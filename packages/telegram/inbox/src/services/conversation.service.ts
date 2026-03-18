import { noopLogger } from '@astralibx/core';
import type { PipelineStage } from 'mongoose';
import type { LogAdapter, TelegramInboxConfig } from '../types/config.types';
import type { TelegramMessageModel, TelegramMessageDocument } from '../schemas/telegram-message.schema';
import type { InboxEventGateway } from './websocket-gateway';
import { DIRECTION_INBOUND } from '../constants';

export interface ConversationListItem {
  conversationId: string;
  lastMessage: {
    content: string;
    contentType: string;
    direction: string;
    createdAt: Date;
  };
  messageCount: number;
  unreadCount: number;
}

export interface ConversationFilters {
  accountId?: string;
  direction?: 'inbound' | 'outbound';
  contentType?: string;
  startDate?: Date;
  endDate?: Date;
}

export class ConversationService {
  private logger: LogAdapter;
  private hooks?: TelegramInboxConfig['hooks'];
  private events?: InboxEventGateway;

  constructor(
    private TelegramMessage: TelegramMessageModel,
    logger?: LogAdapter,
    hooks?: TelegramInboxConfig['hooks'],
    events?: InboxEventGateway,
  ) {
    this.logger = logger || noopLogger;
    this.hooks = hooks;
    this.events = events;
  }

  async list(
    filters?: ConversationFilters,
    page = 1,
    limit = 50,
  ): Promise<{ items: ConversationListItem[]; total: number }> {
    const matchStage: Record<string, unknown> = {};

    if (filters?.accountId) matchStage.accountId = filters.accountId;
    if (filters?.direction) matchStage.direction = filters.direction;
    if (filters?.contentType) matchStage.contentType = filters.contentType;
    if (filters?.startDate || filters?.endDate) {
      matchStage.createdAt = {};
      if (filters.startDate) (matchStage.createdAt as Record<string, unknown>).$gte = filters.startDate;
      if (filters.endDate) (matchStage.createdAt as Record<string, unknown>).$lte = filters.endDate;
    }

    const pipeline: PipelineStage[] = [];

    if (Object.keys(matchStage).length > 0) {
      pipeline.push({ $match: matchStage });
    }

    pipeline.push(
      { $sort: { createdAt: -1 as const } },
      {
        $group: {
          _id: '$conversationId',
          lastMessage: {
            $first: {
              content: '$content',
              contentType: '$contentType',
              direction: '$direction',
              createdAt: '$createdAt',
            },
          },
          messageCount: { $sum: 1 },
          unreadCount: {
            $sum: {
              $cond: [
                { $and: [{ $eq: ['$direction', DIRECTION_INBOUND] }, { $eq: ['$readAt', null] }] },
                1,
                0,
              ],
            },
          },
        },
      },
      { $sort: { 'lastMessage.createdAt': -1 as const } },
    );

    // Use $facet to get count and paginated results in a single aggregation
    pipeline.push({
      $facet: {
        metadata: [{ $count: 'total' }],
        data: [{ $skip: (page - 1) * limit }, { $limit: limit }],
      },
    });

    const [facetResult] = await this.TelegramMessage.aggregate(pipeline);
    const total = facetResult?.metadata[0]?.total || 0;

    const items: ConversationListItem[] = (facetResult?.data || []).map((r: Record<string, unknown>) => ({
      conversationId: r._id as string,
      lastMessage: r.lastMessage as ConversationListItem['lastMessage'],
      messageCount: r.messageCount as number,
      unreadCount: r.unreadCount as number,
    }));

    return { items, total };
  }

  async getMessages(
    conversationId: string,
    page = 1,
    limit = 50,
    accountId?: string,
  ): Promise<{ items: TelegramMessageDocument[]; total: number }> {
    const query: Record<string, unknown> = { conversationId };
    if (accountId) query.accountId = accountId;

    const [items, total] = await Promise.all([
      this.TelegramMessage.find(query)
        .sort({ createdAt: -1 })
        .skip((page - 1) * limit)
        .limit(limit),
      this.TelegramMessage.countDocuments(query),
    ]);

    return { items, total };
  }

  // Note: Uses $regex for search which does a collection scan. For large datasets,
  // consider adding a MongoDB text index on the 'content' field.
  async search(
    query: string,
    page = 1,
    limit = 50,
    accountId?: string,
  ): Promise<{ items: TelegramMessageDocument[]; total: number }> {
    if (!query?.trim()) return { items: [], total: 0 };

    const escaped = query.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
    const searchQuery: Record<string, unknown> = {
      content: { $regex: escaped, $options: 'i' },
    };
    if (accountId) searchQuery.accountId = accountId;

    const [items, total] = await Promise.all([
      this.TelegramMessage.find(searchQuery)
        .sort({ createdAt: -1 })
        .skip((page - 1) * limit)
        .limit(limit),
      this.TelegramMessage.countDocuments(searchQuery),
    ]);

    return { items, total };
  }

  async markAsRead(conversationId: string, upToMessageId?: string, accountId?: string): Promise<number> {
    const query: Record<string, unknown> = {
      conversationId,
      direction: DIRECTION_INBOUND,
      readAt: null,
    };
    if (accountId) query.accountId = accountId;

    if (upToMessageId) {
      const upToMessage = await this.TelegramMessage.findOne({ messageId: upToMessageId });
      if (upToMessage) {
        query.createdAt = { $lte: upToMessage.createdAt };
      }
    }

    const readAt = new Date();
    const result = await this.TelegramMessage.updateMany(query, {
      $set: { readAt },
    });

    this.logger.info('Messages marked as read', { conversationId, count: result.modifiedCount });

    try {
      this.hooks?.onMessageRead?.({ messageId: upToMessageId || 'all', chatId: conversationId, readAt });
    } catch (e) {
      this.logger.error('onMessageRead hook error', e as Record<string, unknown>);
    }

    this.events?.emitMessageRead(conversationId, upToMessageId || 'all');

    return result.modifiedCount;
  }

  async getUnreadCount(conversationId?: string, accountId?: string): Promise<number> {
    const query: Record<string, unknown> = {
      direction: DIRECTION_INBOUND,
      readAt: null,
    };

    if (accountId) query.accountId = accountId;
    if (conversationId) query.conversationId = conversationId;

    return this.TelegramMessage.countDocuments(query);
  }
}
