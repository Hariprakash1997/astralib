import { describe, it, expect, vi, beforeEach } from 'vitest';
import { HealthTracker } from '../services/health-tracker';
import { ACCOUNT_STATUS } from '../constants';
import type { TelegramAccountModel } from '../schemas/telegram-account.schema';
import type { TelegramDailyStatsModel } from '../schemas/telegram-daily-stats.schema';
import type { TelegramAccountManagerConfig } from '../types/config.types';
import type { QuarantineService } from '../services/quarantine.service';

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
      onHealthChange: vi.fn(),
      onAccountBanned: vi.fn(),
    },
    ...overrides,
  };
}

function createMockTelegramAccount() {
  return {
    findById: vi.fn(),
    findByIdAndUpdate: vi.fn(),
    find: vi.fn(),
  } as unknown as TelegramAccountModel;
}

function createMockDailyStats() {
  return {
    incrementStat: vi.fn().mockResolvedValue({}),
    findOne: vi.fn(),
  } as unknown as TelegramDailyStatsModel;
}

function createMockQuarantineService() {
  return {
    quarantine: vi.fn().mockResolvedValue(undefined),
  } as unknown as QuarantineService;
}

function makeAccountDoc(overrides: Record<string, unknown> = {}) {
  return {
    _id: 'acc-1',
    phone: '+1234567890',
    status: ACCOUNT_STATUS.Connected,
    healthScore: 80,
    consecutiveErrors: 0,
    floodWaitCount: 0,
    totalMessagesSent: 100,
    lastSuccessfulSendAt: null,
    ...overrides,
  };
}

describe('HealthTracker', () => {
  let tracker: HealthTracker;
  let TelegramAccount: TelegramAccountModel;
  let TelegramDailyStats: TelegramDailyStatsModel;
  let config: TelegramAccountManagerConfig;
  let quarantineService: QuarantineService;

  beforeEach(() => {
    TelegramAccount = createMockTelegramAccount();
    TelegramDailyStats = createMockDailyStats();
    config = createMockConfig();
    quarantineService = createMockQuarantineService();
    tracker = new HealthTracker(TelegramAccount, TelegramDailyStats, config, config.hooks, quarantineService);
  });

  describe('recordSuccess()', () => {
    it('should use atomic aggregation pipeline update', async () => {
      const oldAccount = makeAccountDoc({ healthScore: 80 });
      const updatedAccount = makeAccountDoc({ healthScore: 82, consecutiveErrors: 0 });

      (TelegramAccount.findById as ReturnType<typeof vi.fn>).mockResolvedValue(oldAccount);
      (TelegramAccount.findByIdAndUpdate as ReturnType<typeof vi.fn>).mockResolvedValue(updatedAccount);

      await tracker.recordSuccess('acc-1');

      expect(TelegramAccount.findByIdAndUpdate).toHaveBeenCalledWith(
        'acc-1',
        expect.arrayContaining([
          expect.objectContaining({
            $set: expect.objectContaining({
              consecutiveErrors: 0,
            }),
          }),
        ]),
        { new: true },
      );
    });

    it('should increment daily sent stat', async () => {
      const oldAccount = makeAccountDoc();
      const updatedAccount = makeAccountDoc({ healthScore: 82 });

      (TelegramAccount.findById as ReturnType<typeof vi.fn>).mockResolvedValue(oldAccount);
      (TelegramAccount.findByIdAndUpdate as ReturnType<typeof vi.fn>).mockResolvedValue(updatedAccount);

      await tracker.recordSuccess('acc-1');

      expect(TelegramDailyStats.incrementStat).toHaveBeenCalledWith('acc-1', 'sent', 1, expect.any(String));
    });

    it('should call onHealthChange hook when score changes', async () => {
      const oldAccount = makeAccountDoc({ healthScore: 80 });
      const updatedAccount = makeAccountDoc({ healthScore: 82, phone: '+1234567890' });

      (TelegramAccount.findById as ReturnType<typeof vi.fn>).mockResolvedValue(oldAccount);
      (TelegramAccount.findByIdAndUpdate as ReturnType<typeof vi.fn>).mockResolvedValue(updatedAccount);

      await tracker.recordSuccess('acc-1');

      expect(config.hooks!.onHealthChange).toHaveBeenCalledWith({
        accountId: 'acc-1',
        phone: '+1234567890',
        oldScore: 80,
        newScore: 82,
      });
    });

    it('should do nothing if account not found (findById)', async () => {
      (TelegramAccount.findById as ReturnType<typeof vi.fn>).mockResolvedValue(null);

      await tracker.recordSuccess('nonexistent');

      expect(TelegramAccount.findByIdAndUpdate).not.toHaveBeenCalled();
      expect(TelegramDailyStats.incrementStat).not.toHaveBeenCalled();
    });

    it('should do nothing if update returns null', async () => {
      const oldAccount = makeAccountDoc();
      (TelegramAccount.findById as ReturnType<typeof vi.fn>).mockResolvedValue(oldAccount);
      (TelegramAccount.findByIdAndUpdate as ReturnType<typeof vi.fn>).mockResolvedValue(null);

      await tracker.recordSuccess('acc-1');

      expect(TelegramDailyStats.incrementStat).not.toHaveBeenCalled();
    });

    it('should cap health score at 100', async () => {
      const oldAccount = makeAccountDoc({ healthScore: 99 });
      const updatedAccount = makeAccountDoc({ healthScore: 100 });

      (TelegramAccount.findById as ReturnType<typeof vi.fn>).mockResolvedValue(oldAccount);
      (TelegramAccount.findByIdAndUpdate as ReturnType<typeof vi.fn>).mockResolvedValue(updatedAccount);

      await tracker.recordSuccess('acc-1');

      const updateCall = (TelegramAccount.findByIdAndUpdate as ReturnType<typeof vi.fn>).mock.calls[0];
      const pipeline = updateCall[1];
      expect(pipeline[0].$set.healthScore).toEqual({ $min: [100, { $add: ['$healthScore', 2] }] });
    });
  });

  describe('recordError()', () => {
    it('should use atomic aggregation pipeline update', async () => {
      const oldAccount = makeAccountDoc({ healthScore: 80 });
      const updatedAccount = makeAccountDoc({ healthScore: 70, consecutiveErrors: 1 });

      (TelegramAccount.findById as ReturnType<typeof vi.fn>).mockResolvedValue(oldAccount);
      (TelegramAccount.findByIdAndUpdate as ReturnType<typeof vi.fn>).mockResolvedValue(updatedAccount);

      await tracker.recordError('acc-1', 'TIMEOUT');

      expect(TelegramAccount.findByIdAndUpdate).toHaveBeenCalledWith(
        'acc-1',
        expect.arrayContaining([
          expect.objectContaining({ $set: expect.any(Object) }),
        ]),
        { new: true },
      );
    });

    it('should call onHealthChange hook with score change', async () => {
      const oldAccount = makeAccountDoc({ healthScore: 80 });
      const updatedAccount = makeAccountDoc({ healthScore: 70, consecutiveErrors: 1, phone: '+1234567890' });

      (TelegramAccount.findById as ReturnType<typeof vi.fn>).mockResolvedValue(oldAccount);
      (TelegramAccount.findByIdAndUpdate as ReturnType<typeof vi.fn>).mockResolvedValue(updatedAccount);

      await tracker.recordError('acc-1', 'TIMEOUT');

      expect(config.hooks!.onHealthChange).toHaveBeenCalledWith({
        accountId: 'acc-1',
        phone: '+1234567890',
        oldScore: 80,
        newScore: 70,
      });
    });

    it('should decrement score by 20 for FLOOD_WAIT errors', async () => {
      const oldAccount = makeAccountDoc({ healthScore: 80 });
      const updatedAccount = makeAccountDoc({ healthScore: 60, consecutiveErrors: 1, floodWaitCount: 1 });

      (TelegramAccount.findById as ReturnType<typeof vi.fn>).mockResolvedValue(oldAccount);
      (TelegramAccount.findByIdAndUpdate as ReturnType<typeof vi.fn>).mockResolvedValue(updatedAccount);

      await tracker.recordError('acc-1', 'FLOOD_WAIT');

      const updateCall = (TelegramAccount.findByIdAndUpdate as ReturnType<typeof vi.fn>).mock.calls[0];
      const pipeline = updateCall[1];
      expect(pipeline[0].$set.healthScore).toEqual({ $max: [0, { $subtract: ['$healthScore', 20] }] });
    });

    it('should decrement score by 10 for regular errors', async () => {
      const oldAccount = makeAccountDoc({ healthScore: 80 });
      const updatedAccount = makeAccountDoc({ healthScore: 70, consecutiveErrors: 1 });

      (TelegramAccount.findById as ReturnType<typeof vi.fn>).mockResolvedValue(oldAccount);
      (TelegramAccount.findByIdAndUpdate as ReturnType<typeof vi.fn>).mockResolvedValue(updatedAccount);

      await tracker.recordError('acc-1', 'TIMEOUT');

      const updateCall = (TelegramAccount.findByIdAndUpdate as ReturnType<typeof vi.fn>).mock.calls[0];
      const pipeline = updateCall[1];
      expect(pipeline[0].$set.healthScore).toEqual({ $max: [0, { $subtract: ['$healthScore', 10] }] });
    });

    it('should trigger onAccountBanned hook for critical errors', async () => {
      const oldAccount = makeAccountDoc({ healthScore: 80 });
      const updatedAccount = makeAccountDoc({ healthScore: 70, consecutiveErrors: 1, phone: '+1234567890' });

      (TelegramAccount.findById as ReturnType<typeof vi.fn>).mockResolvedValue(oldAccount);
      (TelegramAccount.findByIdAndUpdate as ReturnType<typeof vi.fn>).mockResolvedValue(updatedAccount);

      await tracker.recordError('acc-1', 'AUTH_KEY_UNREGISTERED');

      // Should set status to Banned
      expect(TelegramAccount.findByIdAndUpdate).toHaveBeenCalledWith('acc-1', {
        $set: { status: ACCOUNT_STATUS.Banned },
      });

      expect(config.hooks!.onAccountBanned).toHaveBeenCalledWith({
        accountId: 'acc-1',
        phone: '+1234567890',
        errorCode: 'AUTH_KEY_UNREGISTERED',
      });
    });

    it('should trigger quarantine for QUARANTINE_ERRORS', async () => {
      const oldAccount = makeAccountDoc({ healthScore: 80 });
      const updatedAccount = makeAccountDoc({ healthScore: 60, consecutiveErrors: 1, phone: '+1234567890' });

      (TelegramAccount.findById as ReturnType<typeof vi.fn>).mockResolvedValue(oldAccount);
      (TelegramAccount.findByIdAndUpdate as ReturnType<typeof vi.fn>).mockResolvedValue(updatedAccount);

      await tracker.recordError('acc-1', 'PEER_FLOOD');

      expect(quarantineService.quarantine).toHaveBeenCalledWith('acc-1', 'Auto-quarantined: PEER_FLOOD');
    });

    it('should not quarantine if quarantineService is not provided', async () => {
      const trackerNoQuarantine = new HealthTracker(TelegramAccount, TelegramDailyStats, config, config.hooks);
      const oldAccount = makeAccountDoc({ healthScore: 80 });
      const updatedAccount = makeAccountDoc({ healthScore: 60, consecutiveErrors: 1 });

      (TelegramAccount.findById as ReturnType<typeof vi.fn>).mockResolvedValue(oldAccount);
      (TelegramAccount.findByIdAndUpdate as ReturnType<typeof vi.fn>).mockResolvedValue(updatedAccount);

      // Should not throw
      await trackerNoQuarantine.recordError('acc-1', 'PEER_FLOOD');
    });

    it('should do nothing if account not found', async () => {
      (TelegramAccount.findById as ReturnType<typeof vi.fn>).mockResolvedValue(null);

      await tracker.recordError('nonexistent', 'error');

      expect(TelegramAccount.findByIdAndUpdate).not.toHaveBeenCalled();
    });

    it('should never let score go below 0', async () => {
      const oldAccount = makeAccountDoc({ healthScore: 5 });
      const updatedAccount = makeAccountDoc({ healthScore: 0, consecutiveErrors: 1 });

      (TelegramAccount.findById as ReturnType<typeof vi.fn>).mockResolvedValue(oldAccount);
      (TelegramAccount.findByIdAndUpdate as ReturnType<typeof vi.fn>).mockResolvedValue(updatedAccount);

      await tracker.recordError('acc-1', 'error');

      const updateCall = (TelegramAccount.findByIdAndUpdate as ReturnType<typeof vi.fn>).mock.calls[0];
      const pipeline = updateCall[1];
      expect(pipeline[0].$set.healthScore).toEqual({ $max: [0, { $subtract: ['$healthScore', 10] }] });
    });

    it('should increment daily failed stat', async () => {
      const oldAccount = makeAccountDoc({ healthScore: 80 });
      const updatedAccount = makeAccountDoc({ healthScore: 70, consecutiveErrors: 1 });

      (TelegramAccount.findById as ReturnType<typeof vi.fn>).mockResolvedValue(oldAccount);
      (TelegramAccount.findByIdAndUpdate as ReturnType<typeof vi.fn>).mockResolvedValue(updatedAccount);

      await tracker.recordError('acc-1', 'TIMEOUT');

      expect(TelegramDailyStats.incrementStat).toHaveBeenCalledWith('acc-1', 'failed', 1, expect.any(String));
    });
  });

  describe('getHealth()', () => {
    it('should return health info for existing account', async () => {
      const account = makeAccountDoc();
      (TelegramAccount.findById as ReturnType<typeof vi.fn>).mockResolvedValue(account);

      const result = await tracker.getHealth('acc-1');

      expect(result).toEqual({
        accountId: 'acc-1',
        phone: '+1234567890',
        healthScore: 80,
        consecutiveErrors: 0,
        floodWaitCount: 0,
        status: ACCOUNT_STATUS.Connected,
        lastSuccessfulSendAt: null,
      });
    });

    it('should return null for non-existent account', async () => {
      (TelegramAccount.findById as ReturnType<typeof vi.fn>).mockResolvedValue(null);

      const result = await tracker.getHealth('nonexistent');

      expect(result).toBeNull();
    });
  });

  describe('getAllHealth()', () => {
    it('should return health info for all accounts', async () => {
      const accounts = [
        makeAccountDoc({ _id: 'acc-1', phone: '+111', healthScore: 90 }),
        makeAccountDoc({ _id: 'acc-2', phone: '+222', healthScore: 60 }),
      ];
      (TelegramAccount.find as ReturnType<typeof vi.fn>).mockResolvedValue(accounts);

      const results = await tracker.getAllHealth();

      expect(results).toHaveLength(2);
      expect(results[0].healthScore).toBe(90);
      expect(results[1].healthScore).toBe(60);
    });
  });

  describe('startMonitor() / stopMonitor()', () => {
    it('should start and stop the monitor interval', () => {
      vi.useFakeTimers();

      tracker.startMonitor();
      expect(config.logger!.info).toHaveBeenCalledWith('Health monitor started', expect.any(Object));

      tracker.stopMonitor();
      expect(config.logger!.info).toHaveBeenCalledWith('Health monitor stopped');

      vi.useRealTimers();
    });

    it('stopMonitor does nothing if not started', () => {
      tracker.stopMonitor();
      // Should not throw or log
    });
  });
});
