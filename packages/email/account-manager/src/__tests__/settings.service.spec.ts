import { describe, it, expect, vi, beforeEach } from 'vitest';
import { SettingsService } from '../services/settings.service';
import type { GlobalSettingsModel } from '../schemas/global-settings.schema';
import type { LogAdapter } from '../types/config.types';
import type { GlobalSettings } from '../types/settings.types';

function createMockLogger(): LogAdapter {
  return {
    info: vi.fn(),
    warn: vi.fn(),
    error: vi.fn(),
  };
}

const STORED_SETTINGS: GlobalSettings = {
  _id: 'global',
  timezone: 'America/New_York',
  devMode: { enabled: true, testEmails: ['test@example.com'] },
  imap: {
    enabled: true,
    pollIntervalMs: 60000,
    searchSince: 'last_24h',
    bounceSenders: ['mailer-daemon@googlemail.com'],
  },
  ses: { trackOpens: true, trackClicks: false },
  approval: {
    enabled: true,
    defaultMode: 'auto',
    autoApproveDelayMs: 5000,
    sendWindow: { timezone: 'UTC', startHour: 9, endHour: 21 },
    spreadStrategy: 'random',
    maxSpreadMinutes: 120,
  },
  unsubscribePage: { companyName: 'TestCorp' },
  queues: {
    sendConcurrency: 5,
    sendAttempts: 3,
    sendBackoffMs: 5000,
    approvalConcurrency: 1,
    approvalAttempts: 3,
    approvalBackoffMs: 10000,
  },
  updatedAt: new Date('2025-01-01'),
};

function createMockModel() {
  const model = {
    findById: vi.fn().mockReturnValue({ lean: vi.fn() }),
    create: vi.fn(),
    findByIdAndUpdate: vi.fn().mockReturnValue({ lean: vi.fn() }),
  } as unknown as GlobalSettingsModel;
  return model;
}

describe('SettingsService', () => {
  let service: SettingsService;
  let model: GlobalSettingsModel;
  let logger: LogAdapter;

  beforeEach(() => {
    model = createMockModel();
    logger = createMockLogger();
    service = new SettingsService(model, logger);
  });

  describe('get()', () => {
    it('should query DB on first call when settings exist', async () => {
      (model.findById as ReturnType<typeof vi.fn>).mockReturnValue({
        lean: vi.fn().mockResolvedValue(STORED_SETTINGS),
      });

      const result = await service.get();

      expect(model.findById).toHaveBeenCalledWith('global');
      expect(result).toEqual(STORED_SETTINGS);
    });

    it('should return cached settings on subsequent calls without querying DB', async () => {
      (model.findById as ReturnType<typeof vi.fn>).mockReturnValue({
        lean: vi.fn().mockResolvedValue(STORED_SETTINGS),
      });

      const first = await service.get();
      const second = await service.get();

      expect(model.findById).toHaveBeenCalledTimes(1);
      expect(first).toBe(second);
    });

    it('should create default settings when none exist in DB', async () => {
      (model.findById as ReturnType<typeof vi.fn>).mockReturnValue({
        lean: vi.fn().mockResolvedValue(null),
      });

      const createdDoc = { _id: 'global', timezone: 'UTC', updatedAt: new Date() };
      (model.create as ReturnType<typeof vi.fn>).mockResolvedValue(createdDoc);

      const result = await service.get();

      expect(model.create).toHaveBeenCalledWith(
        expect.objectContaining({
          _id: 'global',
          timezone: 'UTC',
          updatedAt: expect.any(Date),
        }),
      );
      expect(logger.info).toHaveBeenCalledWith('GlobalSettings created with defaults');
      expect(result).toEqual(createdDoc);
    });

    it('should create settings with correct default values', async () => {
      (model.findById as ReturnType<typeof vi.fn>).mockReturnValue({
        lean: vi.fn().mockResolvedValue(null),
      });
      (model.create as ReturnType<typeof vi.fn>).mockResolvedValue({});

      await service.get();

      const createArg = (model.create as ReturnType<typeof vi.fn>).mock.calls[0][0];
      expect(createArg.timezone).toBe('UTC');
      expect(createArg.devMode).toEqual({ enabled: false, testEmails: [] });
      expect(createArg.imap.enabled).toBe(false);
      expect(createArg.imap.pollIntervalMs).toBe(300000);
      expect(createArg.imap.searchSince).toBe('last_check');
      expect(createArg.ses).toEqual({ trackOpens: true, trackClicks: true });
      expect(createArg.approval.enabled).toBe(false);
      expect(createArg.approval.defaultMode).toBe('manual');
      expect(createArg.approval.sendWindow).toEqual({ timezone: 'UTC', startHour: 9, endHour: 21 });
      expect(createArg.queues.sendConcurrency).toBe(3);
      expect(createArg.queues.sendAttempts).toBe(3);
      expect(createArg.queues.sendBackoffMs).toBe(5000);
      expect(createArg.unsubscribePage).toEqual({ companyName: '' });
    });

    it('should cache the created settings when DB was empty', async () => {
      (model.findById as ReturnType<typeof vi.fn>).mockReturnValue({
        lean: vi.fn().mockResolvedValue(null),
      });
      const createdDoc = { _id: 'global', timezone: 'UTC' };
      (model.create as ReturnType<typeof vi.fn>).mockResolvedValue(createdDoc);

      await service.get();
      const second = await service.get();

      expect(model.findById).toHaveBeenCalledTimes(1);
      expect(model.create).toHaveBeenCalledTimes(1);
      expect(second).toEqual(createdDoc);
    });
  });

  describe('update()', () => {
    it('should update settings and refresh cache', async () => {
      const updatedDoc = { ...STORED_SETTINGS, timezone: 'Asia/Kolkata' };
      (model.findByIdAndUpdate as ReturnType<typeof vi.fn>).mockReturnValue({
        lean: vi.fn().mockResolvedValue(updatedDoc),
      });

      const result = await service.update({ timezone: 'Asia/Kolkata' });

      expect(model.findByIdAndUpdate).toHaveBeenCalledWith(
        'global',
        { $set: expect.objectContaining({ timezone: 'Asia/Kolkata', updatedAt: expect.any(Date) }) },
        { new: true, upsert: true },
      );
      expect(result).toEqual(updatedDoc);
      expect(logger.info).toHaveBeenCalledWith('GlobalSettings updated', { sections: ['timezone'] });
    });

    it('should invalidate old cache after update', async () => {
      (model.findById as ReturnType<typeof vi.fn>).mockReturnValue({
        lean: vi.fn().mockResolvedValue(STORED_SETTINGS),
      });
      await service.get();

      const updatedDoc = { ...STORED_SETTINGS, timezone: 'Europe/London' };
      (model.findByIdAndUpdate as ReturnType<typeof vi.fn>).mockReturnValue({
        lean: vi.fn().mockResolvedValue(updatedDoc),
      });

      await service.update({ timezone: 'Europe/London' });

      const afterUpdate = await service.get();
      expect(afterUpdate).toEqual(updatedDoc);
      expect(model.findById).toHaveBeenCalledTimes(1);
    });

    it('should log all updated section keys', async () => {
      (model.findByIdAndUpdate as ReturnType<typeof vi.fn>).mockReturnValue({
        lean: vi.fn().mockResolvedValue(STORED_SETTINGS),
      });

      await service.update({ timezone: 'UTC', devMode: { enabled: true, testEmails: [] } });

      expect(logger.info).toHaveBeenCalledWith('GlobalSettings updated', {
        sections: ['timezone', 'devMode'],
      });
    });
  });

  describe('updateSection()', () => {
    it('should update a specific section with dot-notation fields', async () => {
      const updatedDoc = { ...STORED_SETTINGS };
      (model.findByIdAndUpdate as ReturnType<typeof vi.fn>).mockReturnValue({
        lean: vi.fn().mockResolvedValue(updatedDoc),
      });

      await service.updateSection('imap', { enabled: true, pollIntervalMs: 120000 });

      expect(model.findByIdAndUpdate).toHaveBeenCalledWith(
        'global',
        {
          $set: {
            'imap.enabled': true,
            'imap.pollIntervalMs': 120000,
            updatedAt: expect.any(Date),
          },
        },
        { new: true, upsert: true },
      );
    });

    it('should handle primitive section values', async () => {
      (model.findByIdAndUpdate as ReturnType<typeof vi.fn>).mockReturnValue({
        lean: vi.fn().mockResolvedValue(STORED_SETTINGS),
      });

      await service.updateSection('timezone', 'Asia/Tokyo');

      expect(model.findByIdAndUpdate).toHaveBeenCalledWith(
        'global',
        {
          $set: {
            timezone: 'Asia/Tokyo',
            updatedAt: expect.any(Date),
          },
        },
        { new: true, upsert: true },
      );
    });

    it('should refresh cache after section update', async () => {
      const updatedDoc = { ...STORED_SETTINGS, timezone: 'Asia/Tokyo' };
      (model.findByIdAndUpdate as ReturnType<typeof vi.fn>).mockReturnValue({
        lean: vi.fn().mockResolvedValue(updatedDoc),
      });

      await service.updateSection('timezone', 'Asia/Tokyo');

      (model.findById as ReturnType<typeof vi.fn>).mockReturnValue({
        lean: vi.fn().mockResolvedValue(null),
      });

      const cached = await service.get();
      expect(cached).toEqual(updatedDoc);
      expect(model.findById).not.toHaveBeenCalled();
    });

    it('should log section name on update', async () => {
      (model.findByIdAndUpdate as ReturnType<typeof vi.fn>).mockReturnValue({
        lean: vi.fn().mockResolvedValue(STORED_SETTINGS),
      });

      await service.updateSection('ses', { trackOpens: false });

      expect(logger.info).toHaveBeenCalledWith('GlobalSettings section updated', { section: 'ses' });
    });

    it('should handle null data as primitive value', async () => {
      (model.findByIdAndUpdate as ReturnType<typeof vi.fn>).mockReturnValue({
        lean: vi.fn().mockResolvedValue(STORED_SETTINGS),
      });

      await service.updateSection('ses', null);

      expect(model.findByIdAndUpdate).toHaveBeenCalledWith(
        'global',
        {
          $set: {
            ses: null,
            updatedAt: expect.any(Date),
          },
        },
        { new: true, upsert: true },
      );
    });
  });

  describe('invalidateCache()', () => {
    it('should force DB query on next get() call', async () => {
      (model.findById as ReturnType<typeof vi.fn>).mockReturnValue({
        lean: vi.fn().mockResolvedValue(STORED_SETTINGS),
      });

      await service.get();
      expect(model.findById).toHaveBeenCalledTimes(1);

      service.invalidateCache();

      await service.get();
      expect(model.findById).toHaveBeenCalledTimes(2);
    });
  });
});
