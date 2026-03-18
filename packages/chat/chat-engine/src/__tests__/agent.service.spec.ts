import { describe, it, expect, vi, beforeEach } from 'vitest';
import { AgentService } from '../services/agent.service';
import { AgentStatus } from '@astralibx/chat-types';
import type { ChatAgentModel } from '../schemas/chat-agent.schema';
import { DEFAULT_OPTIONS } from '../types/config.types';
import type { LogAdapter } from '@astralibx/core';

function createMockLogger(): LogAdapter {
  return { info: vi.fn(), warn: vi.fn(), error: vi.fn() };
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

function createMockAgent(overrides: Record<string, unknown> = {}) {
  return {
    _id: { toString: () => 'agent-1' },
    name: 'Test Agent',
    avatar: undefined,
    role: 'support',
    isAI: false,
    isActive: true,
    isOnline: false,
    status: AgentStatus.Offline,
    activeChats: 0,
    maxConcurrentChats: 5,
    totalChatsHandled: 0,
    save: vi.fn().mockResolvedValue(undefined),
    ...overrides,
  };
}

describe('AgentService', () => {
  let service: AgentService;
  let model: ChatAgentModel;
  let logger: LogAdapter;

  beforeEach(() => {
    model = createMockAgentModel();
    logger = createMockLogger();
    service = new AgentService(model, DEFAULT_OPTIONS, logger);
  });

  describe('create()', () => {
    it('should create an agent with default maxConcurrentChats from options', async () => {
      const mockAgent = createMockAgent();
      (model.create as ReturnType<typeof vi.fn>).mockResolvedValue(mockAgent);

      const result = await service.create({ name: 'Test Agent' });

      expect(model.create).toHaveBeenCalledWith(
        expect.objectContaining({
          name: 'Test Agent',
          maxConcurrentChats: DEFAULT_OPTIONS.maxConcurrentChatsPerAgent,
        }),
      );
      expect(result).toBe(mockAgent);
      expect(logger.info).toHaveBeenCalledWith('Agent created', expect.any(Object));
    });

    it('should use provided maxConcurrentChats over default', async () => {
      const mockAgent = createMockAgent({ maxConcurrentChats: 10 });
      (model.create as ReturnType<typeof vi.fn>).mockResolvedValue(mockAgent);

      await service.create({ name: 'Agent', maxConcurrentChats: 10 });

      expect(model.create).toHaveBeenCalledWith(
        expect.objectContaining({ maxConcurrentChats: 10 }),
      );
    });
  });

  describe('findByIdOrFail()', () => {
    it('should return agent when found', async () => {
      const mockAgent = createMockAgent();
      (model.findById as ReturnType<typeof vi.fn>).mockResolvedValue(mockAgent);

      const result = await service.findByIdOrFail('agent-1');
      expect(result).toBe(mockAgent);
    });

    it('should throw AgentNotFoundError when not found', async () => {
      (model.findById as ReturnType<typeof vi.fn>).mockResolvedValue(null);

      await expect(service.findByIdOrFail('nonexistent')).rejects.toThrow('Agent not found');
    });
  });

  describe('update()', () => {
    it('should update agent fields and save', async () => {
      const mockAgent = createMockAgent();
      (model.findById as ReturnType<typeof vi.fn>).mockResolvedValue(mockAgent);

      const result = await service.update('agent-1', { name: 'Updated' });
      expect(result.name).toBe('Updated');
      expect(mockAgent.save).toHaveBeenCalled();
    });
  });

  describe('remove()', () => {
    it('should delete agent', async () => {
      (model.findByIdAndDelete as ReturnType<typeof vi.fn>).mockResolvedValue({});

      await service.remove('agent-1');
      expect(model.findByIdAndDelete).toHaveBeenCalledWith('agent-1');
    });
  });

  describe('connect() / disconnect()', () => {
    it('should set agent online on connect', async () => {
      const mockAgent = createMockAgent();
      (model.findById as ReturnType<typeof vi.fn>).mockResolvedValue(mockAgent);

      const result = await service.connect('agent-1');
      expect(result.isOnline).toBe(true);
      expect(result.status).toBe(AgentStatus.Available);
    });

    it('should set agent offline on disconnect', async () => {
      const mockAgent = createMockAgent({ isOnline: true, status: AgentStatus.Available });
      (model.findById as ReturnType<typeof vi.fn>).mockResolvedValue(mockAgent);

      const result = await service.disconnect('agent-1');
      expect(result.isOnline).toBe(false);
      expect(result.status).toBe(AgentStatus.Offline);
    });
  });

  describe('toggleActive()', () => {
    it('should toggle isActive and set offline when deactivating', async () => {
      const mockAgent = createMockAgent({ isActive: true, isOnline: true });
      (model.findById as ReturnType<typeof vi.fn>).mockResolvedValue(mockAgent);

      const result = await service.toggleActive('agent-1');
      expect(result.isActive).toBe(false);
      expect(result.isOnline).toBe(false);
      expect(result.status).toBe(AgentStatus.Offline);
    });

    it('should toggle isActive on when currently inactive', async () => {
      const mockAgent = createMockAgent({ isActive: false });
      (model.findById as ReturnType<typeof vi.fn>).mockResolvedValue(mockAgent);

      const result = await service.toggleActive('agent-1');
      expect(result.isActive).toBe(true);
    });
  });

  describe('hasCapacity()', () => {
    it('should return true when under max chats', async () => {
      const mockAgent = createMockAgent({ activeChats: 2, maxConcurrentChats: 5 });
      (model.findById as ReturnType<typeof vi.fn>).mockResolvedValue(mockAgent);

      const result = await service.hasCapacity('agent-1');
      expect(result).toBe(true);
    });

    it('should return false when at max chats', async () => {
      const mockAgent = createMockAgent({ activeChats: 5, maxConcurrentChats: 5 });
      (model.findById as ReturnType<typeof vi.fn>).mockResolvedValue(mockAgent);

      const result = await service.hasCapacity('agent-1');
      expect(result).toBe(false);
    });

    it('should return false when agent status is Busy', async () => {
      const mockAgent = createMockAgent({ status: AgentStatus.Busy, activeChats: 0, maxConcurrentChats: 5 });
      (model.findById as ReturnType<typeof vi.fn>).mockResolvedValue(mockAgent);

      const result = await service.hasCapacity('agent-1');
      expect(result).toBe(false);
    });

    it('should return false when agent status is Away', async () => {
      const mockAgent = createMockAgent({ status: AgentStatus.Away, activeChats: 0, maxConcurrentChats: 5 });
      (model.findById as ReturnType<typeof vi.fn>).mockResolvedValue(mockAgent);

      const result = await service.hasCapacity('agent-1');
      expect(result).toBe(false);
    });

    it('should return false when agent is inactive', async () => {
      const mockAgent = createMockAgent({ isActive: false, activeChats: 0, maxConcurrentChats: 5 });
      (model.findById as ReturnType<typeof vi.fn>).mockResolvedValue(mockAgent);

      const result = await service.hasCapacity('agent-1');
      expect(result).toBe(false);
    });
  });

  describe('incrementChats() / decrementChats()', () => {
    it('should increment activeChats and totalChatsHandled', async () => {
      await service.incrementChats('agent-1');
      expect(model.updateOne).toHaveBeenCalledWith(
        { _id: 'agent-1' },
        { $inc: { activeChats: 1, totalChatsHandled: 1 } },
      );
    });

    it('should decrement activeChats with guard', async () => {
      await service.decrementChats('agent-1');
      expect(model.updateOne).toHaveBeenCalledWith(
        { _id: 'agent-1', activeChats: { $gt: 0 } },
        { $inc: { activeChats: -1 } },
      );
    });
  });

  describe('toAgentInfo()', () => {
    it('should map agent document to AgentInfo', () => {
      const mockAgent = createMockAgent();
      const info = service.toAgentInfo(mockAgent as any);

      expect(info.agentId).toBe('agent-1');
      expect(info.name).toBe('Test Agent');
      expect(info.isAI).toBe(false);
    });

    it('should include visibility and isDefault in AgentInfo', () => {
      const mockAgent = createMockAgent({ visibility: 'public', isDefault: true });
      const info = service.toAgentInfo(mockAgent as any);

      expect(info.visibility).toBe('public');
      expect(info.isDefault).toBe(true);
    });
  });

  describe('create() with new fields', () => {
    it('should create agent with modeOverride, visibility, and isDefault', async () => {
      const mockAgent = createMockAgent({
        modeOverride: 'ai',
        visibility: 'public',
        isDefault: true,
      });
      (model.create as ReturnType<typeof vi.fn>).mockResolvedValue(mockAgent);

      const result = await service.create({
        name: 'AI Agent',
        isAI: true,
        modeOverride: 'ai',
        visibility: 'public',
        isDefault: true,
      });

      expect(model.create).toHaveBeenCalledWith(
        expect.objectContaining({
          name: 'AI Agent',
          modeOverride: 'ai',
          visibility: 'public',
          isDefault: true,
        }),
      );
      expect(result).toBe(mockAgent);
    });
  });

  describe('findDefaultAiAgent()', () => {
    it('should return default AI agent when one exists', async () => {
      const defaultAiAgent = createMockAgent({ isAI: true, isDefault: true, isActive: true });
      (model.findOne as ReturnType<typeof vi.fn>).mockResolvedValueOnce(defaultAiAgent);

      const result = await service.findDefaultAiAgent();
      expect(result).toBe(defaultAiAgent);
      expect(model.findOne).toHaveBeenCalledWith({ isAI: true, isDefault: true, isActive: true });
    });

    it('should fall back to first active AI agent when no default', async () => {
      const activeAiAgent = createMockAgent({ isAI: true, isActive: true });
      (model.findOne as ReturnType<typeof vi.fn>)
        .mockResolvedValueOnce(null)
        .mockResolvedValueOnce(activeAiAgent);

      const result = await service.findDefaultAiAgent();
      expect(result).toBe(activeAiAgent);
      expect(model.findOne).toHaveBeenCalledTimes(2);
      expect(model.findOne).toHaveBeenNthCalledWith(2, { isAI: true, isActive: true });
    });

    it('should return null when no AI agents exist', async () => {
      (model.findOne as ReturnType<typeof vi.fn>)
        .mockResolvedValueOnce(null)
        .mockResolvedValueOnce(null);

      const result = await service.findDefaultAiAgent();
      expect(result).toBeNull();
      expect(model.findOne).toHaveBeenCalledTimes(2);
    });
  });

  describe('listPublicAgents()', () => {
    it('should return only active public agents', async () => {
      const publicAgent = createMockAgent({ visibility: 'public', isActive: true });
      const mockFind = vi.fn().mockReturnValue({
        lean: vi.fn().mockResolvedValue([publicAgent]),
      });
      (model.find as ReturnType<typeof vi.fn>).mockImplementation(mockFind);

      const result = await service.listPublicAgents();
      expect(mockFind).toHaveBeenCalledWith({ isActive: true, visibility: 'public' });
      expect(result).toHaveLength(1);
      expect(result[0].agentId).toBe('agent-1');
      expect(result[0].name).toBe('Test Agent');
    });

    it('should return empty array when no public agents exist', async () => {
      const mockFind = vi.fn().mockReturnValue({
        lean: vi.fn().mockResolvedValue([]),
      });
      (model.find as ReturnType<typeof vi.fn>).mockImplementation(mockFind);

      const result = await service.listPublicAgents();
      expect(result).toHaveLength(0);
    });
  });

  describe('update() with new fields', () => {
    it('should update agent visibility', async () => {
      const mockAgent = createMockAgent({ visibility: 'internal' });
      (model.findById as ReturnType<typeof vi.fn>).mockResolvedValue(mockAgent);

      const result = await service.update('agent-1', { visibility: 'public' });
      expect(result.visibility).toBe('public');
      expect(mockAgent.save).toHaveBeenCalled();
    });
  });
});
