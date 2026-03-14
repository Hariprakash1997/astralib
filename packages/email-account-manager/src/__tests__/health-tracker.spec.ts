import { describe, it, expect, vi, beforeEach } from 'vitest';
import { HealthTracker } from '../services/health-tracker';
import { ACCOUNT_STATUS } from '../constants';
import type { EmailAccountModel } from '../schemas/email-account.schema';
import type { EmailDailyStatsModel } from '../schemas/email-daily-stats.schema';
import type { SettingsService } from '../services/settings.service';
import type { LogAdapter, EmailAccountManagerConfig } from '../types/config.types';

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

function createMockEmailAccount() {
  return {
    findById: vi.fn(),
    findByIdAndUpdate: vi.fn(),
    find: vi.fn(),
  } as unknown as EmailAccountModel;
}

function createMockDailyStats() {
  return {
    findOneAndUpdate: vi.fn().mockResolvedValue({}),
  } as unknown as EmailDailyStatsModel;
}

function makeAccountDoc(overrides: Record<string, unknown> = {}) {
  return {
    _id: 'acc-1',
    email: 'sender@example.com',
    provider: 'gmail',
    status: ACCOUNT_STATUS.Active,
    totalEmailsSent: 100,
    health: {
      score: 80,
      consecutiveErrors: 0,
      bounceCount: 2,
      thresholds: {
        minScore: 50,
        maxBounceRate: 5,
        maxConsecutiveErrors: 10,
      },
    },
    ...overrides,
  };
}

describe('HealthTracker', () => {
  let tracker: HealthTracker;
  let EmailAccount: EmailAccountModel;
  let EmailDailyStats: EmailDailyStatsModel;
  let settings: SettingsService;
  let logger: LogAdapter;
  let hooks: EmailAccountManagerConfig['hooks'];

  beforeEach(() => {
    EmailAccount = createMockEmailAccount();
    EmailDailyStats = createMockDailyStats();
    settings = createMockSettings();
    logger = createMockLogger();
    hooks = {
      onHealthDegraded: vi.fn(),
      onAccountDisabled: vi.fn(),
      onBounce: vi.fn(),
    };
    tracker = new HealthTracker(EmailAccount, EmailDailyStats, settings, logger, hooks);
  });

  describe('recordSuccess()', () => {
    it('should increment health score by 1', async () => {
      const account = makeAccountDoc({ health: { score: 80, consecutiveErrors: 2, bounceCount: 0, thresholds: { minScore: 50, maxBounceRate: 5, maxConsecutiveErrors: 10 } } });
      (EmailAccount.findById as ReturnType<typeof vi.fn>).mockResolvedValue(account);
      (EmailAccount.findByIdAndUpdate as ReturnType<typeof vi.fn>).mockResolvedValue(null);

      await tracker.recordSuccess('acc-1');

      expect(EmailAccount.findByIdAndUpdate).toHaveBeenCalledWith('acc-1', {
        $set: {
          'health.score': 81,
          'health.consecutiveErrors': 0,
          lastSuccessfulSendAt: expect.any(Date),
        },
        $inc: { totalEmailsSent: 1 },
      });
    });

    it('should cap health score at 100', async () => {
      const account = makeAccountDoc({ health: { score: 100, consecutiveErrors: 0, bounceCount: 0, thresholds: { minScore: 50, maxBounceRate: 5, maxConsecutiveErrors: 10 } } });
      (EmailAccount.findById as ReturnType<typeof vi.fn>).mockResolvedValue(account);
      (EmailAccount.findByIdAndUpdate as ReturnType<typeof vi.fn>).mockResolvedValue(null);

      await tracker.recordSuccess('acc-1');

      expect(EmailAccount.findByIdAndUpdate).toHaveBeenCalledWith('acc-1', expect.objectContaining({
        $set: expect.objectContaining({ 'health.score': 100 }),
      }));
    });

    it('should reset consecutiveErrors to 0', async () => {
      const account = makeAccountDoc({ health: { score: 60, consecutiveErrors: 5, bounceCount: 0, thresholds: { minScore: 50, maxBounceRate: 5, maxConsecutiveErrors: 10 } } });
      (EmailAccount.findById as ReturnType<typeof vi.fn>).mockResolvedValue(account);
      (EmailAccount.findByIdAndUpdate as ReturnType<typeof vi.fn>).mockResolvedValue(null);

      await tracker.recordSuccess('acc-1');

      expect(EmailAccount.findByIdAndUpdate).toHaveBeenCalledWith('acc-1', expect.objectContaining({
        $set: expect.objectContaining({ 'health.consecutiveErrors': 0 }),
      }));
    });

    it('should increment daily sent stat', async () => {
      const account = makeAccountDoc();
      (EmailAccount.findById as ReturnType<typeof vi.fn>).mockResolvedValue(account);
      (EmailAccount.findByIdAndUpdate as ReturnType<typeof vi.fn>).mockResolvedValue(null);

      await tracker.recordSuccess('acc-1');

      expect(EmailDailyStats.findOneAndUpdate).toHaveBeenCalledWith(
        { accountId: 'acc-1', date: expect.any(String) },
        { $inc: { sent: 1 } },
        { upsert: true },
      );
    });

    it('should do nothing if account not found', async () => {
      (EmailAccount.findById as ReturnType<typeof vi.fn>).mockResolvedValue(null);

      await tracker.recordSuccess('nonexistent');

      expect(EmailAccount.findByIdAndUpdate).not.toHaveBeenCalled();
    });
  });

  describe('recordError()', () => {
    it('should decrement health score by 5', async () => {
      const account = makeAccountDoc({ health: { score: 80, consecutiveErrors: 0, bounceCount: 0, thresholds: { minScore: 50, maxBounceRate: 5, maxConsecutiveErrors: 10 } } });
      (EmailAccount.findById as ReturnType<typeof vi.fn>).mockResolvedValue(account);
      (EmailAccount.findByIdAndUpdate as ReturnType<typeof vi.fn>).mockResolvedValue(null);

      await tracker.recordError('acc-1', 'SMTP timeout');

      expect(EmailAccount.findByIdAndUpdate).toHaveBeenCalledWith('acc-1', {
        $set: {
          'health.score': 75,
          'health.consecutiveErrors': 1,
        },
      });
    });

    it('should not go below 0', async () => {
      const account = makeAccountDoc({ health: { score: 3, consecutiveErrors: 0, bounceCount: 0, thresholds: { minScore: 50, maxBounceRate: 5, maxConsecutiveErrors: 10 } } });
      (EmailAccount.findById as ReturnType<typeof vi.fn>).mockResolvedValue(account);
      (EmailAccount.findByIdAndUpdate as ReturnType<typeof vi.fn>).mockResolvedValue(null);

      await tracker.recordError('acc-1', 'error');

      expect(EmailAccount.findByIdAndUpdate).toHaveBeenCalledWith('acc-1', {
        $set: {
          'health.score': 0,
          'health.consecutiveErrors': 1,
        },
      });
    });

    it('should call onHealthDegraded hook', async () => {
      const account = makeAccountDoc({ health: { score: 80, consecutiveErrors: 0, bounceCount: 0, thresholds: { minScore: 50, maxBounceRate: 5, maxConsecutiveErrors: 10 } } });
      (EmailAccount.findById as ReturnType<typeof vi.fn>).mockResolvedValue(account);
      (EmailAccount.findByIdAndUpdate as ReturnType<typeof vi.fn>).mockResolvedValue(null);

      await tracker.recordError('acc-1', 'SMTP timeout');

      expect(hooks!.onHealthDegraded).toHaveBeenCalledWith({ accountId: 'acc-1', healthScore: 75 });
    });

    it('should auto-disable when score drops below minScore threshold', async () => {
      const account = makeAccountDoc({ health: { score: 52, consecutiveErrors: 0, bounceCount: 0, thresholds: { minScore: 50, maxBounceRate: 5, maxConsecutiveErrors: 10 } } });
      (EmailAccount.findById as ReturnType<typeof vi.fn>).mockResolvedValue(account);
      (EmailAccount.findByIdAndUpdate as ReturnType<typeof vi.fn>).mockResolvedValue(null);

      await tracker.recordError('acc-1', 'error');

      const disableCall = (EmailAccount.findByIdAndUpdate as ReturnType<typeof vi.fn>).mock.calls.find(
        (call: unknown[]) => (call[1] as Record<string, unknown>).$set && (call[1] as Record<string, Record<string, unknown>>).$set.status === ACCOUNT_STATUS.Disabled,
      );
      expect(disableCall).toBeTruthy();
      expect(logger.error).toHaveBeenCalledWith('Account auto-disabled', expect.objectContaining({ accountId: 'acc-1' }));
      expect(hooks!.onAccountDisabled).toHaveBeenCalledWith({
        accountId: 'acc-1',
        reason: expect.stringContaining('Health score'),
      });
    });

    it('should auto-disable when consecutiveErrors exceeds max', async () => {
      const account = makeAccountDoc({ health: { score: 80, consecutiveErrors: 10, bounceCount: 0, thresholds: { minScore: 50, maxBounceRate: 5, maxConsecutiveErrors: 10 } } });
      (EmailAccount.findById as ReturnType<typeof vi.fn>).mockResolvedValue(account);
      (EmailAccount.findByIdAndUpdate as ReturnType<typeof vi.fn>).mockResolvedValue(null);

      await tracker.recordError('acc-1', 'SMTP error');

      const disableCall = (EmailAccount.findByIdAndUpdate as ReturnType<typeof vi.fn>).mock.calls.find(
        (call: unknown[]) => (call[1] as Record<string, unknown>).$set && (call[1] as Record<string, Record<string, unknown>>).$set.status === ACCOUNT_STATUS.Disabled,
      );
      expect(disableCall).toBeTruthy();
      expect(hooks!.onAccountDisabled).toHaveBeenCalledWith({
        accountId: 'acc-1',
        reason: expect.stringContaining('consecutive errors'),
      });
    });

    it('should NOT auto-disable when within thresholds', async () => {
      const account = makeAccountDoc({ health: { score: 80, consecutiveErrors: 0, bounceCount: 0, thresholds: { minScore: 50, maxBounceRate: 5, maxConsecutiveErrors: 10 } } });
      (EmailAccount.findById as ReturnType<typeof vi.fn>).mockResolvedValue(account);
      (EmailAccount.findByIdAndUpdate as ReturnType<typeof vi.fn>).mockResolvedValue(null);

      await tracker.recordError('acc-1', 'temp error');

      expect(EmailAccount.findByIdAndUpdate).toHaveBeenCalledTimes(1);
      expect(hooks!.onAccountDisabled).not.toHaveBeenCalled();
    });

    it('should do nothing if account not found', async () => {
      (EmailAccount.findById as ReturnType<typeof vi.fn>).mockResolvedValue(null);

      await tracker.recordError('nonexistent', 'error');

      expect(EmailAccount.findByIdAndUpdate).not.toHaveBeenCalled();
    });
  });

  describe('recordBounce()', () => {
    it('should decrement health score by 10', async () => {
      const account = makeAccountDoc({ health: { score: 80, consecutiveErrors: 0, bounceCount: 2, thresholds: { minScore: 50, maxBounceRate: 5, maxConsecutiveErrors: 10 } }, totalEmailsSent: 100 });
      (EmailAccount.findById as ReturnType<typeof vi.fn>).mockResolvedValue(account);
      (EmailAccount.findByIdAndUpdate as ReturnType<typeof vi.fn>).mockResolvedValue(null);

      await tracker.recordBounce('acc-1', 'recipient@example.com', 'hard');

      expect(EmailAccount.findByIdAndUpdate).toHaveBeenCalledWith('acc-1', {
        $set: { 'health.score': 70, 'health.bounceCount': 3 },
      });
    });

    it('should not go below 0', async () => {
      const account = makeAccountDoc({ health: { score: 5, consecutiveErrors: 0, bounceCount: 0, thresholds: { minScore: 50, maxBounceRate: 5, maxConsecutiveErrors: 10 } }, totalEmailsSent: 100 });
      (EmailAccount.findById as ReturnType<typeof vi.fn>).mockResolvedValue(account);
      (EmailAccount.findByIdAndUpdate as ReturnType<typeof vi.fn>).mockResolvedValue(null);

      await tracker.recordBounce('acc-1', 'test@test.com', 'hard');

      expect(EmailAccount.findByIdAndUpdate).toHaveBeenCalledWith('acc-1', {
        $set: { 'health.score': 0, 'health.bounceCount': 1 },
      });
    });

    it('should increment daily bounced stat', async () => {
      const account = makeAccountDoc();
      (EmailAccount.findById as ReturnType<typeof vi.fn>).mockResolvedValue(account);
      (EmailAccount.findByIdAndUpdate as ReturnType<typeof vi.fn>).mockResolvedValue(null);

      await tracker.recordBounce('acc-1', 'test@test.com', 'soft');

      expect(EmailDailyStats.findOneAndUpdate).toHaveBeenCalledWith(
        { accountId: 'acc-1', date: expect.any(String) },
        { $inc: { bounced: 1 } },
        { upsert: true },
      );
    });

    it('should call onBounce hook with correct info', async () => {
      const account = makeAccountDoc({ provider: 'ses' });
      (EmailAccount.findById as ReturnType<typeof vi.fn>).mockResolvedValue(account);
      (EmailAccount.findByIdAndUpdate as ReturnType<typeof vi.fn>).mockResolvedValue(null);

      await tracker.recordBounce('acc-1', 'bounced@test.com', 'hard');

      expect(hooks!.onBounce).toHaveBeenCalledWith({
        accountId: 'acc-1',
        email: 'bounced@test.com',
        bounceType: 'hard',
        provider: 'ses',
      });
    });

    it('should auto-disable when bounce rate exceeds threshold', async () => {
      const account = makeAccountDoc({
        totalEmailsSent: 10,
        health: {
          score: 80,
          consecutiveErrors: 0,
          bounceCount: 0,
          thresholds: { minScore: 50, maxBounceRate: 5, maxConsecutiveErrors: 10 },
        },
      });
      (EmailAccount.findById as ReturnType<typeof vi.fn>).mockResolvedValue(account);
      (EmailAccount.findByIdAndUpdate as ReturnType<typeof vi.fn>).mockResolvedValue(null);

      await tracker.recordBounce('acc-1', 'test@test.com', 'hard');

      const disableCall = (EmailAccount.findByIdAndUpdate as ReturnType<typeof vi.fn>).mock.calls.find(
        (call: unknown[]) => (call[1] as Record<string, unknown>).$set && (call[1] as Record<string, Record<string, unknown>>).$set.status === ACCOUNT_STATUS.Disabled,
      );
      expect(disableCall).toBeTruthy();
      expect(logger.error).toHaveBeenCalledWith('Account auto-disabled due to bounce rate', expect.objectContaining({ accountId: 'acc-1' }));
      expect(hooks!.onAccountDisabled).toHaveBeenCalledWith({
        accountId: 'acc-1',
        reason: expect.stringContaining('Bounce rate'),
      });
    });

    it('should NOT auto-disable when bounce rate is within threshold', async () => {
      const account = makeAccountDoc({
        totalEmailsSent: 1000,
        health: {
          score: 80,
          consecutiveErrors: 0,
          bounceCount: 2,
          thresholds: { minScore: 50, maxBounceRate: 5, maxConsecutiveErrors: 10 },
        },
      });
      (EmailAccount.findById as ReturnType<typeof vi.fn>).mockResolvedValue(account);
      (EmailAccount.findByIdAndUpdate as ReturnType<typeof vi.fn>).mockResolvedValue(null);

      await tracker.recordBounce('acc-1', 'test@test.com', 'soft');

      expect(hooks!.onAccountDisabled).not.toHaveBeenCalled();
    });

    it('should do nothing if account not found', async () => {
      (EmailAccount.findById as ReturnType<typeof vi.fn>).mockResolvedValue(null);

      await tracker.recordBounce('nonexistent', 'test@test.com', 'hard');

      expect(EmailAccount.findByIdAndUpdate).not.toHaveBeenCalled();
    });
  });

  describe('getHealth()', () => {
    it('should return health info for existing account', async () => {
      const account = makeAccountDoc();
      (EmailAccount.findById as ReturnType<typeof vi.fn>).mockResolvedValue(account);

      const result = await tracker.getHealth('acc-1');

      expect(result).toEqual({
        accountId: 'acc-1',
        email: 'sender@example.com',
        score: 80,
        consecutiveErrors: 0,
        bounceCount: 2,
        thresholds: { minScore: 50, maxBounceRate: 5, maxConsecutiveErrors: 10 },
        status: ACCOUNT_STATUS.Active,
      });
    });

    it('should return null for non-existent account', async () => {
      (EmailAccount.findById as ReturnType<typeof vi.fn>).mockResolvedValue(null);

      const result = await tracker.getHealth('nonexistent');

      expect(result).toBeNull();
    });
  });

  describe('getAllHealth()', () => {
    it('should return health info for all accounts', async () => {
      const accounts = [
        makeAccountDoc({ _id: 'acc-1', email: 'a@test.com', health: { score: 90, consecutiveErrors: 0, bounceCount: 0, thresholds: { minScore: 50, maxBounceRate: 5, maxConsecutiveErrors: 10 } } }),
        makeAccountDoc({ _id: 'acc-2', email: 'b@test.com', health: { score: 60, consecutiveErrors: 3, bounceCount: 1, thresholds: { minScore: 50, maxBounceRate: 5, maxConsecutiveErrors: 10 } } }),
      ];
      (EmailAccount.find as ReturnType<typeof vi.fn>).mockResolvedValue(accounts);

      const results = await tracker.getAllHealth();

      expect(results).toHaveLength(2);
      expect(results[0].score).toBe(90);
      expect(results[1].score).toBe(60);
    });
  });
});
