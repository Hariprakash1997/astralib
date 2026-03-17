import type { TelegramAccountManager } from '@astralibx/telegram-account-manager';
import type { TelegramMessageModel, TelegramMessageDocument } from '../schemas/telegram-message.schema';
import type { TelegramConversationSessionModel } from '../schemas/telegram-conversation-session.schema';
import { noopLogger } from '@astralibx/core';
import type { LogAdapter, TelegramInboxConfig } from '../types/config.types';
import type { CreateMessageInput } from '../types/message.types';
import { MessageNotFoundError } from '../errors';

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

    let sentMessage: any;

    if (media) {
      sentMessage = await client.sendMessage(chatId, {
        message: text,
        file: media.buffer,
      });
    } else {
      sentMessage = await client.sendMessage(chatId, {
        message: text,
      });
    }

    const telegramMessageId = sentMessage?.id ? String(sentMessage.id) : `out_${Date.now()}`;

    // Save outbound message to DB
    const savedMessage = await this.TelegramMessage.create({
      conversationId: chatId,
      messageId: telegramMessageId,
      senderId: accountId,
      senderType: 'account',
      direction: 'outbound',
      contentType: media ? 'document' : 'text',
      content: text,
    });

    // Update conversation session
    await this.TelegramConversationSession.findOneAndUpdate(
      { conversationId: chatId, accountId, status: 'active' },
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
