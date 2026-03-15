import { describe, it, expect, vi, beforeEach } from 'vitest';
import { WarmupManager } from '../services/warmup-manager';
import { ACCOUNT_STATUS } from '../constants';
import type { EmailAccountModel } from '../schemas/email-account.schema';
import type { LogAdapter, EmailAccountManagerConfig, WarmupPhase } from '../types/config.types';

function createMockLogger(): LogAdapter {
  return {
    info: vi.fn(),
    warn: vi.fn(),
    error: vi.fn(),
  };
}

function createMockEmailAccount() {
  return {
    find: vi.fn(),
    findById: vi.fn(),
    findByIdAndUpdate: vi.fn(),
  } as unknown as EmailAccountModel;
}

const DEFAULT_SCHEDULE: WarmupPhase[] = [
  { days: [1, 3], dailyLimit: 5, delayMinMs: 60000, delayMaxMs: 300000 },
  { days: [4, 7], dailyLimit: 15, delayMinMs: 30000, delayMaxMs: 180000 },
  { days: [8, 14], dailyLimit: 30, delayMinMs: 15000, delayMaxMs: 60000 },
  { days: [15, 30], dailyLimit: 50, delayMinMs: 5000, delayMaxMs: 30000 },
];

function makeAccountDoc(overrides: Record<string, unknown> = {}) {
  return {
    _id: 'acc-1',
    email: 'warmup@example.com',
    status: ACCOUNT_STATUS.Warmup,
    limits: { dailyMax: 200 },
    warmup: {
      enabled: true,
      startedAt: new Date('2025-01-01'),
      completedAt: null,
      currentDay: 1,
      schedule: DEFAULT_SCHEDULE,
    },
    ...overrides,
  };
}

describe('WarmupManager', () => {
  let manager: WarmupManager;
  let EmailAccount: EmailAccountModel;
  let logger: LogAdapter;
  let config: EmailAccountManagerConfig;
  let hooks: EmailAccountManagerConfig['hooks'];

  beforeEach(() => {
    EmailAccount = createMockEmailAccount();
    logger = createMockLogger();
    hooks = {
      onWarmupComplete: vi.fn(),
    };
    config = {
      db: { connection: {} as any },
      redis: { connection: {} as any },
      options: {
        warmup: { defaultSchedule: DEFAULT_SCHEDULE },
      },
    };
    manager = new WarmupManager(EmailAccount, config, logger, hooks);
  });

  describe('startWarmup()', () => {
    it('should set warmup fields and status to Warmup', async () => {
      (EmailAccount.findByIdAndUpdate as ReturnType<typeof vi.fn>).mockResolvedValue(null);

      await manager.startWarmup('acc-1');

      expect(EmailAccount.findByIdAndUpdate).toHaveBeenCalledWith('acc-1', {
        $set: expect.objectContaining({
          'warmup.enabled': true,
          'warmup.startedAt': expect.any(Date),
          'warmup.completedAt': null,
          'warmup.currentDay': 1,
          status: ACCOUNT_STATUS.Warmup,
          'warmup.schedule': DEFAULT_SCHEDULE,
        }),
      });
      expect(logger.info).toHaveBeenCalledWith('Warmup started', { accountId: 'acc-1' });
    });

    it('should not set schedule if no default schedule configured', async () => {
      const configNoSchedule: EmailAccountManagerConfig = {
        db: { connection: {} as any },
        redis: { connection: {} as any },
      };
      const mgr = new WarmupManager(EmailAccount, configNoSchedule, logger, hooks);
      (EmailAccount.findByIdAndUpdate as ReturnType<typeof vi.fn>).mockResolvedValue(null);

      await mgr.startWarmup('acc-1');

      const updateArg = (EmailAccount.findByIdAndUpdate as ReturnType<typeof vi.fn>).mock.calls[0][1];
      expect(updateArg.$set).not.toHaveProperty('warmup.schedule');
    });
  });

  describe('completeWarmup()', () => {
    it('should disable warmup and set status to Active', async () => {
      const updatedAccount = makeAccountDoc({ status: ACCOUNT_STATUS.Active, warmup: { enabled: false, completedAt: new Date() } });
      (EmailAccount.findByIdAndUpdate as ReturnType<typeof vi.fn>).mockResolvedValue(updatedAccount);

      await manager.completeWarmup('acc-1');

      expect(EmailAccount.findByIdAndUpdate).toHaveBeenCalledWith(
        'acc-1',
        {
          $set: {
            'warmup.enabled': false,
            'warmup.completedAt': expect.any(Date),
            status: ACCOUNT_STATUS.Active,
          },
        },
        { new: true },
      );
      expect(hooks!.onWarmupComplete).toHaveBeenCalledWith({
        accountId: 'acc-1',
        email: 'warmup@example.com',
      });
      expect(logger.info).toHaveBeenCalledWith('Warmup completed', expect.objectContaining({ accountId: 'acc-1' }));
    });

    it('should not call hook if account not found', async () => {
      (EmailAccount.findByIdAndUpdate as ReturnType<typeof vi.fn>).mockResolvedValue(null);

      await manager.completeWarmup('nonexistent');

      expect(hooks!.onWarmupComplete).not.toHaveBeenCalled();
    });
  });

  describe('resetWarmup()', () => {
    it('should reset warmup to day 1', async () => {
      (EmailAccount.findByIdAndUpdate as ReturnType<typeof vi.fn>).mockResolvedValue(null);

      await manager.resetWarmup('acc-1');

      expect(EmailAccount.findByIdAndUpdate).toHaveBeenCalledWith('acc-1', {
        $set: {
          'warmup.enabled': true,
          'warmup.startedAt': expect.any(Date),
          'warmup.completedAt': null,
          'warmup.currentDay': 1,
          status: ACCOUNT_STATUS.Warmup,
        },
      });
    });
  });

  describe('getCurrentPhase()', () => {
    it('should return correct phase for day 1', async () => {
      const account = makeAccountDoc({ warmup: { enabled: true, currentDay: 1, schedule: DEFAULT_SCHEDULE } });
      (EmailAccount.findById as ReturnType<typeof vi.fn>).mockResolvedValue(account);

      const phase = await manager.getCurrentPhase('acc-1');

      expect(phase).toEqual(DEFAULT_SCHEDULE[0]);
      expect(phase!.dailyLimit).toBe(5);
    });

    it('should return correct phase for day 5 (second phase)', async () => {
      const account = makeAccountDoc({ warmup: { enabled: true, currentDay: 5, schedule: DEFAULT_SCHEDULE } });
      (EmailAccount.findById as ReturnType<typeof vi.fn>).mockResolvedValue(account);

      const phase = await manager.getCurrentPhase('acc-1');

      expect(phase).toEqual(DEFAULT_SCHEDULE[1]);
      expect(phase!.dailyLimit).toBe(15);
    });

    it('should return correct phase for day 10 (third phase)', async () => {
      const account = makeAccountDoc({ warmup: { enabled: true, currentDay: 10, schedule: DEFAULT_SCHEDULE } });
      (EmailAccount.findById as ReturnType<typeof vi.fn>).mockResolvedValue(account);

      const phase = await manager.getCurrentPhase('acc-1');

      expect(phase).toEqual(DEFAULT_SCHEDULE[2]);
      expect(phase!.dailyLimit).toBe(30);
    });

    it('should return null if warmup is not enabled', async () => {
      const account = makeAccountDoc({ warmup: { enabled: false, currentDay: 1, schedule: DEFAULT_SCHEDULE } });
      (EmailAccount.findById as ReturnType<typeof vi.fn>).mockResolvedValue(account);

      const phase = await manager.getCurrentPhase('acc-1');

      expect(phase).toBeNull();
    });

    it('should return null if account not found', async () => {
      (EmailAccount.findById as ReturnType<typeof vi.fn>).mockResolvedValue(null);

      const phase = await manager.getCurrentPhase('nonexistent');

      expect(phase).toBeNull();
    });

    it('should return null if no schedule is set', async () => {
      const account = makeAccountDoc({ warmup: { enabled: true, currentDay: 1, schedule: undefined } });
      (EmailAccount.findById as ReturnType<typeof vi.fn>).mockResolvedValue(account);

      const phase = await manager.getCurrentPhase('acc-1');

      expect(phase).toBeNull();
    });

    it('should handle open-ended phase (days[1] === 0)', async () => {
      const openSchedule: WarmupPhase[] = [
        { days: [1, 5], dailyLimit: 10, delayMinMs: 1000, delayMaxMs: 5000 },
        { days: [6, 0], dailyLimit: 50, delayMinMs: 500, delayMaxMs: 2000 },
      ];
      const account = makeAccountDoc({ warmup: { enabled: true, currentDay: 100, schedule: openSchedule } });
      (EmailAccount.findById as ReturnType<typeof vi.fn>).mockResolvedValue(account);

      const phase = await manager.getCurrentPhase('acc-1');

      expect(phase).toEqual(openSchedule[1]);
      expect(phase!.dailyLimit).toBe(50);
    });
  });

  describe('getDailyLimit()', () => {
    it('should return warmup phase daily limit when in warmup', async () => {
      const account = makeAccountDoc({ warmup: { enabled: true, currentDay: 2, schedule: DEFAULT_SCHEDULE } });
      (EmailAccount.findById as ReturnType<typeof vi.fn>).mockResolvedValue(account);

      const limit = await manager.getDailyLimit('acc-1');

      expect(limit).toBe(5);
    });

    it('should return account dailyMax when warmup is disabled', async () => {
      const account = makeAccountDoc({
        warmup: { enabled: false, currentDay: 1, schedule: DEFAULT_SCHEDULE },
        limits: { dailyMax: 200 },
      });
      (EmailAccount.findById as ReturnType<typeof vi.fn>).mockResolvedValue(account);

      const limit = await manager.getDailyLimit('acc-1');

      expect(limit).toBe(200);
    });

    it('should return account dailyMax when day exceeds all phases', async () => {
      const shortSchedule: WarmupPhase[] = [
        { days: [1, 3], dailyLimit: 5, delayMinMs: 1000, delayMaxMs: 5000 },
      ];
      const account = makeAccountDoc({
        warmup: { enabled: true, currentDay: 10, schedule: shortSchedule },
        limits: { dailyMax: 200 },
      });
      (EmailAccount.findById as ReturnType<typeof vi.fn>).mockResolvedValue(account);

      const limit = await manager.getDailyLimit('acc-1');

      expect(limit).toBe(200);
    });

    it('should return 0 for non-existent account', async () => {
      (EmailAccount.findById as ReturnType<typeof vi.fn>).mockResolvedValue(null);

      const limit = await manager.getDailyLimit('nonexistent');

      expect(limit).toBe(0);
    });

    it('should return increasing limits as warmup progresses', async () => {
      const limits: number[] = [];

      for (const day of [1, 5, 10, 20]) {
        const account = makeAccountDoc({ warmup: { enabled: true, currentDay: day, schedule: DEFAULT_SCHEDULE } });
        (EmailAccount.findById as ReturnType<typeof vi.fn>).mockResolvedValue(account);
        limits.push(await manager.getDailyLimit('acc-1'));
      }

      expect(limits).toEqual([5, 15, 30, 50]);
      for (let i = 1; i < limits.length; i++) {
        expect(limits[i]).toBeGreaterThan(limits[i - 1]);
      }
    });
  });

  describe('advanceDay()', () => {
    it('should increment currentDay', async () => {
      const account = makeAccountDoc({ warmup: { enabled: true, currentDay: 5, schedule: DEFAULT_SCHEDULE } });
      (EmailAccount.findById as ReturnType<typeof vi.fn>).mockResolvedValue(account);
      (EmailAccount.findByIdAndUpdate as ReturnType<typeof vi.fn>).mockResolvedValue(null);

      await manager.advanceDay('acc-1');

      expect(EmailAccount.findByIdAndUpdate).toHaveBeenCalledWith('acc-1', {
        $set: { 'warmup.currentDay': 6 },
      });
    });

    it('should complete warmup when advancing past max day', async () => {
      const account = makeAccountDoc({ warmup: { enabled: true, currentDay: 30, schedule: DEFAULT_SCHEDULE } });
      (EmailAccount.findById as ReturnType<typeof vi.fn>).mockResolvedValue(account);
      const completedAccount = makeAccountDoc({ email: 'warmup@example.com' });
      (EmailAccount.findByIdAndUpdate as ReturnType<typeof vi.fn>).mockResolvedValue(completedAccount);

      await manager.advanceDay('acc-1');

      expect(EmailAccount.findByIdAndUpdate).toHaveBeenCalledWith(
        'acc-1',
        expect.objectContaining({
          $set: expect.objectContaining({
            'warmup.enabled': false,
            status: ACCOUNT_STATUS.Active,
          }),
        }),
        { new: true },
      );
    });

    it('should not advance if warmup is disabled', async () => {
      const account = makeAccountDoc({ warmup: { enabled: false, currentDay: 5, schedule: DEFAULT_SCHEDULE } });
      (EmailAccount.findById as ReturnType<typeof vi.fn>).mockResolvedValue(account);

      await manager.advanceDay('acc-1');

      expect(EmailAccount.findByIdAndUpdate).not.toHaveBeenCalled();
    });

    it('should not advance if account not found', async () => {
      (EmailAccount.findById as ReturnType<typeof vi.fn>).mockResolvedValue(null);

      await manager.advanceDay('nonexistent');

      expect(EmailAccount.findByIdAndUpdate).not.toHaveBeenCalled();
    });

    it('should not complete warmup if schedule has open-ended phase', async () => {
      const openSchedule: WarmupPhase[] = [
        { days: [1, 5], dailyLimit: 10, delayMinMs: 1000, delayMaxMs: 5000 },
        { days: [6, 0], dailyLimit: 50, delayMinMs: 500, delayMaxMs: 2000 },
      ];
      const account = makeAccountDoc({ warmup: { enabled: true, currentDay: 100, schedule: openSchedule } });
      (EmailAccount.findById as ReturnType<typeof vi.fn>).mockResolvedValue(account);
      (EmailAccount.findByIdAndUpdate as ReturnType<typeof vi.fn>).mockResolvedValue(null);

      await manager.advanceDay('acc-1');

      expect(EmailAccount.findByIdAndUpdate).toHaveBeenCalledWith('acc-1', {
        $set: { 'warmup.currentDay': 101 },
      });
    });
  });

  describe('getStatus()', () => {
    it('should return full warmup status for active warmup', async () => {
      const startDate = new Date('2025-01-01');
      const account = makeAccountDoc({
        warmup: { enabled: true, startedAt: startDate, completedAt: null, currentDay: 5, schedule: DEFAULT_SCHEDULE },
        limits: { dailyMax: 200 },
      });
      (EmailAccount.findById as ReturnType<typeof vi.fn>).mockResolvedValue(account);

      const status = await manager.getStatus('acc-1');

      expect(status).toEqual({
        accountId: 'acc-1',
        email: 'warmup@example.com',
        enabled: true,
        currentDay: 5,
        startedAt: startDate,
        completedAt: null,
        currentPhase: DEFAULT_SCHEDULE[1],
        dailyLimit: 15,
        delayRange: { min: 30000, max: 180000 },
      });
    });

    it('should return null for non-existent account', async () => {
      (EmailAccount.findById as ReturnType<typeof vi.fn>).mockResolvedValue(null);

      const status = await manager.getStatus('nonexistent');

      expect(status).toBeNull();
    });

    it('should return dailyMax and zero delay when no phase matches', async () => {
      const account = makeAccountDoc({
        warmup: { enabled: true, currentDay: 99, schedule: [{ days: [1, 3], dailyLimit: 5, delayMinMs: 1000, delayMaxMs: 5000 }] },
        limits: { dailyMax: 200 },
      });
      (EmailAccount.findById as ReturnType<typeof vi.fn>).mockResolvedValue(account);

      const status = await manager.getStatus('acc-1');

      expect(status!.dailyLimit).toBe(200);
      expect(status!.delayRange).toEqual({ min: 0, max: 0 });
      expect(status!.currentPhase).toBeNull();
    });
  });

  describe('getRecommendedDelay()', () => {
    it('should return delay within phase range', async () => {
      const account = makeAccountDoc({ warmup: { enabled: true, currentDay: 1, schedule: DEFAULT_SCHEDULE } });
      (EmailAccount.findById as ReturnType<typeof vi.fn>).mockResolvedValue(account);

      const delay = await manager.getRecommendedDelay('acc-1');

      expect(delay).toBeGreaterThanOrEqual(60000);
      expect(delay).toBeLessThanOrEqual(300000);
    });

    it('should return 0 when no phase matches', async () => {
      const account = makeAccountDoc({ warmup: { enabled: false, currentDay: 1, schedule: DEFAULT_SCHEDULE } });
      (EmailAccount.findById as ReturnType<typeof vi.fn>).mockResolvedValue(account);

      const delay = await manager.getRecommendedDelay('acc-1');

      expect(delay).toBe(0);
    });
  });

  describe('advanceAllAccounts()', () => {
    it('should advance all warmup-enabled accounts', async () => {
      const accounts = [
        makeAccountDoc({ _id: 'acc-1', email: 'a@example.com', warmup: { enabled: true, currentDay: 5, schedule: DEFAULT_SCHEDULE } }),
        makeAccountDoc({ _id: 'acc-2', email: 'b@example.com', warmup: { enabled: true, currentDay: 10, schedule: DEFAULT_SCHEDULE } }),
      ];
      (EmailAccount.find as ReturnType<typeof vi.fn>).mockResolvedValue(accounts);
      (EmailAccount.findById as ReturnType<typeof vi.fn>)
        .mockResolvedValueOnce(accounts[0])
        .mockResolvedValueOnce(accounts[1]);
      (EmailAccount.findByIdAndUpdate as ReturnType<typeof vi.fn>).mockResolvedValue(null);

      const result = await manager.advanceAllAccounts();

      expect(result).toEqual({ advanced: 2, errors: 0 });
      expect(EmailAccount.find).toHaveBeenCalledWith({
        status: ACCOUNT_STATUS.Warmup,
        'warmup.enabled': true,
      });
    });

    it('should count errors when advanceDay fails', async () => {
      const accounts = [
        makeAccountDoc({ _id: 'acc-1', email: 'a@example.com', warmup: { enabled: true, currentDay: 5, schedule: DEFAULT_SCHEDULE } }),
      ];
      (EmailAccount.find as ReturnType<typeof vi.fn>).mockResolvedValue(accounts);
      (EmailAccount.findById as ReturnType<typeof vi.fn>).mockRejectedValue(new Error('DB error'));

      const result = await manager.advanceAllAccounts();

      expect(result).toEqual({ advanced: 0, errors: 1 });
      expect(logger.error).toHaveBeenCalled();
    });

    it('should return zeros when no accounts are in warmup', async () => {
      (EmailAccount.find as ReturnType<typeof vi.fn>).mockResolvedValue([]);

      const result = await manager.advanceAllAccounts();

      expect(result).toEqual({ advanced: 0, errors: 0 });
    });
  });

  describe('updateSchedule()', () => {
    it('should update the warmup schedule', async () => {
      const newSchedule: WarmupPhase[] = [
        { days: [1, 7], dailyLimit: 10, delayMinMs: 5000, delayMaxMs: 10000 },
      ];
      (EmailAccount.findByIdAndUpdate as ReturnType<typeof vi.fn>).mockResolvedValue(null);

      await manager.updateSchedule('acc-1', newSchedule);

      expect(EmailAccount.findByIdAndUpdate).toHaveBeenCalledWith('acc-1', {
        $set: { 'warmup.schedule': newSchedule },
      });
      expect(logger.info).toHaveBeenCalledWith('Warmup schedule updated', { accountId: 'acc-1', phases: 1 });
    });
  });
});
