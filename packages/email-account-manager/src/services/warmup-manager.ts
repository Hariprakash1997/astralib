import type { LogAdapter, EmailAccountManagerConfig, WarmupPhase } from '../types/config.types';
import { ACCOUNT_STATUS } from '../constants';
import type { EmailAccountModel } from '../schemas/email-account.schema';

export interface WarmupStatus {
  accountId: string;
  email: string;
  enabled: boolean;
  currentDay: number;
  startedAt?: Date;
  completedAt?: Date;
  currentPhase: WarmupPhase | null;
  dailyLimit: number;
  delayRange: { min: number; max: number };
}

export class WarmupManager {
  constructor(
    private EmailAccount: EmailAccountModel,
    private config: EmailAccountManagerConfig,
    private logger: LogAdapter,
    private hooks?: EmailAccountManagerConfig['hooks'],
  ) {}

  async startWarmup(accountId: string): Promise<void> {
    const defaultSchedule = this.config.options?.warmup?.defaultSchedule;

    await this.EmailAccount.findByIdAndUpdate(accountId, {
      $set: {
        'warmup.enabled': true,
        'warmup.startedAt': new Date(),
        'warmup.completedAt': null,
        'warmup.currentDay': 1,
        status: ACCOUNT_STATUS.Warmup,
        ...(defaultSchedule ? { 'warmup.schedule': defaultSchedule } : {}),
      },
    });

    this.logger.info('Warmup started', { accountId });
  }

  async completeWarmup(accountId: string): Promise<void> {
    const account = await this.EmailAccount.findByIdAndUpdate(
      accountId,
      {
        $set: {
          'warmup.enabled': false,
          'warmup.completedAt': new Date(),
          status: ACCOUNT_STATUS.Active,
        },
      },
      { new: true },
    );

    if (account) {
      this.logger.info('Warmup completed', { accountId, email: (account as any).email });
      this.hooks?.onWarmupComplete?.({
        accountId,
        email: (account as any).email,
      });
    }
  }

  async resetWarmup(accountId: string): Promise<void> {
    await this.EmailAccount.findByIdAndUpdate(accountId, {
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

  async getCurrentPhase(accountId: string): Promise<WarmupPhase | null> {
    const account = await this.EmailAccount.findById(accountId);
    if (!account) return null;

    const warmup = (account as any).warmup;
    if (!warmup?.enabled || !warmup.schedule) return null;

    return this.findPhaseForDay(warmup.schedule, warmup.currentDay);
  }

  async getRecommendedDelay(accountId: string): Promise<number> {
    const phase = await this.getCurrentPhase(accountId);
    if (!phase) return 0;

    return Math.floor(Math.random() * (phase.delayMaxMs - phase.delayMinMs + 1)) + phase.delayMinMs;
  }

  async getDailyLimit(accountId: string): Promise<number> {
    const account = await this.EmailAccount.findById(accountId);
    if (!account) return 0;

    const warmup = (account as any).warmup;
    if (!warmup?.enabled) return (account as any).limits.dailyMax;

    const phase = this.findPhaseForDay(warmup.schedule, warmup.currentDay);
    return phase ? phase.dailyLimit : (account as any).limits.dailyMax;
  }

  async advanceDay(accountId: string): Promise<void> {
    const account = await this.EmailAccount.findById(accountId);
    if (!account) return;

    const warmup = (account as any).warmup;
    if (!warmup?.enabled) return;

    const nextDay = warmup.currentDay + 1;
    const maxDay = this.getMaxDay(warmup.schedule);

    if (maxDay > 0 && nextDay > maxDay) {
      await this.completeWarmup(accountId);
    } else {
      await this.EmailAccount.findByIdAndUpdate(accountId, {
        $set: { 'warmup.currentDay': nextDay },
      });
    }
  }

  async getStatus(accountId: string): Promise<WarmupStatus | null> {
    const account = await this.EmailAccount.findById(accountId);
    if (!account) return null;

    const acct = account as any;
    const warmup = acct.warmup;
    const phase = warmup?.schedule
      ? this.findPhaseForDay(warmup.schedule, warmup.currentDay)
      : null;

    return {
      accountId: acct._id.toString(),
      email: acct.email,
      enabled: warmup?.enabled ?? false,
      currentDay: warmup?.currentDay ?? 0,
      startedAt: warmup?.startedAt,
      completedAt: warmup?.completedAt,
      currentPhase: phase,
      dailyLimit: phase ? phase.dailyLimit : acct.limits.dailyMax,
      delayRange: phase
        ? { min: phase.delayMinMs, max: phase.delayMaxMs }
        : { min: 0, max: 0 },
    };
  }

  async advanceAllAccounts(): Promise<{ advanced: number; errors: number }> {
    const accounts = await this.EmailAccount.find({
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
        this.logger.error(`Failed to advance warmup for ${(account as any).email}: ${msg}`);
      }
    }

    this.logger.info('Advance all accounts completed', { advanced, errors });
    return { advanced, errors };
  }

  async updateSchedule(accountId: string, schedule: WarmupPhase[]): Promise<void> {
    await this.EmailAccount.findByIdAndUpdate(accountId, {
      $set: { 'warmup.schedule': schedule },
    });
    this.logger.info('Warmup schedule updated', { accountId, phases: schedule.length });
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
