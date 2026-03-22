import { describe, it, expect, vi, beforeEach } from 'vitest';
import { SettingsService } from '../../services/settings.service.js';
import { InvalidConfigError } from '../../errors/index.js';

// ── Mock helpers ──────────────────────────────────────────────────────────────

function makeDefaultDoc(overrides: Record<string, unknown> = {}) {
  return {
    key: 'global',
    availableTags: [],
    availableCategories: [],
    priorityLevels: [],
    defaultFollowUpDays: 3,
    followUpReminderEnabled: true,
    timelinePageSize: 20,
    maxConcurrentCalls: 10,
    updatedAt: new Date(),
    ...overrides,
  };
}

function makeModel(doc: unknown = null) {
  return {
    findOne: vi.fn().mockResolvedValue(doc),
    create: vi.fn().mockImplementation((data: unknown) => Promise.resolve({ ...makeDefaultDoc(), ...(data as object) })),
    findOneAndUpdate: vi.fn().mockImplementation((_filter: unknown, update: unknown) => {
      const $set = (update as { $set?: Record<string, unknown>; $setOnInsert?: Record<string, unknown> }).$set;
      const $setOnInsert = (update as { $set?: Record<string, unknown>; $setOnInsert?: Record<string, unknown> }).$setOnInsert;
      const merged = { ...makeDefaultDoc(), ...($setOnInsert ?? {}), ...($set ?? {}) };
      return Promise.resolve(doc !== null ? { ...makeDefaultDoc(), ...($set ?? {}) } : merged);
    }),
  };
}

const mockLogger = {
  info: vi.fn(),
  warn: vi.fn(),
  error: vi.fn(),
  debug: vi.fn(),
};

// ── Tests ─────────────────────────────────────────────────────────────────────

describe('SettingsService', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('get()', () => {
    it('returns settings using atomic findOneAndUpdate upsert', async () => {
      const existingDoc = makeDefaultDoc({ defaultFollowUpDays: 7 });
      const model = makeModel(existingDoc);
      const service = new SettingsService(model as any, mockLogger);

      const result = await service.get();

      expect(model.findOneAndUpdate).toHaveBeenCalledWith(
        { key: 'global' },
        { $setOnInsert: expect.objectContaining({ key: 'global' }) },
        { upsert: true, new: true },
      );
      expect(model.findOne).not.toHaveBeenCalled();
      expect(model.create).not.toHaveBeenCalled();
      expect(result).toBeDefined();
    });

    it('inserts defaults on first call (upsert path)', async () => {
      const model = makeModel(null);
      const service = new SettingsService(model as any, mockLogger);

      const result = await service.get();

      expect(model.findOneAndUpdate).toHaveBeenCalledWith(
        { key: 'global' },
        { $setOnInsert: expect.objectContaining({ key: 'global' }) },
        { upsert: true, new: true },
      );
      expect(result).toBeDefined();
    });

    it('includes tenantId in filter and $setOnInsert when provided', async () => {
      const model = makeModel(null);
      const service = new SettingsService(model as any, mockLogger, 'tenant-1');

      await service.get();

      expect(model.findOneAndUpdate).toHaveBeenCalledWith(
        { key: 'global', tenantId: 'tenant-1' },
        { $setOnInsert: expect.objectContaining({ key: 'global', tenantId: 'tenant-1' }) },
        { upsert: true, new: true },
      );
    });

    it('does not include tenantId in filter when not provided', async () => {
      const model = makeModel(null);
      const service = new SettingsService(model as any, mockLogger);

      await service.get();

      const [filter, update] = model.findOneAndUpdate.mock.calls[0];
      expect(filter).toEqual({ key: 'global' });
      expect(update.$setOnInsert).not.toHaveProperty('tenantId');
    });
  });

  describe('update()', () => {
    it('applies partial updates via findOneAndUpdate', async () => {
      const model = makeModel();
      const service = new SettingsService(model as any, mockLogger);

      await service.update({ defaultFollowUpDays: 5 });

      expect(model.findOneAndUpdate).toHaveBeenCalledWith(
        { key: 'global' },
        { $set: { defaultFollowUpDays: 5 } },
        { upsert: true, new: true },
      );
    });

    it('logs updated fields', async () => {
      const model = makeModel();
      const service = new SettingsService(model as any, mockLogger);

      await service.update({ defaultFollowUpDays: 5, maxConcurrentCalls: 20 });

      expect(mockLogger.info).toHaveBeenCalledWith('Call log settings updated', {
        fields: expect.arrayContaining(['defaultFollowUpDays', 'maxConcurrentCalls']),
      });
    });

    it('accepts valid defaultFollowUpDays (1-30)', async () => {
      const model = makeModel();
      const service = new SettingsService(model as any, mockLogger);

      await expect(service.update({ defaultFollowUpDays: 1 })).resolves.toBeDefined();
      await expect(service.update({ defaultFollowUpDays: 30 })).resolves.toBeDefined();
    });

    it('throws InvalidConfigError for defaultFollowUpDays < 1', async () => {
      const model = makeModel();
      const service = new SettingsService(model as any, mockLogger);

      await expect(service.update({ defaultFollowUpDays: 0 })).rejects.toThrow(InvalidConfigError);
    });

    it('throws InvalidConfigError for defaultFollowUpDays > 30', async () => {
      const model = makeModel();
      const service = new SettingsService(model as any, mockLogger);

      await expect(service.update({ defaultFollowUpDays: 31 })).rejects.toThrow(InvalidConfigError);
    });

    it('throws InvalidConfigError for non-integer defaultFollowUpDays', async () => {
      const model = makeModel();
      const service = new SettingsService(model as any, mockLogger);

      await expect(service.update({ defaultFollowUpDays: 2.5 })).rejects.toThrow(InvalidConfigError);
    });

    it('accepts valid timelinePageSize (5-100)', async () => {
      const model = makeModel();
      const service = new SettingsService(model as any, mockLogger);

      await expect(service.update({ timelinePageSize: 5 })).resolves.toBeDefined();
      await expect(service.update({ timelinePageSize: 100 })).resolves.toBeDefined();
    });

    it('throws InvalidConfigError for timelinePageSize < 5', async () => {
      const model = makeModel();
      const service = new SettingsService(model as any, mockLogger);

      await expect(service.update({ timelinePageSize: 4 })).rejects.toThrow(InvalidConfigError);
    });

    it('throws InvalidConfigError for timelinePageSize > 100', async () => {
      const model = makeModel();
      const service = new SettingsService(model as any, mockLogger);

      await expect(service.update({ timelinePageSize: 101 })).rejects.toThrow(InvalidConfigError);
    });

    it('accepts valid maxConcurrentCalls (1-50)', async () => {
      const model = makeModel();
      const service = new SettingsService(model as any, mockLogger);

      await expect(service.update({ maxConcurrentCalls: 1 })).resolves.toBeDefined();
      await expect(service.update({ maxConcurrentCalls: 50 })).resolves.toBeDefined();
    });

    it('throws InvalidConfigError for maxConcurrentCalls < 1', async () => {
      const model = makeModel();
      const service = new SettingsService(model as any, mockLogger);

      await expect(service.update({ maxConcurrentCalls: 0 })).rejects.toThrow(InvalidConfigError);
    });

    it('throws InvalidConfigError for maxConcurrentCalls > 50', async () => {
      const model = makeModel();
      const service = new SettingsService(model as any, mockLogger);

      await expect(service.update({ maxConcurrentCalls: 51 })).rejects.toThrow(InvalidConfigError);
    });

    it('does not validate fields that are not provided', async () => {
      const model = makeModel();
      const service = new SettingsService(model as any, mockLogger);

      // Only updating availableTags — no integer validations triggered
      await expect(service.update({ availableTags: ['tag1'] })).resolves.toBeDefined();
    });

    it('updates multiple fields at once', async () => {
      const model = makeModel();
      const service = new SettingsService(model as any, mockLogger);

      await service.update({
        defaultFollowUpDays: 7,
        timelinePageSize: 50,
        maxConcurrentCalls: 5,
      });

      expect(model.findOneAndUpdate).toHaveBeenCalledWith(
        { key: 'global' },
        { $set: { defaultFollowUpDays: 7, timelinePageSize: 50, maxConcurrentCalls: 5 } },
        { upsert: true, new: true },
      );
    });
  });
});
