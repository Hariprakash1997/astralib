import { TemplateRenderService } from './template-render.service';
import { RedisLock, noopLogger } from '@astralibx/core';
import { isWithinSendWindow, calculateDelay, getHumanDelay } from '../utils/delay';
import type { TelegramRuleModel } from '../schemas/rule.schema';
import type { TelegramTemplateModel } from '../schemas/template.schema';
import type { TelegramSendLogModel } from '../schemas/send-log.schema';
import type { TelegramRunLogModel } from '../schemas/run-log.schema';
import type { TelegramThrottleConfigModel } from '../schemas/throttle-config.schema';
import type { TelegramErrorLogModel } from '../schemas/error-log.schema';
import type { RuleRunStats, PerRuleStats } from '../types/rule.types';
import type { TelegramRuleEngineConfig, LogAdapter, RunStatusResponse } from '../types/config.types';
import {
  DEFAULT_LOCK_TTL_MS,
  DEFAULT_MAX_PER_RUN,
  DEFAULT_DELAY_BETWEEN_SENDS_MS,
  DEFAULT_JITTER_MS,
  DEFAULT_MAX_CONSECUTIVE_FAILURES,
  DEFAULT_THINKING_PAUSE_PROBABILITY,
  DEFAULT_BATCH_PROGRESS_INTERVAL,
  MESSAGE_PREVIEW_LENGTH,
  RUN_PROGRESS_TTL_SECONDS
} from '../constants';
import crypto from 'crypto';
import type { Redis } from 'ioredis';

const MS_PER_DAY = 86400000;

function getLocalDate(date: Date, timezone?: string): Date {
  if (!timezone) return date;
  const parts = new Intl.DateTimeFormat('en-US', {
    timeZone: timezone,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
    hour12: false
  }).formatToParts(date);

  const get = (type: string) => parts.find(p => p.type === type)?.value || '0';
  return new Date(`${get('year')}-${get('month')}-${get('day')}T${get('hour')}:${get('minute')}:${get('second')}`);
}

interface UserThrottle {
  today: number;
  thisWeek: number;
  lastSentDate: Date | null;
}


export class RuleRunnerService {
  private templateRenderer = new TemplateRenderService();
  private lock: RedisLock;
  private logger: LogAdapter;
  private redis: Redis;
  private keyPrefix: string;

  constructor(
    private TelegramRule: TelegramRuleModel,
    private TelegramTemplate: TelegramTemplateModel,
    private TelegramSendLog: TelegramSendLogModel,
    private TelegramRunLog: TelegramRunLogModel,
    private TelegramThrottleConfig: TelegramThrottleConfigModel,
    private TelegramErrorLog: TelegramErrorLogModel,
    private config: TelegramRuleEngineConfig
  ) {
    this.keyPrefix = config.redis.keyPrefix || '';
    this.redis = config.redis.connection;
    const lockTTL = config.options?.lockTTLMs || DEFAULT_LOCK_TTL_MS;
    this.lock = new RedisLock(
      this.redis,
      `${this.keyPrefix}tg-rule-runner:lock`,
      lockTTL,
      config.logger
    );
    this.logger = config.logger || noopLogger;
  }

  trigger(triggeredBy?: string): { runId: string } {
    const runId = crypto.randomUUID();
    this.runAllRules(runId, triggeredBy || 'manual').catch(err => {
      this.logger.error('Background rule run failed', { error: err, runId });
      this.updateRunProgress(runId, { status: 'failed' } as Partial<RunStatusResponse>).catch(() => {});
    });
    return { runId };
  }

  async runAllRules(runId: string, triggeredBy: string = 'system'): Promise<{ runId: string }> {
    if (!runId) runId = crypto.randomUUID();
    const startedAt = new Date().toISOString();

    if (this.config.options?.sendWindow) {
      if (!isWithinSendWindow(this.config.options.sendWindow)) {
        this.logger.info('Outside send window, skipping run', {
          ...this.config.options.sendWindow
        });
        return { runId };
      }
    }

    const lockAcquired = await this.lock.acquire();
    if (!lockAcquired) {
      this.logger.warn('Rule runner already executing, skipping');
      return { runId };
    }

    const runStartTime = Date.now();

    await this.updateRunProgress(runId, {
      runId,
      status: 'running',
      currentRule: '',
      progress: { rulesTotal: 0, rulesCompleted: 0, sent: 0, failed: 0, skipped: 0, throttled: 0 },
      startedAt,
      elapsed: 0
    });

    let runStatus: 'completed' | 'cancelled' | 'failed' = 'completed';

    try {
      const throttleConfig = await this.TelegramThrottleConfig.getConfig();
      const allActiveRules = await this.TelegramRule.findActive();

      const now = new Date();
      const tz = this.config.options?.sendWindow?.timezone;
      const activeRules = allActiveRules.filter(rule => {
        if (rule.validFrom) {
          const localNow = getLocalDate(now, tz);
          const localValidFrom = getLocalDate(new Date(rule.validFrom), tz);
          if (localNow < localValidFrom) return false;
        }
        if (rule.validTill) {
          const localNow = getLocalDate(now, tz);
          const localValidTill = getLocalDate(new Date(rule.validTill), tz);
          if (localNow > localValidTill) return false;
        }
        return true;
      });

      try {
        this.config.hooks?.onRunStart?.({ rulesCount: activeRules.length, triggeredBy, runId });
      } catch { /* hook error safe */ }

      await this.updateRunProgress(runId, {
        progress: { rulesTotal: activeRules.length, rulesCompleted: 0, sent: 0, failed: 0, skipped: 0, throttled: 0 }
      } as Partial<RunStatusResponse>);

      if (activeRules.length === 0) {
        this.logger.info('No active rules to process');
        await this.TelegramRunLog.create({
          runId,
          triggeredBy,
          status: 'completed',
          startedAt: new Date(startedAt),
          completedAt: new Date(),
          stats: { sent: 0, failed: 0, skipped: 0, throttled: 0 }
        });
        await this.updateRunProgress(runId, { status: 'completed', elapsed: Date.now() - runStartTime } as Partial<RunStatusResponse>);
        return { runId };
      }

      const templateIds = [...new Set(activeRules.map(r => r.templateId.toString()))];
      const templates = await this.TelegramTemplate.find({ _id: { $in: templateIds } }).lean();
      const templateMap = new Map<string, any>();
      for (const t of templates) {
        templateMap.set(t._id.toString(), t);
      }

      const recentSends = await this.TelegramSendLog.find({
        sentAt: { $gte: new Date(Date.now() - 7 * MS_PER_DAY) }
      }).lean();

      const throttleMap = this.buildThrottleMap(recentSends);
      const perRuleStats: PerRuleStats[] = [];
      let totalSent = 0;
      let totalFailed = 0;
      let totalSkipped = 0;
      let totalThrottled = 0;

      for (let ri = 0; ri < activeRules.length; ri++) {
        const rule = activeRules[ri];

        const cancelKey = `${this.keyPrefix}run:${runId}:cancel`;
        const cancelled = await this.redis.exists(cancelKey);
        if (cancelled) {
          runStatus = 'cancelled';
          break;
        }

        await this.updateRunProgress(runId, {
          currentRule: rule.name,
          elapsed: Date.now() - runStartTime
        } as Partial<RunStatusResponse>);

        const stats = await this.executeRule(rule, throttleMap, throttleConfig, templateMap, runId);
        totalSent += stats.sent;
        totalFailed += stats.failed;
        totalSkipped += stats.skipped;
        totalThrottled += stats.throttled;

        perRuleStats.push({
          ruleId: rule._id.toString(),
          ruleName: rule.name,
          stats
        });

        await this.updateRunProgress(runId, {
          progress: {
            rulesTotal: activeRules.length,
            rulesCompleted: ri + 1,
            sent: totalSent,
            failed: totalFailed,
            skipped: totalSkipped,
            throttled: totalThrottled
          },
          elapsed: Date.now() - runStartTime
        } as Partial<RunStatusResponse>);
      }

      const totalStats: RuleRunStats = {
        sent: totalSent,
        failed: totalFailed,
        skipped: totalSkipped,
        throttled: totalThrottled
      };

      await this.TelegramRunLog.create({
        runId,
        triggeredBy,
        status: runStatus,
        startedAt: new Date(startedAt),
        completedAt: new Date(),
        stats: totalStats
      });

      await this.updateRunProgress(runId, { status: runStatus, currentRule: '', elapsed: Date.now() - runStartTime } as Partial<RunStatusResponse>);

      try {
        this.config.hooks?.onRunComplete?.({ duration: Date.now() - runStartTime, totalStats, perRuleStats, runId });
      } catch { /* hook error safe */ }

      this.logger.info('Rule run completed', {
        triggeredBy,
        rulesProcessed: activeRules.length,
        totalSent: totalStats.sent,
        totalSkipped: totalStats.skipped,
        duration: Date.now() - runStartTime
      });
    } catch (err) {
      runStatus = 'failed';
      await this.updateRunProgress(runId, { status: 'failed', elapsed: Date.now() - runStartTime } as Partial<RunStatusResponse>);
      throw err;
    } finally {
      await this.lock.release();
    }

    return { runId };
  }

  private async executeRule(
    rule: any,
    throttleMap: Map<string, UserThrottle>,
    throttleConfig: any,
    templateMap: Map<string, any>,
    runId: string
  ): Promise<RuleRunStats> {
    const stats: RuleRunStats = { sent: 0, failed: 0, skipped: 0, throttled: 0 };

    const template = templateMap.get(rule.templateId.toString());
    if (!template) {
      this.logger.error(`Rule "${rule.name}": template ${rule.templateId} not found`);
      stats.failed = 1;
      return stats;
    }

    const ruleId = rule._id.toString();
    const templateId = rule.templateId.toString();

    const isListMode = rule.target?.mode === 'list';

    if (isListMode) {
      return this.executeListMode(rule, template, throttleMap, throttleConfig, stats, runId);
    }

    return this.executeQueryMode(rule, template, throttleMap, throttleConfig, stats, runId);
  }

  private async executeQueryMode(
    rule: any,
    template: any,
    throttleMap: Map<string, UserThrottle>,
    throttleConfig: any,
    stats: RuleRunStats,
    runId: string
  ): Promise<RuleRunStats> {
    const maxPerRun = rule.maxPerRun || this.config.options?.defaultMaxPerRun || DEFAULT_MAX_PER_RUN;
    const ruleId = rule._id.toString();
    const templateId = rule.templateId.toString();

    let users: Record<string, unknown>[];
    try {
      users = await this.config.adapters.queryUsers(rule.target, maxPerRun);
    } catch (err) {
      this.logger.error(`Rule "${rule.name}": query failed`, { error: err });
      stats.failed = 1;
      return stats;
    }

    if (users.length > maxPerRun) {
      this.logger.warn(`Rule "${rule.name}" matched ${users.length} users but maxPerRun is ${maxPerRun}`, {
        ruleId, matchedCount: users.length, maxPerRun
      });
    }

    const usersToProcess = users.slice(0, maxPerRun);

    try {
      this.config.hooks?.onRuleStart?.({ ruleId, ruleName: rule.name, matchedCount: usersToProcess.length, templateId, runId });
    } catch { /* hook error safe */ }

    if (usersToProcess.length === 0) return stats;

    const compiled = this.templateRenderer.compile(template.messages);
    const batchProgressInterval = this.config.options?.batchProgressInterval || DEFAULT_BATCH_PROGRESS_INTERVAL;
    let consecutiveFailures = 0;
    const maxConsecutiveFailures = this.config.options?.maxConsecutiveFailures || DEFAULT_MAX_CONSECUTIVE_FAILURES;
    let totalProcessed = 0;

    for (let i = 0; i < usersToProcess.length; i++) {
      const user = usersToProcess[i];

      if (i % batchProgressInterval === 0) {
        const cancelKey = `${this.keyPrefix}run:${runId}:cancel`;
        const cancelled = await this.redis.exists(cancelKey);
        if (cancelled) break;
      }

      try {
        const userId = (user._id as any)?.toString();
        const userIdentifier = (user.phone as string) || (user.username as string) || '';
        if (!userId || !userIdentifier) {
          stats.skipped++;
          try {
            this.config.hooks?.onSend?.({ ruleId, ruleName: rule.name, identifierId: userIdentifier || 'unknown', status: 'skipped', accountId: '', templateId, runId, messageIndex: -1, failureReason: 'invalid identifier' });
          } catch { /* hook error safe */ }
          continue;
        }

        const identifier = await this.config.adapters.findIdentifier(userIdentifier);
        if (!identifier) {
          stats.skipped++;
          try {
            this.config.hooks?.onSend?.({ ruleId, ruleName: rule.name, identifierId: userIdentifier, status: 'skipped', accountId: '', templateId, runId, messageIndex: -1, failureReason: 'identifier not found' });
          } catch { /* hook error safe */ }
          continue;
        }

        if (!this.checkThrottle(identifier.id, ruleId, throttleMap, throttleConfig, stats, rule.name, templateId, runId)) continue;

        if (rule.sendOnce) {
          const existingSend = await this.TelegramSendLog.findOne({
            ruleId: rule._id,
            identifierId: identifier.id,
            deliveryStatus: { $in: ['sent', 'delivered', 'read'] },
          });
          if (existingSend) {
            stats.skipped++;
            continue;
          }
        }

        const accountSelection = await this.config.adapters.selectAccount(identifier.id, { ruleId, templateId });
        if (!accountSelection) {
          stats.skipped++;
          try {
            this.config.hooks?.onSend?.({ ruleId, ruleName: rule.name, identifierId: identifier.id, status: 'skipped', accountId: '', templateId, runId, messageIndex: -1, failureReason: 'no account available' });
          } catch { /* hook error safe */ }
          continue;
        }

        const resolvedData = this.config.adapters.resolveData(user);
        const templateData = { ...(template.fields || {}), ...resolvedData };

        const mi = Math.floor(Math.random() * template.messages.length);
        const renderedMessage = compiled.messageFns[mi](templateData);

        let finalMessage = renderedMessage;
        let finalMedia = template.media;

        if (this.config.hooks?.beforeSend) {
          try {
            const modified = await this.config.hooks.beforeSend({
              message: finalMessage,
              account: {
                id: accountSelection.accountId,
                phone: accountSelection.phone,
                metadata: accountSelection.metadata,
              },
              user: {
                id: identifier.id,
                contactId: identifier.contactId,
                name: String((user as any).name || (user as any).firstName || ''),
              },
              context: { ruleId, templateId, runId },
              media: finalMedia,
            });
            finalMessage = modified.message;
            finalMedia = modified.media;
          } catch (hookErr: any) {
            this.logger.error(`beforeSend hook failed for identifier ${identifier.id}: ${hookErr.message}`);
            stats.failed++;
            try {
              this.config.hooks?.onSend?.({ ruleId, ruleName: rule.name, identifierId: identifier.id, status: 'error', accountId: accountSelection.accountId, templateId, runId, messageIndex: mi, failureReason: hookErr.message });
            } catch { /* hook error safe */ }
            continue;
          }
        }

        try {
          await this.config.adapters.sendMessage({
            identifierId: identifier.id,
            contactId: identifier.contactId,
            accountId: accountSelection.accountId,
            message: finalMessage,
            media: finalMedia,
            ruleId,
            templateId,
          });

          await this.TelegramSendLog.create({
            identifierId: identifier.id,
            contactId: identifier.contactId,
            accountId: accountSelection.accountId,
            ruleId: rule._id,
            runId,
            templateId: rule.templateId,
            messagePreview: finalMessage.substring(0, MESSAGE_PREVIEW_LENGTH),
            messageIndex: mi,
            deliveryStatus: 'sent',
            sentAt: new Date(),
          });

          const current = throttleMap.get(identifier.id) || { today: 0, thisWeek: 0, lastSentDate: null };
          throttleMap.set(identifier.id, {
            today: current.today + 1,
            thisWeek: current.thisWeek + 1,
            lastSentDate: new Date()
          });

          stats.sent++;
          consecutiveFailures = 0;
          try {
            this.config.hooks?.onSend?.({ ruleId, ruleName: rule.name, identifierId: identifier.id, status: 'sent', accountId: accountSelection.accountId, templateId, runId, messageIndex: mi });
          } catch { /* hook error safe */ }
        } catch (sendErr: any) {
          consecutiveFailures++;
          stats.failed++;

          await this.TelegramSendLog.create({
            identifierId: identifier.id,
            contactId: identifier.contactId,
            accountId: accountSelection.accountId,
            ruleId: rule._id,
            runId,
            templateId: rule.templateId,
            messagePreview: finalMessage.substring(0, MESSAGE_PREVIEW_LENGTH),
            messageIndex: mi,
            deliveryStatus: 'failed',
            sentAt: new Date(),
            errorInfo: {
              code: sendErr.code || 'UNKNOWN',
              category: this.categorizeError(sendErr),
              message: sendErr.message || 'Unknown error',
              retryable: this.isRetryableError(sendErr),
            },
          });

          try {
            await this.TelegramErrorLog.create({
              accountId: accountSelection.accountId,
              contactId: identifier.contactId,
              errorCode: sendErr.code || 'UNKNOWN',
              errorCategory: this.categorizeError(sendErr),
              errorMessage: sendErr.message,
              operation: 'send',
            });
          } catch { /* log error safe */ }

          try {
            this.config.hooks?.onSend?.({ ruleId, ruleName: rule.name, identifierId: identifier.id, status: 'error', accountId: accountSelection.accountId, templateId, runId, messageIndex: mi, failureReason: sendErr.message });
          } catch { /* hook error safe */ }

          this.logger.error(`Rule "${rule.name}" send failed for ${identifier.id}`, { error: sendErr });

          if (consecutiveFailures >= maxConsecutiveFailures) {
            this.logger.warn(`Rule "${rule.name}" stopped — ${consecutiveFailures} consecutive failures`);
            break;
          }
        }

        totalProcessed++;
        if (totalProcessed % batchProgressInterval === 0) {
          await this.updateRunSendProgress(runId, stats);
        }

        if (i < usersToProcess.length - 1) {
          const delayMs = this.config.options?.delayBetweenSendsMs ?? DEFAULT_DELAY_BETWEEN_SENDS_MS;
          const jitterMs = this.config.options?.jitterMs ?? DEFAULT_JITTER_MS;
          const thinkingPause = this.config.options?.thinkingPauseProbability ?? DEFAULT_THINKING_PAUSE_PROBABILITY;
          const totalDelay = getHumanDelay(delayMs, jitterMs, thinkingPause);
          if (totalDelay > 0) await new Promise(resolve => setTimeout(resolve, totalDelay));
        }
      } catch (err) {
        stats.failed++;
        try {
          this.config.hooks?.onSend?.({ ruleId, ruleName: rule.name, identifierId: 'unknown', status: 'error', accountId: '', templateId, runId, messageIndex: -1, failureReason: (err as Error).message || 'unknown error' });
        } catch { /* hook error safe */ }
        this.logger.error(`Rule "${rule.name}" unexpected error`, { error: err });
      }
    }

    try {
      this.config.hooks?.onRuleComplete?.({ ruleId, ruleName: rule.name, stats, templateId, runId });
    } catch { /* hook error safe */ }

    return stats;
  }

  private async executeListMode(
    rule: any,
    template: any,
    throttleMap: Map<string, UserThrottle>,
    throttleConfig: any,
    stats: RuleRunStats,
    runId: string
  ): Promise<RuleRunStats> {
    const rawIdentifiers: string[] = rule.target.identifiers || [];
    const uniqueIdentifiers = [...new Set(rawIdentifiers.map((id: string) => id.trim()).filter(Boolean))];

    const maxPerRun = rule.maxPerRun || this.config.options?.defaultMaxPerRun || DEFAULT_MAX_PER_RUN;
    if (uniqueIdentifiers.length > maxPerRun) {
      this.logger.warn(`Rule "${rule.name}" has ${uniqueIdentifiers.length} identifiers but maxPerRun is ${maxPerRun}`, {
        ruleId: rule._id.toString(), count: uniqueIdentifiers.length, maxPerRun
      });
    }

    const identifiersToProcess = uniqueIdentifiers.slice(0, maxPerRun);
    const ruleId = rule._id.toString();
    const templateId = rule.templateId.toString();

    try {
      this.config.hooks?.onRuleStart?.({ ruleId, ruleName: rule.name, matchedCount: identifiersToProcess.length, templateId, runId });
    } catch { /* hook error safe */ }

    if (identifiersToProcess.length === 0) return stats;

    // Resolve identifiers and dedup by id
    const resolvedMap = new Map<string, { id: string; contactId: string; raw: string }>();
    for (const raw of identifiersToProcess) {
      const result = await this.config.adapters.findIdentifier(raw);
      if (result && !resolvedMap.has(result.id)) {
        resolvedMap.set(result.id, { ...result, raw });
      } else if (!result) {
        stats.skipped++;
        try {
          this.config.hooks?.onSend?.({ ruleId, ruleName: rule.name, identifierId: raw, status: 'skipped', accountId: '', templateId, runId, messageIndex: -1, failureReason: 'identifier not found' });
        } catch { /* hook error safe */ }
      }
    }

    const resolvedIdentifiers = Array.from(resolvedMap.values());
    const compiled = this.templateRenderer.compile(template.messages);
    const batchProgressInterval = this.config.options?.batchProgressInterval || DEFAULT_BATCH_PROGRESS_INTERVAL;
    let consecutiveFailures = 0;
    const maxConsecutiveFailures = this.config.options?.maxConsecutiveFailures || DEFAULT_MAX_CONSECUTIVE_FAILURES;
    let totalProcessed = 0;

    for (let i = 0; i < resolvedIdentifiers.length; i++) {
      const identifier = resolvedIdentifiers[i];

      if (i % batchProgressInterval === 0) {
        const cancelKey = `${this.keyPrefix}run:${runId}:cancel`;
        const cancelled = await this.redis.exists(cancelKey);
        if (cancelled) break;
      }

      try {
        if (!this.checkThrottle(identifier.id, ruleId, throttleMap, throttleConfig, stats, rule.name, templateId, runId)) continue;

        if (rule.sendOnce) {
          const existingSend = await this.TelegramSendLog.findOne({
            ruleId: rule._id,
            identifierId: identifier.id,
            deliveryStatus: { $in: ['sent', 'delivered', 'read'] },
          });
          if (existingSend) {
            stats.skipped++;
            continue;
          }
        }

        const accountSelection = await this.config.adapters.selectAccount(identifier.id, { ruleId, templateId });
        if (!accountSelection) {
          stats.skipped++;
          try {
            this.config.hooks?.onSend?.({ ruleId, ruleName: rule.name, identifierId: identifier.id, status: 'skipped', accountId: '', templateId, runId, messageIndex: -1, failureReason: 'no account available' });
          } catch { /* hook error safe */ }
          continue;
        }

        const user = { _id: identifier.id, phone: identifier.raw };
        const resolvedData = this.config.adapters.resolveData(user);
        const templateData = { ...(template.fields || {}), ...resolvedData };

        const mi = Math.floor(Math.random() * template.messages.length);
        const renderedMessage = compiled.messageFns[mi](templateData);

        let finalMessage = renderedMessage;
        let finalMedia = template.media;

        if (this.config.hooks?.beforeSend) {
          try {
            const modified = await this.config.hooks.beforeSend({
              message: finalMessage,
              account: {
                id: accountSelection.accountId,
                phone: accountSelection.phone,
                metadata: accountSelection.metadata,
              },
              user: {
                id: identifier.id,
                contactId: identifier.contactId,
                name: '',
              },
              context: { ruleId, templateId, runId },
              media: finalMedia,
            });
            finalMessage = modified.message;
            finalMedia = modified.media;
          } catch (hookErr: any) {
            this.logger.error(`beforeSend hook failed for identifier ${identifier.id}: ${hookErr.message}`);
            stats.failed++;
            try {
              this.config.hooks?.onSend?.({ ruleId, ruleName: rule.name, identifierId: identifier.id, status: 'error', accountId: accountSelection.accountId, templateId, runId, messageIndex: mi, failureReason: hookErr.message });
            } catch { /* hook error safe */ }
            continue;
          }
        }

        try {
          await this.config.adapters.sendMessage({
            identifierId: identifier.id,
            contactId: identifier.contactId,
            accountId: accountSelection.accountId,
            message: finalMessage,
            media: finalMedia,
            ruleId,
            templateId,
          });

          await this.TelegramSendLog.create({
            identifierId: identifier.id,
            contactId: identifier.contactId,
            accountId: accountSelection.accountId,
            ruleId: rule._id,
            runId,
            templateId: rule.templateId,
            messagePreview: finalMessage.substring(0, MESSAGE_PREVIEW_LENGTH),
            messageIndex: mi,
            deliveryStatus: 'sent',
            sentAt: new Date(),
          });

          const current = throttleMap.get(identifier.id) || { today: 0, thisWeek: 0, lastSentDate: null };
          throttleMap.set(identifier.id, {
            today: current.today + 1,
            thisWeek: current.thisWeek + 1,
            lastSentDate: new Date()
          });

          stats.sent++;
          consecutiveFailures = 0;
          try {
            this.config.hooks?.onSend?.({ ruleId, ruleName: rule.name, identifierId: identifier.id, status: 'sent', accountId: accountSelection.accountId, templateId, runId, messageIndex: mi });
          } catch { /* hook error safe */ }
        } catch (sendErr: any) {
          consecutiveFailures++;
          stats.failed++;

          await this.TelegramSendLog.create({
            identifierId: identifier.id,
            contactId: identifier.contactId,
            accountId: accountSelection.accountId,
            ruleId: rule._id,
            runId,
            templateId: rule.templateId,
            messagePreview: finalMessage.substring(0, MESSAGE_PREVIEW_LENGTH),
            messageIndex: mi,
            deliveryStatus: 'failed',
            sentAt: new Date(),
            errorInfo: {
              code: sendErr.code || 'UNKNOWN',
              category: this.categorizeError(sendErr),
              message: sendErr.message || 'Unknown error',
              retryable: this.isRetryableError(sendErr),
            },
          });

          try {
            await this.TelegramErrorLog.create({
              accountId: accountSelection.accountId,
              contactId: identifier.contactId,
              errorCode: sendErr.code || 'UNKNOWN',
              errorCategory: this.categorizeError(sendErr),
              errorMessage: sendErr.message,
              operation: 'send',
            });
          } catch { /* log error safe */ }

          try {
            this.config.hooks?.onSend?.({ ruleId, ruleName: rule.name, identifierId: identifier.id, status: 'error', accountId: accountSelection.accountId, templateId, runId, messageIndex: mi, failureReason: sendErr.message });
          } catch { /* hook error safe */ }

          this.logger.error(`Rule "${rule.name}" send failed for ${identifier.id}`, { error: sendErr });

          if (consecutiveFailures >= maxConsecutiveFailures) {
            this.logger.warn(`Rule "${rule.name}" stopped — ${consecutiveFailures} consecutive failures`);
            break;
          }
        }

        totalProcessed++;
        if (totalProcessed % batchProgressInterval === 0) {
          await this.updateRunSendProgress(runId, stats);
        }

        if (i < resolvedIdentifiers.length - 1) {
          const delayMs = this.config.options?.delayBetweenSendsMs ?? DEFAULT_DELAY_BETWEEN_SENDS_MS;
          const jitterMs = this.config.options?.jitterMs ?? DEFAULT_JITTER_MS;
          const thinkingPause = this.config.options?.thinkingPauseProbability ?? DEFAULT_THINKING_PAUSE_PROBABILITY;
          const totalDelay = getHumanDelay(delayMs, jitterMs, thinkingPause);
          if (totalDelay > 0) await new Promise(resolve => setTimeout(resolve, totalDelay));
        }
      } catch (err) {
        stats.failed++;
        try {
          this.config.hooks?.onSend?.({ ruleId, ruleName: rule.name, identifierId: identifier.id, status: 'error', accountId: '', templateId, runId, messageIndex: -1, failureReason: (err as Error).message || 'unknown error' });
        } catch { /* hook error safe */ }
        this.logger.error(`Rule "${rule.name}" unexpected error for ${identifier.id}`, { error: err });
      }
    }

    try {
      this.config.hooks?.onRuleComplete?.({ ruleId, ruleName: rule.name, stats, templateId, runId });
    } catch { /* hook error safe */ }

    return stats;
  }

  private checkThrottle(
    identifierId: string,
    ruleId: string,
    throttleMap: Map<string, UserThrottle>,
    config: any,
    stats: RuleRunStats,
    ruleName: string,
    templateId: string,
    runId: string
  ): boolean {
    const dailyLimit = config.maxPerUserPerDay;
    const weeklyLimit = config.maxPerUserPerWeek;
    const minGap = config.minGapDays;

    const userThrottle = throttleMap.get(identifierId) || { today: 0, thisWeek: 0, lastSentDate: null };

    if (userThrottle.today >= dailyLimit) {
      stats.throttled++;
      try {
        this.config.hooks?.onSend?.({ ruleId, ruleName, identifierId, status: 'throttled', accountId: '', templateId, runId, messageIndex: -1, failureReason: 'daily throttle limit' });
      } catch { /* hook error safe */ }
      return false;
    }
    if (userThrottle.thisWeek >= weeklyLimit) {
      stats.throttled++;
      try {
        this.config.hooks?.onSend?.({ ruleId, ruleName, identifierId, status: 'throttled', accountId: '', templateId, runId, messageIndex: -1, failureReason: 'weekly throttle limit' });
      } catch { /* hook error safe */ }
      return false;
    }
    if (userThrottle.lastSentDate) {
      const daysSinceLastSend = (Date.now() - userThrottle.lastSentDate.getTime()) / MS_PER_DAY;
      if (daysSinceLastSend < minGap) {
        stats.throttled++;
        try {
          this.config.hooks?.onSend?.({ ruleId, ruleName, identifierId, status: 'throttled', accountId: '', templateId, runId, messageIndex: -1, failureReason: 'min gap days' });
        } catch { /* hook error safe */ }
        return false;
      }
    }

    return true;
  }

  async getStatus(runId: string): Promise<RunStatusResponse | null> {
    const key = `${this.keyPrefix}run:${runId}:progress`;
    const data = await this.redis.hgetall(key);
    if (!data || Object.keys(data).length === 0) return null;

    let progress = { rulesTotal: 0, rulesCompleted: 0, sent: 0, failed: 0, skipped: 0, throttled: 0 };
    if (data.progress) {
      try { progress = JSON.parse(data.progress); } catch { /* use default */ }
    }

    return {
      runId: data.runId || runId,
      status: (data.status as RunStatusResponse['status']) || 'running',
      currentRule: data.currentRule || '',
      progress,
      startedAt: data.startedAt || '',
      elapsed: parseInt(data.elapsed || '0', 10)
    };
  }

  async cancel(runId: string): Promise<{ ok: boolean }> {
    const progressKey = `${this.keyPrefix}run:${runId}:progress`;
    const exists = await this.redis.exists(progressKey);
    if (!exists) return { ok: false };

    const cancelKey = `${this.keyPrefix}run:${runId}:cancel`;
    await this.redis.set(cancelKey, '1', 'EX', 3600);
    return { ok: true };
  }

  private async updateRunProgress(runId: string, data: Partial<RunStatusResponse>): Promise<void> {
    const key = `${this.keyPrefix}run:${runId}:progress`;
    const flat: string[] = [];
    for (const [k, v] of Object.entries(data)) {
      if (typeof v === 'object' && v !== null) {
        flat.push(k, JSON.stringify(v));
      } else {
        flat.push(k, String(v));
      }
    }
    if (flat.length > 0) {
      await this.redis.hset(key, ...flat);
      await this.redis.expire(key, RUN_PROGRESS_TTL_SECONDS);
    }
  }

  private async updateRunSendProgress(runId: string, stats: RuleRunStats): Promise<void> {
    const key = `${this.keyPrefix}run:${runId}:progress`;
    const existing = await this.redis.hget(key, 'progress');
    let progress = { rulesTotal: 0, rulesCompleted: 0, sent: 0, failed: 0, skipped: 0, throttled: 0 };
    if (existing) {
      try { progress = JSON.parse(existing); } catch { /* use default */ }
    }
    progress.sent = stats.sent;
    progress.failed = stats.failed;
    progress.skipped = stats.skipped;
    progress.throttled = stats.throttled;
    await this.redis.hset(key, 'progress', JSON.stringify(progress));
    await this.redis.expire(key, RUN_PROGRESS_TTL_SECONDS);
  }

  buildThrottleMap(recentSends: any[]): Map<string, UserThrottle> {
    const map = new Map<string, UserThrottle>();
    const todayStart = this.getTodayStart();

    for (const send of recentSends) {
      const key = send.identifierId;
      if (!key) continue;
      const current = map.get(key) || { today: 0, thisWeek: 0, lastSentDate: null };
      const sentAt = new Date(send.sentAt);

      current.thisWeek++;
      if (sentAt >= todayStart) {
        current.today++;
      }
      if (!current.lastSentDate || sentAt > current.lastSentDate) {
        current.lastSentDate = sentAt;
      }

      map.set(key, current);
    }

    return map;
  }

  private getTodayStart(): Date {
    const timezone = this.config.options?.sendWindow?.timezone;
    if (timezone) {
      const now = new Date();
      const parts = new Intl.DateTimeFormat('en-US', {
        timeZone: timezone,
        year: 'numeric',
        month: '2-digit',
        day: '2-digit',
        hour: '2-digit',
        minute: '2-digit',
        second: '2-digit',
        hour12: false
      }).formatToParts(now);
      const get = (type: string) => parts.find(p => p.type === type)?.value || '0';
      const tzNowMs = Date.UTC(
        parseInt(get('year')),
        parseInt(get('month')) - 1,
        parseInt(get('day')),
        parseInt(get('hour')),
        parseInt(get('minute')),
        parseInt(get('second'))
      );
      const tzMidnightMs = Date.UTC(
        parseInt(get('year')),
        parseInt(get('month')) - 1,
        parseInt(get('day'))
      );
      const offsetMs = now.getTime() - tzNowMs;
      return new Date(tzMidnightMs + offsetMs);
    }
    const todayStart = new Date();
    todayStart.setHours(0, 0, 0, 0);
    return todayStart;
  }

  private categorizeError(err: any): string {
    const code = (err.code || err.errorMessage || '').toUpperCase();

    if (['AUTH_KEY_UNREGISTERED', 'SESSION_REVOKED', 'USER_DEACTIVATED_BAN', 'PHONE_NUMBER_BANNED'].some(c => code.includes(c))) {
      return 'critical';
    }
    if (['FLOOD_WAIT', 'PEER_FLOOD', 'USER_RESTRICTED', 'SLOWMODE_WAIT'].some(c => code.includes(c))) {
      return 'account';
    }
    if (['TIMEOUT', 'NETWORK_ERROR', 'RPC_TIMEOUT', 'CONNECTION_ERROR', 'RPC_CALL_FAIL'].some(c => code.includes(c))) {
      return 'recoverable';
    }
    if (['USER_NOT_FOUND', 'USER_PRIVACY_RESTRICTED', 'USER_IS_BLOCKED', 'PEER_ID_INVALID', 'CHAT_WRITE_FORBIDDEN'].some(c => code.includes(c))) {
      return 'skip';
    }

    return 'unknown';
  }

  private isRetryableError(err: any): boolean {
    const category = this.categorizeError(err);
    return category === 'recoverable';
  }
}
