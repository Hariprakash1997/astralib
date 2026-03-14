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
import type { EmailRuleEngineConfig, LogAdapter } from '../types/config.types';

const MS_PER_DAY = 86400000;
const DEFAULT_LOCK_TTL_MS = 30 * 60 * 1000;
const IDENTIFIER_CHUNK_SIZE = 50;

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

  constructor(
    private EmailRule: EmailRuleModel,
    private EmailTemplate: EmailTemplateModel,
    private EmailRuleSend: EmailRuleSendModel,
    private EmailRuleRunLog: EmailRuleRunLogModel,
    private EmailThrottleConfig: EmailThrottleConfigModel,
    private config: EmailRuleEngineConfig
  ) {
    const keyPrefix = config.redis.keyPrefix || '';
    const lockTTL = config.options?.lockTTLMs || DEFAULT_LOCK_TTL_MS;
    this.lock = new RedisLock(
      config.redis.connection,
      `${keyPrefix}email-rule-runner:lock`,
      lockTTL,
      config.logger
    );
    this.logger = config.logger || defaultLogger;
  }

  async runAllRules(triggeredBy: RunTrigger = RUN_TRIGGER.Cron): Promise<void> {
    if (this.config.options?.sendWindow) {
      const { startHour, endHour, timezone } = this.config.options.sendWindow;
      const now = new Date();
      const formatter = new Intl.DateTimeFormat('en-US', { hour: 'numeric', hour12: false, timeZone: timezone });
      const currentHour = parseInt(formatter.format(now), 10);
      if (currentHour < startHour || currentHour >= endHour) {
        this.logger.info('Outside send window, skipping run', { currentHour, startHour, endHour, timezone });
        return;
      }
    }

    const lockAcquired = await this.lock.acquire();
    if (!lockAcquired) {
      this.logger.warn('Rule runner already executing, skipping');
      return;
    }

    const runStartTime = Date.now();

    try {
      const throttleConfig = await this.EmailThrottleConfig.getConfig();
      const activeRules = await this.EmailRule.findActive();

      this.config.hooks?.onRunStart?.({ rulesCount: activeRules.length, triggeredBy });

      if (activeRules.length === 0) {
        this.logger.info('No active rules to process');
        await this.EmailRuleRunLog.create({
          runAt: new Date(),
          triggeredBy,
          duration: Date.now() - runStartTime,
          rulesProcessed: 0,
          totalStats: { matched: 0, sent: 0, skipped: 0, skippedByThrottle: 0, errors: 0 },
          perRuleStats: []
        });
        return;
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

      for (const rule of activeRules) {
        const stats = await this.executeRule(rule, throttleMap, throttleConfig, templateMap);
        perRuleStats.push({
          ruleId: rule._id.toString(),
          ruleName: rule.name,
          ...stats
        });
      }

      const totalStats = perRuleStats.reduce(
        (acc, s) => ({
          matched: acc.matched + s.matched,
          sent: acc.sent + s.sent,
          skipped: acc.skipped + s.skipped,
          skippedByThrottle: acc.skippedByThrottle + s.skippedByThrottle,
          errors: acc.errors + s.errors,
        }),
        { matched: 0, sent: 0, skipped: 0, skippedByThrottle: 0, errors: 0 }
      );

      await this.EmailRuleRunLog.create({
        runAt: new Date(),
        triggeredBy,
        duration: Date.now() - runStartTime,
        rulesProcessed: activeRules.length,
        totalStats,
        perRuleStats
      });

      this.config.hooks?.onRunComplete?.({ duration: Date.now() - runStartTime, totalStats, perRuleStats });

      this.logger.info('Rule run completed', {
        triggeredBy,
        rulesProcessed: activeRules.length,
        totalSent: totalStats.sent,
        totalSkipped: totalStats.skipped,
        duration: Date.now() - runStartTime
      });
    } finally {
      await this.lock.release();
    }
  }

  async executeRule(
    rule: any,
    throttleMap: Map<string, UserThrottle>,
    throttleConfig: any,
    templateMap?: Map<string, any>
  ): Promise<RuleRunStats> {
    const stats: RuleRunStats = { matched: 0, sent: 0, skipped: 0, skippedByThrottle: 0, errors: 0 };

    const template = templateMap?.get(rule.templateId.toString()) ?? await this.EmailTemplate.findById(rule.templateId);
    if (!template) {
      this.logger.error(`Rule "${rule.name}": template ${rule.templateId} not found`);
      stats.errors = 1;
      return stats;
    }

    let users: Record<string, unknown>[];
    try {
      users = await this.config.adapters.queryUsers(rule.target, rule.maxPerRun || this.config.options?.defaultMaxPerRun || 500);
    } catch (err) {
      this.logger.error(`Rule "${rule.name}": query failed`, { error: err });
      stats.errors = 1;
      return stats;
    }

    stats.matched = users.length;
    this.config.hooks?.onRuleStart?.({ ruleId: rule._id.toString(), ruleName: rule.name, matchedCount: users.length });
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

    const compiled = this.templateRenderer.compileBatch(
      template.subject,
      template.body,
      template.textBody
    );

    const ruleId = rule._id.toString();
    const templateId = rule.templateId.toString();

    for (let i = 0; i < users.length; i++) {
      const user = users[i];
      try {
        const userId = (user._id as any)?.toString();
        const email = user.email as string;
        if (!userId || !email) {
          stats.skipped++;
          this.config.hooks?.onSend?.({ ruleId, ruleName: rule.name, email: email || 'unknown', status: 'invalid' });
          continue;
        }

        const lastSend = sendMap.get(userId);
        if (lastSend) {
          if (rule.sendOnce && !rule.resendAfterDays) {
            stats.skipped++;
            this.config.hooks?.onSend?.({ ruleId, ruleName: rule.name, email, status: 'skipped' });
            continue;
          }
          if (rule.resendAfterDays) {
            const daysSince = (Date.now() - new Date(lastSend.sentAt).getTime()) / MS_PER_DAY;
            if (daysSince < rule.resendAfterDays) {
              stats.skipped++;
              this.config.hooks?.onSend?.({ ruleId, ruleName: rule.name, email, status: 'skipped' });
              continue;
            }
          } else {
            stats.skipped++;
            this.config.hooks?.onSend?.({ ruleId, ruleName: rule.name, email, status: 'skipped' });
            continue;
          }
        }

        const identifier = identifierMap.get(email.toLowerCase().trim());
        if (!identifier) {
          stats.skipped++;
          this.config.hooks?.onSend?.({ ruleId, ruleName: rule.name, email, status: 'invalid' });
          continue;
        }

        if (!this.checkThrottle(rule, userId, email, throttleMap, throttleConfig, stats)) continue;

        const agentSelection = await this.config.adapters.selectAgent(identifier.id, { ruleId, templateId });
        if (!agentSelection) {
          stats.skipped++;
          this.config.hooks?.onSend?.({ ruleId, ruleName: rule.name, email, status: 'skipped' });
          continue;
        }

        const templateData = this.config.adapters.resolveData(user);
        const rendered = this.templateRenderer.renderFromCompiled(compiled, templateData);

        await this.config.adapters.sendEmail({
          identifierId: identifier.id,
          contactId: identifier.contactId,
          accountId: agentSelection.accountId,
          subject: rendered.subject,
          htmlBody: rendered.html,
          textBody: rendered.text,
          ruleId,
          autoApprove: rule.autoApprove ?? true
        });

        await this.EmailRuleSend.logSend(
          ruleId,
          userId,
          identifier.id,
          undefined,
          { status: 'sent', accountId: agentSelection.accountId, subject: rendered.subject }
        );

        const current = throttleMap.get(userId) || { today: 0, thisWeek: 0, lastSentDate: null };
        throttleMap.set(userId, {
          today: current.today + 1,
          thisWeek: current.thisWeek + 1,
          lastSentDate: new Date()
        });

        stats.sent++;
        this.config.hooks?.onSend?.({ ruleId, ruleName: rule.name, email, status: 'sent' });

        if (i < users.length - 1) {
          const delayMs = this.config.options?.delayBetweenSendsMs || 0;
          const jitterMs = this.config.options?.jitterMs || 0;
          if (delayMs > 0 || jitterMs > 0) {
            const totalDelay = delayMs + Math.floor(Math.random() * (jitterMs + 1));
            if (totalDelay > 0) await new Promise(resolve => setTimeout(resolve, totalDelay));
          }
        }
      } catch (err) {
        stats.errors++;
        this.config.hooks?.onSend?.({ ruleId, ruleName: rule.name, email: (user.email as string) || 'unknown', status: 'error' });
        this.logger.error(`Rule "${rule.name}" failed for user ${(user._id as any)?.toString()}`, { error: err });
      }
    }

    await this.EmailRule.findByIdAndUpdate(rule._id, {
      $set: { lastRunAt: new Date(), lastRunStats: stats },
      $inc: { totalSent: stats.sent, totalSkipped: stats.skipped }
    });

    this.config.hooks?.onRuleComplete?.({ ruleId, ruleName: rule.name, stats });

    return stats;
  }

  private checkThrottle(
    rule: any,
    userId: string,
    email: string,
    throttleMap: Map<string, UserThrottle>,
    config: any,
    stats: RuleRunStats
  ): boolean {
    if (rule.emailType === EMAIL_TYPE.Transactional || rule.bypassThrottle) return true;

    const userThrottle = throttleMap.get(userId) || { today: 0, thisWeek: 0, lastSentDate: null };

    if (userThrottle.today >= config.maxPerUserPerDay) {
      stats.skippedByThrottle++;
      this.config.hooks?.onSend?.({ ruleId: rule._id.toString(), ruleName: rule.name, email, status: 'throttled' });
      return false;
    }
    if (userThrottle.thisWeek >= config.maxPerUserPerWeek) {
      stats.skippedByThrottle++;
      this.config.hooks?.onSend?.({ ruleId: rule._id.toString(), ruleName: rule.name, email, status: 'throttled' });
      return false;
    }
    if (userThrottle.lastSentDate) {
      const daysSinceLastSend = (Date.now() - userThrottle.lastSentDate.getTime()) / MS_PER_DAY;
      if (daysSinceLastSend < config.minGapDays) {
        stats.skippedByThrottle++;
        this.config.hooks?.onSend?.({ ruleId: rule._id.toString(), ruleName: rule.name, email, status: 'throttled' });
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
