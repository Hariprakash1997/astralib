import { TemplateRenderService } from './template-render.service';
import { RedisLock } from '../utils/redis-lock';
import type { EmailRuleModel } from '../schemas/rule.schema';
import type { EmailTemplateModel } from '../schemas/template.schema';
import type { EmailRuleSendModel } from '../schemas/rule-send.schema';
import type { EmailRuleRunLogModel } from '../schemas/run-log.schema';
import type { EmailThrottleConfigModel } from '../schemas/throttle-config.schema';
import { RUN_TRIGGER, EMAIL_TYPE } from '../constants';
import type { RunTrigger } from '../constants';
import type { RuleRunStats, PerRuleStats } from '../types/rule.types';
import crypto from 'crypto';
import type { Redis } from 'ioredis';
import type { EmailRuleEngineConfig, LogAdapter, RunStatusResponse } from '../types/config.types';

const MS_PER_DAY = 86400000;
const DEFAULT_LOCK_TTL_MS = 30 * 60 * 1000;
const IDENTIFIER_CHUNK_SIZE = 50;

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

async function processInChunks<T, R>(items: T[], fn: (item: T) => Promise<R>, chunkSize: number): Promise<R[]> {
  const results: R[] = [];
  for (let i = 0; i < items.length; i += chunkSize) {
    const chunk = items.slice(i, i + chunkSize);
    const chunkResults = await Promise.all(chunk.map(fn));
    results.push(...chunkResults);
  }
  return results;
}

interface UserThrottle {
  today: number;
  thisWeek: number;
  lastSentDate: Date | null;
}

const defaultLogger: LogAdapter = {
  info: () => {},
  warn: () => {},
  error: () => {}
};

export class RuleRunnerService {
  private templateRenderer = new TemplateRenderService();
  private lock: RedisLock;
  private logger: LogAdapter;
  private redis: Redis;
  private keyPrefix: string;

  constructor(
    private EmailRule: EmailRuleModel,
    private EmailTemplate: EmailTemplateModel,
    private EmailRuleSend: EmailRuleSendModel,
    private EmailRuleRunLog: EmailRuleRunLogModel,
    private EmailThrottleConfig: EmailThrottleConfigModel,
    private config: EmailRuleEngineConfig
  ) {
    this.keyPrefix = config.redis.keyPrefix || '';
    this.redis = config.redis.connection;
    const lockTTL = config.options?.lockTTLMs || DEFAULT_LOCK_TTL_MS;
    this.lock = new RedisLock(
      this.redis,
      `${this.keyPrefix}email-rule-runner:lock`,
      lockTTL,
      config.logger
    );
    this.logger = config.logger || defaultLogger;
  }

  async runAllRules(triggeredBy: RunTrigger = RUN_TRIGGER.Cron, runId?: string): Promise<{ runId: string }> {
    if (!runId) runId = crypto.randomUUID();
    const startedAt = new Date().toISOString();

    if (this.config.options?.sendWindow) {
      const { startHour, endHour, timezone } = this.config.options.sendWindow;
      const now = new Date();
      const formatter = new Intl.DateTimeFormat('en-US', { hour: 'numeric', hour12: false, timeZone: timezone });
      const currentHour = parseInt(formatter.format(now), 10);
      if (currentHour < startHour || currentHour >= endHour) {
        this.logger.info('Outside send window, skipping run', { currentHour, startHour, endHour, timezone });
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
      progress: { rulesTotal: 0, rulesCompleted: 0, sent: 0, failed: 0, skipped: 0, invalid: 0 },
      startedAt,
      elapsed: 0
    });

    let runStatus: 'completed' | 'cancelled' | 'failed' = 'completed';

    try {
      const throttleConfig = await this.EmailThrottleConfig.getConfig();
      const allActiveRules = await this.EmailRule.findActive();

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

      this.config.hooks?.onRunStart?.({ rulesCount: activeRules.length, triggeredBy, runId });

      await this.updateRunProgress(runId, {
        progress: { rulesTotal: activeRules.length, rulesCompleted: 0, sent: 0, failed: 0, skipped: 0, invalid: 0 }
      } as Partial<RunStatusResponse>);

      if (activeRules.length === 0) {
        this.logger.info('No active rules to process');
        await this.EmailRuleRunLog.create({
          runId,
          runAt: new Date(),
          triggeredBy,
          duration: Date.now() - runStartTime,
          rulesProcessed: 0,
          totalStats: { matched: 0, sent: 0, skipped: 0, skippedByThrottle: 0, errorCount: 0 },
          perRuleStats: [],
          status: 'completed'
        });
        await this.updateRunProgress(runId, { status: 'completed', elapsed: Date.now() - runStartTime } as Partial<RunStatusResponse>);
        return { runId };
      }

      const templateIds = [...new Set(activeRules.map(r => r.templateId.toString()))];
      const templates = await this.EmailTemplate.find({ _id: { $in: templateIds } }).lean();
      const templateMap = new Map<string, any>();
      for (const t of templates) {
        templateMap.set(t._id.toString(), t);
      }

      const recentSends = await this.EmailRuleSend.find({
        sentAt: { $gte: new Date(Date.now() - 7 * MS_PER_DAY) }
      }).lean();

      const throttleMap = this.buildThrottleMap(recentSends);
      const perRuleStats: PerRuleStats[] = [];
      let totalSent = 0;
      let totalFailed = 0;
      let totalSkipped = 0;
      let totalInvalid = 0;

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
        totalFailed += stats.errorCount;
        totalSkipped += stats.skipped + stats.skippedByThrottle;
        totalInvalid += stats.matched - stats.sent - stats.skipped - stats.skippedByThrottle - stats.errorCount;

        perRuleStats.push({
          ruleId: rule._id.toString(),
          ruleName: rule.name,
          ...stats
        });

        await this.updateRunProgress(runId, {
          progress: {
            rulesTotal: activeRules.length,
            rulesCompleted: ri + 1,
            sent: totalSent,
            failed: totalFailed,
            skipped: totalSkipped,
            invalid: totalInvalid < 0 ? 0 : totalInvalid
          },
          elapsed: Date.now() - runStartTime
        } as Partial<RunStatusResponse>);
      }

      const totalStats = perRuleStats.reduce(
        (acc, s) => ({
          matched: acc.matched + s.matched,
          sent: acc.sent + s.sent,
          skipped: acc.skipped + s.skipped,
          skippedByThrottle: acc.skippedByThrottle + s.skippedByThrottle,
          errorCount: acc.errorCount + s.errorCount,
        }),
        { matched: 0, sent: 0, skipped: 0, skippedByThrottle: 0, errorCount: 0 }
      );

      await this.EmailRuleRunLog.create({
        runId,
        runAt: new Date(),
        triggeredBy,
        duration: Date.now() - runStartTime,
        rulesProcessed: activeRules.length,
        totalStats,
        perRuleStats,
        status: runStatus
      });

      await this.updateRunProgress(runId, { status: runStatus, currentRule: '', elapsed: Date.now() - runStartTime } as Partial<RunStatusResponse>);

      this.config.hooks?.onRunComplete?.({ duration: Date.now() - runStartTime, totalStats, perRuleStats, runId });

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

  async executeRule(
    rule: any,
    throttleMap: Map<string, UserThrottle>,
    throttleConfig: any,
    templateMap?: Map<string, any>,
    runId?: string
  ): Promise<RuleRunStats> {
    const stats: RuleRunStats = { matched: 0, sent: 0, skipped: 0, skippedByThrottle: 0, errorCount: 0 };

    const template = templateMap?.get(rule.templateId.toString()) ?? await this.EmailTemplate.findById(rule.templateId);
    if (!template) {
      this.logger.error(`Rule "${rule.name}": template ${rule.templateId} not found`);
      stats.errorCount = 1;
      return stats;
    }

    const isListMode = rule.target?.mode === 'list';

    if (isListMode) {
      return this.executeListMode(rule, template, throttleMap, throttleConfig, stats, runId);
    }

    return this.executeQueryMode(rule, template, throttleMap, throttleConfig, stats, runId);
  }

  private async executeListMode(
    rule: any,
    template: any,
    throttleMap: Map<string, UserThrottle>,
    throttleConfig: any,
    stats: RuleRunStats,
    runId?: string
  ): Promise<RuleRunStats> {
    const rawIdentifiers: string[] = rule.target.identifiers || [];
    const uniqueEmails = [...new Set(rawIdentifiers.map((e: string) => e.toLowerCase().trim()).filter(Boolean))];

    const limit = rule.maxPerRun || this.config.options?.defaultMaxPerRun || 500;
    const emailsToProcess = uniqueEmails.slice(0, limit);

    stats.matched = emailsToProcess.length;
    const ruleId = rule._id.toString();
    const templateId = rule.templateId.toString();

    this.config.hooks?.onRuleStart?.({ ruleId, ruleName: rule.name, matchedCount: emailsToProcess.length, templateId, runId: runId || '' });
    if (emailsToProcess.length === 0) return stats;

    const identifierResults = await processInChunks(
      emailsToProcess,
      async email => {
        const result = await this.config.adapters.findIdentifier(email);
        return result ? { email, ...result } : null;
      },
      IDENTIFIER_CHUNK_SIZE
    );

    const identifierMap = new Map<string, { id: string; contactId: string }>();
    for (const result of identifierResults) {
      if (result) {
        identifierMap.set(result.email, { id: result.id, contactId: result.contactId });
      }
    }

    const validEmails = emailsToProcess.filter(e => identifierMap.has(e));
    const identifierIds = validEmails.map(e => identifierMap.get(e)!.id);

    const allRuleSends = await this.EmailRuleSend.find({ ruleId: rule._id, userId: { $in: identifierIds } })
      .sort({ sentAt: -1 })
      .lean();

    const sendMap = new Map<string, any>();
    for (const send of allRuleSends) {
      const uid = send.userId.toString();
      if (!sendMap.has(uid)) {
        sendMap.set(uid, send);
      }
    }

    const preheaders: string[] = template.preheaders || [];
    const compiledVariants = this.templateRenderer.compileBatchVariants(
      template.subjects,
      template.bodies,
      template.textBody,
      preheaders
    );

    let totalProcessed = 0;

    for (let i = 0; i < emailsToProcess.length; i++) {
      const email = emailsToProcess[i];

      if (runId && i % 10 === 0) {
        const cancelKey = `${this.keyPrefix}run:${runId}:cancel`;
        const cancelled = await this.redis.exists(cancelKey);
        if (cancelled) break;
      }

      try {
        const identifier = identifierMap.get(email);
        if (!identifier) {
          stats.skipped++;
          this.config.hooks?.onSend?.({ ruleId, ruleName: rule.name, email, status: 'invalid', accountId: '', templateId, runId: runId || '', subjectIndex: -1, bodyIndex: -1, failureReason: 'invalid email' });
          continue;
        }

        const dedupKey = identifier.id;

        const lastSend = sendMap.get(dedupKey);
        if (lastSend) {
          if (rule.sendOnce && !rule.resendAfterDays) {
            stats.skipped++;
            this.config.hooks?.onSend?.({ ruleId, ruleName: rule.name, email, status: 'skipped', accountId: '', templateId, runId: runId || '', subjectIndex: -1, bodyIndex: -1, failureReason: 'send once' });
            continue;
          }
          if (rule.resendAfterDays) {
            const daysSince = (Date.now() - new Date(lastSend.sentAt).getTime()) / MS_PER_DAY;
            if (daysSince < rule.resendAfterDays) {
              stats.skipped++;
              this.config.hooks?.onSend?.({ ruleId, ruleName: rule.name, email, status: 'skipped', accountId: '', templateId, runId: runId || '', subjectIndex: -1, bodyIndex: -1, failureReason: 'resend too soon' });
              continue;
            }
          } else {
            stats.skipped++;
            this.config.hooks?.onSend?.({ ruleId, ruleName: rule.name, email, status: 'skipped', accountId: '', templateId, runId: runId || '', subjectIndex: -1, bodyIndex: -1, failureReason: 'send once' });
            continue;
          }
        }

        if (!this.checkThrottle(rule, dedupKey, email, throttleMap, throttleConfig, stats, templateId, runId)) continue;

        const agentSelection = await this.config.adapters.selectAgent(identifier.id, { ruleId, templateId });
        if (!agentSelection) {
          stats.skipped++;
          this.config.hooks?.onSend?.({ ruleId, ruleName: rule.name, email, status: 'skipped', accountId: '', templateId, runId: runId || '', subjectIndex: -1, bodyIndex: -1, failureReason: 'no account available' });
          continue;
        }

        const user = { _id: identifier.id, email };
        const resolvedData = this.config.adapters.resolveData(user);
        const templateData = { ...(template.fields || {}), ...resolvedData };

        const si = Math.floor(Math.random() * compiledVariants.subjectFns.length);
        const bi = Math.floor(Math.random() * compiledVariants.bodyFns.length);

        const renderedSubject = compiledVariants.subjectFns[si](templateData);
        const renderedHtml = compiledVariants.bodyFns[bi](templateData);
        const renderedText = compiledVariants.textBodyFn
          ? compiledVariants.textBodyFn(templateData)
          : this.templateRenderer.htmlToText(renderedHtml);

        let finalHtml = renderedHtml;
        let finalText = renderedText;
        let finalSubject = renderedSubject;

        let pi: number | undefined;
        if (compiledVariants.preheaderFns && compiledVariants.preheaderFns.length > 0) {
          pi = Math.floor(Math.random() * compiledVariants.preheaderFns.length);
          const renderedPreheader = compiledVariants.preheaderFns[pi](templateData);
          if (renderedPreheader) {
            const preheaderHtml = `<div style="display:none;font-size:1px;color:#ffffff;line-height:1px;max-height:0px;max-width:0px;opacity:0;overflow:hidden;">${renderedPreheader}</div>`;
            finalHtml = finalHtml.replace(/(<body[^>]*>)/i, `$1${preheaderHtml}`);
          }
        }

        if (this.config.hooks?.beforeSend) {
          try {
            const modified = await this.config.hooks.beforeSend({
              htmlBody: finalHtml,
              textBody: finalText,
              subject: finalSubject,
              account: {
                id: agentSelection.accountId,
                email: agentSelection.email,
                metadata: agentSelection.metadata,
              },
              user: {
                id: dedupKey,
                email,
                name: '',
              },
              context: {
                ruleId,
                templateId,
                runId: runId || '',
              },
            });
            finalHtml = modified.htmlBody;
            finalText = modified.textBody;
            finalSubject = modified.subject;
          } catch (hookErr: any) {
            this.logger.error(`beforeSend hook failed for email ${email}: ${hookErr.message}`);
            stats.errorCount++;
            this.config.hooks?.onSend?.({ ruleId, ruleName: rule.name, email, status: 'error', accountId: agentSelection.accountId, templateId, runId: runId || '', subjectIndex: si, bodyIndex: bi, failureReason: (hookErr as Error).message });
            continue;
          }
        }

        await this.config.adapters.sendEmail({
          identifierId: identifier.id,
          contactId: identifier.contactId,
          accountId: agentSelection.accountId,
          subject: finalSubject,
          htmlBody: finalHtml,
          textBody: finalText,
          ruleId,
          autoApprove: rule.autoApprove ?? true
        });

        await this.EmailRuleSend.logSend(
          ruleId,
          dedupKey,
          identifier.id,
          undefined,
          { status: 'sent', accountId: agentSelection.accountId, subject: finalSubject, subjectIndex: si, bodyIndex: bi, preheaderIndex: pi }
        );

        const current = throttleMap.get(dedupKey) || { today: 0, thisWeek: 0, lastSentDate: null };
        throttleMap.set(dedupKey, {
          today: current.today + 1,
          thisWeek: current.thisWeek + 1,
          lastSentDate: new Date()
        });

        stats.sent++;
        this.config.hooks?.onSend?.({ ruleId, ruleName: rule.name, email, status: 'sent', accountId: agentSelection.accountId, templateId, runId: runId || '', subjectIndex: si, bodyIndex: bi });

        totalProcessed++;
        if (runId && totalProcessed % 10 === 0) {
          await this.updateRunSendProgress(runId, stats);
        }

        if (i < emailsToProcess.length - 1) {
          const delayMs = this.config.options?.delayBetweenSendsMs || 0;
          const jitterMs = this.config.options?.jitterMs || 0;
          if (delayMs > 0 || jitterMs > 0) {
            const totalDelay = delayMs + Math.floor(Math.random() * (jitterMs + 1));
            if (totalDelay > 0) await new Promise(resolve => setTimeout(resolve, totalDelay));
          }
        }
      } catch (err) {
        stats.errorCount++;
        this.config.hooks?.onSend?.({ ruleId, ruleName: rule.name, email, status: 'error', accountId: '', templateId, runId: runId || '', subjectIndex: -1, bodyIndex: -1, failureReason: (err as Error).message || 'unknown error' });
        this.logger.error(`Rule "${rule.name}" failed for identifier ${email}`, { error: err });
      }
    }

    await this.EmailRule.findByIdAndUpdate(rule._id, {
      $set: { lastRunAt: new Date(), lastRunStats: stats },
      $inc: { totalSent: stats.sent, totalSkipped: stats.skipped }
    });

    // Auto-disable only applies to sendOnce rules — rules without sendOnce are meant to keep running
    if (rule.sendOnce) {
      const allIdentifiers: string[] = rule.target.identifiers || [];
      const totalIdentifiers = new Set(allIdentifiers.map((e: string) => e.toLowerCase().trim()).filter(Boolean)).size;

      const sends = await this.EmailRuleSend.find({
        ruleId: rule._id,
      }).lean();

      const sentOrProcessedIds = new Set(sends
        .filter((s: any) => s.status !== 'throttled')
        .map((s: any) => String(s.userId || s.emailIdentifierId))
      );

      const throttledCount = sends.filter((s: any) => s.status === 'throttled').length;

      if (sentOrProcessedIds.size >= totalIdentifiers && throttledCount === 0) {
        await this.EmailRule.findByIdAndUpdate(rule._id, { $set: { isActive: false } });
        this.logger.info(`Rule '${rule.name}' auto-disabled — all identifiers processed`);
      }
    }

    this.config.hooks?.onRuleComplete?.({ ruleId, ruleName: rule.name, stats, templateId, runId: runId || '' });

    return stats;
  }

  private async executeQueryMode(
    rule: any,
    template: any,
    throttleMap: Map<string, UserThrottle>,
    throttleConfig: any,
    stats: RuleRunStats,
    runId?: string
  ): Promise<RuleRunStats> {
    let users: Record<string, unknown>[];
    try {
      users = await this.config.adapters.queryUsers(rule.target, rule.maxPerRun || this.config.options?.defaultMaxPerRun || 500);
    } catch (err) {
      this.logger.error(`Rule "${rule.name}": query failed`, { error: err });
      stats.errorCount = 1;
      return stats;
    }

    stats.matched = users.length;
    this.config.hooks?.onRuleStart?.({ ruleId: rule._id.toString(), ruleName: rule.name, matchedCount: users.length, templateId: rule.templateId.toString(), runId: runId || '' });
    if (users.length === 0) return stats;

    const userIds = users.map(u => (u._id as any)?.toString()).filter(Boolean);
    const emails = users.map(u => u.email as string).filter(Boolean);

    const allRuleSends = await this.EmailRuleSend.find({ ruleId: rule._id, userId: { $in: userIds } })
      .sort({ sentAt: -1 })
      .lean();

    const sendMap = new Map<string, any>();
    for (const send of allRuleSends) {
      const uid = send.userId.toString();
      if (!sendMap.has(uid)) {
        sendMap.set(uid, send);
      }
    }

    const uniqueEmails = [...new Set(emails.map(e => e.toLowerCase().trim()))];
    const identifierResults = await processInChunks(
      uniqueEmails,
      async email => {
        const result = await this.config.adapters.findIdentifier(email);
        return result ? { email, ...result } : null;
      },
      IDENTIFIER_CHUNK_SIZE
    );

    const identifierMap = new Map<string, { id: string; contactId: string }>();
    for (const result of identifierResults) {
      if (result) {
        identifierMap.set(result.email, { id: result.id, contactId: result.contactId });
      }
    }

    const preheadersQ: string[] = template.preheaders || [];
    const compiledVariants = this.templateRenderer.compileBatchVariants(
      template.subjects,
      template.bodies,
      template.textBody,
      preheadersQ
    );

    const ruleId = rule._id.toString();
    const templateId = rule.templateId.toString();

    let totalProcessed = 0;

    for (let i = 0; i < users.length; i++) {
      const user = users[i];

      if (runId && i % 10 === 0) {
        const cancelKey = `${this.keyPrefix}run:${runId}:cancel`;
        const cancelled = await this.redis.exists(cancelKey);
        if (cancelled) break;
      }

      try {
        const userId = (user._id as any)?.toString();
        const email = user.email as string;
        if (!userId || !email) {
          stats.skipped++;
          this.config.hooks?.onSend?.({ ruleId, ruleName: rule.name, email: email || 'unknown', status: 'invalid', accountId: '', templateId, runId: runId || '', subjectIndex: -1, bodyIndex: -1, failureReason: 'invalid email' });
          continue;
        }

        const lastSend = sendMap.get(userId);
        if (lastSend) {
          if (rule.sendOnce && !rule.resendAfterDays) {
            stats.skipped++;
            this.config.hooks?.onSend?.({ ruleId, ruleName: rule.name, email, status: 'skipped', accountId: '', templateId, runId: runId || '', subjectIndex: -1, bodyIndex: -1, failureReason: 'send once' });
            continue;
          }
          if (rule.resendAfterDays) {
            const daysSince = (Date.now() - new Date(lastSend.sentAt).getTime()) / MS_PER_DAY;
            if (daysSince < rule.resendAfterDays) {
              stats.skipped++;
              this.config.hooks?.onSend?.({ ruleId, ruleName: rule.name, email, status: 'skipped', accountId: '', templateId, runId: runId || '', subjectIndex: -1, bodyIndex: -1, failureReason: 'resend too soon' });
              continue;
            }
          } else {
            stats.skipped++;
            this.config.hooks?.onSend?.({ ruleId, ruleName: rule.name, email, status: 'skipped', accountId: '', templateId, runId: runId || '', subjectIndex: -1, bodyIndex: -1, failureReason: 'send once' });
            continue;
          }
        }

        const identifier = identifierMap.get(email.toLowerCase().trim());
        if (!identifier) {
          stats.skipped++;
          this.config.hooks?.onSend?.({ ruleId, ruleName: rule.name, email, status: 'invalid', accountId: '', templateId, runId: runId || '', subjectIndex: -1, bodyIndex: -1, failureReason: 'invalid email' });
          continue;
        }

        if (!this.checkThrottle(rule, userId, email, throttleMap, throttleConfig, stats, templateId, runId)) continue;

        const agentSelection = await this.config.adapters.selectAgent(identifier.id, { ruleId, templateId });
        if (!agentSelection) {
          stats.skipped++;
          this.config.hooks?.onSend?.({ ruleId, ruleName: rule.name, email, status: 'skipped', accountId: '', templateId, runId: runId || '', subjectIndex: -1, bodyIndex: -1, failureReason: 'no account available' });
          continue;
        }

        const resolvedData = this.config.adapters.resolveData(user);
        const templateData = { ...(template.fields || {}), ...resolvedData };

        const si = Math.floor(Math.random() * compiledVariants.subjectFns.length);
        const bi = Math.floor(Math.random() * compiledVariants.bodyFns.length);

        const renderedSubject = compiledVariants.subjectFns[si](templateData);
        const renderedHtml = compiledVariants.bodyFns[bi](templateData);
        const renderedText = compiledVariants.textBodyFn
          ? compiledVariants.textBodyFn(templateData)
          : this.templateRenderer.htmlToText(renderedHtml);

        let finalHtml = renderedHtml;
        let finalText = renderedText;
        let finalSubject = renderedSubject;

        let pi: number | undefined;
        if (compiledVariants.preheaderFns && compiledVariants.preheaderFns.length > 0) {
          pi = Math.floor(Math.random() * compiledVariants.preheaderFns.length);
          const renderedPreheader = compiledVariants.preheaderFns[pi](templateData);
          if (renderedPreheader) {
            const preheaderHtml = `<div style="display:none;font-size:1px;color:#ffffff;line-height:1px;max-height:0px;max-width:0px;opacity:0;overflow:hidden;">${renderedPreheader}</div>`;
            finalHtml = finalHtml.replace(/(<body[^>]*>)/i, `$1${preheaderHtml}`);
          }
        }

        if (this.config.hooks?.beforeSend) {
          try {
            const modified = await this.config.hooks.beforeSend({
              htmlBody: finalHtml,
              textBody: finalText,
              subject: finalSubject,
              account: {
                id: agentSelection.accountId,
                email: agentSelection.email,
                metadata: agentSelection.metadata,
              },
              user: {
                id: String(userId),
                email,
                name: String(user.name || user.firstName || ''),
              },
              context: {
                ruleId,
                templateId,
                runId: runId || '',
              },
            });
            finalHtml = modified.htmlBody;
            finalText = modified.textBody;
            finalSubject = modified.subject;
          } catch (hookErr: any) {
            this.logger.error(`beforeSend hook failed for email ${email}: ${hookErr.message}`);
            stats.errorCount++;
            this.config.hooks?.onSend?.({ ruleId, ruleName: rule.name, email, status: 'error', accountId: agentSelection.accountId, templateId, runId: runId || '', subjectIndex: si, bodyIndex: bi, failureReason: (hookErr as Error).message });
            continue;
          }
        }

        await this.config.adapters.sendEmail({
          identifierId: identifier.id,
          contactId: identifier.contactId,
          accountId: agentSelection.accountId,
          subject: finalSubject,
          htmlBody: finalHtml,
          textBody: finalText,
          ruleId,
          autoApprove: rule.autoApprove ?? true
        });

        await this.EmailRuleSend.logSend(
          ruleId,
          userId,
          identifier.id,
          undefined,
          { status: 'sent', accountId: agentSelection.accountId, subject: finalSubject, subjectIndex: si, bodyIndex: bi, preheaderIndex: pi }
        );

        const current = throttleMap.get(userId) || { today: 0, thisWeek: 0, lastSentDate: null };
        throttleMap.set(userId, {
          today: current.today + 1,
          thisWeek: current.thisWeek + 1,
          lastSentDate: new Date()
        });

        stats.sent++;
        this.config.hooks?.onSend?.({ ruleId, ruleName: rule.name, email, status: 'sent', accountId: agentSelection.accountId, templateId, runId: runId || '', subjectIndex: si, bodyIndex: bi });

        totalProcessed++;
        if (runId && totalProcessed % 10 === 0) {
          await this.updateRunSendProgress(runId, stats);
        }

        if (i < users.length - 1) {
          const delayMs = this.config.options?.delayBetweenSendsMs || 0;
          const jitterMs = this.config.options?.jitterMs || 0;
          if (delayMs > 0 || jitterMs > 0) {
            const totalDelay = delayMs + Math.floor(Math.random() * (jitterMs + 1));
            if (totalDelay > 0) await new Promise(resolve => setTimeout(resolve, totalDelay));
          }
        }
      } catch (err) {
        stats.errorCount++;
        this.config.hooks?.onSend?.({ ruleId, ruleName: rule.name, email: (user.email as string) || 'unknown', status: 'error', accountId: '', templateId, runId: runId || '', subjectIndex: -1, bodyIndex: -1, failureReason: (err as Error).message || 'unknown error' });
        this.logger.error(`Rule "${rule.name}" failed for user ${(user._id as any)?.toString()}`, { error: err });
      }
    }

    await this.EmailRule.findByIdAndUpdate(rule._id, {
      $set: { lastRunAt: new Date(), lastRunStats: stats },
      $inc: { totalSent: stats.sent, totalSkipped: stats.skipped }
    });

    this.config.hooks?.onRuleComplete?.({ ruleId, ruleName: rule.name, stats, templateId, runId: runId || '' });

    return stats;
  }

  private checkThrottle(
    rule: any,
    userId: string,
    email: string,
    throttleMap: Map<string, UserThrottle>,
    config: any,
    stats: RuleRunStats,
    templateId?: string,
    runId?: string
  ): boolean {
    if (rule.emailType === EMAIL_TYPE.Transactional || rule.bypassThrottle) return true;

    const userThrottle = throttleMap.get(userId) || { today: 0, thisWeek: 0, lastSentDate: null };

    if (userThrottle.today >= config.maxPerUserPerDay) {
      stats.skippedByThrottle++;
      this.config.hooks?.onSend?.({ ruleId: rule._id.toString(), ruleName: rule.name, email, status: 'throttled', accountId: '', templateId: templateId || '', runId: runId || '', subjectIndex: -1, bodyIndex: -1, failureReason: 'daily throttle limit' });
      return false;
    }
    if (userThrottle.thisWeek >= config.maxPerUserPerWeek) {
      stats.skippedByThrottle++;
      this.config.hooks?.onSend?.({ ruleId: rule._id.toString(), ruleName: rule.name, email, status: 'throttled', accountId: '', templateId: templateId || '', runId: runId || '', subjectIndex: -1, bodyIndex: -1, failureReason: 'weekly throttle limit' });
      return false;
    }
    if (userThrottle.lastSentDate) {
      const daysSinceLastSend = (Date.now() - userThrottle.lastSentDate.getTime()) / MS_PER_DAY;
      if (daysSinceLastSend < config.minGapDays) {
        stats.skippedByThrottle++;
        this.config.hooks?.onSend?.({ ruleId: rule._id.toString(), ruleName: rule.name, email, status: 'throttled', accountId: '', templateId: templateId || '', runId: runId || '', subjectIndex: -1, bodyIndex: -1, failureReason: 'min gap days' });
        return false;
      }
    }

    return true;
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
      await this.redis.expire(key, 3600);
    }
  }

  private async updateRunSendProgress(runId: string, stats: RuleRunStats): Promise<void> {
    const key = `${this.keyPrefix}run:${runId}:progress`;
    const existing = await this.redis.hget(key, 'progress');
    let progress = { rulesTotal: 0, rulesCompleted: 0, sent: 0, failed: 0, skipped: 0, invalid: 0 };
    if (existing) {
      try { progress = JSON.parse(existing); } catch { /* use default */ }
    }
    progress.sent = stats.sent;
    progress.failed = stats.errorCount;
    progress.skipped = stats.skipped + stats.skippedByThrottle;
    await this.redis.hset(key, 'progress', JSON.stringify(progress));
    await this.redis.expire(key, 3600);
  }

  async getStatus(runId: string): Promise<RunStatusResponse | null> {
    const key = `${this.keyPrefix}run:${runId}:progress`;
    const data = await this.redis.hgetall(key);
    if (!data || Object.keys(data).length === 0) return null;

    let progress = { rulesTotal: 0, rulesCompleted: 0, sent: 0, failed: 0, skipped: 0, invalid: 0 };
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

  trigger(triggeredBy?: RunTrigger): { runId: string } {
    const runId = crypto.randomUUID();
    this.runAllRules(triggeredBy || RUN_TRIGGER.Manual, runId).catch(err => {
      this.logger.error('Background rule run failed', { error: err, runId });
      this.updateRunProgress(runId, { status: 'failed' } as Partial<RunStatusResponse>).catch(() => {});
    });
    return { runId };
  }

  buildThrottleMap(recentSends: any[]): Map<string, UserThrottle> {
    const map = new Map<string, UserThrottle>();
    const todayStart = this.getTodayStart();

    for (const send of recentSends) {
      const key = send.userId.toString();
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
}
