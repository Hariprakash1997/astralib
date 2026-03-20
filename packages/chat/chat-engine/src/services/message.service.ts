import crypto from 'crypto';
import type { LogAdapter } from '@astralibx/core';
import type { ChatMessage } from '@astralibx/chat-types';
import {
  ChatSenderType,
  ChatContentType,
  ChatMessageStatus,
} from '@astralibx/chat-types';
import type { ChatMessageModel, ChatMessageDocument } from '../schemas/chat-message.schema.js';
import type { ChatEngineConfig, ResolvedOptions } from '../types/config.types.js';
import { SYSTEM_MESSAGE } from '../constants/index.js';
import { withTenantFilter, withTenantId } from '../utils/helpers.js';

export class MessageService {
  constructor(
    private ChatMessage: ChatMessageModel,
    private options: ResolvedOptions,
    private logger: LogAdapter,
    private hooks?: ChatEngineConfig['hooks'],
    private tenantId?: string,
  ) {}

  async create(params: {
    sessionId: string;
    senderType: ChatSenderType;
    senderName?: string;
    content: string;
    contentType?: ChatContentType;
    metadata?: Record<string, unknown>;
  }): Promise<ChatMessageDocument> {
    const messageId = crypto.randomUUID();

    const message = await this.ChatMessage.create(withTenantId({
      messageId,
      sessionId: params.sessionId,
      senderType: params.senderType,
      senderName: params.senderName,
      content: params.content,
      contentType: params.contentType || ChatContentType.Text,
      status: ChatMessageStatus.Sent,
      metadata: params.metadata || {},
      createdAt: new Date(),
    }, this.tenantId));

    this.hooks?.onMessageSent?.(this.toPayload(message));
    return message;
  }

  async createSystemMessage(sessionId: string, content: string, metadata?: Record<string, unknown>): Promise<ChatMessageDocument> {
    return this.create({
      sessionId,
      senderType: ChatSenderType.System,
      senderName: SYSTEM_MESSAGE.SenderName,
      content,
      contentType: ChatContentType.System,
      metadata,
    });
  }

  async findBySession(sessionId: string, limit?: number, before?: string): Promise<ChatMessageDocument[]> {
    const filter: Record<string, unknown> = withTenantFilter({ sessionId }, this.tenantId);

    if (before) {
      const cursorMessage = await this.ChatMessage.findOne({ messageId: before });
      if (cursorMessage) {
        filter.createdAt = { $lt: cursorMessage.createdAt };
      }
    }

    const query = this.ChatMessage
      .find(filter)
      .sort({ createdAt: -1 });

    if (limit) {
      query.limit(limit);
    }

    const messages = await query;
    return messages.reverse();
  }

  async findById(messageId: string): Promise<ChatMessageDocument | null> {
    return this.ChatMessage.findOne({ messageId });
  }

  async markDelivered(messageId: string): Promise<void> {
    await this.ChatMessage.updateOne(
      { messageId },
      {
        $set: {
          status: ChatMessageStatus.Delivered,
          deliveredAt: new Date(),
        },
      },
    );
  }

  async markRead(messageIds: string[]): Promise<void> {
    if (messageIds.length === 0) return;

    await this.ChatMessage.updateMany(
      { messageId: { $in: messageIds } },
      {
        $set: {
          status: ChatMessageStatus.Read,
          readAt: new Date(),
        },
      },
    );
  }

  async markSessionMessagesDelivered(sessionId: string, senderType: ChatSenderType): Promise<string[]> {
    const messages = await this.ChatMessage.find({
      sessionId,
      senderType,
      status: ChatMessageStatus.Sent,
    });
    const ids = messages.map((m) => m.messageId);
    if (ids.length === 0) return [];

    await this.ChatMessage.updateMany(
      { messageId: { $in: ids } },
      {
        $set: {
          status: ChatMessageStatus.Delivered,
          deliveredAt: new Date(),
        },
      },
    );
    return ids;
  }

  async updateLabel(messageId: string, quality: 'good' | 'bad' | 'needs_review'): Promise<void> {
    await this.ChatMessage.updateOne(
      { messageId },
      { $set: { trainingQuality: quality } },
    );
  }

  async markSessionMessagesRead(sessionId: string, senderType: ChatSenderType): Promise<void> {
    await this.ChatMessage.updateMany(
      {
        sessionId,
        senderType,
        status: { $in: [ChatMessageStatus.Sent, ChatMessageStatus.Delivered] },
      },
      {
        $set: {
          status: ChatMessageStatus.Read,
          readAt: new Date(),
        },
      },
    );
  }

  toPayload(message: ChatMessageDocument): ChatMessage {
    return {
      _id: message._id.toString(),
      messageId: message.messageId,
      sessionId: message.sessionId,
      senderType: message.senderType,
      senderName: message.senderName,
      content: message.content,
      contentType: message.contentType,
      status: message.status,
      metadata: message.metadata,
      createdAt: message.createdAt,
      deliveredAt: message.deliveredAt,
      readAt: message.readAt,
    };
  }
}
