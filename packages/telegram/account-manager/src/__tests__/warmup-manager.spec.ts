import { describe, it, expect, vi, beforeEach } from 'vitest';
import { WarmupManager } from '../services/warmup-manager';
import { ACCOUNT_STATUS, DEFAULT_WARMUP_SCHEDULE } from '../constants';
import type { TelegramAccountModel } from '../schemas/telegram-account.schema';
import type { TelegramAccountManagerConfig, WarmupPhase } from '../types/config.types';

function createMockConfig(overrides: Partial<TelegramAccountManagerConfig> = {}): TelegramAccountManagerConfig {
  return {
    db: { connection: {} as any },
    credentials: { apiId: 12345, apiHash: 'abc123' },
    logger: {
      info: vi.fn(),
      warn: vi.fn(),
      error: vi.fn(),
    },
    options: {
      warmup: { defaultSchedule: DEFAULT_WARMUP_SCHEDULE },
    },
    ...overrides,
  };
}

function createMockTelegramAccount() {
  return {
    find: vi.fn(),
    findById: vi.fn(),
    findByIdAndUpdate: vi.fn(),
  } as unknown as TelegramAccountModel;
}

function makeAccountDoc(overrides: Record<string, unknown> = {}) {
  return {
    _id: 'acc-1',
    phone: '+1234567890',
    status: ACCOUNT_STATUS.Warmup,
    currentDailyLimit: 40,
    currentDelayMin: 30000,
    currentDelayMax: 60000,
    warmup: {
      enabled: true,
      startedAt: new Date('2025-01-01'),
      completedAt: null,
      currentDay: 1,
      schedule: DEFAULT_WARMUP_SCHEDULE,
    },
    ...overrides,
  };
}

describe('WarmupManager', () => {
  let manager: WarmupManager;
  let TelegramAccount: TelegramAccountModel;
  let config: TelegramAccountManagerConfig;
  let hooks: TelegramAccountManagerConfig['hooks'];

  beforeEach(() => {
    TelegramAccount = createMockTelegramAccount();
    hooks = {
      onWarmupComplete: vi.fn(),
    };
    config = createMockConfig();
    manager = new WarmupManager(TelegramAccount, config, hooks);
  });

  describe('startWarmup()', () => {
    it('should set warmup fields and status to Warmup', async () => {
      (TelegramAccount.findByIdAndUpdate as ReturnType<typeof vi.fn>).mockResolvedValue(null);

      await manager.startWarmup('acc-1');

      expect(TelegramAccount.findByIdAndUpdate).toHaveBeenCalledWith('acc-1', {
        $set: expect.objectContaining({
          'warmup.enabled': true,
          'warmup.startedAt': expect.any(Date),
          'warmup.completedAt': null,
          'warmup.currentDay': 1,
          status: ACCOUNT_STATUS.Warmup,
          'warmup.schedule': DEFAULT_WARMUP_SCHEDULE,
        }),
      });
      expect(config.logger!.info).toHaveBeenCalledWith('Warmup started', { accountId: 'acc-1' });
    });

    it('should use custom schedule when provided', async () => {
      const customSchedule: WarmupPhase[] = [
        { days: [1, 5], dailyLimit: 20, delayMinMs: 5000, delayMaxMs: 10000 },
      ];
      (TelegramAccount.findByIdAndUpdate as ReturnType<typeof vi.fn>).mockResolvedValue(null);

      await manager.startWarmup('acc-1', customSchedule);

      const updateArg = (TelegramAccount.findByIdAndUpdate as ReturnType<typeof vi.fn>).mock.calls[0][1];
      expect(updateArg.$set['warmup.schedule']).toEqual(customSchedule);
    });

    it('should fallback to DEFAULT_WARMUP_SCHEDULE when no config schedule', async () => {
      const configNoSchedule = createMockConfig({ options: {} });
      const mgr = new WarmupManager(TelegramAccount, configNoSchedule, hooks);
      (TelegramAccount.findByIdAndUpdate as ReturnType<typeof vi.fn>).mockResolvedValue(null);

      await mgr.startWarmup('acc-1');

      const updateArg = (TelegramAccount.findByIdAndUpdate as ReturnType<typeof vi.fn>).mock.calls[0][1];
      expect(updateArg.$set['warmup.schedule']).toEqual(DEFAULT_WARMUP_SCHEDULE);
    });
  });

  describe('completeWarmup()', () => {
    it('should disable warmup and set status to Connected', async () => {
      const updatedAccount = makeAccountDoc({ status: ACCOUNT_STATUS.Connected, warmup: { enabled: false, completedAt: new Date() } });
      (TelegramAccount.findByIdAndUpdate as ReturnType<typeof vi.fn>).mockResolvedValue(updatedAccount);

      await manager.completeWarmup('acc-1');

      expect(TelegramAccount.findByIdAndUpdate).toHaveBeenCalledWith(
        'acc-1',
        {
          $set: {
            'warmup.enabled': false,
            'warmup.completedAt': expect.any(Date),
            status: ACCOUNT_STATUS.Connected,
          },
        },
        { new: true },
      );
      expect(hooks!.onWarmupComplete).toHaveBeenCalledWith({
        accountId: 'acc-1',
        phone: '+1234567890',
      });
      expect(config.logger!.info).toHaveBeenCalledWith('Warmup completed', expect.objectContaining({ accountId: 'acc-1' }));
    });

    it('should not call hook if account not found', async () => {
      (TelegramAccount.findByIdAndUpdate as ReturnType<typeof vi.fn>).mockResolvedValue(null);

      await manager.completeWarmup('nonexistent');

      expect(hooks!.onWarmupComplete).not.toHaveBeenCalled();
    });
  });

  describe('resetWarmup()', () => {
    it('should reset warmup to day 1', async () => {
      (TelegramAccount.findByIdAndUpdate as ReturnType<typeof vi.fn>).mockResolvedValue(null);

      await manager.resetWarmup('acc-1');

      expect(TelegramAccount.findByIdAndUpdate).toHaveBeenCalledWith('acc-1', {
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
      const account = makeAccountDoc({ warmup: { enabled: true, currentDay: 1, schedule: DEFAULT_WARMUP_SCHEDULE } });

      const phase = await manager.getCurrentPhase(account);

      expect(phase).toEqual(DEFAULT_WARMUP_SCHEDULE[0]);
      expect(phase!.dailyLimit).toBe(10);
    });

    it('should return correct phase for day 5 (second phase)', async () => {
      const account = makeAccountDoc({ warmup: { enabled: true, currentDay: 5, schedule: DEFAULT_WARMUP_SCHEDULE } });

      const phase = await manager.getCurrentPhase(account);

      expect(phase).toEqual(DEFAULT_WARMUP_SCHEDULE[1]);
      expect(phase!.dailyLimit).toBe(25);
    });

    it('should return correct phase for day 10 (third phase)', async () => {
      const account = makeAccountDoc({ warmup: { enabled: true, currentDay: 10, schedule: DEFAULT_WARMUP_SCHEDULE } });

      const phase = await manager.getCurrentPhase(account);

      expect(phase).toEqual(DEFAULT_WARMUP_SCHEDULE[2]);
      expect(phase!.dailyLimit).toBe(50);
    });

    it('should return null if warmup is not enabled', async () => {
      const account = makeAccountDoc({ warmup: { enabled: false, currentDay: 1, schedule: DEFAULT_WARMUP_SCHEDULE } });

      const phase = await manager.getCurrentPhase(account);

      expect(phase).toBeNull();
    });

    it('should return null if no schedule is set', async () => {
      const account = makeAccountDoc({ warmup: { enabled: true, currentDay: 1, schedule: undefined } });

      const phase = await manager.getCurrentPhase(account);

      expect(phase).toBeNull();
    });

    it('should handle open-ended phase (days[1] === 0)', async () => {
      const account = makeAccountDoc({ warmup: { enabled: true, currentDay: 100, schedule: DEFAULT_WARMUP_SCHEDULE } });

      const phase = await manager.getCurrentPhase(account);

      // Phase 4 is [15, 0] -> open-ended
      expect(phase).toEqual(DEFAULT_WARMUP_SCHEDULE[3]);
      expect(phase!.dailyLimit).toBe(100);
    });
  });

  describe('getDailyLimit()', () => {
    it('should return warmup phase daily limit when in warmup', async () => {
      const account = makeAccountDoc({ warmup: { enabled: true, currentDay: 2, schedule: DEFAULT_WARMUP_SCHEDULE } });

      const limit = await manager.getDailyLimit(account);

      expect(limit).toBe(10);
    });

    it('should return account currentDailyLimit when warmup is disabled', async () => {
      const account = makeAccountDoc({
        warmup: { enabled: false, currentDay: 1, schedule: DEFAULT_WARMUP_SCHEDULE },
        currentDailyLimit: 200,
      });

      const limit = await manager.getDailyLimit(account);

      expect(limit).toBe(200);
    });

    it('should return account currentDailyLimit when day exceeds all closed phases', async () => {
      const shortSchedule: WarmupPhase[] = [
        { days: [1, 3], dailyLimit: 5, delayMinMs: 1000, delayMaxMs: 5000 },
      ];
      const account = makeAccountDoc({
        warmup: { enabled: true, currentDay: 10, schedule: shortSchedule },
        currentDailyLimit: 200,
      });

      const limit = await manager.getDailyLimit(account);

      expect(limit).toBe(200);
    });

    it('should return increasing limits as warmup progresses', async () => {
      const limits: number[] = [];

      for (const day of [1, 5, 10, 20]) {
        const account = makeAccountDoc({ warmup: { enabled: true, currentDay: day, schedule: DEFAULT_WARMUP_SCHEDULE } });
        limits.push(await manager.getDailyLimit(account));
      }

      expect(limits).toEqual([10, 25, 50, 100]);
      for (let i = 1; i < limits.length; i++) {
        expect(limits[i]).toBeGreaterThan(limits[i - 1]);
      }
    });
  });

  describe('advanceDay()', () => {
    it('should increment currentDay', async () => {
      const account = makeAccountDoc({ warmup: { enabled: true, currentDay: 5, schedule: DEFAULT_WARMUP_SCHEDULE } });
      (TelegramAccount.findById as ReturnType<typeof vi.fn>).mockResolvedValue(account);
      (TelegramAccount.findByIdAndUpdate as ReturnType<typeof vi.fn>).mockResolvedValue(null);

      await manager.advanceDay('acc-1');

      expect(TelegramAccount.findByIdAndUpdate).toHaveBeenCalledWith('acc-1', {
        $set: { 'warmup.currentDay': 6 },
      });
    });

    it('should not complete warmup if schedule has open-ended phase', async () => {
      const account = makeAccountDoc({ warmup: { enabled: true, currentDay: 100, schedule: DEFAULT_WARMUP_SCHEDULE } });
      (TelegramAccount.findById as ReturnType<typeof vi.fn>).mockResolvedValue(account);
      (TelegramAccount.findByIdAndUpdate as ReturnType<typeof vi.fn>).mockResolvedValue(null);

      await manager.advanceDay('acc-1');

      expect(TelegramAccount.findByIdAndUpdate).toHaveBeenCalledWith('acc-1', {
        $set: { 'warmup.currentDay': 101 },
      });
    });

    it('should complete warmup when advancing past max day of closed schedule', async () => {
      const closedSchedule: WarmupPhase[] = [
        { days: [1, 3], dailyLimit: 5, delayMinMs: 1000, delayMaxMs: 5000 },
        { days: [4, 7], dailyLimit: 15, delayMinMs: 500, delayMaxMs: 2000 },
      ];
      const account = makeAccountDoc({ warmup: { enabled: true, currentDay: 7, schedule: closedSchedule } });
      (TelegramAccount.findById as ReturnType<typeof vi.fn>).mockResolvedValue(account);
      const completedAccount = makeAccountDoc({ phone: '+1234567890' });
      (TelegramAccount.findByIdAndUpdate as ReturnType<typeof vi.fn>).mockResolvedValue(completedAccount);

      await manager.advanceDay('acc-1');

      expect(TelegramAccount.findByIdAndUpdate).toHaveBeenCalledWith(
        'acc-1',
        expect.objectContaining({
          $set: expect.objectContaining({
            'warmup.enabled': false,
            status: ACCOUNT_STATUS.Connected,
          }),
        }),
        { new: true },
      );
    });

    it('should not advance if warmup is disabled', async () => {
      const account = makeAccountDoc({ warmup: { enabled: false, currentDay: 5, schedule: DEFAULT_WARMUP_SCHEDULE } });
      (TelegramAccount.findById as ReturnType<typeof vi.fn>).mockResolvedValue(account);

      await manager.advanceDay('acc-1');

      expect(TelegramAccount.findByIdAndUpdate).not.toHaveBeenCalled();
    });

    it('should not advance if account not found', async () => {
      (TelegramAccount.findById as ReturnType<typeof vi.fn>).mockResolvedValue(null);

      await manager.advanceDay('nonexistent');

      expect(TelegramAccount.findByIdAndUpdate).not.toHaveBeenCalled();
    });
  });

  describe('getRecommendedDelay()', () => {
    it('should return delay within phase range', async () => {
      const account = makeAccountDoc({ warmup: { enabled: true, currentDay: 1, schedule: DEFAULT_WARMUP_SCHEDULE } });

      const delay = await manager.getRecommendedDelay(account);

      expect(delay).toBeGreaterThanOrEqual(60000);
      expect(delay).toBeLessThanOrEqual(120000);
    });

    it('should return 0 when warmup is disabled', async () => {
      const account = makeAccountDoc({ warmup: { enabled: false, currentDay: 1, schedule: DEFAULT_WARMUP_SCHEDULE } });

      const delay = await manager.getRecommendedDelay(account);

      expect(delay).toBe(0);
    });
  });

  describe('getStatus()', () => {
    it('should return full warmup status for active warmup', async () => {
      const startDate = new Date('2025-01-01');
      const account = makeAccountDoc({
        warmup: { enabled: true, startedAt: startDate, completedAt: null, currentDay: 5, schedule: DEFAULT_WARMUP_SCHEDULE },
        currentDailyLimit: 200,
        currentDelayMin: 30000,
        currentDelayMax: 60000,
      });
      (TelegramAccount.findById as ReturnType<typeof vi.fn>).mockResolvedValue(account);

      const status = await manager.getStatus('acc-1');

      expect(status).toEqual({
        accountId: 'acc-1',
        phone: '+1234567890',
        enabled: true,
        currentDay: 5,
        startedAt: startDate,
        completedAt: null,
        currentPhase: DEFAULT_WARMUP_SCHEDULE[1],
        dailyLimit: 25,
        delayRange: { min: 45000, max: 90000 },
      });
    });

    it('should return null for non-existent account', async () => {
      (TelegramAccount.findById as ReturnType<typeof vi.fn>).mockResolvedValue(null);

      const status = await manager.getStatus('nonexistent');

      expect(status).toBeNull();
    });

    it('should return account defaults when no phase matches', async () => {
      const account = makeAccountDoc({
        warmup: { enabled: true, currentDay: 99, schedule: [{ days: [1, 3], dailyLimit: 5, delayMinMs: 1000, delayMaxMs: 5000 }] },
        currentDailyLimit: 200,
        currentDelayMin: 30000,
        currentDelayMax: 60000,
      });
      (TelegramAccount.findById as ReturnType<typeof vi.fn>).mockResolvedValue(account);

      const status = await manager.getStatus('acc-1');

      expect(status!.dailyLimit).toBe(200);
      expect(status!.delayRange).toEqual({ min: 30000, max: 60000 });
      expect(status!.currentPhase).toBeNull();
    });
  });

  describe('advanceAllAccounts()', () => {
    it('should advance all warmup-enabled accounts', async () => {
      const accounts = [
        makeAccountDoc({ _id: 'acc-1', phone: '+111', warmup: { enabled: true, currentDay: 5, schedule: DEFAULT_WARMUP_SCHEDULE } }),
        makeAccountDoc({ _id: 'acc-2', phone: '+222', warmup: { enabled: true, currentDay: 10, schedule: DEFAULT_WARMUP_SCHEDULE } }),
      ];
      (TelegramAccount.find as ReturnType<typeof vi.fn>).mockResolvedValue(accounts);
      (TelegramAccount.findById as ReturnType<typeof vi.fn>)
        .mockResolvedValueOnce(accounts[0])
        .mockResolvedValueOnce(accounts[1]);
      (TelegramAccount.findByIdAndUpdate as ReturnType<typeof vi.fn>).mockResolvedValue(null);

      const result = await manager.advanceAllAccounts();

      expect(result).toEqual({ advanced: 2, errors: 0 });
      expect(TelegramAccount.find).toHaveBeenCalledWith({
        status: ACCOUNT_STATUS.Warmup,
        'warmup.enabled': true,
      });
    });

    it('should count errors when advanceDay fails', async () => {
      const accounts = [
        makeAccountDoc({ _id: 'acc-1', phone: '+111', warmup: { enabled: true, currentDay: 5, schedule: DEFAULT_WARMUP_SCHEDULE } }),
      ];
      (TelegramAccount.find as ReturnType<typeof vi.fn>).mockResolvedValue(accounts);
      (TelegramAccount.findById as ReturnType<typeof vi.fn>).mockRejectedValue(new Error('DB error'));

      const result = await manager.advanceAllAccounts();

      expect(result).toEqual({ advanced: 0, errors: 1 });
      expect(config.logger!.error).toHaveBeenCalled();
    });

    it('should return zeros when no accounts are in warmup', async () => {
      (TelegramAccount.find as ReturnType<typeof vi.fn>).mockResolvedValue([]);

      const result = await manager.advanceAllAccounts();

      expect(result).toEqual({ advanced: 0, errors: 0 });
    });
  });
});
