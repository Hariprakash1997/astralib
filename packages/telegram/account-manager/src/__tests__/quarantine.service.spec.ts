import { describe, it, expect, vi, beforeEach } from 'vitest';
import { QuarantineService } from '../services/quarantine.service';
import { ACCOUNT_STATUS, DEFAULT_QUARANTINE_DURATION_MS } from '../constants';
import type { TelegramAccountModel } from '../schemas/telegram-account.schema';
import type { TelegramAccountManagerConfig } from '../types/config.types';
import type { ConnectionService } from '../services/connection.service';

function createMockConfig(overrides: Partial<TelegramAccountManagerConfig> = {}): TelegramAccountManagerConfig {
  return {
    db: { connection: {} as any },
    credentials: { apiId: 12345, apiHash: 'abc123' },
    logger: {
      info: vi.fn(),
      warn: vi.fn(),
      error: vi.fn(),
    },
    hooks: {
      onAccountQuarantined: vi.fn(),
      onAccountReleased: vi.fn(),
    },
    ...overrides,
  };
}

function createMockTelegramAccount() {
  return {
    findById: vi.fn(),
    findOneAndUpdate: vi.fn(),
  } as unknown as TelegramAccountModel;
}

function createMockConnectionService() {
  return {
    disconnect: vi.fn().mockResolvedValue(undefined),
  } as unknown as ConnectionService;
}

function makeAccountDoc(overrides: Record<string, unknown> = {}) {
  return {
    _id: 'acc-1',
    phone: '+1234567890',
    status: ACCOUNT_STATUS.Quarantined,
    quarantinedUntil: new Date(Date.now() + 86400000),
    quarantineReason: 'PEER_FLOOD',
    ...overrides,
  };
}

describe('QuarantineService', () => {
  let service: QuarantineService;
  let TelegramAccount: TelegramAccountModel;
  let connectionService: ConnectionService;
  let config: TelegramAccountManagerConfig;

  beforeEach(() => {
    TelegramAccount = createMockTelegramAccount();
    connectionService = createMockConnectionService();
    config = createMockConfig();
    service = new QuarantineService(TelegramAccount, connectionService, config, config.hooks);
  });

  describe('quarantine()', () => {
    it('should set quarantine fields atomically', async () => {
      const account = makeAccountDoc();
      (TelegramAccount.findOneAndUpdate as ReturnType<typeof vi.fn>).mockResolvedValue(account);

      await service.quarantine('acc-1', 'PEER_FLOOD');

      expect(TelegramAccount.findOneAndUpdate).toHaveBeenCalledWith(
        { _id: 'acc-1' },
        {
          $set: {
            status: ACCOUNT_STATUS.Quarantined,
            quarantinedUntil: expect.any(Date),
            quarantineReason: 'PEER_FLOOD',
          },
        },
        { new: true },
      );
    });

    it('should use default duration when not specified', async () => {
      const account = makeAccountDoc();
      (TelegramAccount.findOneAndUpdate as ReturnType<typeof vi.fn>).mockResolvedValue(account);

      const before = Date.now();
      await service.quarantine('acc-1', 'PEER_FLOOD');
      const after = Date.now();

      const updateCall = (TelegramAccount.findOneAndUpdate as ReturnType<typeof vi.fn>).mock.calls[0];
      const quarantinedUntil = updateCall[1].$set.quarantinedUntil as Date;
      const expectedMin = before + DEFAULT_QUARANTINE_DURATION_MS;
      const expectedMax = after + DEFAULT_QUARANTINE_DURATION_MS;

      expect(quarantinedUntil.getTime()).toBeGreaterThanOrEqual(expectedMin);
      expect(quarantinedUntil.getTime()).toBeLessThanOrEqual(expectedMax);
    });

    it('should use custom duration when provided', async () => {
      const account = makeAccountDoc();
      (TelegramAccount.findOneAndUpdate as ReturnType<typeof vi.fn>).mockResolvedValue(account);

      const customDuration = 3600000; // 1 hour
      const before = Date.now();
      await service.quarantine('acc-1', 'PEER_FLOOD', customDuration);

      const updateCall = (TelegramAccount.findOneAndUpdate as ReturnType<typeof vi.fn>).mock.calls[0];
      const quarantinedUntil = updateCall[1].$set.quarantinedUntil as Date;

      expect(quarantinedUntil.getTime()).toBeGreaterThanOrEqual(before + customDuration);
    });

    it('should disconnect the client', async () => {
      const account = makeAccountDoc();
      (TelegramAccount.findOneAndUpdate as ReturnType<typeof vi.fn>).mockResolvedValue(account);

      await service.quarantine('acc-1', 'PEER_FLOOD');

      expect(connectionService.disconnect).toHaveBeenCalledWith('acc-1');
    });

    it('should call onAccountQuarantined hook', async () => {
      const account = makeAccountDoc();
      (TelegramAccount.findOneAndUpdate as ReturnType<typeof vi.fn>).mockResolvedValue(account);

      await service.quarantine('acc-1', 'PEER_FLOOD');

      expect(config.hooks!.onAccountQuarantined).toHaveBeenCalledWith({
        accountId: 'acc-1',
        phone: '+1234567890',
        reason: 'PEER_FLOOD',
        until: expect.any(Date),
      });
    });

    it('should log warning with account details', async () => {
      const account = makeAccountDoc();
      (TelegramAccount.findOneAndUpdate as ReturnType<typeof vi.fn>).mockResolvedValue(account);

      await service.quarantine('acc-1', 'PEER_FLOOD');

      expect(config.logger!.warn).toHaveBeenCalledWith('Account quarantined', expect.objectContaining({
        accountId: 'acc-1',
        phone: '+1234567890',
        reason: 'PEER_FLOOD',
      }));
    });

    it('should do nothing if account not found', async () => {
      (TelegramAccount.findOneAndUpdate as ReturnType<typeof vi.fn>).mockResolvedValue(null);

      await service.quarantine('nonexistent', 'PEER_FLOOD');

      expect(connectionService.disconnect).not.toHaveBeenCalled();
      expect(config.hooks!.onAccountQuarantined).not.toHaveBeenCalled();
    });
  });

  describe('release()', () => {
    it('should clear quarantine fields and set status to Disconnected', async () => {
      const account = makeAccountDoc({ status: ACCOUNT_STATUS.Disconnected });
      (TelegramAccount.findOneAndUpdate as ReturnType<typeof vi.fn>).mockResolvedValue(account);

      await service.release('acc-1');

      expect(TelegramAccount.findOneAndUpdate).toHaveBeenCalledWith(
        { _id: 'acc-1' },
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
    });

    it('should call onAccountReleased hook', async () => {
      const account = makeAccountDoc({ status: ACCOUNT_STATUS.Disconnected });
      (TelegramAccount.findOneAndUpdate as ReturnType<typeof vi.fn>).mockResolvedValue(account);

      await service.release('acc-1');

      expect(config.hooks!.onAccountReleased).toHaveBeenCalledWith({
        accountId: 'acc-1',
        phone: '+1234567890',
      });
    });

    it('should log release', async () => {
      const account = makeAccountDoc({ status: ACCOUNT_STATUS.Disconnected });
      (TelegramAccount.findOneAndUpdate as ReturnType<typeof vi.fn>).mockResolvedValue(account);

      await service.release('acc-1');

      expect(config.logger!.info).toHaveBeenCalledWith('Account released from quarantine', {
        accountId: 'acc-1',
        phone: '+1234567890',
      });
    });

    it('should do nothing if account not found', async () => {
      (TelegramAccount.findOneAndUpdate as ReturnType<typeof vi.fn>).mockResolvedValue(null);

      await service.release('nonexistent');

      expect(config.hooks!.onAccountReleased).not.toHaveBeenCalled();
    });
  });

  describe('isQuarantined()', () => {
    it('should return true when quarantined with future date', async () => {
      const account = makeAccountDoc({
        status: ACCOUNT_STATUS.Quarantined,
        quarantinedUntil: new Date(Date.now() + 86400000),
      });
      (TelegramAccount.findById as ReturnType<typeof vi.fn>).mockResolvedValue(account);

      const result = await service.isQuarantined('acc-1');

      expect(result).toBe(true);
    });

    it('should return false when quarantine has expired', async () => {
      const account = makeAccountDoc({
        status: ACCOUNT_STATUS.Quarantined,
        quarantinedUntil: new Date(Date.now() - 1000),
      });
      (TelegramAccount.findById as ReturnType<typeof vi.fn>).mockResolvedValue(account);

      const result = await service.isQuarantined('acc-1');

      expect(result).toBe(false);
    });

    it('should return false when account is not quarantined status', async () => {
      const account = makeAccountDoc({
        status: ACCOUNT_STATUS.Connected,
        quarantinedUntil: undefined,
      });
      (TelegramAccount.findById as ReturnType<typeof vi.fn>).mockResolvedValue(account);

      const result = await service.isQuarantined('acc-1');

      expect(result).toBe(false);
    });

    it('should return false when account not found', async () => {
      (TelegramAccount.findById as ReturnType<typeof vi.fn>).mockResolvedValue(null);

      const result = await service.isQuarantined('nonexistent');

      expect(result).toBe(false);
    });
  });

  describe('checkAndReleaseExpired()', () => {
    it('should find and release expired quarantines', async () => {
      const releasedAccount = makeAccountDoc({ status: ACCOUNT_STATUS.Disconnected });

      (TelegramAccount.findOneAndUpdate as ReturnType<typeof vi.fn>)
        .mockResolvedValueOnce(releasedAccount)
        .mockResolvedValueOnce(null); // loop terminates

      const count = await service.checkAndReleaseExpired();

      expect(count).toBe(1);
      expect(TelegramAccount.findOneAndUpdate).toHaveBeenCalledWith(
        {
          status: ACCOUNT_STATUS.Quarantined,
          quarantinedUntil: { $lte: expect.any(Date) },
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
    });

    it('should release multiple expired accounts', async () => {
      const acct1 = makeAccountDoc({ _id: 'acc-1', phone: '+111' });
      const acct2 = makeAccountDoc({ _id: 'acc-2', phone: '+222' });

      (TelegramAccount.findOneAndUpdate as ReturnType<typeof vi.fn>)
        .mockResolvedValueOnce(acct1)
        .mockResolvedValueOnce(acct2)
        .mockResolvedValueOnce(null);

      const count = await service.checkAndReleaseExpired();

      expect(count).toBe(2);
    });

    it('should return 0 when no expired quarantines', async () => {
      (TelegramAccount.findOneAndUpdate as ReturnType<typeof vi.fn>).mockResolvedValue(null);

      const count = await service.checkAndReleaseExpired();

      expect(count).toBe(0);
    });

    it('should call onAccountReleased hook for each released account', async () => {
      const acct = makeAccountDoc({ _id: 'acc-1', phone: '+111' });

      (TelegramAccount.findOneAndUpdate as ReturnType<typeof vi.fn>)
        .mockResolvedValueOnce(acct)
        .mockResolvedValueOnce(null);

      await service.checkAndReleaseExpired();

      expect(config.hooks!.onAccountReleased).toHaveBeenCalledWith({
        accountId: 'acc-1',
        phone: '+111',
      });
    });

    it('should log auto-release for each account', async () => {
      const acct = makeAccountDoc({ _id: 'acc-1', phone: '+111' });

      (TelegramAccount.findOneAndUpdate as ReturnType<typeof vi.fn>)
        .mockResolvedValueOnce(acct)
        .mockResolvedValueOnce(null);

      await service.checkAndReleaseExpired();

      expect(config.logger!.info).toHaveBeenCalledWith('Quarantined account auto-released', {
        accountId: 'acc-1',
        phone: '+111',
      });
    });
  });

  describe('startMonitor() / stopMonitor()', () => {
    it('should start the monitor interval', () => {
      vi.useFakeTimers();

      service.startMonitor();

      expect(config.logger!.info).toHaveBeenCalledWith('Quarantine monitor started', expect.any(Object));

      service.stopMonitor();
      vi.useRealTimers();
    });

    it('should stop the monitor interval', () => {
      vi.useFakeTimers();

      service.startMonitor();
      service.stopMonitor();

      expect(config.logger!.info).toHaveBeenCalledWith('Quarantine monitor stopped');

      vi.useRealTimers();
    });

    it('stopMonitor does nothing if not started', () => {
      service.stopMonitor();
      // Should not throw or log 'Quarantine monitor stopped'
    });
  });
});
