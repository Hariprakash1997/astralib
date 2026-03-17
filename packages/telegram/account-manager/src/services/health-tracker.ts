import type { AccountHealth } from '../types/account.types';
import { noopLogger } from '@astralibx/core';
import type { LogAdapter, TelegramAccountManagerConfig } from '../types/config.types';
import type { TelegramAccountModel } from '../schemas/telegram-account.schema';
import type { TelegramDailyStatsModel } from '../schemas/telegram-daily-stats.schema';
import { ACCOUNT_STATUS, CRITICAL_ERRORS, QUARANTINE_ERRORS, DEFAULT_HEALTH_CHECK_INTERVAL_MS } from '../constants';
import type { QuarantineService } from './quarantine.service';

export class HealthTracker {
  private monitorInterval: ReturnType<typeof setInterval> | null = null;
  private logger: LogAdapter;

  constructor(
    private TelegramAccount: TelegramAccountModel,
    private TelegramDailyStats: TelegramDailyStatsModel,
    private config: TelegramAccountManagerConfig,
    private hooks?: TelegramAccountManagerConfig['hooks'],
    private quarantineService?: QuarantineService,
  ) {
    this.logger = config.logger || noopLogger;
  }

  async getHealth(accountId: string): Promise<AccountHealth | null> {
    const account = await this.TelegramAccount.findById(accountId);
    if (!account) return null;
    return this.toAccountHealth(account);
  }

  async getAllHealth(): Promise<AccountHealth[]> {
    const accounts = await this.TelegramAccount.find();
    return accounts.map((a) => this.toAccountHealth(a));
  }

  async recordSuccess(accountId: string): Promise<void> {
    const oldAccount = await this.TelegramAccount.findById(accountId);
    if (!oldAccount) return;

    const oldScore = (oldAccount as any).healthScore;

    const updated = await this.TelegramAccount.findByIdAndUpdate(
      accountId,
      [
        {
          $set: {
            healthScore: { $min: [100, { $add: ['$healthScore', 2] }] },
            consecutiveErrors: 0,
            lastSuccessfulSendAt: new Date(),
            totalMessagesSent: { $add: ['$totalMessagesSent', 1] },
          },
        },
      ],
      { new: true },
    );

    if (!updated) return;

    const acct = updated as any;
    const newScore = acct.healthScore;

    if (oldScore !== newScore) {
      try {
        this.hooks?.onHealthChange?.({ accountId, phone: acct.phone, oldScore, newScore });
      } catch (e) {
        this.logger.error('Hook onHealthChange error', { accountId, error: e instanceof Error ? e.message : String(e) });
      }
    }

    const dateStr = this.getTodayDateString();
    await this.TelegramDailyStats.incrementStat(accountId, 'sent', 1, dateStr);
  }

  async recordError(accountId: string, errorCode: string): Promise<void> {
    const oldAccount = await this.TelegramAccount.findById(accountId);
    if (!oldAccount) return;

    const oldScore = (oldAccount as any).healthScore;
    const isFloodWait = errorCode === 'FLOOD_WAIT' || errorCode === 'SLOWMODE_WAIT';
    const scoreDecrement = isFloodWait ? 20 : 10;

    const updatePipeline: any[] = [
      {
        $set: {
          healthScore: { $max: [0, { $subtract: ['$healthScore', scoreDecrement] }] },
          consecutiveErrors: { $add: ['$consecutiveErrors', 1] },
          lastError: errorCode,
          lastErrorAt: new Date(),
          ...(isFloodWait ? { floodWaitCount: { $add: ['$floodWaitCount', 1] } } : {}),
        },
      },
    ];

    const updated = await this.TelegramAccount.findByIdAndUpdate(accountId, updatePipeline, { new: true });
    if (!updated) return;

    const acct = updated as any;
    const newScore = acct.healthScore;

    this.logger.warn('Account health degraded', {
      accountId,
      errorCode,
      oldScore,
      newScore,
      consecutiveErrors: acct.consecutiveErrors,
    });

    if (oldScore !== newScore) {
      try {
        this.hooks?.onHealthChange?.({ accountId, phone: acct.phone, oldScore, newScore });
      } catch (e) {
        this.logger.error('Hook onHealthChange error', { accountId, error: e instanceof Error ? e.message : String(e) });
      }
    }

    // Critical error → mark banned
    if ((CRITICAL_ERRORS as readonly string[]).includes(errorCode)) {
      await this.TelegramAccount.findByIdAndUpdate(accountId, {
        $set: { status: ACCOUNT_STATUS.Banned },
      });

      this.logger.error('Account banned due to critical error', { accountId, errorCode });

      try {
        this.hooks?.onAccountBanned?.({ accountId, phone: acct.phone, errorCode });
      } catch (e) {
        this.logger.error('Hook onAccountBanned error', { accountId, error: e instanceof Error ? e.message : String(e) });
      }
      return;
    }

    // Quarantine error → auto-quarantine
    if ((QUARANTINE_ERRORS as readonly string[]).includes(errorCode) && this.quarantineService) {
      try {
        await this.quarantineService.quarantine(accountId, `Auto-quarantined: ${errorCode}`);
      } catch (e) {
        this.logger.error('Auto-quarantine failed', { accountId, error: e instanceof Error ? e.message : String(e) });
      }
    }

    const dateStr = this.getTodayDateString();
    await this.TelegramDailyStats.incrementStat(accountId, 'failed', 1, dateStr);
  }

  startMonitor(): void {
    const intervalMs = this.config.options?.healthCheckIntervalMs ?? DEFAULT_HEALTH_CHECK_INTERVAL_MS;

    this.monitorInterval = setInterval(async () => {
      try {
        const accounts = await this.TelegramAccount.find({
          status: { $in: [ACCOUNT_STATUS.Connected, ACCOUNT_STATUS.Warmup] },
        });

        for (const account of accounts) {
          const acct = account as any;
          if (acct.healthScore < 20) {
            this.logger.warn('Account health critically low', {
              accountId: acct._id.toString(),
              phone: acct.phone,
              healthScore: acct.healthScore,
            });
          }
        }
      } catch (err) {
        this.logger.error('Health monitor error', { error: err instanceof Error ? err.message : String(err) });
      }
    }, intervalMs);

    this.logger.info('Health monitor started', { intervalMs });
  }

  stopMonitor(): void {
    if (this.monitorInterval) {
      clearInterval(this.monitorInterval);
      this.monitorInterval = null;
      this.logger.info('Health monitor stopped');
    }
  }

  private toAccountHealth(account: any): AccountHealth {
    return {
      accountId: account._id.toString(),
      phone: account.phone,
      healthScore: account.healthScore,
      consecutiveErrors: account.consecutiveErrors,
      floodWaitCount: account.floodWaitCount,
      status: account.status,
      lastSuccessfulSendAt: account.lastSuccessfulSendAt || null,
    };
  }

  private getTodayDateString(): string {
    return new Intl.DateTimeFormat('en-CA', { timeZone: 'UTC' }).format(new Date());
  }
}
