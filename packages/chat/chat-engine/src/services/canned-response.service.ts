import crypto from 'crypto';
import type { LogAdapter } from '@astralibx/core';
import type { ChatCannedResponseModel, ChatCannedResponseDocument } from '../schemas/chat-canned-response.schema.js';
import { withTenantFilter, withTenantId } from '../utils/helpers.js';

export class CannedResponseService {
  constructor(
    private ChatCannedResponse: ChatCannedResponseModel,
    private logger: LogAdapter,
    private tenantId?: string,
  ) {}

  async create(data: {
    title: string;
    content: string;
    category?: string;
    shortcut?: string;
    isActive?: boolean;
    order?: number;
    createdBy?: string;
  }): Promise<ChatCannedResponseDocument> {
    const responseId = crypto.randomUUID();
    const response = await this.ChatCannedResponse.create(withTenantId({ responseId, ...data }, this.tenantId));
    this.logger.info('Canned response created', { responseId });
    return response;
  }

  async findById(responseId: string): Promise<ChatCannedResponseDocument | null> {
    return this.ChatCannedResponse.findOne(withTenantFilter({ responseId }, this.tenantId));
  }

  async findByShortcut(shortcut: string): Promise<ChatCannedResponseDocument | null> {
    return this.ChatCannedResponse.findOne(withTenantFilter({ shortcut, isActive: true }, this.tenantId));
  }

  async update(responseId: string, data: Partial<{
    title: string;
    content: string;
    category: string;
    shortcut: string;
    isActive: boolean;
    order: number;
  }>): Promise<ChatCannedResponseDocument | null> {
    return this.ChatCannedResponse.findOneAndUpdate(
      { responseId },
      { $set: data },
      { new: true },
    );
  }

  async remove(responseId: string): Promise<void> {
    await this.ChatCannedResponse.deleteOne({ responseId });
    this.logger.info('Canned response removed', { responseId });
  }

  async list(filters?: { category?: string; isActive?: boolean; search?: string }): Promise<ChatCannedResponseDocument[]> {
    const query: Record<string, unknown> = withTenantFilter({} as Record<string, unknown>, this.tenantId);
    if (filters?.category) query.category = filters.category;
    if (filters?.isActive !== undefined) query.isActive = filters.isActive;
    if (filters?.search) {
      const escaped = String(filters.search).replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
      query.$or = [
        { title: { $regex: escaped, $options: 'i' } },
        { content: { $regex: escaped, $options: 'i' } },
      ];
    }
    return this.ChatCannedResponse.find(query).sort({ order: 1 });
  }

  substituteVariables(content: string, context: { userName?: string; agentName?: string; [key: string]: string | undefined }): string {
    return content.replace(/\{\{(\w+)\}\}/g, (match, key) => context[key] ?? match);
  }
}
