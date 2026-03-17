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
  });
});
