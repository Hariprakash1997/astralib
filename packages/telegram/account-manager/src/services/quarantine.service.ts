import { noopLogger } from '@astralibx/core';
import type { LogAdapter, TelegramAccountManagerConfig } from '../types/config.types';
import type { TelegramAccountModel } from '../schemas/telegram-account.schema';
import { ACCOUNT_STATUS, DEFAULT_QUARANTINE_DURATION_MS, DEFAULT_QUARANTINE_MONITOR_INTERVAL_MS } from '../constants';
import type { ConnectionService } from './connection.service';

export class QuarantineService {
  private monitorInterval: ReturnType<typeof setInterval> | null = null;
  private logger: LogAdapter;

  constructor(
    private TelegramAccount: TelegramAccountModel,
    private connectionService: ConnectionService,
    private config: TelegramAccountManagerConfig,
    private hooks?: TelegramAccountManagerConfig['hooks'],
  ) {
    this.logger = config.logger || noopLogger;
  }

  async quarantine(accountId: string, reason: string, durationMs?: number): Promise<void> {
    const duration = durationMs ?? this.config.options?.quarantine?.defaultDurationMs ?? DEFAULT_QUARANTINE_DURATION_MS;
    const until = new Date(Date.now() + duration);

    const account = await this.TelegramAccount.findOneAndUpdate(
      { _id: accountId },
      {
        $set: {
          status: ACCOUNT_STATUS.Quarantined,
          quarantinedUntil: until,
          quarantineReason: reason,
        },
      },
      { new: true },
    );

    if (!account) return;

    const acct = account as any;

    // Disconnect the client if connected
    await this.connectionService.disconnect(accountId);

    this.logger.warn('Account quarantined', { accountId, phone: acct.phone, reason, until: until.toISOString() });

    try {
      this.hooks?.onAccountQuarantined?.({ accountId, phone: acct.phone, reason, until });
    } catch (e) {
      this.logger.error('Hook onAccountQuarantined error', { accountId, error: e instanceof Error ? e.message : String(e) });
    }
  }

  async release(accountId: string): Promise<void> {
    const account = await this.TelegramAccount.findOneAndUpdate(
      { _id: accountId },
      {
        $set: {
          status: ACCOUNT_STATUS.Disconnected,
        },
        $unset: {
          quarantinedUntil: 1,
          quarantineReason: 1,
        },
      },
      { new: true },
    );

    if (!account) return;

    const acct = account as any;
    this.logger.info('Account released from quarantine', { accountId, phone: acct.phone });

    try {
      this.hooks?.onAccountReleased?.({ accountId, phone: acct.phone });
    } catch (e) {
      this.logger.error('Hook onAccountReleased error', { accountId, error: e instanceof Error ? e.message : String(e) });
    }
  }

  async isQuarantined(accountId: string): Promise<boolean> {
    const account = await this.TelegramAccount.findById(accountId);
    if (!account) return false;

    const acct = account as any;
    return acct.status === ACCOUNT_STATUS.Quarantined && acct.quarantinedUntil && acct.quarantinedUntil > new Date();
  }

  async checkAndReleaseExpired(): Promise<number> {
    const now = new Date();
    let releasedCount = 0;

    // Use findOneAndUpdate in a loop for atomicity (no race conditions)
    while (true) {
      const account = await this.TelegramAccount.findOneAndUpdate(
        {
          status: ACCOUNT_STATUS.Quarantined,
          quarantinedUntil: { $lte: now },
        },
        {
          $set: {
            status: ACCOUNT_STATUS.Disconnected,
          },
          $unset: {
            quarantinedUntil: 1,
            quarantineReason: 1,
          },
        },
        { new: true },
      );

      if (!account) break;

      const acct = account as any;
      releasedCount++;

      this.logger.info('Quarantined account auto-released', { accountId: acct._id.toString(), phone: acct.phone });

      try {
        this.hooks?.onAccountReleased?.({ accountId: acct._id.toString(), phone: acct.phone });
      } catch (e) {
        this.logger.error('Hook onAccountReleased error', { accountId: acct._id.toString(), error: e instanceof Error ? e.message : String(e) });
      }
    }

    return releasedCount;
  }

  startMonitor(): void {
    const intervalMs = this.config.options?.quarantine?.monitorIntervalMs ?? DEFAULT_QUARANTINE_MONITOR_INTERVAL_MS;

    this.monitorInterval = setInterval(async () => {
      try {
        const released = await this.checkAndReleaseExpired();
        if (released > 0) {
          this.logger.info('Quarantine monitor released accounts', { count: released });
        }
      } catch (err) {
        this.logger.error('Quarantine monitor error', { error: err instanceof Error ? err.message : String(err) });
      }
    }, intervalMs);
    this.monitorInterval.unref();

    this.logger.info('Quarantine monitor started', { intervalMs });
  }

  stopMonitor(): void {
    if (this.monitorInterval) {
      clearInterval(this.monitorInterval);
      this.monitorInterval = null;
      this.logger.info('Quarantine monitor stopped');
    }
  }
}
