import { noopLogger } from '@astralibx/core';
import type { LogAdapter, TelegramAccountManagerConfig, WarmupPhase } from '../types/config.types';
import { ACCOUNT_STATUS, DEFAULT_WARMUP_SCHEDULE, DEFAULT_WARMUP_ADVANCE_INTERVAL_MS } from '../constants';
import type { TelegramAccountModel, ITelegramAccount } from '../schemas/telegram-account.schema';

export interface WarmupStatus {
  accountId: string;
  phone: string;
  enabled: boolean;
  currentDay: number;
  startedAt?: Date;
  completedAt?: Date;
  currentPhase: WarmupPhase | null;
  dailyLimit: number;
  delayRange: { min: number; max: number };
}

export class WarmupManager {
  private logger: LogAdapter;
  private advanceInterval: ReturnType<typeof setInterval> | null = null;

  constructor(
    private TelegramAccount: TelegramAccountModel,
    private config: TelegramAccountManagerConfig,
    private hooks?: TelegramAccountManagerConfig['hooks'],
  ) {
    this.logger = config.logger || noopLogger;
  }

  async startWarmup(accountId: string, schedule?: WarmupPhase[]): Promise<void> {
    const warmupSchedule = schedule || this.config.options?.warmup?.defaultSchedule || DEFAULT_WARMUP_SCHEDULE;

    await this.TelegramAccount.findByIdAndUpdate(accountId, {
      $set: {
        'warmup.enabled': true,
        'warmup.startedAt': new Date(),
        'warmup.completedAt': null,
        'warmup.currentDay': 1,
        'warmup.schedule': warmupSchedule,
        status: ACCOUNT_STATUS.Warmup,
      },
    });

    this.logger.info('Warmup started', { accountId });
  }

  async advanceDay(accountId: string): Promise<void> {
    const account = await this.TelegramAccount.findById(accountId);
    if (!account) return;

    const warmup = (account as any).warmup;
    if (!warmup?.enabled) return;

    const nextDay = warmup.currentDay + 1;
    const maxDay = this.getMaxDay(warmup.schedule);

    if (maxDay > 0 && nextDay > maxDay) {
      await this.completeWarmup(accountId);
    } else {
      await this.TelegramAccount.findByIdAndUpdate(accountId, {
        $set: { 'warmup.currentDay': nextDay },
      });
    }
  }

  async advanceAllAccounts(): Promise<{ advanced: number; errors: number }> {
    const accounts = await this.TelegramAccount.find({
      status: ACCOUNT_STATUS.Warmup,
      'warmup.enabled': true,
    });

    let advanced = 0;
    let errors = 0;

    for (const account of accounts) {
      try {
        await this.advanceDay((account as any)._id.toString());
        advanced++;
      } catch (err) {
        errors++;
        const msg = err instanceof Error ? err.message : 'Unknown error';
        this.logger.error(`Failed to advance warmup for ${(account as any).phone}: ${msg}`);
      }
    }

    this.logger.info('Advance all accounts completed', { advanced, errors });
    return { advanced, errors };
  }

  async completeWarmup(accountId: string): Promise<void> {
    const account = await this.TelegramAccount.findByIdAndUpdate(
      accountId,
      {
        $set: {
          'warmup.enabled': false,
          'warmup.completedAt': new Date(),
          status: ACCOUNT_STATUS.Connected,
        },
      },
      { new: true },
    );

    if (account) {
      const acct = account as any;
      this.logger.info('Warmup completed', { accountId, phone: acct.phone });

      try {
        this.hooks?.onWarmupComplete?.({ accountId, phone: acct.phone });
      } catch (e) {
        this.logger.error('Hook onWarmupComplete error', { accountId, error: e instanceof Error ? e.message : String(e) });
      }
    }
  }

  async getDailyLimit(account: ITelegramAccount): Promise<number> {
    const warmup = account.warmup;
    if (!warmup?.enabled) return account.currentDailyLimit;

    const phase = this.findPhaseForDay(warmup.schedule, warmup.currentDay);
    return phase ? phase.dailyLimit : account.currentDailyLimit;
  }

  async getCurrentPhase(account: ITelegramAccount): Promise<WarmupPhase | null> {
    const warmup = account.warmup;
    if (!warmup?.enabled || !warmup.schedule) return null;

    return this.findPhaseForDay(warmup.schedule, warmup.currentDay);
  }

  async getRecommendedDelay(account: ITelegramAccount): Promise<number> {
    const phase = await this.getCurrentPhase(account);
    if (!phase) return 0;

    return Math.floor(Math.random() * (phase.delayMaxMs - phase.delayMinMs + 1)) + phase.delayMinMs;
  }

  async resetWarmup(accountId: string): Promise<void> {
    await this.TelegramAccount.findByIdAndUpdate(accountId, {
      $set: {
        'warmup.enabled': true,
        'warmup.startedAt': new Date(),
        'warmup.completedAt': null,
        'warmup.currentDay': 1,
        status: ACCOUNT_STATUS.Warmup,
      },
    });

    this.logger.info('Warmup reset', { accountId });
  }

  async getStatus(accountId: string): Promise<WarmupStatus | null> {
    const account = await this.TelegramAccount.findById(accountId);
    if (!account) return null;

    const acct = account as any;
    const warmup = acct.warmup;
    const phase = warmup?.schedule
      ? this.findPhaseForDay(warmup.schedule, warmup.currentDay)
      : null;

    return {
      accountId: acct._id.toString(),
      phone: acct.phone,
      enabled: warmup?.enabled ?? false,
      currentDay: warmup?.currentDay ?? 0,
      startedAt: warmup?.startedAt,
      completedAt: warmup?.completedAt,
      currentPhase: phase,
      dailyLimit: phase ? phase.dailyLimit : acct.currentDailyLimit,
      delayRange: phase
        ? { min: phase.delayMinMs, max: phase.delayMaxMs }
        : { min: acct.currentDelayMin, max: acct.currentDelayMax },
    };
  }

  startAutoAdvance(intervalMs = DEFAULT_WARMUP_ADVANCE_INTERVAL_MS): void {
    if (this.advanceInterval) return;

    this.advanceInterval = setInterval(() => {
      this.advanceAllAccounts().catch((err) => {
        const msg = err instanceof Error ? err.message : String(err);
        this.logger.error(`Auto-advance failed: ${msg}`);
      });
    }, intervalMs);
    this.advanceInterval.unref();

    this.logger.info('Warmup auto-advance started');
  }

  stopAutoAdvance(): void {
    if (this.advanceInterval) {
      clearInterval(this.advanceInterval);
      this.advanceInterval = null;
      this.logger.info('Warmup auto-advance stopped');
    }
  }

  private findPhaseForDay(schedule: WarmupPhase[], day: number): WarmupPhase | null {
    for (const phase of schedule) {
      const [start, end] = phase.days;
      if (end === 0) {
        if (day >= start) return phase;
      } else {
        if (day >= start && day <= end) return phase;
      }
    }
    return null;
  }

  private getMaxDay(schedule: WarmupPhase[]): number {
    let max = 0;
    for (const phase of schedule) {
      if (phase.days[1] === 0) return 0;
      if (phase.days[1] > max) max = phase.days[1];
    }
    return max;
  }
}
