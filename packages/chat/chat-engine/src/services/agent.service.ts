import type { LogAdapter } from '@astralibx/core';
import type { ChatAgentInfo } from '@astralibx/chat-types';
import { AgentStatus } from '@astralibx/chat-types';
import type { ChatAgentModel, ChatAgentDocument } from '../schemas/chat-agent.schema.js';
import type { ResolvedOptions } from '../types/config.types.js';
import type { CreateAgentInput, UpdateAgentInput } from '../types/service.types.js';
import { AgentNotFoundError, InvalidHierarchyError } from '../errors/index.js';
import { AGENT_VISIBILITY } from '../constants/index.js';
import { filterUpdateableFields, withTenantFilter, withTenantId } from '../utils/helpers.js';

export interface SetHierarchyInput {
  parentId?: string | null;
  level?: number;
  teamId?: string | null;
}

export interface TeamTreeNode extends Record<string, unknown> {
  _id: unknown;
  name: string;
  depth: number;
}

const AGENT_UPDATEABLE_FIELDS = new Set([
  'name', 'avatar', 'role', 'isAI', 'aiConfig', 'promptTemplateId',
  'maxConcurrentChats', 'modeOverride', 'aiEnabled', 'autoAccept',
  'aiCharacter', 'visibility', 'isDefault', 'metadata',
  'level', 'parentId', 'teamId',
]);

export class AgentService {
  constructor(
    private ChatAgent: ChatAgentModel,
    private options: ResolvedOptions,
    private logger: LogAdapter,
    private tenantId?: string,
  ) {}

  async create(data: CreateAgentInput): Promise<ChatAgentDocument> {
    const agent = await this.ChatAgent.create(withTenantId({
      ...data,
      maxConcurrentChats: data.maxConcurrentChats ?? this.options.maxConcurrentChatsPerAgent,
    }, this.tenantId));
    this.logger.info('Agent created', { agentId: agent._id.toString(), name: data.name });
    return agent;
  }

  async findById(agentId: string): Promise<ChatAgentDocument | null> {
    return this.ChatAgent.findById(agentId);
  }

  async findByIdOrFail(agentId: string): Promise<ChatAgentDocument> {
    const agent = await this.findById(agentId);
    if (!agent) throw new AgentNotFoundError(agentId);
    return agent;
  }

  async update(agentId: string, data: UpdateAgentInput): Promise<ChatAgentDocument> {
    const agent = await this.findByIdOrFail(agentId);
    const safeFields = filterUpdateableFields(data as Record<string, unknown>, AGENT_UPDATEABLE_FIELDS);
    Object.assign(agent, safeFields);
    await agent.save();
    this.logger.info('Agent updated', { agentId });
    return agent;
  }

  async remove(agentId: string): Promise<void> {
    await this.ChatAgent.findByIdAndDelete(agentId);
    this.logger.info('Agent removed', { agentId });
  }

  async list(): Promise<ChatAgentDocument[]> {
    return this.ChatAgent.find(withTenantFilter({} as Record<string, unknown>, this.tenantId)).sort({ name: 1 });
  }

  async connect(agentId: string): Promise<ChatAgentDocument> {
    const agent = await this.findByIdOrFail(agentId);
    agent.isOnline = true;
    agent.status = AgentStatus.Available;
    await agent.save();
    this.logger.info('Agent connected', { agentId });
    return agent;
  }

  async disconnect(agentId: string): Promise<ChatAgentDocument> {
    const agent = await this.findByIdOrFail(agentId);
    agent.isOnline = false;
    agent.status = AgentStatus.Offline;
    await agent.save();
    this.logger.info('Agent disconnected', { agentId });
    return agent;
  }

  async updateStatus(agentId: string, status: AgentStatus): Promise<ChatAgentDocument> {
    const agent = await this.findByIdOrFail(agentId);
    agent.status = status;
    agent.isOnline = status !== AgentStatus.Offline;
    await agent.save();
    return agent;
  }

  async toggleActive(agentId: string): Promise<ChatAgentDocument> {
    const agent = await this.findByIdOrFail(agentId);
    agent.isActive = !agent.isActive;
    if (!agent.isActive) {
      agent.isOnline = false;
      agent.status = AgentStatus.Offline;
    }
    await agent.save();
    this.logger.info('Agent active toggled', { agentId, isActive: agent.isActive });
    return agent;
  }

  async hasCapacity(agentId: string): Promise<boolean> {
    const agent = await this.findByIdOrFail(agentId);
    if (!agent.isActive) return false;
    if (agent.status === AgentStatus.Busy || agent.status === AgentStatus.Away) return false;
    return agent.activeChats < agent.maxConcurrentChats;
  }

  async incrementChats(agentId: string): Promise<void> {
    await this.ChatAgent.updateOne(
      { _id: agentId },
      {
        $inc: { activeChats: 1, totalChatsHandled: 1 },
      },
    );
  }

  async decrementChats(agentId: string): Promise<void> {
    await this.ChatAgent.updateOne(
      { _id: agentId, activeChats: { $gt: 0 } },
      {
        $inc: { activeChats: -1 },
      },
    );
  }

  async getOnlineAgents(): Promise<ChatAgentDocument[]> {
    return this.ChatAgent.find(withTenantFilter({ isOnline: true, isActive: true } as Record<string, unknown>, this.tenantId));
  }

  async getOnlineAgentCount(): Promise<number> {
    return this.ChatAgent.countDocuments(withTenantFilter({ isOnline: true, isActive: true } as Record<string, unknown>, this.tenantId));
  }

  async getTotalAgentCount(): Promise<number> {
    return this.ChatAgent.countDocuments(withTenantFilter({ isActive: true } as Record<string, unknown>, this.tenantId));
  }

  async findDefaultAiAgent(): Promise<ChatAgentDocument | null> {
    // Step 1: isAI + isDefault + isActive
    let agent = await this.ChatAgent.findOne(withTenantFilter({ isAI: true, isDefault: true, isActive: true } as Record<string, unknown>, this.tenantId));
    if (agent) return agent;

    // Step 2: first active AI agent
    agent = await this.ChatAgent.findOne(withTenantFilter({ isAI: true, isActive: true } as Record<string, unknown>, this.tenantId));
    if (agent) return agent;

    // Step 3: null (caller uses global settings)
    return null;
  }

  async listPublicAgents(): Promise<ChatAgentInfo[]> {
    const agents = await this.ChatAgent.find(withTenantFilter({
      isActive: true,
      visibility: AGENT_VISIBILITY.Public,
    } as Record<string, unknown>, this.tenantId)).lean();
    return agents.map((a) => this.toAgentInfo(a as unknown as ChatAgentDocument));
  }

  toAgentInfo(agent: ChatAgentDocument): ChatAgentInfo {
    return {
      agentId: agent._id.toString(),
      name: agent.name,
      avatar: agent.avatar,
      role: agent.role,
      status: agent.status,
      isAI: agent.isAI,
      visibility: agent.visibility,
      isDefault: agent.isDefault,
    };
  }

  // ── Hierarchy ──────────────────────────────────────────────────────

  /**
   * Get the full team tree below a manager using $graphLookup.
   * Returns the manager document with a `subordinates` array containing
   * all descendants (recursively) down to L1.
   */
  async getTeamTree(managerId: string): Promise<TeamTreeNode[]> {
    const manager = await this.findByIdOrFail(managerId);

    const results = await this.ChatAgent.aggregate([
      { $match: { _id: manager._id } },
      {
        $graphLookup: {
          from: this.ChatAgent.collection.name,
          startWith: '$_id',
          connectFromField: '_id',
          connectToField: 'parentId',
          as: 'subordinates',
          depthField: 'depth',
        },
      },
    ]);

    return results[0]?.subordinates ?? [];
  }

  /** Get all agents whose parentId equals this agent (one level down). */
  async getDirectReports(agentId: string): Promise<ChatAgentDocument[]> {
    await this.findByIdOrFail(agentId);
    return this.ChatAgent.find({ parentId: agentId }).sort({ name: 1 });
  }

  /** Get the supervisor (parent) of a given agent. */
  async getSupervisor(agentId: string): Promise<ChatAgentDocument | null> {
    const agent = await this.findByIdOrFail(agentId);
    if (!agent.parentId) return null;
    return this.ChatAgent.findById(agent.parentId);
  }

  /** Get all agents in a team. */
  async getTeamMembers(teamId: string): Promise<ChatAgentDocument[]> {
    return this.ChatAgent.find({ teamId }).sort({ level: -1, name: 1 });
  }

  /** Get all agents at a specific level. */
  async getAgentsByLevel(level: number): Promise<ChatAgentDocument[]> {
    return this.ChatAgent.find({ level }).sort({ name: 1 });
  }

  /**
   * Find the least busy online agent at the next level up that shares the
   * same team or is the direct supervisor of the given agent.
   * Returns null when no eligible agent is available.
   */
  async findLeastBusySupervisor(agent: ChatAgentDocument): Promise<ChatAgentDocument | null> {
    const nextLevel = agent.level + 1;

    // Build filter: next level, online, active, with remaining capacity
    const candidates = await this.ChatAgent.find({
      level: nextLevel,
      isOnline: true,
      isActive: true,
      $or: [
        // Same team
        ...(agent.teamId ? [{ teamId: agent.teamId }] : []),
        // Direct supervisor
        ...(agent.parentId ? [{ _id: agent.parentId }] : []),
      ],
    }).sort({ activeChats: 1 }); // least busy first

    // Return the first candidate that still has capacity
    for (const candidate of candidates) {
      if (candidate.activeChats < candidate.maxConcurrentChats) {
        return candidate;
      }
    }

    return null;
  }

  /**
   * A manager is an agent with no parentId (top of the hierarchy).
   * Managers can view all chats but can only send messages to sessions
   * explicitly assigned/escalated to them.
   */
  async isManager(agentId: string): Promise<boolean> {
    const agent = await this.findByIdOrFail(agentId);
    return agent.parentId == null;
  }

  /** Update an agent's position in the hierarchy. */
  async setHierarchy(agentId: string, input: SetHierarchyInput): Promise<ChatAgentDocument> {
    const agent = await this.findByIdOrFail(agentId);

    if (input.level !== undefined) {
      if (!Number.isInteger(input.level) || input.level < 1) {
        throw new InvalidHierarchyError('level must be a positive integer');
      }
      agent.level = input.level;
    }

    if (input.parentId !== undefined) {
      if (input.parentId === null) {
        agent.parentId = null;
      } else {
        if (input.parentId === agentId) {
          throw new InvalidHierarchyError('an agent cannot be its own parent');
        }
        const parent = await this.findByIdOrFail(input.parentId);
        const targetLevel = input.level ?? agent.level;
        if (parent.level <= targetLevel) {
          throw new InvalidHierarchyError(
            `parent must be at a higher level (parent level ${parent.level}, agent level ${targetLevel})`,
          );
        }
        agent.parentId = parent._id;
      }
    }

    if (input.teamId !== undefined) {
      agent.teamId = input.teamId;
    }

    await agent.save();
    this.logger.info('Agent hierarchy updated', { agentId, ...input });
    return agent;
  }
}
