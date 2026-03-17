import crypto from 'crypto';
import type { LogAdapter } from '@astralibx/core';
import type { ChatFAQItemModel, ChatFAQItemDocument } from '../schemas/chat-faq-item.schema';

export class FAQService {
  constructor(
    private ChatFAQItem: ChatFAQItemModel,
    private logger: LogAdapter,
  ) {}

  async create(data: {
    question: string;
    answer: string;
    category?: string;
    tags?: string[];
    order?: number;
    isActive?: boolean;
    metadata?: Record<string, unknown>;
  }): Promise<ChatFAQItemDocument> {
    const itemId = crypto.randomUUID();
    const item = await this.ChatFAQItem.create({ itemId, ...data });
    this.logger.info('FAQ item created', { itemId });
    return item;
  }

  async findById(itemId: string): Promise<ChatFAQItemDocument | null> {
    return this.ChatFAQItem.findOne({ itemId });
  }

  async update(itemId: string, data: Partial<{
    question: string;
    answer: string;
    category: string;
    tags: string[];
    order: number;
    isActive: boolean;
    metadata: Record<string, unknown>;
  }>): Promise<ChatFAQItemDocument | null> {
    return this.ChatFAQItem.findOneAndUpdate(
      { itemId },
      { $set: data },
      { new: true },
    );
  }

  async remove(itemId: string): Promise<void> {
    await this.ChatFAQItem.deleteOne({ itemId });
    this.logger.info('FAQ item removed', { itemId });
  }

  async list(filters?: { category?: string; isActive?: boolean; search?: string }): Promise<ChatFAQItemDocument[]> {
    const query: Record<string, unknown> = {};
    if (filters?.category) query.category = filters.category;
    if (filters?.isActive !== undefined) query.isActive = filters.isActive;
    if (filters?.search) {
      query.$or = [
        { question: { $regex: filters.search, $options: 'i' } },
        { answer: { $regex: filters.search, $options: 'i' } },
        { tags: { $in: [new RegExp(filters.search, 'i')] } },
      ];
    }
    return this.ChatFAQItem.find(query).sort({ order: 1 });
  }

  async getCategories(): Promise<string[]> {
    const categories = await this.ChatFAQItem.distinct('category', { category: { $ne: null } });
    return categories;
  }

  async reorder(items: { itemId: string; order: number }[]): Promise<void> {
    const bulk = items.map((item) => ({
      updateOne: {
        filter: { itemId: item.itemId },
        update: { $set: { order: item.order } },
      },
    }));
    await this.ChatFAQItem.bulkWrite(bulk);
    this.logger.info('FAQ items reordered', { count: items.length });
  }

  async bulkImport(items: Array<{
    question: string;
    answer: string;
    category?: string;
    tags?: string[];
    order?: number;
  }>): Promise<ChatFAQItemDocument[]> {
    const docs = items.map((item, index) => ({
      itemId: crypto.randomUUID(),
      ...item,
      order: item.order ?? index,
      isActive: true,
      viewCount: 0,
      helpfulCount: 0,
      notHelpfulCount: 0,
    }));
    const created = await this.ChatFAQItem.insertMany(docs);
    this.logger.info('FAQ items imported', { count: created.length });
    return created as ChatFAQItemDocument[];
  }

  async incrementViewCount(itemId: string): Promise<void> {
    await this.ChatFAQItem.updateOne(
      { itemId },
      { $inc: { viewCount: 1 } },
    );
  }

  async recordFeedback(itemId: string, helpful: boolean): Promise<void> {
    const field = helpful ? 'helpfulCount' : 'notHelpfulCount';
    await this.ChatFAQItem.updateOne(
      { itemId },
      { $inc: { [field]: 1 } },
    );
  }
}
