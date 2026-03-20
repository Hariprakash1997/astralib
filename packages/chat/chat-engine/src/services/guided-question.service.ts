import crypto from 'crypto';
import type { LogAdapter } from '@astralibx/core';
import type { ChatGuidedQuestionModel, ChatGuidedQuestionDocument, IChatGuidedQuestionOption } from '../schemas/chat-guided-question.schema.js';

export class GuidedQuestionService {
  constructor(
    private ChatGuidedQuestion: ChatGuidedQuestionModel,
    private logger: LogAdapter,
  ) {}

  async create(data: {
    key: string;
    text: string;
    options?: IChatGuidedQuestionOption[];
    allowFreeText?: boolean;
    multiSelect?: boolean;
    order?: number;
    isActive?: boolean;
    metadata?: Record<string, unknown>;
  }): Promise<ChatGuidedQuestionDocument> {
    const questionId = crypto.randomUUID();
    const question = await this.ChatGuidedQuestion.create({ questionId, ...data });
    this.logger.info('Guided question created', { questionId, key: data.key });
    return question;
  }

  async findById(questionId: string): Promise<ChatGuidedQuestionDocument | null> {
    return this.ChatGuidedQuestion.findOne({ questionId });
  }

  async findByKey(key: string): Promise<ChatGuidedQuestionDocument | null> {
    return this.ChatGuidedQuestion.findOne({ key });
  }

  async update(questionId: string, data: Partial<{
    key: string;
    text: string;
    options: IChatGuidedQuestionOption[];
    allowFreeText: boolean;
    multiSelect: boolean;
    order: number;
    isActive: boolean;
    metadata: Record<string, unknown>;
  }>): Promise<ChatGuidedQuestionDocument | null> {
    return this.ChatGuidedQuestion.findOneAndUpdate(
      { questionId },
      { $set: data },
      { new: true },
    );
  }

  async remove(questionId: string): Promise<void> {
    await this.ChatGuidedQuestion.deleteOne({ questionId });
    this.logger.info('Guided question removed', { questionId });
  }

  async list(filters?: { isActive?: boolean }): Promise<ChatGuidedQuestionDocument[]> {
    const query: Record<string, unknown> = {};
    if (filters?.isActive !== undefined) query.isActive = filters.isActive;
    return this.ChatGuidedQuestion.find(query).sort({ order: 1 });
  }

  async reorder(items: { questionId: string; order: number }[]): Promise<void> {
    const bulk = items.map((item) => ({
      updateOne: {
        filter: { questionId: item.questionId },
        update: { $set: { order: item.order } },
      },
    }));
    await this.ChatGuidedQuestion.bulkWrite(bulk);
    this.logger.info('Guided questions reordered', { count: items.length });
  }
}
