import { noopLogger } from '@astralibx/core';
import type { LogAdapter } from '../types/config.types';
import type {
  TelegramConversationSessionModel,
  TelegramConversationSessionDocument,
} from '../schemas/telegram-conversation-session.schema';
import type { CreateSessionInput, SessionFilters } from '../types/session.types';
import { STATUS_ACTIVE, STATUS_PAUSED, STATUS_CLOSED } from '../constants';

export class SessionService {
  private logger: LogAdapter;

  constructor(
    private TelegramConversationSession: TelegramConversationSessionModel,
    logger?: LogAdapter,
  ) {
    this.logger = logger || noopLogger;
  }

  async create(input: CreateSessionInput): Promise<TelegramConversationSessionDocument> {
    const doc = await this.TelegramConversationSession.create({
      accountId: input.accountId,
      contactId: input.contactId,
      identifierId: input.identifierId,
      conversationId: input.conversationId,
      status: STATUS_ACTIVE,
      startedAt: new Date(),
      messageCount: 0,
    });

    this.logger.info('Session created', { id: doc._id.toString(), accountId: input.accountId, contactId: input.contactId });
    return doc;
  }

  async getById(id: string): Promise<TelegramConversationSessionDocument | null> {
    return this.TelegramConversationSession.findById(id);
  }

  async list(
    filters?: SessionFilters,
    page = 1,
    limit = 50,
  ): Promise<{ items: TelegramConversationSessionDocument[]; total: number }> {
    const query: Record<string, unknown> = {};
    if (filters?.accountId) query.accountId = filters.accountId;
    if (filters?.contactId) query.contactId = filters.contactId;
    if (filters?.status) query.status = filters.status;

    const [items, total] = await Promise.all([
      this.TelegramConversationSession.find(query)
        .sort({ updatedAt: -1 })
        .skip((page - 1) * limit)
        .limit(limit),
      this.TelegramConversationSession.countDocuments(query),
    ]);

    return { items, total };
  }

  async getActiveByContact(contactId: string): Promise<TelegramConversationSessionDocument | null> {
    return this.TelegramConversationSession.findOne({ contactId, status: STATUS_ACTIVE });
  }

  async getByConversation(conversationId: string): Promise<TelegramConversationSessionDocument | null> {
    return this.TelegramConversationSession.findOne({ conversationId });
  }

  async pause(id: string): Promise<TelegramConversationSessionDocument | null> {
    const doc = await this.TelegramConversationSession.findByIdAndUpdate(
      id,
      { $set: { status: STATUS_PAUSED } },
      { new: true },
    );

    if (doc) {
      this.logger.info('Session paused', { id });
    }

    return doc;
  }

  async close(id: string): Promise<TelegramConversationSessionDocument | null> {
    const doc = await this.TelegramConversationSession.findByIdAndUpdate(
      id,
      { $set: { status: STATUS_CLOSED, endedAt: new Date() } },
      { new: true },
    );

    if (doc) {
      this.logger.info('Session closed', { id });
    }

    return doc;
  }

  async resume(id: string): Promise<TelegramConversationSessionDocument | null> {
    const doc = await this.TelegramConversationSession.findByIdAndUpdate(
      id,
      { $set: { status: STATUS_ACTIVE }, $unset: { endedAt: 1 } },
      { new: true },
    );

    if (doc) {
      this.logger.info('Session resumed', { id });
    }

    return doc;
  }

  async incrementMessageCount(conversationId: string): Promise<TelegramConversationSessionDocument | null> {
    return this.TelegramConversationSession.findOneAndUpdate(
      { conversationId, status: STATUS_ACTIVE },
      {
        $inc: { messageCount: 1 },
        $set: { lastMessageAt: new Date() },
      },
      { new: true },
    );
  }

  async delete(id: string): Promise<boolean> {
    const result = await this.TelegramConversationSession.findByIdAndDelete(id);
    if (result) {
      this.logger.info('Session deleted', { id });
      return true;
    }
    return false;
  }
}
