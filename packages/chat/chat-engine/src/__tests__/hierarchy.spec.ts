import { describe, it, expect, vi, beforeEach } from 'vitest';
import { AgentService, type SetHierarchyInput } from '../services/agent.service';
import { AgentStatus } from '@astralibx/chat-types';
import type { ChatAgentModel } from '../schemas/chat-agent.schema';
import { DEFAULT_OPTIONS } from '../types/config.types';
import type { LogAdapter } from '@astralibx/core';
import { AgentNotFoundError, InvalidHierarchyError } from '../errors';
import { AGENT_LEVEL } from '../constants';

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
    aggregate: vi.fn().mockResolvedValue([]),
    collection: { name: 'chat_agents' },
  } as unknown as ChatAgentModel;
}

function createMockAgent(overrides: Record<string, unknown> = {}) {
  return {
    _id: { toString: () => 'agent-1' },
    name: 'Test Agent',
    role: 'support',
    isAI: false,
    isActive: true,
    isOnline: false,
    status: AgentStatus.Offline,
    activeChats: 0,
    maxConcurrentChats: 5,
    totalChatsHandled: 0,
    level: AGENT_LEVEL.L1,
    parentId: null,
    teamId: null,
    save: vi.fn().mockResolvedValue(undefined),
    ...overrides,
  };
}

describe('AgentService — Hierarchy', () => {
  let service: AgentService;
  let model: ChatAgentModel;
  let logger: LogAdapter;

  beforeEach(() => {
    model = createMockAgentModel();
    logger = createMockLogger();
    service = new AgentService(model, DEFAULT_OPTIONS, logger);
  });

  // ── getTeamTree ─────────────────────────────────────────────────────

  describe('getTeamTree()', () => {
    it('should return subordinates from $graphLookup', async () => {
      const manager = createMockAgent({ _id: { toString: () => 'mgr-1' }, level: AGENT_LEVEL.L3 });
      (model.findById as ReturnType<typeof vi.fn>).mockResolvedValue(manager);

      const subordinates = [
        { name: 'L2 Agent', depth: 0 },
        { name: 'L1 Agent', depth: 1 },
      ];
      (model.aggregate as ReturnType<typeof vi.fn>).mockResolvedValue([{ subordinates }]);

      const result = await service.getTeamTree('mgr-1');

      expect(model.aggregate).toHaveBeenCalledWith(
        expect.arrayContaining([
          expect.objectContaining({ $match: { _id: manager._id } }),
          expect.objectContaining({ $graphLookup: expect.any(Object) }),
        ]),
      );
      expect(result).toEqual(subordinates);
    });

    it('should return empty array when manager has no subordinates', async () => {
      const manager = createMockAgent({ _id: { toString: () => 'mgr-1' }, level: AGENT_LEVEL.L3 });
      (model.findById as ReturnType<typeof vi.fn>).mockResolvedValue(manager);
      (model.aggregate as ReturnType<typeof vi.fn>).mockResolvedValue([{ subordinates: [] }]);

      const result = await service.getTeamTree('mgr-1');
      expect(result).toEqual([]);
    });

    it('should throw AgentNotFoundError when manager does not exist', async () => {
      (model.findById as ReturnType<typeof vi.fn>).mockResolvedValue(null);

      await expect(service.getTeamTree('nonexistent')).rejects.toThrow(AgentNotFoundError);
    });
  });

  // ── getDirectReports ────────────────────────────────────────────────

  describe('getDirectReports()', () => {
    it('should query agents with parentId equal to agentId', async () => {
      const manager = createMockAgent({ _id: { toString: () => 'mgr-1' } });
      (model.findById as ReturnType<typeof vi.fn>).mockResolvedValue(manager);

      const reports = [createMockAgent({ name: 'Report 1' }), createMockAgent({ name: 'Report 2' })];
      (model.find as ReturnType<typeof vi.fn>).mockReturnValue({ sort: vi.fn().mockResolvedValue(reports) });

      const result = await service.getDirectReports('mgr-1');

      expect(model.find).toHaveBeenCalledWith({ parentId: 'mgr-1' });
      expect(result).toEqual(reports);
    });

    it('should throw AgentNotFoundError when agent does not exist', async () => {
      (model.findById as ReturnType<typeof vi.fn>).mockResolvedValue(null);

      await expect(service.getDirectReports('nonexistent')).rejects.toThrow(AgentNotFoundError);
    });
  });

  // ── getSupervisor ───────────────────────────────────────────────────

  describe('getSupervisor()', () => {
    it('should return the parent agent when parentId is set', async () => {
      const parentAgent = createMockAgent({ _id: { toString: () => 'mgr-1' }, level: AGENT_LEVEL.L2 });
      const agent = createMockAgent({ parentId: 'mgr-1', level: AGENT_LEVEL.L1 });

      (model.findById as ReturnType<typeof vi.fn>)
        .mockResolvedValueOnce(agent)     // findByIdOrFail
        .mockResolvedValueOnce(parentAgent); // findById(parentId)

      const result = await service.getSupervisor('agent-1');
      expect(result).toBe(parentAgent);
    });

    it('should return null when agent has no parentId', async () => {
      const agent = createMockAgent({ parentId: null });
      (model.findById as ReturnType<typeof vi.fn>).mockResolvedValue(agent);

      const result = await service.getSupervisor('agent-1');
      expect(result).toBeNull();
    });

    it('should throw AgentNotFoundError when agent does not exist', async () => {
      (model.findById as ReturnType<typeof vi.fn>).mockResolvedValue(null);

      await expect(service.getSupervisor('nonexistent')).rejects.toThrow(AgentNotFoundError);
    });
  });

  // ── getTeamMembers ──────────────────────────────────────────────────

  describe('getTeamMembers()', () => {
    it('should query agents by teamId sorted by level desc, name asc', async () => {
      const members = [
        createMockAgent({ name: 'Agent A', level: AGENT_LEVEL.L2 }),
        createMockAgent({ name: 'Agent B', level: AGENT_LEVEL.L1 }),
      ];
      (model.find as ReturnType<typeof vi.fn>).mockReturnValue({
        sort: vi.fn().mockResolvedValue(members),
      });

      const result = await service.getTeamMembers('team-alpha');

      expect(model.find).toHaveBeenCalledWith({ teamId: 'team-alpha' });
      expect(result).toEqual(members);
    });
  });

  // ── getAgentsByLevel ────────────────────────────────────────────────

  describe('getAgentsByLevel()', () => {
    it('should query agents by level sorted by name', async () => {
      const agents = [createMockAgent({ name: 'Agent A', level: AGENT_LEVEL.L2 })];
      (model.find as ReturnType<typeof vi.fn>).mockReturnValue({
        sort: vi.fn().mockResolvedValue(agents),
      });

      const result = await service.getAgentsByLevel(AGENT_LEVEL.L2);

      expect(model.find).toHaveBeenCalledWith({ level: AGENT_LEVEL.L2 });
      expect(result).toEqual(agents);
    });
  });

  // ── setHierarchy ────────────────────────────────────────────────────

  describe('setHierarchy()', () => {
    it('should update level, parentId, and teamId', async () => {
      const parentAgent = createMockAgent({
        _id: { toString: () => 'mgr-1' },
        level: AGENT_LEVEL.L3,
      });
      const agent = createMockAgent({ level: AGENT_LEVEL.L1 });

      (model.findById as ReturnType<typeof vi.fn>)
        .mockResolvedValueOnce(agent)       // findByIdOrFail(agentId)
        .mockResolvedValueOnce(parentAgent); // findByIdOrFail(parentId)

      const input: SetHierarchyInput = {
        level: AGENT_LEVEL.L2,
        parentId: 'mgr-1',
        teamId: 'team-alpha',
      };

      const result = await service.setHierarchy('agent-1', input);

      expect(result.level).toBe(AGENT_LEVEL.L2);
      expect(result.parentId).toBe(parentAgent._id);
      expect(result.teamId).toBe('team-alpha');
      expect(agent.save).toHaveBeenCalled();
      expect(logger.info).toHaveBeenCalledWith('Agent hierarchy updated', expect.objectContaining({ agentId: 'agent-1' }));
    });

    it('should reject self-reference as parent', async () => {
      const agent = createMockAgent({ _id: { toString: () => 'agent-1' } });
      (model.findById as ReturnType<typeof vi.fn>).mockResolvedValue(agent);

      await expect(
        service.setHierarchy('agent-1', { parentId: 'agent-1' }),
      ).rejects.toThrow(InvalidHierarchyError);
    });

    it('should reject parent at lower or equal level', async () => {
      const agent = createMockAgent({ level: AGENT_LEVEL.L2 });
      const parent = createMockAgent({
        _id: { toString: () => 'parent-1' },
        level: AGENT_LEVEL.L1, // lower than agent
      });

      (model.findById as ReturnType<typeof vi.fn>)
        .mockResolvedValueOnce(agent)
        .mockResolvedValueOnce(parent);

      await expect(
        service.setHierarchy('agent-1', { parentId: 'parent-1' }),
      ).rejects.toThrow(InvalidHierarchyError);
    });

    it('should reject parent at equal level', async () => {
      const agent = createMockAgent({ level: AGENT_LEVEL.L2 });
      const parent = createMockAgent({
        _id: { toString: () => 'parent-1' },
        level: AGENT_LEVEL.L2,
      });

      (model.findById as ReturnType<typeof vi.fn>)
        .mockResolvedValueOnce(agent)
        .mockResolvedValueOnce(parent);

      await expect(
        service.setHierarchy('agent-1', { parentId: 'parent-1' }),
      ).rejects.toThrow(InvalidHierarchyError);
    });

    it('should reject non-integer level', async () => {
      const agent = createMockAgent();
      (model.findById as ReturnType<typeof vi.fn>).mockResolvedValue(agent);

      await expect(
        service.setHierarchy('agent-1', { level: 1.5 }),
      ).rejects.toThrow(InvalidHierarchyError);
    });

    it('should reject level below 1', async () => {
      const agent = createMockAgent();
      (model.findById as ReturnType<typeof vi.fn>).mockResolvedValue(agent);

      await expect(
        service.setHierarchy('agent-1', { level: 0 }),
      ).rejects.toThrow(InvalidHierarchyError);
    });

    it('should allow clearing parentId by setting to null', async () => {
      const agent = createMockAgent({ parentId: 'old-parent' });
      (model.findById as ReturnType<typeof vi.fn>).mockResolvedValue(agent);

      const result = await service.setHierarchy('agent-1', { parentId: null });
      expect(result.parentId).toBeNull();
      expect(agent.save).toHaveBeenCalled();
    });

    it('should throw AgentNotFoundError when agent does not exist', async () => {
      (model.findById as ReturnType<typeof vi.fn>).mockResolvedValue(null);

      await expect(
        service.setHierarchy('nonexistent', { level: 2 }),
      ).rejects.toThrow(AgentNotFoundError);
    });
  });

  // ── isManager ───────────────────────────────────────────────────────

  describe('isManager()', () => {
    it('should return true when agent has no parentId', async () => {
      const agent = createMockAgent({ parentId: null });
      (model.findById as ReturnType<typeof vi.fn>).mockResolvedValue(agent);

      const result = await service.isManager('agent-1');
      expect(result).toBe(true);
    });

    it('should return false when agent has a parentId', async () => {
      const agent = createMockAgent({ parentId: 'mgr-1' });
      (model.findById as ReturnType<typeof vi.fn>).mockResolvedValue(agent);

      const result = await service.isManager('agent-1');
      expect(result).toBe(false);
    });
  });

  // ── findLeastBusySupervisor ─────────────────────────────────────────

  describe('findLeastBusySupervisor()', () => {
    it('should return candidate with capacity at the next level', async () => {
      const agent = createMockAgent({
        level: AGENT_LEVEL.L1,
        teamId: 'team-1',
        parentId: 'mgr-1',
      });
      const supervisor = createMockAgent({
        _id: { toString: () => 'mgr-1' },
        level: AGENT_LEVEL.L2,
        activeChats: 1,
        maxConcurrentChats: 5,
      });

      (model.find as ReturnType<typeof vi.fn>).mockReturnValue({
        sort: vi.fn().mockResolvedValue([supervisor]),
      });

      const result = await service.findLeastBusySupervisor(agent as any);
      expect(result).toBe(supervisor);
    });

    it('should return null when no candidate has capacity', async () => {
      const agent = createMockAgent({
        level: AGENT_LEVEL.L1,
        teamId: 'team-1',
        parentId: 'mgr-1',
      });
      const busySupervisor = createMockAgent({
        level: AGENT_LEVEL.L2,
        activeChats: 5,
        maxConcurrentChats: 5,
      });

      (model.find as ReturnType<typeof vi.fn>).mockReturnValue({
        sort: vi.fn().mockResolvedValue([busySupervisor]),
      });

      const result = await service.findLeastBusySupervisor(agent as any);
      expect(result).toBeNull();
    });

    it('should return null when no candidates exist', async () => {
      const agent = createMockAgent({ level: AGENT_LEVEL.L1 });

      (model.find as ReturnType<typeof vi.fn>).mockReturnValue({
        sort: vi.fn().mockResolvedValue([]),
      });

      const result = await service.findLeastBusySupervisor(agent as any);
      expect(result).toBeNull();
    });
  });
});
