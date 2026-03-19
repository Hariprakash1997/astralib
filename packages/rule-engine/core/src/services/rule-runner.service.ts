import { TemplateRenderService } from './template-render.service';
import { RedisLock, noopLogger } from '@astralibx/core';
import type { RuleModel } from '../schemas/rule.schema';
import type { TemplateModel } from '../schemas/template.schema';
import type { SendLogModel } from '../schemas/send-log.schema';
import type { RunLogModel } from '../schemas/run-log.schema';
import type { ErrorLogModel } from '../schemas/error-log.schema';
import type { ThrottleConfigModel } from '../schemas/throttle-config.schema';
import { RUN_TRIGGER } from '../constants';
import type { RunTrigger } from '../constants';
import type { RuleRunStats, PerRuleStats } from '../types/rule.types';
import type { RunStatusResponse } from '../types/run.types';
import crypto from 'crypto';
import type { Redis } from 'ioredis';
import type { RuleEngineConfig, LogAdapter } from '../types/config.types';

import { updateRunProgress, updateRunSendProgress, getRunStatus, cancelRun } from './run-progress';
import { type UserThrottle, getTodayStart, buildThrottleMap as buildThrottleMapFn } from './throttle';
import { compileTemplateVariants, emitSendEvent, processUsers } from './user-processor';

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

export class RuleRunnerService {
  private templateRenderer = new TemplateRenderService();
  private lock: RedisLock;
  private logger: LogAdapter;
  private redis: Redis;
  private keyPrefix: string;

  constructor(
    private Rule: RuleModel,
    private Template: TemplateModel,
    private SendLog: SendLogModel,
    private RunLog: RunLogModel,
    private ErrorLog: ErrorLogModel,
    private ThrottleConfig: ThrottleConfigModel,
    private config: RuleEngineConfig
  ) {
    this.keyPrefix = config.redis.keyPrefix || '';
    this.redis = config.redis.connection;
    const lockTTL = config.options?.lockTTLMs || DEFAULT_LOCK_TTL_MS;
    this.lock = new RedisLock(
      this.redis,
      `${this.keyPrefix}rule-runner:lock`,
      lockTTL,
      config.logger
    );
    this.logger = config.logger || noopLogger;
  }

  async runAllRules(triggeredBy: RunTrigger = RUN_TRIGGER.Cron, runId?: string): Promise<{ runId: string }> {
    if (!runId) runId = crypto.randomUUID();
    const startedAt = new Date().toISOString();

    const lockAcquired = await this.lock.acquire();
    if (!lockAcquired) {
      this.logger.warn('Rule runner already executing, skipping');
      await updateRunProgress(this.redis, this.keyPrefix, runId, { status: 'failed', currentRule: 'Another run is already in progress' } as Partial<RunStatusResponse>);
      return { runId };
    }

    const runStartTime = Date.now();

    await updateRunProgress(this.redis, this.keyPrefix, runId, {
      runId,
      status: 'running',
      currentRule: '',
      progress: { rulesTotal: 0, rulesCompleted: 0, sent: 0, failed: 0, skipped: 0, invalid: 0 },
      startedAt,
      elapsed: 0
    });

    let runStatus: 'completed' | 'cancelled' | 'failed' = 'completed';

    try {
      const throttleConfig = await this.ThrottleConfig.getConfig();

      // Send window: DB setting takes priority, falls back to code-level config
      const sendWindow = throttleConfig.sendWindow ?? this.config.options?.sendWindow;
      if (sendWindow) {
        const { startHour, endHour, timezone } = sendWindow;
        const now2 = new Date();
        const formatter = new Intl.DateTimeFormat('en-US', { hour: 'numeric', hour12: false, timeZone: timezone });
        const currentHour = parseInt(formatter.format(now2), 10);
        const inWindow = startHour < endHour
          ? (currentHour >= startHour && currentHour < endHour)
          : (currentHour >= startHour || currentHour < endHour);
        if (!inWindow) {
          this.logger.info('Outside send window, skipping run', { currentHour, startHour, endHour, timezone });
          return { runId };
        }
      }

      const allActiveRules = await this.Rule.findActive();

      const now = new Date();
      const tz = sendWindow?.timezone ?? this.config.options?.sendWindow?.timezone;
      const activeRules = allActiveRules.filter(rule => {
        if (rule.validFrom) {
          const localNow = getLocalDate(now, tz);
          const localValidFrom = getLocalDate(new Date(rule.validFrom as any), tz);
          if (localNow < localValidFrom) return false;
        }
        if (rule.validTill) {
          const localNow = getLocalDate(now, tz);
          const localValidTill = getLocalDate(new Date(rule.validTill as any), tz);
          if (localNow > localValidTill) return false;
        }
        return true;
      });

      this.config.hooks?.onRunStart?.({ rulesCount: activeRules.length, triggeredBy, runId });

      await updateRunProgress(this.redis, this.keyPrefix, runId, {
        progress: { rulesTotal: activeRules.length, rulesCompleted: 0, sent: 0, failed: 0, skipped: 0, invalid: 0 }
      } as Partial<RunStatusResponse>);

      if (activeRules.length === 0) {
        this.logger.info('No active rules to process');
        await this.RunLog.create({
          runId,
          runAt: new Date(),
          triggeredBy,
          duration: Date.now() - runStartTime,
          rulesProcessed: 0,
          totalStats: { matched: 0, sent: 0, skipped: 0, throttled: 0, failed: 0 },
          perRuleStats: [],
          status: 'completed'
        });
        await updateRunProgress(this.redis, this.keyPrefix, runId, { status: 'completed', elapsed: Date.now() - runStartTime } as Partial<RunStatusResponse>);
        return { runId };
      }

      const templateIds = [...new Set(activeRules.map(r => r.templateId.toString()))];
      const templates = await this.Template.find({ _id: { $in: templateIds } }).lean();
      const templateMap = new Map<string, any>();
      for (const t of templates) {
        templateMap.set((t as any)._id.toString(), t);
      }

      const recentSends = await this.SendLog.find(
        { sentAt: { $gte: new Date(Date.now() - 7 * MS_PER_DAY) } },
        { userId: 1, sentAt: 1, ruleId: 1 }
      ).sort({ sentAt: -1 }).limit(100000).lean();

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

        await updateRunProgress(this.redis, this.keyPrefix, runId, {
          currentRule: rule.name,
          elapsed: Date.now() - runStartTime
        } as Partial<RunStatusResponse>);

        const stats = await this.executeRule(rule, throttleMap, throttleConfig, templateMap, runId);
        totalSent += stats.sent;
        totalFailed += stats.failed;
        totalSkipped += stats.skipped + stats.throttled;
        totalInvalid += stats.matched - stats.sent - stats.skipped - stats.throttled - stats.failed;

        perRuleStats.push({
          ruleId: rule._id.toString(),
          ruleName: rule.name,
          ...stats
        });

        await updateRunProgress(this.redis, this.keyPrefix, runId, {
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
          throttled: acc.throttled + s.throttled,
          failed: acc.failed + s.failed,
        }),
        { matched: 0, sent: 0, skipped: 0, throttled: 0, failed: 0 }
      );

      await this.RunLog.create({
        runId,
        runAt: new Date(),
        triggeredBy,
        duration: Date.now() - runStartTime,
        rulesProcessed: activeRules.length,
        totalStats,
        perRuleStats,
        status: runStatus
      });

      await updateRunProgress(this.redis, this.keyPrefix, runId, { status: runStatus, currentRule: '', elapsed: Date.now() - runStartTime } as Partial<RunStatusResponse>);

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
      await updateRunProgress(this.redis, this.keyPrefix, runId, { status: 'failed', elapsed: Date.now() - runStartTime } as Partial<RunStatusResponse>);
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
    const stats: RuleRunStats = { matched: 0, sent: 0, skipped: 0, throttled: 0, failed: 0 };

    const template = templateMap?.get(rule.templateId.toString()) ?? await this.Template.findById(rule.templateId);
    if (!template) {
      this.logger.error(`Rule "${rule.name}": template ${rule.templateId} not found`);
      stats.failed = 1;
      return stats;
    }

    const isListMode = rule.target?.mode === 'list';

    if (isListMode) {
      return this.executeListMode(rule, template, throttleMap, throttleConfig, stats, runId);
    }

    return this.executeQueryMode(rule, template, throttleMap, throttleConfig, stats, runId);
  }

  private async resolveIdentifiers(contactValues: string[]): Promise<Map<string, { id: string; contactId: string }>> {
    const identifierResults = await processInChunks(
      contactValues,
      async contactValue => {
        const result = await this.config.adapters.findIdentifier(contactValue);
        return result ? { contactValue, ...result } : null;
      },
      IDENTIFIER_CHUNK_SIZE
    );
    const map = new Map<string, { id: string; contactId: string }>();
    for (const result of identifierResults) {
      if (result) {
        map.set(result.contactValue, { id: result.id, contactId: result.contactId });
      }
    }
    return map;
  }

  private buildSendMap(sends: any[]): Map<string, any> {
    const map = new Map<string, any>();
    for (const send of sends) {
      const uid = send.userId.toString();
      if (!map.has(uid)) {
        map.set(uid, send);
      }
    }
    return map;
  }

  private async checkCancelled(runId: string | undefined, index: number): Promise<boolean> {
    if (!runId || index % 10 !== 0) return false;
    const cancelKey = `${this.keyPrefix}run:${runId}:cancel`;
    return !!(await this.redis.exists(cancelKey));
  }

  private async applySendDelay(isLast: boolean): Promise<void> {
    if (isLast) return;
    const delayMs = this.config.options?.delayBetweenSendsMs || 0;
    const jitterMs = this.config.options?.jitterMs || 0;
    if (delayMs > 0 || jitterMs > 0) {
      const totalDelay = delayMs + Math.floor(Math.random() * (jitterMs + 1));
      if (totalDelay > 0) await new Promise(resolve => setTimeout(resolve, totalDelay));
    }
  }

  private async finalizeRuleStats(rule: any, stats: RuleRunStats, ruleId: string, templateId: string, runId?: string): Promise<void> {
    await this.Rule.findByIdAndUpdate(rule._id, {
      $set: { lastRunAt: new Date(), lastRunStats: stats },
      $inc: { totalSent: stats.sent, totalSkipped: stats.skipped }
    });
    this.config.hooks?.onRuleComplete?.({ ruleId, ruleName: rule.name, stats, templateId, runId: runId || '' });
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
    const uniqueContactValues = [...new Set(rawIdentifiers.map((v: string) => v.toLowerCase().trim()).filter(Boolean))];

    const limit = rule.maxPerRun || this.config.options?.defaultMaxPerRun || 500;
    if (uniqueContactValues.length > limit) {
      this.logger.warn(`Rule "${rule.name}" matched ${uniqueContactValues.length} users but maxPerRun is ${limit} — only ${limit} will be processed`, { ruleId: rule._id.toString(), matchedCount: uniqueContactValues.length, maxPerRun: limit });
    }
    const contactValuesToProcess = uniqueContactValues.slice(0, limit);

    stats.matched = contactValuesToProcess.length;
    const ruleId = rule._id.toString();
    const templateId = rule.templateId.toString();

    this.config.hooks?.onRuleStart?.({ ruleId, ruleName: rule.name, matchedCount: contactValuesToProcess.length, templateId, runId: runId || '' });
    if (contactValuesToProcess.length === 0) return stats;

    const identifierMap = await this.resolveIdentifiers(contactValuesToProcess);

    const validContactValues = contactValuesToProcess.filter(v => identifierMap.has(v));
    const identifierIds = validContactValues.map(v => identifierMap.get(v)!.id);

    const allRuleSends = await this.SendLog.find({ ruleId: rule._id, userId: { $in: identifierIds } })
      .sort({ sentAt: -1 })
      .lean();

    const sendMap = this.buildSendMap(allRuleSends);
    const compiledVariants = compileTemplateVariants(this.templateRenderer, template);

    const users = contactValuesToProcess.map(contactValue => {
      const identifier = identifierMap.get(contactValue) || null;
      return {
        contactValue,
        userKey: identifier?.id || contactValue,
        user: identifier ? { _id: identifier.id, contactValue } as Record<string, unknown> : { contactValue } as Record<string, unknown>,
        identifier,
      };
    });

    await processUsers({
      rule, template, throttleMap, throttleConfig, stats, runId,
      users, sendMap, compiledVariants, ruleId, templateId,
      config: this.config, logger: this.logger,
      redis: this.redis, keyPrefix: this.keyPrefix,
      SendLog: this.SendLog, ErrorLog: this.ErrorLog,
      checkCancelledFn: (rid, idx) => this.checkCancelled(rid, idx),
      applySendDelayFn: (isLast) => this.applySendDelay(isLast),
    });

    await this.finalizeRuleStats(rule, stats, ruleId, templateId, runId);

    // Auto-disable only applies to sendOnce rules — rules without sendOnce are meant to keep running
    if (rule.sendOnce) {
      const allIdentifiers: string[] = rule.target.identifiers || [];
      const totalIdentifiers = new Set(allIdentifiers.map((v: string) => v.toLowerCase().trim()).filter(Boolean)).size;

      const sends = await this.SendLog.find({
        ruleId: rule._id,
      }).lean();

      const sentOrProcessedIds = new Set(sends
        .filter((s: any) => s.status !== 'throttled')
        .map((s: any) => String(s.userId || s.identifierId))
      );

      const throttledCount = sends.filter((s: any) => s.status === 'throttled').length;

      if (sentOrProcessedIds.size >= totalIdentifiers && throttledCount === 0) {
        await this.Rule.findByIdAndUpdate(rule._id, { $set: { isActive: false } });
        this.logger.info(`Rule '${rule.name}' auto-disabled — all identifiers processed`);
      }
    }

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
    const limit = rule.maxPerRun || this.config.options?.defaultMaxPerRun || 500;
    let rawUsers: Record<string, unknown>[];
    try {
      // Resolve collection context from template
      const collectionName = (template as any)?.collectionName as string | undefined;
      const collectionSchema = collectionName
        ? this.config.collections?.find(c => c.name === collectionName)
        : undefined;
      const joinAliases: string[] = ((template as any)?.joins as string[] | undefined) ?? [];
      const activeJoins = collectionSchema?.joins?.filter(j => joinAliases.includes(j.as)) ?? [];

      rawUsers = await this.config.adapters.queryUsers(
        rule.target, limit,
        collectionSchema ? { collectionSchema, activeJoins } : undefined
      );
    } catch (err) {
      this.logger.error(`Rule "${rule.name}": query failed`, { error: err });
      stats.failed = 1;
      return stats;
    }

    if (rawUsers.length > limit) {
      this.logger.warn(`Rule "${rule.name}" matched ${rawUsers.length} users but maxPerRun is ${limit} — only ${limit} will be processed`, { ruleId: rule._id.toString(), matchedCount: rawUsers.length, maxPerRun: limit });
    }

    stats.matched = rawUsers.length;
    this.config.hooks?.onRuleStart?.({ ruleId: rule._id.toString(), ruleName: rule.name, matchedCount: rawUsers.length, templateId: rule.templateId.toString(), runId: runId || '' });
    if (rawUsers.length === 0) return stats;

    const userIds = rawUsers.map(u => (u._id as any)?.toString()).filter(Boolean);
    const contactValues = rawUsers.map(u => u.contactValue as string).filter(Boolean);

    const allRuleSends = await this.SendLog.find({ ruleId: rule._id, userId: { $in: userIds } })
      .sort({ sentAt: -1 })
      .lean();

    const sendMap = this.buildSendMap(allRuleSends);

    const uniqueContactValues = [...new Set(contactValues.map(v => v.toLowerCase().trim()))];
    const identifierMap = await this.resolveIdentifiers(uniqueContactValues);
    const compiledVariants = compileTemplateVariants(this.templateRenderer, template);

    const ruleId = rule._id.toString();
    const templateId = rule.templateId.toString();

    const users = rawUsers.map(user => {
      const userId = (user._id as any)?.toString();
      const contactValue = user.contactValue as string;
      if (!userId || !contactValue) {
        return {
          contactValue: contactValue || 'unknown',
          userKey: userId || '',
          user,
          identifier: null,
        };
      }
      const identifier = identifierMap.get(contactValue.toLowerCase().trim()) || null;
      return {
        contactValue,
        userKey: userId,
        user,
        identifier,
      };
    });

    await processUsers({
      rule, template, throttleMap, throttleConfig, stats, runId,
      users, sendMap, compiledVariants, ruleId, templateId,
      config: this.config, logger: this.logger,
      redis: this.redis, keyPrefix: this.keyPrefix,
      SendLog: this.SendLog, ErrorLog: this.ErrorLog,
      checkCancelledFn: (rid, idx) => this.checkCancelled(rid, idx),
      applySendDelayFn: (isLast) => this.applySendDelay(isLast),
    });

    await this.finalizeRuleStats(rule, stats, ruleId, templateId, runId);

    return stats;
  }

  async getStatus(runId: string): Promise<RunStatusResponse | null> {
    return getRunStatus(this.redis, this.keyPrefix, runId);
  }

  async cancel(runId: string): Promise<{ ok: boolean }> {
    return cancelRun(this.redis, this.keyPrefix, runId);
  }

  trigger(triggeredBy?: RunTrigger): { runId: string; started: boolean } {
    const runId = crypto.randomUUID();
    this.runAllRules(triggeredBy || RUN_TRIGGER.Manual, runId).catch(err => {
      this.logger.error('Background rule run failed', { error: err, runId });
      updateRunProgress(this.redis, this.keyPrefix, runId, { status: 'failed' } as Partial<RunStatusResponse>).catch(() => {});
    });
    return { runId, started: true };
  }

  buildThrottleMap(recentSends: any[]): Map<string, UserThrottle> {
    const timezone = this.config.options?.sendWindow?.timezone;
    const todayStart = getTodayStart(timezone);
    return buildThrottleMapFn(recentSends, todayStart);
  }
}
