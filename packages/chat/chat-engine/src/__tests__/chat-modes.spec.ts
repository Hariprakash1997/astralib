import { describe, it, expect, vi, beforeEach } from 'vitest';
import { SettingsService } from '../services/settings.service';
import { AgentService } from '../services/agent.service';
import { AgentStatus } from '@astralibx/chat-types';
import type { ChatSettingsModel } from '../schemas/chat-settings.schema';
import type { ChatAgentModel } from '../schemas/chat-agent.schema';
import { DEFAULT_OPTIONS } from '../types/config.types';
import type { LogAdapter } from '@astralibx/core';
import { InvalidConfigError } from '../errors';
import { CHAT_MODE, CHAT_MODE_VALUES, ERROR_CODE, ERROR_MESSAGE, AI_MODE } from '../constants';

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

function createMockAgentModel() {
  return {
    create: vi.fn(),
    findById: vi.fn(),
    findByIdAndDelete: vi.fn(),
    findOne: vi.fn(),
    find: vi.fn().mockReturnValue({ sort: vi.fn().mockResolvedValue([]) }),
    updateOne: vi.fn().mockResolvedValue({ modifiedCount: 1 }),
    countDocuments: vi.fn().mockResolvedValue(0),
  } as unknown as ChatAgentModel;
}

function createMockSettings(overrides: Record<string, unknown> = {}) {
  return {
    key: 'global',
    chatMode: CHAT_MODE.Switchable,
    aiMode: AI_MODE.AgentWise,
    aiCharacter: { globalCharacter: null },
    showAiTag: true,
    availableTags: [],
    availableUserCategories: [],
    businessHours: { enabled: false },
    ratingConfig: { enabled: false, ratingType: 'thumbs', followUpOptions: {} },
    ...overrides,
  };
}

describe('Chat Modes — SettingsService', () => {
  let settingsService: SettingsService;
  let settingsModel: ChatSettingsModel;
  let logger: LogAdapter;

  beforeEach(() => {
    settingsModel = createMockSettingsModel();
    logger = createMockLogger();
    settingsService = new SettingsService(settingsModel, logger);
  });

  describe('chatMode setting', () => {
    it('should accept switchable mode', async () => {
      const updated = createMockSettings({ chatMode: CHAT_MODE.Switchable });
      (settingsModel.findOneAndUpdate as ReturnType<typeof vi.fn>).mockResolvedValue(updated);

      const result = await settingsService.update({ chatMode: CHAT_MODE.Switchable });
      expect(result.chatMode).toBe(CHAT_MODE.Switchable);
    });

    it('should accept fixed mode', async () => {
      const updated = createMockSettings({ chatMode: CHAT_MODE.Fixed });
      (settingsModel.findOneAndUpdate as ReturnType<typeof vi.fn>).mockResolvedValue(updated);

      const result = await settingsService.update({ chatMode: CHAT_MODE.Fixed });
      expect(result.chatMode).toBe(CHAT_MODE.Fixed);
    });

    it('should reject invalid chat mode', async () => {
      await expect(
        settingsService.update({ chatMode: 'invalid' as any }),
      ).rejects.toThrow(InvalidConfigError);
    });
  });

  describe('AI mode prerequisites', () => {
    it('should reject aiMode=ai without AI adapter', async () => {
      await expect(
        settingsService.updateAiSettings(
          { aiMode: AI_MODE.AI },
          { hasAiAdapter: false },
        ),
      ).rejects.toThrow(InvalidConfigError);
    });

    it('should reject aiMode=agent-wise without AI adapter', async () => {
      await expect(
        settingsService.updateAiSettings(
          { aiMode: AI_MODE.AgentWise },
          { hasAiAdapter: false },
        ),
      ).rejects.toThrow(InvalidConfigError);
    });

    it('should reject aiMode=ai without globalCharacter configured', async () => {
      const settings = createMockSettings({ aiCharacter: { globalCharacter: null } });
      (settingsModel.findOne as ReturnType<typeof vi.fn>).mockResolvedValue(settings);

      await expect(
        settingsService.updateAiSettings(
          { aiMode: AI_MODE.AI },
          { hasAiAdapter: true },
        ),
      ).rejects.toThrow(InvalidConfigError);
    });

    it('should accept aiMode=ai when globalCharacter is provided inline', async () => {
      const globalCharacter = {
        name: 'Aria',
        tone: 'friendly',
        personality: 'helpful',
        responseStyle: 'conversational',
        rules: [],
      };
      // get() is called internally to check existing globalCharacter
      const existingSettings = createMockSettings();
      (settingsModel.findOne as ReturnType<typeof vi.fn>).mockResolvedValue(existingSettings);

      const updated = createMockSettings({
        aiMode: AI_MODE.AI,
        aiCharacter: { globalCharacter },
        showAiTag: true,
      });
      (settingsModel.findOneAndUpdate as ReturnType<typeof vi.fn>).mockResolvedValue(updated);

      const result = await settingsService.updateAiSettings(
        { aiMode: AI_MODE.AI, aiCharacter: { globalCharacter } },
        { hasAiAdapter: true },
      );
      expect(result.aiMode).toBe(AI_MODE.AI);
    });

    it('should accept aiMode=manual without AI adapter', async () => {
      const updated = createMockSettings({ aiMode: AI_MODE.Manual });
      (settingsModel.findOneAndUpdate as ReturnType<typeof vi.fn>).mockResolvedValue(updated);

      const result = await settingsService.updateAiSettings({ aiMode: AI_MODE.Manual });
      expect(result.aiMode).toBe(AI_MODE.Manual);
    });

    it('should reject invalid aiMode value', async () => {
      await expect(
        settingsService.updateAiSettings({ aiMode: 'bogus' as any }),
      ).rejects.toThrow(InvalidConfigError);
    });
  });

  describe('AI character validation', () => {
    it('should reject globalCharacter without name', async () => {
      await expect(
        settingsService.updateAiSettings({
          aiCharacter: {
            globalCharacter: {
              name: '',
              tone: 'friendly',
              personality: 'helpful',
              responseStyle: 'conversational',
            } as any,
          },
        }),
      ).rejects.toThrow(InvalidConfigError);
    });

    it('should reject globalCharacter without tone', async () => {
      await expect(
        settingsService.updateAiSettings({
          aiCharacter: {
            globalCharacter: {
              name: 'Aria',
              tone: '',
              personality: 'helpful',
              responseStyle: 'conversational',
            } as any,
          },
        }),
      ).rejects.toThrow(InvalidConfigError);
    });

    it('should reject globalCharacter with non-string-array rules', async () => {
      await expect(
        settingsService.updateAiSettings({
          aiCharacter: {
            globalCharacter: {
              name: 'Aria',
              tone: 'friendly',
              personality: 'helpful',
              responseStyle: 'conversational',
              rules: [123 as any],
            } as any,
          },
        }),
      ).rejects.toThrow(InvalidConfigError);
    });
  });
});

describe('Chat Modes — Constants', () => {
  it('should have FixedModeSwitch error code', () => {
    expect(ERROR_CODE.FixedModeSwitch).toBe('FIXED_MODE_SWITCH');
  });

  it('should have ManagerNotAllowed error code', () => {
    expect(ERROR_CODE.ManagerNotAllowed).toBe('MANAGER_NOT_ALLOWED');
  });

  it('should have FixedModeSwitch error message', () => {
    expect(ERROR_MESSAGE.FixedModeSwitch).toBeDefined();
    expect(typeof ERROR_MESSAGE.FixedModeSwitch).toBe('string');
  });

  it('should have ManagerMessageNotAllowed and ManagerWatchOnly messages', () => {
    expect(ERROR_MESSAGE.ManagerMessageNotAllowed).toBeDefined();
    expect(ERROR_MESSAGE.ManagerWatchOnly).toBeDefined();
  });

  it('should have exactly two chat mode values', () => {
    expect(CHAT_MODE_VALUES).toContain(CHAT_MODE.Switchable);
    expect(CHAT_MODE_VALUES).toContain(CHAT_MODE.Fixed);
    expect(CHAT_MODE_VALUES).toHaveLength(2);
  });
});

describe('Chat Modes — AgentService.isManager()', () => {
  let agentService: AgentService;
  let agentModel: ChatAgentModel;
  let logger: LogAdapter;

  beforeEach(() => {
    agentModel = createMockAgentModel();
    logger = createMockLogger();
    agentService = new AgentService(agentModel, DEFAULT_OPTIONS, logger);
  });

  it('should identify a top-level agent (no parentId) as manager', async () => {
    const agent = {
      _id: { toString: () => 'mgr-1' },
      parentId: null,
      save: vi.fn(),
    };
    (agentModel.findById as ReturnType<typeof vi.fn>).mockResolvedValue(agent);

    const result = await agentService.isManager('mgr-1');
    expect(result).toBe(true);
  });

  it('should not identify an agent with parentId as manager', async () => {
    const agent = {
      _id: { toString: () => 'agent-1' },
      parentId: 'mgr-1',
      save: vi.fn(),
    };
    (agentModel.findById as ReturnType<typeof vi.fn>).mockResolvedValue(agent);

    const result = await agentService.isManager('agent-1');
    expect(result).toBe(false);
  });
});
