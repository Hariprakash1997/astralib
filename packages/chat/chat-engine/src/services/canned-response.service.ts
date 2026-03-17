import crypto from 'crypto';
import type { LogAdapter } from '@astralibx/core';
import type { ChatCannedResponseModel, ChatCannedResponseDocument } from '../schemas/chat-canned-response.schema';

export class CannedResponseService {
  constructor(
    private ChatCannedResponse: ChatCannedResponseModel,
    private logger: LogAdapter,
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
    const response = await this.ChatCannedResponse.create({ responseId, ...data });
    this.logger.info('Canned response created', { responseId });
    return response;
  }

  async findById(responseId: string): Promise<ChatCannedResponseDocument | null> {
    return this.ChatCannedResponse.findOne({ responseId });
  }

  async findByShortcut(shortcut: string): Promise<ChatCannedResponseDocument | null> {
    return this.ChatCannedResponse.findOne({ shortcut, isActive: true });
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
    const query: Record<string, unknown> = {};
    if (filters?.category) query.category = filters.category;
    if (filters?.isActive !== undefined) query.isActive = filters.isActive;
    if (filters?.search) {
      query.$or = [
        { title: { $regex: filters.search, $options: 'i' } },
        { content: { $regex: filters.search, $options: 'i' } },
      ];
    }
    return this.ChatCannedResponse.find(query).sort({ order: 1 });
  }
}
