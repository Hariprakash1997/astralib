import { describe, it, expect, vi, beforeEach } from 'vitest';
import { SettingsService } from '../services/settings.service';
import { SessionService } from '../services/session.service';
import type { ChatSettingsModel } from '../schemas/chat-settings.schema';
import type { ChatSessionModel } from '../schemas/chat-session.schema';
import type { ChatMessageModel } from '../schemas/chat-message.schema';
import type { LogAdapter } from '@astralibx/core';
import { DEFAULT_OPTIONS } from '../types/config.types';
import { InvalidConfigError } from '../errors';
import { RATING_TYPE } from '../constants';

function createMockLogger(): LogAdapter {
  return { info: vi.fn(), warn: vi.fn(), error: vi.fn() };
}

function createMockSettingsModel() {
  return {
    findOne: vi.fn(),
    create: vi.fn(),
    findOneAndUpdate: vi.fn(),
  } as unknown as ChatSettingsModel;
}

function createMockSessionModel() {
  return {
    create: vi.fn(),
    findOne: vi.fn(),
    find: vi.fn().mockReturnValue({ sort: vi.fn().mockReturnThis(), skip: vi.fn().mockReturnThis(), limit: vi.fn().mockResolvedValue([]) }),
    countDocuments: vi.fn().mockResolvedValue(0),
    updateOne: vi.fn().mockResolvedValue({ modifiedCount: 1 }),
    distinct: vi.fn().mockResolvedValue([]),
  } as unknown as ChatSessionModel;
}

function createMockMessageModel() {
  return {
    find: vi.fn().mockReturnValue({
      sort: vi.fn().mockReturnValue({
        limit: vi.fn().mockReturnValue({
          sort: vi.fn().mockResolvedValue([]),
        }),
      }),
    }),
    countDocuments: vi.fn().mockResolvedValue(0),
  } as unknown as ChatMessageModel;
}

function createMockSettings(overrides: Record<string, unknown> = {}) {
  return {
    key: 'global',
    ratingConfig: {
      enabled: true,
      ratingType: RATING_TYPE.Thumbs,
      followUpOptions: {},
    },
    ...overrides,
  };
}

describe('Rating — SettingsService.updateRatingConfig()', () => {
  let settingsService: SettingsService;
  let settingsModel: ChatSettingsModel;
  let logger: LogAdapter;

  beforeEach(() => {
    settingsModel = createMockSettingsModel();
    logger = createMockLogger();
    settingsService = new SettingsService(settingsModel, logger);
  });

  it('should update rating type to stars', async () => {
    const updatedSettings = createMockSettings({
      ratingConfig: { enabled: true, ratingType: RATING_TYPE.Stars, followUpOptions: {} },
    });
    (settingsModel.findOneAndUpdate as ReturnType<typeof vi.fn>).mockResolvedValue(updatedSettings);

    const result = await settingsService.updateRatingConfig({ ratingType: RATING_TYPE.Stars });

    expect(settingsModel.findOneAndUpdate).toHaveBeenCalledWith(
      { key: 'global' },
      { $set: { 'ratingConfig.ratingType': RATING_TYPE.Stars } },
      { upsert: true, new: true },
    );
    expect(result.ratingType).toBe(RATING_TYPE.Stars);
  });

  it('should reject invalid rating type', async () => {
    await expect(
      settingsService.updateRatingConfig({ ratingType: 'invalid' as any }),
    ).rejects.toThrow(InvalidConfigError);
  });

  it('should update follow-up options', async () => {
    const followUpOptions = {
      positive: ['Great service', 'Quick response'],
      negative: ['Slow response', 'Not helpful'],
    };
    const updatedSettings = createMockSettings({
      ratingConfig: { enabled: true, ratingType: RATING_TYPE.Thumbs, followUpOptions },
    });
    (settingsModel.findOneAndUpdate as ReturnType<typeof vi.fn>).mockResolvedValue(updatedSettings);

    const result = await settingsService.updateRatingConfig({ followUpOptions });

    expect(result.followUpOptions).toEqual(followUpOptions);
  });

  it('should reject followUpOptions that is not an object', async () => {
    await expect(
      settingsService.updateRatingConfig({ followUpOptions: 'invalid' as any }),
    ).rejects.toThrow(InvalidConfigError);
  });

  it('should reject followUpOptions with non-string-array values', async () => {
    await expect(
      settingsService.updateRatingConfig({
        followUpOptions: { positive: [123 as any] },
      }),
    ).rejects.toThrow(InvalidConfigError);
  });

  it('should reject followUpOptions that is an array', async () => {
    await expect(
      settingsService.updateRatingConfig({ followUpOptions: ['a'] as any }),
    ).rejects.toThrow(InvalidConfigError);
  });

  it('should enable/disable rating', async () => {
    const updatedSettings = createMockSettings({
      ratingConfig: { enabled: false, ratingType: RATING_TYPE.Thumbs, followUpOptions: {} },
    });
    (settingsModel.findOneAndUpdate as ReturnType<typeof vi.fn>).mockResolvedValue(updatedSettings);

    const result = await settingsService.updateRatingConfig({ enabled: false });

    expect(settingsModel.findOneAndUpdate).toHaveBeenCalledWith(
      { key: 'global' },
      { $set: { 'ratingConfig.enabled': false } },
      { upsert: true, new: true },
    );
    expect(result.enabled).toBe(false);
  });
});

describe('Rating — SessionService.submitFeedback()', () => {
  let sessionService: SessionService;
  let sessionModel: ChatSessionModel;
  let messageModel: ChatMessageModel;
  let logger: LogAdapter;
  let hooks: any;

  beforeEach(() => {
    sessionModel = createMockSessionModel();
    messageModel = createMockMessageModel();
    logger = createMockLogger();
    hooks = { onFeedbackReceived: vi.fn() };
    sessionService = new SessionService(sessionModel, messageModel, DEFAULT_OPTIONS, logger, hooks);
  });

  it('should store two-step rating (thumbs + follow-up)', async () => {
    const feedback = {
      ratingType: RATING_TYPE.Thumbs,
      ratingValue: 1,
      followUpSelection: ['Great service'],
      comment: 'Very helpful!',
    };

    await sessionService.submitFeedback('sess-1', feedback);

    expect(sessionModel.updateOne).toHaveBeenCalledWith(
      { sessionId: 'sess-1' },
      {
        $set: {
          feedback: expect.objectContaining({
            ratingType: RATING_TYPE.Thumbs,
            ratingValue: 1,
            followUpSelection: ['Great service'],
            comment: 'Very helpful!',
            submittedAt: expect.any(Date),
          }),
        },
      },
    );
    expect(hooks.onFeedbackReceived).toHaveBeenCalledWith('sess-1', feedback);
  });

  it('should store star rating with follow-up options', async () => {
    const feedback = {
      ratingType: RATING_TYPE.Stars,
      ratingValue: 4,
      followUpSelection: ['Quick response'],
    };

    await sessionService.submitFeedback('sess-1', feedback);

    expect(sessionModel.updateOne).toHaveBeenCalledWith(
      { sessionId: 'sess-1' },
      {
        $set: {
          feedback: expect.objectContaining({
            ratingType: RATING_TYPE.Stars,
            ratingValue: 4,
            submittedAt: expect.any(Date),
          }),
        },
      },
    );
  });

  it('should call onFeedbackReceived hook', async () => {
    const feedback = { rating: 5 };

    await sessionService.submitFeedback('sess-1', feedback);

    expect(hooks.onFeedbackReceived).toHaveBeenCalledWith('sess-1', feedback);
    expect(logger.info).toHaveBeenCalledWith('Feedback received', { sessionId: 'sess-1' });
  });
});

describe('Rating — SettingsService.getRatingConfig()', () => {
  let settingsService: SettingsService;
  let settingsModel: ChatSettingsModel;
  let logger: LogAdapter;

  beforeEach(() => {
    settingsModel = createMockSettingsModel();
    logger = createMockLogger();
    settingsService = new SettingsService(settingsModel, logger);
  });

  it('should return rating config from settings', async () => {
    const settings = createMockSettings();
    (settingsModel.findOne as ReturnType<typeof vi.fn>).mockResolvedValue(settings);

    const result = await settingsService.getRatingConfig();

    expect(result.enabled).toBe(true);
    expect(result.ratingType).toBe(RATING_TYPE.Thumbs);
    expect(result.followUpOptions).toEqual({});
  });
});
