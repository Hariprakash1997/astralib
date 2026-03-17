import type { LogAdapter } from '@astralibx/core';
import type { ChatAgentInfo } from '@astralibx/chat-types';
import { AgentStatus } from '@astralibx/chat-types';
import type { ChatAgentModel, ChatAgentDocument } from '../schemas/chat-agent.schema';
import type { ResolvedOptions } from '../types/config.types';
import { AgentNotFoundError } from '../errors';

export class AgentService {
  constructor(
    private ChatAgent: ChatAgentModel,
    private options: ResolvedOptions,
    private logger: LogAdapter,
  ) {}

  async create(data: {
    name: string;
    avatar?: string;
    role?: string;
    isAI?: boolean;
    aiConfig?: Record<string, unknown>;
    promptTemplateId?: string;
    maxConcurrentChats?: number;
    metadata?: Record<string, unknown>;
  }): Promise<ChatAgentDocument> {
    const agent = await this.ChatAgent.create({
      ...data,
      maxConcurrentChats: data.maxConcurrentChats ?? this.options.maxConcurrentChatsPerAgent,
    });
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

  async update(agentId: string, data: Partial<{
    name: string;
    avatar: string;
    role: string;
    isAI: boolean;
    aiConfig: Record<string, unknown>;
    promptTemplateId: string;
    maxConcurrentChats: number;
    metadata: Record<string, unknown>;
  }>): Promise<ChatAgentDocument> {
    const agent = await this.findByIdOrFail(agentId);
    Object.assign(agent, data);
    await agent.save();
    this.logger.info('Agent updated', { agentId });
    return agent;
  }

  async remove(agentId: string): Promise<void> {
    await this.ChatAgent.findByIdAndDelete(agentId);
    this.logger.info('Agent removed', { agentId });
  }

  async list(): Promise<ChatAgentDocument[]> {
    return this.ChatAgent.find().sort({ name: 1 });
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
    return this.ChatAgent.find({ isOnline: true, isActive: true });
  }

  async getOnlineAgentCount(): Promise<number> {
    return this.ChatAgent.countDocuments({ isOnline: true, isActive: true });
  }

  async getTotalAgentCount(): Promise<number> {
    return this.ChatAgent.countDocuments({ isActive: true });
  }

  toAgentInfo(agent: ChatAgentDocument): ChatAgentInfo {
    return {
      agentId: agent._id.toString(),
      name: agent.name,
      avatar: agent.avatar,
      role: agent.role,
      status: agent.status,
      isAI: agent.isAI,
    };
  }
}
