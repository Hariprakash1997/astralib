import { TemplateRenderService } from './template-render.service';
import { RedisLock } from '../utils/redis-lock';
import type { EmailRuleModel } from '../schemas/rule.schema';
import type { EmailTemplateModel } from '../schemas/template.schema';
import type { EmailRuleSendModel } from '../schemas/rule-send.schema';
import type { EmailRuleRunLogModel } from '../schemas/run-log.schema';
import type { EmailThrottleConfigModel } from '../schemas/throttle-config.schema';
import { RunTrigger, EmailType } from '../types/enums';
import type { RuleRunStats, PerRuleStats } from '../types/rule.types';
import type { EmailRuleEngineConfig, LogAdapter } from '../types/config.types';

const MS_PER_DAY = 86400000;
const DEFAULT_LOCK_TTL_MS = 30 * 60 * 1000;

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

  async runAllRules(triggeredBy: typeof RunTrigger[keyof typeof RunTrigger] = RunTrigger.Cron): Promise<void> {
    const lockAcquired = await this.lock.acquire();
    if (!lockAcquired) {
      this.logger.warn('Rule runner already executing, skipping');
      return;
    }

    const runStartTime = Date.now();

    try {
      const throttleConfig = await this.EmailThrottleConfig.getConfig();
      const activeRules = await this.EmailRule.findActive();

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

      const recentSends = await this.EmailRuleSend.find({
        sentAt: { $gte: new Date(Date.now() - 7 * MS_PER_DAY) }
      }).lean();

      const throttleMap = this.buildThrottleMap(recentSends);
      const perRuleStats: PerRuleStats[] = [];

      for (const rule of activeRules) {
        const stats = await this.executeRule(rule, throttleMap, throttleConfig);
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
    throttleConfig: any
  ): Promise<RuleRunStats> {
    const stats: RuleRunStats = { matched: 0, sent: 0, skipped: 0, skippedByThrottle: 0, errors: 0 };

    const template = await this.EmailTemplate.findById(rule.templateId);
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

    const identifierResults = await Promise.all(
      [...new Set(emails.map(e => e.toLowerCase().trim()))].map(async email => {
        const result = await this.config.adapters.findIdentifier(email);
        return result ? { email, ...result } : null;
      })
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

    for (const user of users) {
      try {
        const userId = (user._id as any)?.toString();
        const email = user.email as string;
        if (!userId || !email) { stats.skipped++; continue; }

        const lastSend = sendMap.get(userId);
        if (lastSend) {
          if (rule.sendOnce && !rule.resendAfterDays) { stats.skipped++; continue; }
          if (rule.resendAfterDays) {
            const daysSince = (Date.now() - new Date(lastSend.sentAt).getTime()) / MS_PER_DAY;
            if (daysSince < rule.resendAfterDays) { stats.skipped++; continue; }
          } else {
            stats.skipped++; continue;
          }
        }

        const identifier = identifierMap.get(email.toLowerCase().trim());
        if (!identifier) { stats.skipped++; continue; }

        if (!this.checkThrottle(rule, userId, throttleMap, throttleConfig, stats)) continue;

        const agentSelection = await this.config.adapters.selectAgent(identifier.id);
        if (!agentSelection) { stats.skipped++; continue; }

        const templateData = this.config.adapters.resolveData(user);
        const rendered = this.templateRenderer.renderFromCompiled(compiled, templateData);

        await this.config.adapters.sendEmail({
          identifierId: identifier.id,
          contactId: identifier.contactId,
          accountId: agentSelection.accountId,
          subject: rendered.subject,
          htmlBody: rendered.html,
          textBody: rendered.text,
          ruleId: rule._id.toString(),
          autoApprove: rule.autoApprove ?? true
        });

        await this.EmailRuleSend.logSend(
          rule._id.toString(),
          userId,
          identifier.id
        );

        const current = throttleMap.get(userId) || { today: 0, thisWeek: 0, lastSentDate: null };
        throttleMap.set(userId, {
          today: current.today + 1,
          thisWeek: current.thisWeek + 1,
          lastSentDate: new Date()
        });

        stats.sent++;
      } catch (err) {
        stats.errors++;
        this.logger.error(`Rule "${rule.name}" failed for user ${(user._id as any)?.toString()}`, { error: err });
      }
    }

    await this.EmailRule.findByIdAndUpdate(rule._id, {
      $set: { lastRunAt: new Date(), lastRunStats: stats },
      $inc: { totalSent: stats.sent, totalSkipped: stats.skipped }
    });

    return stats;
  }

  private checkThrottle(
    rule: any,
    userId: string,
    throttleMap: Map<string, UserThrottle>,
    config: any,
    stats: RuleRunStats
  ): boolean {
    if (rule.emailType === EmailType.Transactional || rule.bypassThrottle) return true;

    const userThrottle = throttleMap.get(userId) || { today: 0, thisWeek: 0, lastSentDate: null };

    if (userThrottle.today >= config.maxPerUserPerDay) {
      stats.skippedByThrottle++;
      return false;
    }
    if (userThrottle.thisWeek >= config.maxPerUserPerWeek) {
      stats.skippedByThrottle++;
      return false;
    }
    if (userThrottle.lastSentDate) {
      const daysSinceLastSend = (Date.now() - userThrottle.lastSentDate.getTime()) / MS_PER_DAY;
      if (daysSinceLastSend < config.minGapDays) {
        stats.skippedByThrottle++;
        return false;
      }
    }

    return true;
  }

  buildThrottleMap(recentSends: any[]): Map<string, UserThrottle> {
    const map = new Map<string, UserThrottle>();
    const todayStart = new Date();
    todayStart.setHours(0, 0, 0, 0);

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
