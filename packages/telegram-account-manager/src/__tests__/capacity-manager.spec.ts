import { describe, it, expect, vi, beforeEach } from 'vitest';
import { CapacityManager } from '../services/capacity-manager';
import { ACCOUNT_STATUS } from '../constants';
import type { TelegramAccountModel } from '../schemas/telegram-account.schema';
import type { TelegramDailyStatsModel } from '../schemas/telegram-daily-stats.schema';
import type { WarmupManager } from '../services/warmup-manager';
import type { TelegramAccountManagerConfig } from '../types/config.types';

const ID1 = 'aaaaaaaaaaaaaaaaaaaaaaaa';
const ID2 = 'bbbbbbbbbbbbbbbbbbbbbbbb';
const ID_HIGH = 'cccccccccccccccccccccccc';
const ID_LOW = 'dddddddddddddddddddddddd'.slice(0, 24);
const ID_EXHAUSTED = 'eeeeeeeeeeeeeeeeeeeeeeee';
const ID_AVAIL = 'ffffffffffffffffffffffff';
const ID_NONEXISTENT = '111111111111111111111111';

function createMockConfig(): TelegramAccountManagerConfig {
  return {
    db: { connection: {} as any },
    credentials: { apiId: 12345, apiHash: 'abc123' },
    logger: {
      info: vi.fn(),
      warn: vi.fn(),
      error: vi.fn(),
    },
  };
}

function createMockWarmupManager(): WarmupManager {
  return {
    getDailyLimit: vi.fn().mockResolvedValue(40),
  } as unknown as WarmupManager;
}

function createMockTelegramAccount() {
  return {
    findById: vi.fn(),
    find: vi.fn().mockReturnValue({
      sort: vi.fn().mockResolvedValue([]),
    }),
  } as unknown as TelegramAccountModel;
}

function createMockDailyStats() {
  return {
    findOne: vi.fn(),
    incrementStat: vi.fn().mockResolvedValue({}),
  } as unknown as TelegramDailyStatsModel;
}

function makeAccountDoc(overrides: Record<string, unknown> = {}) {
  return {
    _id: ID1,
    phone: '+1234567890',
    status: ACCOUNT_STATUS.Connected,
    currentDailyLimit: 100,
    healthScore: 90,
    consecutiveErrors: 0,
    warmup: { enabled: false },
    totalMessagesSent: 500,
    ...overrides,
  };
}

describe('CapacityManager', () => {
  let manager: CapacityManager;
  let TelegramAccount: TelegramAccountModel;
  let TelegramDailyStats: TelegramDailyStatsModel;
  let warmupManager: WarmupManager;
  let config: TelegramAccountManagerConfig;

  beforeEach(() => {
    TelegramAccount = createMockTelegramAccount();
    TelegramDailyStats = createMockDailyStats();
    warmupManager = createMockWarmupManager();
    config = createMockConfig();
    manager = new CapacityManager(TelegramAccount, TelegramDailyStats, warmupManager, config);
  });

  describe('getAccountCapacity()', () => {
    it('should return correct capacity for active account', async () => {
      const account = makeAccountDoc({ _id: ID1, currentDailyLimit: 100, warmup: { enabled: false } });
      (TelegramAccount.findById as ReturnType<typeof vi.fn>).mockResolvedValue(account);
      (warmupManager.getDailyLimit as ReturnType<typeof vi.fn>).mockResolvedValue(100);
      (TelegramDailyStats.findOne as ReturnType<typeof vi.fn>).mockResolvedValue({ sent: 30 });

      const capacity = await manager.getAccountCapacity(ID1);

      expect(capacity).toEqual({
        accountId: ID1,
        phone: '+1234567890',
        dailyMax: 100,
        sentToday: 30,
        remaining: 70,
        usagePercent: 30,
        status: ACCOUNT_STATUS.Connected,
      });
    });

    it('should return zero capacity for non-existent account', async () => {
      (TelegramAccount.findById as ReturnType<typeof vi.fn>).mockResolvedValue(null);

      const capacity = await manager.getAccountCapacity(ID_NONEXISTENT);

      expect(capacity).toEqual({
        accountId: ID_NONEXISTENT,
        phone: '',
        dailyMax: 0,
        sentToday: 0,
        remaining: 0,
        usagePercent: 0,
        status: ACCOUNT_STATUS.Disconnected,
      });
    });

    it('should use warmup daily limit for warmup-enabled accounts', async () => {
      const account = makeAccountDoc({
        _id: ID1,
        warmup: { enabled: true, currentDay: 3, schedule: [] },
        currentDailyLimit: 200,
      });
      (TelegramAccount.findById as ReturnType<typeof vi.fn>).mockResolvedValue(account);
      (warmupManager.getDailyLimit as ReturnType<typeof vi.fn>).mockResolvedValue(15);
      (TelegramDailyStats.findOne as ReturnType<typeof vi.fn>).mockResolvedValue({ sent: 5 });

      const capacity = await manager.getAccountCapacity(ID1);

      expect(capacity.dailyMax).toBe(15);
      expect(capacity.remaining).toBe(10);
      expect(capacity.usagePercent).toBe(33);
    });

    it('should handle zero sent today', async () => {
      const account = makeAccountDoc({ currentDailyLimit: 100, warmup: { enabled: false } });
      (TelegramAccount.findById as ReturnType<typeof vi.fn>).mockResolvedValue(account);
      (warmupManager.getDailyLimit as ReturnType<typeof vi.fn>).mockResolvedValue(100);
      (TelegramDailyStats.findOne as ReturnType<typeof vi.fn>).mockResolvedValue(null);

      const capacity = await manager.getAccountCapacity(ID1);

      expect(capacity.sentToday).toBe(0);
      expect(capacity.remaining).toBe(100);
      expect(capacity.usagePercent).toBe(0);
    });

    it('should clamp remaining to 0 when over limit', async () => {
      const account = makeAccountDoc({ currentDailyLimit: 50, warmup: { enabled: false } });
      (TelegramAccount.findById as ReturnType<typeof vi.fn>).mockResolvedValue(account);
      (warmupManager.getDailyLimit as ReturnType<typeof vi.fn>).mockResolvedValue(50);
      (TelegramDailyStats.findOne as ReturnType<typeof vi.fn>).mockResolvedValue({ sent: 60 });

      const capacity = await manager.getAccountCapacity(ID1);

      expect(capacity.remaining).toBe(0);
      expect(capacity.usagePercent).toBe(120);
    });
  });

  describe('getBestAccount()', () => {
    it('should return highest health-score account with remaining capacity', async () => {
      const highScore = makeAccountDoc({ _id: ID_HIGH, healthScore: 95, currentDailyLimit: 100, warmup: { enabled: false } });
      const lowScore = makeAccountDoc({ _id: ID_LOW, healthScore: 60, currentDailyLimit: 100, warmup: { enabled: false } });

      (TelegramAccount.find as ReturnType<typeof vi.fn>).mockReturnValue({
        sort: vi.fn().mockResolvedValue([highScore, lowScore]),
      });
      (TelegramAccount.findById as ReturnType<typeof vi.fn>).mockResolvedValue(highScore);
      (warmupManager.getDailyLimit as ReturnType<typeof vi.fn>).mockResolvedValue(100);
      (TelegramDailyStats.findOne as ReturnType<typeof vi.fn>).mockResolvedValue({ sent: 10 });

      const result = await manager.getBestAccount();

      expect(result).not.toBeNull();
      expect(result!.accountId).toBe(ID_HIGH);
    });

    it('should skip accounts that have exhausted their daily limit', async () => {
      const exhausted = makeAccountDoc({ _id: ID_EXHAUSTED, phone: '+111', healthScore: 95, currentDailyLimit: 50, warmup: { enabled: false } });
      const available = makeAccountDoc({ _id: ID_AVAIL, phone: '+222', healthScore: 80, currentDailyLimit: 100, warmup: { enabled: false } });

      (TelegramAccount.find as ReturnType<typeof vi.fn>).mockReturnValue({
        sort: vi.fn().mockResolvedValue([exhausted, available]),
      });

      (TelegramAccount.findById as ReturnType<typeof vi.fn>)
        .mockResolvedValueOnce(exhausted)
        .mockResolvedValueOnce(available);

      (warmupManager.getDailyLimit as ReturnType<typeof vi.fn>)
        .mockResolvedValueOnce(50)
        .mockResolvedValueOnce(100);

      (TelegramDailyStats.findOne as ReturnType<typeof vi.fn>)
        .mockResolvedValueOnce({ sent: 50 })
        .mockResolvedValueOnce({ sent: 20 });

      const result = await manager.getBestAccount();

      expect(result).not.toBeNull();
      expect(result!.accountId).toBe(ID_AVAIL);
    });

    it('should return null when no accounts have remaining capacity', async () => {
      const exhausted = makeAccountDoc({ _id: ID1, currentDailyLimit: 10, warmup: { enabled: false } });

      (TelegramAccount.find as ReturnType<typeof vi.fn>).mockReturnValue({
        sort: vi.fn().mockResolvedValue([exhausted]),
      });
      (TelegramAccount.findById as ReturnType<typeof vi.fn>).mockResolvedValue(exhausted);
      (warmupManager.getDailyLimit as ReturnType<typeof vi.fn>).mockResolvedValue(10);
      (TelegramDailyStats.findOne as ReturnType<typeof vi.fn>).mockResolvedValue({ sent: 10 });

      const result = await manager.getBestAccount();

      expect(result).toBeNull();
    });

    it('should return null when no active/warmup accounts exist', async () => {
      (TelegramAccount.find as ReturnType<typeof vi.fn>).mockReturnValue({
        sort: vi.fn().mockResolvedValue([]),
      });

      const result = await manager.getBestAccount();

      expect(result).toBeNull();
    });

    it('should only query connected and warmup status accounts', async () => {
      (TelegramAccount.find as ReturnType<typeof vi.fn>).mockReturnValue({
        sort: vi.fn().mockResolvedValue([]),
      });

      await manager.getBestAccount();

      expect(TelegramAccount.find).toHaveBeenCalledWith({
        status: { $in: [ACCOUNT_STATUS.Connected, ACCOUNT_STATUS.Warmup] },
      });
    });
  });

  describe('incrementSent()', () => {
    it('should increment daily sent stat', async () => {
      await manager.incrementSent(ID1);

      expect(TelegramDailyStats.incrementStat).toHaveBeenCalledWith(ID1, 'sent', 1, expect.any(String));
    });
  });

  describe('incrementFailed()', () => {
    it('should increment daily failed stat', async () => {
      await manager.incrementFailed(ID1);

      expect(TelegramDailyStats.incrementStat).toHaveBeenCalledWith(ID1, 'failed', 1, expect.any(String));
    });
  });

  describe('getSentToday()', () => {
    it('should return sent count for today', async () => {
      (TelegramDailyStats.findOne as ReturnType<typeof vi.fn>).mockResolvedValue({ sent: 42 });

      const result = await manager.getSentToday(ID1);

      expect(result).toBe(42);
    });

    it('should return 0 for new day (no stats record)', async () => {
      (TelegramDailyStats.findOne as ReturnType<typeof vi.fn>).mockResolvedValue(null);

      const result = await manager.getSentToday(ID1);

      expect(result).toBe(0);
    });
  });

  describe('getAllCapacity()', () => {
    it('should return capacity for all connected/warmup accounts', async () => {
      const acc1 = makeAccountDoc({ _id: ID1, phone: '+111', currentDailyLimit: 100, warmup: { enabled: false } });
      const acc2 = makeAccountDoc({ _id: ID2, phone: '+222', currentDailyLimit: 50, warmup: { enabled: false } });

      (TelegramAccount.find as ReturnType<typeof vi.fn>).mockResolvedValue([acc1, acc2]);

      (TelegramAccount.findById as ReturnType<typeof vi.fn>)
        .mockResolvedValueOnce(acc1)
        .mockResolvedValueOnce(acc2);

      (warmupManager.getDailyLimit as ReturnType<typeof vi.fn>)
        .mockResolvedValueOnce(100)
        .mockResolvedValueOnce(50);

      (TelegramDailyStats.findOne as ReturnType<typeof vi.fn>)
        .mockResolvedValueOnce({ sent: 20 })
        .mockResolvedValueOnce({ sent: 10 });

      const result = await manager.getAllCapacity();

      expect(result.accounts).toHaveLength(2);
      expect(result.totalRemaining).toBe(120);
    });

    it('should return empty with zero total when no accounts', async () => {
      (TelegramAccount.find as ReturnType<typeof vi.fn>).mockResolvedValue([]);

      const result = await manager.getAllCapacity();

      expect(result.accounts).toHaveLength(0);
      expect(result.totalRemaining).toBe(0);
    });

    it('should only include connected and warmup status accounts', async () => {
      (TelegramAccount.find as ReturnType<typeof vi.fn>).mockResolvedValue([]);

      await manager.getAllCapacity();

      expect(TelegramAccount.find).toHaveBeenCalledWith({
        status: { $in: [ACCOUNT_STATUS.Connected, ACCOUNT_STATUS.Warmup] },
      });
    });
  });
});
