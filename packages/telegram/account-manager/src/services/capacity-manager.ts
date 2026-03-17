import { Types } from 'mongoose';
import type { AccountCapacity } from '../types/account.types';
import { noopLogger } from '@astralibx/core';
import type { LogAdapter, TelegramAccountManagerConfig } from '../types/config.types';
import { ACCOUNT_STATUS } from '../constants';
import type { WarmupManager } from './warmup-manager';
import type { TelegramAccountModel } from '../schemas/telegram-account.schema';
import type { TelegramDailyStatsModel } from '../schemas/telegram-daily-stats.schema';

export class CapacityManager {
  private logger: LogAdapter;

  constructor(
    private TelegramAccount: TelegramAccountModel,
    private TelegramDailyStats: TelegramDailyStatsModel,
    private warmupManager: WarmupManager,
    private config: TelegramAccountManagerConfig,
  ) {
    this.logger = config.logger || noopLogger;
  }

  async getAccountCapacity(accountId: string): Promise<AccountCapacity> {
    const account = await this.TelegramAccount.findById(accountId);
    if (!account) {
      return {
        accountId,
        phone: '',
        dailyMax: 0,
        sentToday: 0,
        remaining: 0,
        usagePercent: 0,
        status: ACCOUNT_STATUS.Disconnected,
      };
    }

    const acct = account as any;
    const sentToday = await this.getSentToday(accountId);
    const dailyMax = await this.warmupManager.getDailyLimit(acct);
    const remaining = Math.max(0, dailyMax - sentToday);
    const usagePercent = dailyMax > 0 ? Math.round((sentToday / dailyMax) * 100) : 0;

    return {
      accountId: acct._id.toString(),
      phone: acct.phone,
      dailyMax,
      sentToday,
      remaining,
      usagePercent,
      status: acct.status,
    };
  }

  async getAllCapacity(): Promise<{ accounts: AccountCapacity[]; totalRemaining: number }> {
    const accounts = await this.TelegramAccount.find({
      status: { $in: [ACCOUNT_STATUS.Connected, ACCOUNT_STATUS.Warmup] },
    });

    const capacities = await Promise.all(
      accounts.map((a) => this.getAccountCapacity((a as any)._id.toString())),
    );

    const totalRemaining = capacities.reduce((sum, c) => sum + c.remaining, 0);

    return { accounts: capacities, totalRemaining };
  }

  async getBestAccount(): Promise<AccountCapacity | null> {
    const accounts = await this.TelegramAccount.find({
      status: { $in: [ACCOUNT_STATUS.Connected, ACCOUNT_STATUS.Warmup] },
    }).sort({ healthScore: -1 });

    for (const account of accounts) {
      const acct = account as any;
      const capacity = await this.getAccountCapacity(acct._id.toString());
      if (capacity.remaining > 0) {
        return capacity;
      }
    }

    return null;
  }

  async incrementSent(accountId: string): Promise<void> {
    const dateStr = this.getTodayDateString();
    await this.TelegramDailyStats.incrementStat(accountId, 'sent', 1, dateStr);
  }

  async incrementFailed(accountId: string): Promise<void> {
    const dateStr = this.getTodayDateString();
    await this.TelegramDailyStats.incrementStat(accountId, 'failed', 1, dateStr);
  }

  async getSentToday(accountId: string): Promise<number> {
    const dateStr = this.getTodayDateString();
    const stat = await this.TelegramDailyStats.findOne({ accountId: new Types.ObjectId(accountId), date: dateStr });
    return stat?.sent || 0;
  }

  private getTodayDateString(): string {
    return new Intl.DateTimeFormat('en-CA', { timeZone: 'UTC' }).format(new Date());
  }
}
