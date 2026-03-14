import { describe, it, expect, vi, beforeEach } from 'vitest';
import { CapacityManager } from '../services/capacity-manager';
import { ACCOUNT_STATUS } from '../constants';
import type { EmailAccountModel } from '../schemas/email-account.schema';
import type { EmailDailyStatsModel } from '../schemas/email-daily-stats.schema';
import type { WarmupManager } from '../services/warmup-manager';
import type { SettingsService } from '../services/settings.service';
import type { LogAdapter } from '../types/config.types';

function createMockLogger(): LogAdapter {
  return {
    info: vi.fn(),
    warn: vi.fn(),
    error: vi.fn(),
  };
}

function createMockSettings(): SettingsService {
  return {
    get: vi.fn().mockResolvedValue({ timezone: 'UTC' }),
  } as unknown as SettingsService;
}

function createMockWarmupManager(): WarmupManager {
  return {
    getDailyLimit: vi.fn().mockResolvedValue(10),
  } as unknown as WarmupManager;
}

function createMockEmailAccount() {
  return {
    findById: vi.fn(),
    find: vi.fn(),
  } as unknown as EmailAccountModel;
}

function createMockDailyStats() {
  return {
    findOne: vi.fn(),
  } as unknown as EmailDailyStatsModel;
}

function makeAccountDoc(overrides: Record<string, unknown> = {}) {
  return {
    _id: 'acc-1',
    email: 'sender@example.com',
    provider: 'gmail',
    status: ACCOUNT_STATUS.Active,
    limits: { dailyMax: 100 },
    health: {
      score: 90,
      consecutiveErrors: 0,
      bounceCount: 0,
      thresholds: { minScore: 50, maxBounceRate: 5, maxConsecutiveErrors: 10 },
    },
    warmup: { enabled: false },
    totalEmailsSent: 500,
    ...overrides,
  };
}

describe('CapacityManager', () => {
  let manager: CapacityManager;
  let EmailAccount: EmailAccountModel;
  let EmailDailyStats: EmailDailyStatsModel;
  let warmupManager: WarmupManager;
  let settings: SettingsService;
  let logger: LogAdapter;

  beforeEach(() => {
    EmailAccount = createMockEmailAccount();
    EmailDailyStats = createMockDailyStats();
    warmupManager = createMockWarmupManager();
    settings = createMockSettings();
    logger = createMockLogger();
    manager = new CapacityManager(EmailAccount, EmailDailyStats, warmupManager, settings, logger);
  });

  describe('getBestAccount()', () => {
    it('should return highest health-score account with remaining capacity', async () => {
      const highScore = makeAccountDoc({ _id: 'acc-high', health: { score: 95 }, limits: { dailyMax: 100 }, warmup: { enabled: false } });
      const lowScore = makeAccountDoc({ _id: 'acc-low', health: { score: 60 }, limits: { dailyMax: 100 }, warmup: { enabled: false } });

      (EmailAccount.find as ReturnType<typeof vi.fn>).mockReturnValue({
        sort: vi.fn().mockResolvedValue([highScore, lowScore]),
      });
      (EmailAccount.findById as ReturnType<typeof vi.fn>).mockResolvedValue(highScore);
      (EmailDailyStats.findOne as ReturnType<typeof vi.fn>).mockResolvedValue({ sent: 10 });

      const result = await manager.getBestAccount();

      expect(result).toBe(highScore);
    });

    it('should skip accounts that have exhausted their daily limit', async () => {
      const exhausted = makeAccountDoc({ _id: 'acc-exhausted', email: 'exhausted@test.com', health: { score: 95 }, limits: { dailyMax: 50 }, warmup: { enabled: false } });
      const available = makeAccountDoc({ _id: 'acc-avail', email: 'avail@test.com', health: { score: 80 }, limits: { dailyMax: 100 }, warmup: { enabled: false } });

      (EmailAccount.find as ReturnType<typeof vi.fn>).mockReturnValue({
        sort: vi.fn().mockResolvedValue([exhausted, available]),
      });

      (EmailAccount.findById as ReturnType<typeof vi.fn>)
        .mockResolvedValueOnce(exhausted)
        .mockResolvedValueOnce(available);

      (EmailDailyStats.findOne as ReturnType<typeof vi.fn>)
        .mockResolvedValueOnce({ sent: 50 })
        .mockResolvedValueOnce({ sent: 20 });

      const result = await manager.getBestAccount();

      expect(result).toBe(available);
    });

    it('should return null when no accounts have remaining capacity', async () => {
      const exhausted = makeAccountDoc({ _id: 'acc-1', limits: { dailyMax: 10 }, warmup: { enabled: false } });

      (EmailAccount.find as ReturnType<typeof vi.fn>).mockReturnValue({
        sort: vi.fn().mockResolvedValue([exhausted]),
      });
      (EmailAccount.findById as ReturnType<typeof vi.fn>).mockResolvedValue(exhausted);
      (EmailDailyStats.findOne as ReturnType<typeof vi.fn>).mockResolvedValue({ sent: 10 });

      const result = await manager.getBestAccount();

      expect(result).toBeNull();
    });

    it('should return null when no active/warmup accounts exist', async () => {
      (EmailAccount.find as ReturnType<typeof vi.fn>).mockReturnValue({
        sort: vi.fn().mockResolvedValue([]),
      });

      const result = await manager.getBestAccount();

      expect(result).toBeNull();
    });

    it('should only query active and warmup status accounts', async () => {
      (EmailAccount.find as ReturnType<typeof vi.fn>).mockReturnValue({
        sort: vi.fn().mockResolvedValue([]),
      });

      await manager.getBestAccount();

      expect(EmailAccount.find).toHaveBeenCalledWith({
        status: { $in: [ACCOUNT_STATUS.Active, ACCOUNT_STATUS.Warmup] },
      });
    });

    it('should respect warmup daily limits for warmup accounts', async () => {
      const warmupAccount = makeAccountDoc({
        _id: 'acc-warmup',
        status: ACCOUNT_STATUS.Warmup,
        warmup: { enabled: true, currentDay: 2, schedule: [] },
        limits: { dailyMax: 200 },
      });

      (EmailAccount.find as ReturnType<typeof vi.fn>).mockReturnValue({
        sort: vi.fn().mockResolvedValue([warmupAccount]),
      });
      (EmailAccount.findById as ReturnType<typeof vi.fn>).mockResolvedValue(warmupAccount);
      (warmupManager.getDailyLimit as ReturnType<typeof vi.fn>).mockResolvedValue(5);
      (EmailDailyStats.findOne as ReturnType<typeof vi.fn>).mockResolvedValue({ sent: 5 });

      const result = await manager.getBestAccount();

      expect(result).toBeNull();
    });
  });

  describe('getAccountCapacity()', () => {
    it('should return correct capacity for active account', async () => {
      const account = makeAccountDoc({ _id: 'acc-1', limits: { dailyMax: 100 }, warmup: { enabled: false } });
      (EmailAccount.findById as ReturnType<typeof vi.fn>).mockResolvedValue(account);
      (EmailDailyStats.findOne as ReturnType<typeof vi.fn>).mockResolvedValue({ sent: 30 });

      const capacity = await manager.getAccountCapacity('acc-1');

      expect(capacity).toEqual({
        accountId: 'acc-1',
        email: 'sender@example.com',
        provider: 'gmail',
        dailyMax: 100,
        sentToday: 30,
        remaining: 70,
        usagePercent: 30,
      });
    });

    it('should return zero capacity for non-existent account', async () => {
      (EmailAccount.findById as ReturnType<typeof vi.fn>).mockResolvedValue(null);

      const capacity = await manager.getAccountCapacity('nonexistent');

      expect(capacity).toEqual({
        accountId: 'nonexistent',
        email: '',
        provider: 'gmail',
        dailyMax: 0,
        sentToday: 0,
        remaining: 0,
        usagePercent: 0,
      });
    });

    it('should use warmup daily limit for warmup-enabled accounts', async () => {
      const account = makeAccountDoc({
        _id: 'acc-1',
        warmup: { enabled: true, currentDay: 3, schedule: [] },
        limits: { dailyMax: 200 },
      });
      (EmailAccount.findById as ReturnType<typeof vi.fn>).mockResolvedValue(account);
      (warmupManager.getDailyLimit as ReturnType<typeof vi.fn>).mockResolvedValue(15);
      (EmailDailyStats.findOne as ReturnType<typeof vi.fn>).mockResolvedValue({ sent: 5 });

      const capacity = await manager.getAccountCapacity('acc-1');

      expect(capacity.dailyMax).toBe(15);
      expect(capacity.remaining).toBe(10);
      expect(capacity.usagePercent).toBe(33);
    });

    it('should handle zero sent today', async () => {
      const account = makeAccountDoc({ limits: { dailyMax: 100 }, warmup: { enabled: false } });
      (EmailAccount.findById as ReturnType<typeof vi.fn>).mockResolvedValue(account);
      (EmailDailyStats.findOne as ReturnType<typeof vi.fn>).mockResolvedValue(null);

      const capacity = await manager.getAccountCapacity('acc-1');

      expect(capacity.sentToday).toBe(0);
      expect(capacity.remaining).toBe(100);
      expect(capacity.usagePercent).toBe(0);
    });

    it('should clamp remaining to 0 when over limit', async () => {
      const account = makeAccountDoc({ limits: { dailyMax: 50 }, warmup: { enabled: false } });
      (EmailAccount.findById as ReturnType<typeof vi.fn>).mockResolvedValue(account);
      (EmailDailyStats.findOne as ReturnType<typeof vi.fn>).mockResolvedValue({ sent: 60 });

      const capacity = await manager.getAccountCapacity('acc-1');

      expect(capacity.remaining).toBe(0);
      expect(capacity.usagePercent).toBe(120);
    });
  });

  describe('getAllCapacity()', () => {
    it('should return capacity for all active/warmup accounts', async () => {
      const acc1 = makeAccountDoc({ _id: 'acc-1', email: 'a@test.com', limits: { dailyMax: 100 }, warmup: { enabled: false } });
      const acc2 = makeAccountDoc({ _id: 'acc-2', email: 'b@test.com', limits: { dailyMax: 50 }, warmup: { enabled: false } });

      (EmailAccount.find as ReturnType<typeof vi.fn>).mockResolvedValue([acc1, acc2]);

      (EmailAccount.findById as ReturnType<typeof vi.fn>)
        .mockResolvedValueOnce(acc1)
        .mockResolvedValueOnce(acc2);

      (EmailDailyStats.findOne as ReturnType<typeof vi.fn>)
        .mockResolvedValueOnce({ sent: 20 })
        .mockResolvedValueOnce({ sent: 10 });

      const result = await manager.getAllCapacity();

      expect(result.accounts).toHaveLength(2);
      expect(result.totalRemaining).toBe(120);
    });

    it('should return empty with zero total when no accounts', async () => {
      (EmailAccount.find as ReturnType<typeof vi.fn>).mockResolvedValue([]);

      const result = await manager.getAllCapacity();

      expect(result.accounts).toHaveLength(0);
      expect(result.totalRemaining).toBe(0);
    });

    it('should only include active and warmup status accounts', async () => {
      (EmailAccount.find as ReturnType<typeof vi.fn>).mockResolvedValue([]);

      await manager.getAllCapacity();

      expect(EmailAccount.find).toHaveBeenCalledWith({
        status: { $in: [ACCOUNT_STATUS.Active, ACCOUNT_STATUS.Warmup] },
      });
    });
  });
});
