import type { TelegramAccountManager } from '@astralibx/telegram-account-manager';
import type { TelegramMessageModel, TelegramMessageDocument } from '../schemas/telegram-message.schema';
import type { TelegramConversationSessionModel } from '../schemas/telegram-conversation-session.schema';
import { noopLogger } from '@astralibx/core';
import type { LogAdapter, TelegramInboxConfig } from '../types/config.types';
import type { CreateMessageInput } from '../types/message.types';
import type { ContentType } from '../types/config.types';
import {
  SENDER_ACCOUNT,
  DIRECTION_OUTBOUND,
  CONTENT_TEXT,
  CONTENT_PHOTO,
  CONTENT_VIDEO,
  CONTENT_AUDIO,
  CONTENT_DOCUMENT,
  STATUS_ACTIVE,
} from '../constants';

export class MessageService {
  private logger: LogAdapter;
  private accountManager: TelegramAccountManager;

  constructor(
    accountManager: TelegramAccountManager,
    private TelegramMessage: TelegramMessageModel,
    private TelegramConversationSession: TelegramConversationSessionModel,
    config: TelegramInboxConfig,
    logger?: LogAdapter,
  ) {
    this.accountManager = accountManager;
    this.logger = logger || config.logger || noopLogger;
  }

  async create(input: CreateMessageInput): Promise<TelegramMessageDocument> {
    const doc = await this.TelegramMessage.create(input);
    this.logger.info('Message created', { messageId: input.messageId, conversationId: input.conversationId });
    return doc;
  }

  async getById(id: string): Promise<TelegramMessageDocument | null> {
    return this.TelegramMessage.findById(id);
  }

  async getByMessageId(messageId: string): Promise<TelegramMessageDocument | null> {
    return this.TelegramMessage.findOne({ messageId });
  }

  async sendMessage(
    accountId: string,
    chatId: string,
    text: string,
    media?: { buffer: Buffer; filename: string; mimeType: string },
  ): Promise<TelegramMessageDocument> {
    const client = this.accountManager.getClient(accountId);
    if (!client) {
      throw new Error(`Account ${accountId} is not connected`);
    }

    const sentMessage = media
      ? await client.sendMessage(chatId, { message: text, file: media.buffer })
      : await client.sendMessage(chatId, { message: text });

    if (!sentMessage?.id) {
      throw new Error('Telegram sendMessage returned no message ID');
    }
    const telegramMessageId = String(sentMessage.id);

    // Determine content type from media mimeType
    let contentType: ContentType = CONTENT_TEXT;
    if (media) {
      if (media.mimeType.startsWith('image/')) contentType = CONTENT_PHOTO;
      else if (media.mimeType.startsWith('video/')) contentType = CONTENT_VIDEO;
      else if (media.mimeType.startsWith('audio/')) contentType = CONTENT_AUDIO;
      else contentType = CONTENT_DOCUMENT;
    }

    // Save outbound message to DB
    const savedMessage = await this.TelegramMessage.create({
      accountId,
      conversationId: chatId,
      messageId: telegramMessageId,
      senderId: accountId,
      senderType: SENDER_ACCOUNT,
      direction: DIRECTION_OUTBOUND,
      contentType,
      content: text,
      mediaType: media?.mimeType,
    });

    // Update conversation session
    await this.TelegramConversationSession.findOneAndUpdate(
      { conversationId: chatId, accountId, status: STATUS_ACTIVE },
      {
        $inc: { messageCount: 1 },
        $set: { lastMessageAt: new Date() },
      },
    );

    this.logger.info('Message sent', { accountId, chatId, messageId: telegramMessageId });
    return savedMessage;
  }

  async delete(id: string): Promise<boolean> {
    const result = await this.TelegramMessage.findByIdAndDelete(id);
    if (result) {
      this.logger.info('Message deleted', { id });
      return true;
    }
    return false;
  }

}
