import type { AccountCapacity } from '../types/account.types';
import type { LogAdapter } from '../types/config.types';
import { ACCOUNT_STATUS } from '../constants';
import type { WarmupManager } from './warmup-manager';
import type { SettingsService } from './settings.service';
import type { EmailAccountDocument, EmailAccountModel } from '../schemas/email-account.schema';
import type { EmailDailyStatsModel } from '../schemas/email-daily-stats.schema';

export class CapacityManager {
  constructor(
    private EmailAccount: EmailAccountModel,
    private EmailDailyStats: EmailDailyStatsModel,
    private warmupManager: WarmupManager,
    private settings: SettingsService,
    private logger: LogAdapter,
  ) {}

  async getBestAccount(): Promise<EmailAccountDocument | null> {
    const accounts = await this.EmailAccount.find({
      status: { $in: [ACCOUNT_STATUS.Active, ACCOUNT_STATUS.Warmup] },
    }).sort({ 'health.score': -1 });

    for (const account of accounts) {
      const acct = account as any;
      const capacity = await this.getAccountCapacity(acct._id.toString());
      if (capacity.remaining > 0) {
        return account;
      }
    }

    return null;
  }

  async getAccountCapacity(accountId: string): Promise<AccountCapacity> {
    const account = await this.EmailAccount.findById(accountId);
    if (!account) {
      return {
        accountId,
        email: '',
        provider: 'gmail' as any,
        dailyMax: 0,
        sentToday: 0,
        remaining: 0,
        usagePercent: 0,
      };
    }

    const acct = account as any;
    const sentToday = await this.getSentToday(accountId);
    const dailyMax = await this.getDailyLimit(acct);
    const remaining = Math.max(0, dailyMax - sentToday);
    const usagePercent = dailyMax > 0 ? Math.round((sentToday / dailyMax) * 100) : 0;

    return {
      accountId: acct._id.toString(),
      email: acct.email,
      provider: acct.provider,
      dailyMax,
      sentToday,
      remaining,
      usagePercent,
    };
  }

  async getAllCapacity(): Promise<{ accounts: AccountCapacity[]; totalRemaining: number }> {
    const accounts = await this.EmailAccount.find({
      status: { $in: [ACCOUNT_STATUS.Active, ACCOUNT_STATUS.Warmup] },
    });

    const capacities = await Promise.all(
      accounts.map((a) => this.getAccountCapacity((a as any)._id.toString())),
    );

    const totalRemaining = capacities.reduce((sum, c) => sum + c.remaining, 0);

    return { accounts: capacities, totalRemaining };
  }

  private async getSentToday(accountId: string): Promise<number> {
    const dateStr = await this.getTodayDateString();
    const stat = await this.EmailDailyStats.findOne({ accountId, date: dateStr });
    return stat?.sent || 0;
  }

  private async getDailyLimit(account: any): Promise<number> {
    if (account.warmup?.enabled) {
      const warmupLimit = await this.warmupManager.getDailyLimit(account._id.toString());
      return warmupLimit;
    }
    return account.limits.dailyMax;
  }

  private async getTodayDateString(): Promise<string> {
    const globalSettings = await this.settings.get();
    const tz = globalSettings.timezone || 'UTC';
    return new Date().toLocaleDateString('en-CA', { timeZone: tz });
  }
}
