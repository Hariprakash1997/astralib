import type { AccountHealth } from '../types/account.types';
import type { LogAdapter, EmailAccountManagerConfig } from '../types/config.types';
import type { BounceType } from '../constants';
import { ACCOUNT_STATUS } from '../constants';
import type { SettingsService } from './settings.service';
import type { EmailAccountModel } from '../schemas/email-account.schema';
import type { EmailDailyStatsModel } from '../schemas/email-daily-stats.schema';

export class HealthTracker {
  constructor(
    private EmailAccount: EmailAccountModel,
    private EmailDailyStats: EmailDailyStatsModel,
    private settings: SettingsService,
    private logger: LogAdapter,
    private hooks?: EmailAccountManagerConfig['hooks'],
  ) {}

  async recordSuccess(accountId: string): Promise<void> {
    const updated = await this.EmailAccount.findByIdAndUpdate(
      accountId,
      [
        {
          $set: {
            'health.score': { $min: [100, { $add: ['$health.score', 1] }] },
            'health.consecutiveErrors': 0,
            lastSuccessfulSendAt: new Date(),
            totalEmailsSent: { $add: ['$totalEmailsSent', 1] },
          },
        },
      ],
      { new: true },
    );

    if (!updated) return;

    const dateStr = await this.getTodayDateString();
    await this.incrementDailyStat(accountId, 'sent', 1, dateStr);
  }

  async recordError(accountId: string, error: string): Promise<void> {
    const updated = await this.EmailAccount.findByIdAndUpdate(
      accountId,
      [
        {
          $set: {
            'health.score': { $max: [0, { $subtract: ['$health.score', 5] }] },
            'health.consecutiveErrors': { $add: ['$health.consecutiveErrors', 1] },
          },
        },
      ],
      { new: true },
    );

    if (!updated) return;

    const acct = updated as any;
    const newScore = acct.health.score;
    const newErrors = acct.health.consecutiveErrors;

    this.logger.warn('Account health degraded', {
      accountId,
      error,
      score: newScore,
      consecutiveErrors: newErrors,
    });

    this.hooks?.onHealthDegraded?.({ accountId, healthScore: newScore });

    const thresholds = acct.health.thresholds;
    const shouldDisable =
      newScore < thresholds.minScore ||
      newErrors > thresholds.maxConsecutiveErrors;

    if (shouldDisable) {
      const reason = newScore < thresholds.minScore
        ? `Health score ${newScore} below minimum ${thresholds.minScore}`
        : `${newErrors} consecutive errors exceeds maximum ${thresholds.maxConsecutiveErrors}`;

      await this.EmailAccount.findByIdAndUpdate(accountId, {
        $set: { status: ACCOUNT_STATUS.Disabled },
      });

      this.logger.error('Account auto-disabled', { accountId, reason });
      this.hooks?.onAccountDisabled?.({ accountId, reason });
    }
  }

  async recordBounce(accountId: string, email: string, bounceType: BounceType): Promise<void> {
    const updated = await this.EmailAccount.findByIdAndUpdate(
      accountId,
      [
        {
          $set: {
            'health.score': { $max: [0, { $subtract: ['$health.score', 10] }] },
            'health.bounceCount': { $add: ['$health.bounceCount', 1] },
          },
        },
      ],
      { new: true },
    );

    if (!updated) return;

    const acct = updated as any;
    const newScore = acct.health.score;
    const newBounceCount = acct.health.bounceCount;
    const totalSent = acct.totalEmailsSent || 1;
    const bounceRate = (newBounceCount / totalSent) * 100;

    const dateStr = await this.getTodayDateString();
    await this.incrementDailyStat(accountId, 'bounced', 1, dateStr);

    this.logger.warn('Bounce recorded', { accountId, email, bounceType, score: newScore });
    this.hooks?.onBounce?.({
      accountId,
      email,
      bounceType,
      provider: acct.provider,
    });

    if (bounceRate > acct.health.thresholds.maxBounceRate) {
      const reason = `Bounce rate ${bounceRate.toFixed(1)}% exceeds maximum ${acct.health.thresholds.maxBounceRate}%`;
      await this.EmailAccount.findByIdAndUpdate(accountId, {
        $set: { status: ACCOUNT_STATUS.Disabled },
      });
      this.logger.error('Account auto-disabled due to bounce rate', { accountId, reason });
      this.hooks?.onAccountDisabled?.({ accountId, reason });
    }
  }

  async getHealth(accountId: string): Promise<AccountHealth | null> {
    const account = await this.EmailAccount.findById(accountId);
    if (!account) return null;
    return this.toAccountHealth(account);
  }

  async getAllHealth(): Promise<AccountHealth[]> {
    const accounts = await this.EmailAccount.find();
    return accounts.map((a) => this.toAccountHealth(a));
  }

  private toAccountHealth(account: any): AccountHealth {
    return {
      accountId: account._id.toString(),
      email: account.email,
      score: account.health.score,
      consecutiveErrors: account.health.consecutiveErrors,
      bounceCount: account.health.bounceCount,
      thresholds: account.health.thresholds,
      status: account.status,
    };
  }

  private async getTodayDateString(): Promise<string> {
    const globalSettings = await this.settings.get();
    const tz = globalSettings.timezone || 'UTC';
    const now = new Date();
    const formatted = now.toLocaleDateString('en-CA', { timeZone: tz });
    return formatted;
  }

  private async incrementDailyStat(
    accountId: string,
    field: string,
    amount: number,
    date: string,
  ): Promise<void> {
    await this.EmailDailyStats.findOneAndUpdate(
      { accountId, date },
      { $inc: { [field]: amount } },
      { upsert: true },
    );
  }
}
