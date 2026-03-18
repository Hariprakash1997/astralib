import { TemplateRenderService } from './template-render.service';
import { RedisLock, noopLogger } from '@astralibx/core';
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
    this.logger = config.logger || noopLogger;
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
      await this.updateRunProgress(runId, { status: 'failed', currentRule: 'Another run is already in progress' } as Partial<RunStatusResponse>);
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

  private emitSendEvent(
    rule: any, email: string, status: string, templateId: string, runId: string,
    opts?: { accountId?: string; subjectIndex?: number; bodyIndex?: number; preheaderIndex?: number; failureReason?: string }
  ): void {
    this.config.hooks?.onSend?.({
      ruleId: rule._id.toString(), ruleName: rule.name, email, status: status as any,
      accountId: opts?.accountId ?? '', templateId, runId: runId || '',
      subjectIndex: opts?.subjectIndex ?? -1, bodyIndex: opts?.bodyIndex ?? -1,
      preheaderIndex: opts?.preheaderIndex, failureReason: opts?.failureReason,
    });
  }

  private async processSingleUser(params: {
    rule: any;
    email: string;
    userKey: string;
    identifier: { id: string; contactId: string };
    user: Record<string, unknown>;
    sendMap: Map<string, any>;
    throttleMap: Map<string, UserThrottle>;
    throttleConfig: any;
    template: any;
    compiledVariants: any;
    templateId: string;
    ruleId: string;
    runId?: string;
    stats: RuleRunStats;
  }): Promise<'sent' | 'skipped' | 'error'> {
    const { rule, email, userKey, identifier, user, sendMap, throttleMap, throttleConfig, template, compiledVariants, templateId, ruleId, runId, stats } = params;

    const lastSend = sendMap.get(userKey);
    if (lastSend) {
      if (rule.sendOnce && rule.resendAfterDays == null) {
        stats.skipped++;
        this.emitSendEvent(rule, email, 'skipped', templateId, runId || '', { failureReason: 'send once' });
        return 'skipped';
      }
      if (rule.resendAfterDays != null) {
        const daysSince = (Date.now() - new Date(lastSend.sentAt).getTime()) / MS_PER_DAY;
        if (daysSince < rule.resendAfterDays) {
          stats.skipped++;
          this.emitSendEvent(rule, email, 'skipped', templateId, runId || '', { failureReason: 'resend too soon' });
          return 'skipped';
        }
      } else {
        stats.skipped++;
        this.emitSendEvent(rule, email, 'skipped', templateId, runId || '', { failureReason: 'send once' });
        return 'skipped';
      }
      if (rule.cooldownDays) {
        const daysSince = (Date.now() - new Date(lastSend.sentAt).getTime()) / MS_PER_DAY;
        if (daysSince < rule.cooldownDays) {
          stats.skipped++;
          this.emitSendEvent(rule, email, 'skipped', templateId, runId || '', { failureReason: 'cooldown period' });
          return 'skipped';
        }
      }
    }

    if (!this.checkThrottle(rule, userKey, email, throttleMap, throttleConfig, stats, templateId, runId)) return 'skipped';

    const agentSelection = await this.config.adapters.selectAgent(identifier.id, { ruleId, templateId });
    if (!agentSelection) {
      stats.skipped++;
      this.emitSendEvent(rule, email, 'skipped', templateId, runId || '', { failureReason: 'no account available' });
      return 'skipped';
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
            id: String(userKey),
            email,
            name: String((user as any).name || (user as any).firstName || ''),
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
        this.emitSendEvent(rule, email, 'error', templateId, runId || '', { accountId: agentSelection.accountId, subjectIndex: si, bodyIndex: bi, failureReason: (hookErr as Error).message });
        return 'error';
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
      autoApprove: rule.autoApprove ?? true,
      attachments: template.attachments || [],
    });

    await this.EmailRuleSend.logSend(
      ruleId,
      userKey,
      identifier.id,
      undefined,
      { status: 'sent', accountId: agentSelection.accountId, subject: finalSubject, subjectIndex: si, bodyIndex: bi, preheaderIndex: pi }
    );

    const current = throttleMap.get(userKey) || { today: 0, thisWeek: 0, lastSentDate: null };
    throttleMap.set(userKey, {
      today: current.today + 1,
      thisWeek: current.thisWeek + 1,
      lastSentDate: new Date()
    });

    stats.sent++;
    this.emitSendEvent(rule, email, 'sent', templateId, runId || '', { accountId: agentSelection.accountId, subjectIndex: si, bodyIndex: bi, preheaderIndex: pi });

    return 'sent';
  }

  private async resolveIdentifiers(emails: string[]): Promise<Map<string, { id: string; contactId: string }>> {
    const identifierResults = await processInChunks(
      emails,
      async email => {
        const result = await this.config.adapters.findIdentifier(email);
        return result ? { email, ...result } : null;
      },
      IDENTIFIER_CHUNK_SIZE
    );
    const map = new Map<string, { id: string; contactId: string }>();
    for (const result of identifierResults) {
      if (result) {
        map.set(result.email, { id: result.id, contactId: result.contactId });
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

  private compileTemplateVariants(template: any) {
    const preheaders: string[] = template.preheaders || [];
    return this.templateRenderer.compileBatchVariants(
      template.subjects, template.bodies, template.textBody, preheaders
    );
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
    await this.EmailRule.findByIdAndUpdate(rule._id, {
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
    const uniqueEmails = [...new Set(rawIdentifiers.map((e: string) => e.toLowerCase().trim()).filter(Boolean))];

    const limit = rule.maxPerRun || this.config.options?.defaultMaxPerRun || 500;
    if (uniqueEmails.length > limit) {
      this.logger.warn(`Rule "${rule.name}" matched ${uniqueEmails.length} users but maxPerRun is ${limit} — only ${limit} will be processed`, { ruleId: rule._id.toString(), matchedCount: uniqueEmails.length, maxPerRun: limit });
    }
    const emailsToProcess = uniqueEmails.slice(0, limit);

    stats.matched = emailsToProcess.length;
    const ruleId = rule._id.toString();
    const templateId = rule.templateId.toString();

    this.config.hooks?.onRuleStart?.({ ruleId, ruleName: rule.name, matchedCount: emailsToProcess.length, templateId, runId: runId || '' });
    if (emailsToProcess.length === 0) return stats;

    const identifierMap = await this.resolveIdentifiers(emailsToProcess);

    const validEmails = emailsToProcess.filter(e => identifierMap.has(e));
    const identifierIds = validEmails.map(e => identifierMap.get(e)!.id);

    const allRuleSends = await this.EmailRuleSend.find({ ruleId: rule._id, userId: { $in: identifierIds } })
      .sort({ sentAt: -1 })
      .lean();

    const sendMap = this.buildSendMap(allRuleSends);
    const compiledVariants = this.compileTemplateVariants(template);

    let totalProcessed = 0;

    for (let i = 0; i < emailsToProcess.length; i++) {
      const email = emailsToProcess[i];

      if (await this.checkCancelled(runId, i)) break;

      try {
        const identifier = identifierMap.get(email);
        if (!identifier) {
          stats.skipped++;
          this.emitSendEvent(rule, email, 'invalid', templateId, runId || '', { failureReason: 'invalid email' });
          continue;
        }

        const result = await this.processSingleUser({
          rule, email, userKey: identifier.id, identifier, user: { _id: identifier.id, email }, sendMap, throttleMap,
          throttleConfig, template, compiledVariants, templateId, ruleId, runId, stats
        });

        if (result === 'sent') {
          totalProcessed++;
          if (runId && totalProcessed % 10 === 0) await this.updateRunSendProgress(runId, stats);
          await this.applySendDelay(i >= emailsToProcess.length - 1);
        }
      } catch (err) {
        stats.errorCount++;
        this.emitSendEvent(rule, email, 'error', templateId, runId || '', { failureReason: (err as Error).message || 'unknown error' });
        this.logger.error(`Rule "${rule.name}" failed for identifier ${email}`, { error: err });
      }
    }

    await this.finalizeRuleStats(rule, stats, ruleId, templateId, runId);

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
    let users: Record<string, unknown>[];
    try {
      const collectionName = rule.target?.collection;
      const collectionSchema = collectionName
        ? this.config.collections?.find((c: any) => c.name === collectionName)
        : undefined;
      users = await this.config.adapters.queryUsers(rule.target, limit, collectionSchema ? { collectionSchema } : undefined);
    } catch (err) {
      this.logger.error(`Rule "${rule.name}": query failed`, { error: err });
      stats.errorCount = 1;
      return stats;
    }

    if (users.length > limit) {
      this.logger.warn(`Rule "${rule.name}" matched ${users.length} users but maxPerRun is ${limit} — only ${limit} will be processed`, { ruleId: rule._id.toString(), matchedCount: users.length, maxPerRun: limit });
    }

    stats.matched = users.length;
    this.config.hooks?.onRuleStart?.({ ruleId: rule._id.toString(), ruleName: rule.name, matchedCount: users.length, templateId: rule.templateId.toString(), runId: runId || '' });
    if (users.length === 0) return stats;

    const userIds = users.map(u => (u._id as any)?.toString()).filter(Boolean);
    const emails = users.map(u => u.email as string).filter(Boolean);

    const allRuleSends = await this.EmailRuleSend.find({ ruleId: rule._id, userId: { $in: userIds } })
      .sort({ sentAt: -1 })
      .lean();

    const sendMap = this.buildSendMap(allRuleSends);

    const uniqueEmails = [...new Set(emails.map(e => e.toLowerCase().trim()))];
    const identifierMap = await this.resolveIdentifiers(uniqueEmails);
    const compiledVariants = this.compileTemplateVariants(template);

    const ruleId = rule._id.toString();
    const templateId = rule.templateId.toString();

    let totalProcessed = 0;

    for (let i = 0; i < users.length; i++) {
      const user = users[i];

      if (await this.checkCancelled(runId, i)) break;

      try {
        const userId = (user._id as any)?.toString();
        const email = user.email as string;
        if (!userId || !email) {
          stats.skipped++;
          this.emitSendEvent(rule, email || 'unknown', 'invalid', templateId, runId || '', { failureReason: 'invalid email' });
          continue;
        }

        const identifier = identifierMap.get(email.toLowerCase().trim());
        if (!identifier) {
          stats.skipped++;
          this.emitSendEvent(rule, email, 'invalid', templateId, runId || '', { failureReason: 'invalid email' });
          continue;
        }

        const result = await this.processSingleUser({
          rule, email, userKey: userId, identifier, user, sendMap, throttleMap,
          throttleConfig, template, compiledVariants, templateId, ruleId, runId, stats
        });

        if (result === 'sent') {
          totalProcessed++;
          if (runId && totalProcessed % 10 === 0) await this.updateRunSendProgress(runId, stats);
          await this.applySendDelay(i >= users.length - 1);
        }
      } catch (err) {
        stats.errorCount++;
        this.emitSendEvent(rule, (user.email as string) || 'unknown', 'error', templateId, runId || '', { failureReason: (err as Error).message || 'unknown error' });
        this.logger.error(`Rule "${rule.name}" failed for user ${(user._id as any)?.toString()}`, { error: err });
      }
    }

    await this.finalizeRuleStats(rule, stats, ruleId, templateId, runId);

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

    const overrides = rule.throttleOverride || {};
    const dailyLimit = overrides.maxPerUserPerDay ?? config.maxPerUserPerDay;
    const weeklyLimit = overrides.maxPerUserPerWeek ?? config.maxPerUserPerWeek;
    const minGap = overrides.minGapDays ?? config.minGapDays;

    const userThrottle = throttleMap.get(userId) || { today: 0, thisWeek: 0, lastSentDate: null };

    if (userThrottle.today >= dailyLimit) {
      stats.skippedByThrottle++;
      this.emitSendEvent(rule, email, 'throttled', templateId || '', runId || '', { failureReason: 'daily throttle limit' });
      return false;
    }
    if (userThrottle.thisWeek >= weeklyLimit) {
      stats.skippedByThrottle++;
      this.emitSendEvent(rule, email, 'throttled', templateId || '', runId || '', { failureReason: 'weekly throttle limit' });
      return false;
    }
    if (userThrottle.lastSentDate) {
      const daysSinceLastSend = (Date.now() - userThrottle.lastSentDate.getTime()) / MS_PER_DAY;
      if (daysSinceLastSend < minGap) {
        stats.skippedByThrottle++;
        this.emitSendEvent(rule, email, 'throttled', templateId || '', runId || '', { failureReason: 'min gap days' });
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

  trigger(triggeredBy?: RunTrigger): { runId: string; started: boolean } {
    const runId = crypto.randomUUID();
    this.runAllRules(triggeredBy || RUN_TRIGGER.Manual, runId).catch(err => {
      this.logger.error('Background rule run failed', { error: err, runId });
      this.updateRunProgress(runId, { status: 'failed' } as Partial<RunStatusResponse>).catch(() => {});
    });
    return { runId, started: true };
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
