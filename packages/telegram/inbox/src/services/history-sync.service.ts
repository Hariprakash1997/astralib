import { Api } from 'telegram';
import type { TelegramAccountManager } from '@astralibx/telegram-account-manager';
import type { TelegramMessageModel } from '../schemas/telegram-message.schema';
import { noopLogger } from '@astralibx/core';
import type { LogAdapter, TelegramInboxConfig, ContentType } from '../types/config.types';
import {
  DEFAULT_HISTORY_SYNC_LIMIT,
  SENDER_ACCOUNT,
  SENDER_USER,
  DIRECTION_OUTBOUND,
  DIRECTION_INBOUND,
  CONTENT_TEXT,
  CONTENT_DOCUMENT,
  CONTENT_PHOTO,
  CONTENT_VIDEO,
  CONTENT_VOICE,
  CONTENT_AUDIO,
  CONTENT_STICKER,
  CONTENT_LOCATION,
  CONTENT_CONTACT,
} from '../constants';

export interface SyncResult {
  success: boolean;
  messagesImported: number;
  oldestMessageId?: number;
  hasMore: boolean;
  error?: string;
}

export class HistorySyncService {
  private activeSyncs = new Set<string>();
  private logger: LogAdapter;
  private accountManager: TelegramAccountManager;
  private defaultLimit: number;

  constructor(
    accountManager: TelegramAccountManager,
    private TelegramMessage: TelegramMessageModel,
    config: TelegramInboxConfig,
    logger?: LogAdapter,
  ) {
    this.accountManager = accountManager;
    this.logger = logger || config.logger || noopLogger;
    this.defaultLimit = config.options?.historySyncLimit ?? DEFAULT_HISTORY_SYNC_LIMIT;
  }

  isSyncing(chatId: string): boolean {
    return this.activeSyncs.has(chatId);
  }

  async syncChat(accountId: string, chatId: string, limit?: number): Promise<SyncResult> {
    if (this.activeSyncs.has(chatId)) {
      return { success: false, messagesImported: 0, hasMore: false, error: 'Sync already in progress' };
    }

    const client = this.accountManager.getClient(accountId);
    if (!client) {
      return { success: false, messagesImported: 0, hasMore: false, error: 'Account not connected' };
    }

    const syncLimit = limit ?? this.defaultLimit;
    this.activeSyncs.add(chatId);

    try {
      this.logger.info('Starting history sync', { accountId, chatId, limit: syncLimit });

      const messages = await client.getMessages(chatId, {
        limit: syncLimit,
        reverse: false,
      });

      if (!messages || messages.length === 0) {
        this.logger.info('No messages to sync', { accountId, chatId });
        return { success: true, messagesImported: 0, hasMore: false };
      }

      let imported = 0;
      let oldestId: number | undefined;

      // Batch dedup: collect all messageIds and query once
      const allMessageIds = messages
        .filter((msg): msg is Api.Message => msg instanceof Api.Message)
        .map(msg => String(msg.id));

      const existingDocs = await this.TelegramMessage.find({ messageId: { $in: allMessageIds } }).select('messageId').lean();
      const existingSet = new Set(existingDocs.map((e: Record<string, unknown>) => String(e.messageId)));

      for (const msg of messages) {
        if (!(msg instanceof Api.Message)) continue;

        const messageId = String(msg.id);

        // Skip if message already exists (batch dedup)
        if (existingSet.has(messageId)) {
          oldestId = msg.id;
          continue;
        }

        const isOutbound = msg.out || false;
        const contentType = this.extractContentType(msg);
        const content = msg.message || '';

        try {
          await this.TelegramMessage.create({
            accountId,
            conversationId: chatId,
            messageId,
            senderId: isOutbound ? accountId : chatId,
            senderType: isOutbound ? SENDER_ACCOUNT : SENDER_USER,
            direction: isOutbound ? DIRECTION_OUTBOUND : DIRECTION_INBOUND,
            contentType,
            content,
          });

          imported++;
          oldestId = msg.id;
        } catch (err: unknown) {
          // Skip duplicate key errors silently
          const errMsg = err instanceof Error ? err.message : String(err);
          if (!errMsg.includes('duplicate') && !errMsg.includes('E11000')) {
            this.logger.error('Error saving synced message', { messageId, error: errMsg });
          }
        }
      }

      const hasMore = messages.length >= syncLimit;

      this.logger.info('History sync completed', { accountId, chatId, imported, hasMore });

      return {
        success: true,
        messagesImported: imported,
        oldestMessageId: oldestId,
        hasMore,
      };
    } catch (err) {
      const error = err instanceof Error ? err : new Error(String(err));
      this.logger.error('History sync failed', {
        accountId,
        chatId,
        error: error.message,
      });

      return {
        success: false,
        messagesImported: 0,
        hasMore: false,
        error: error.message,
      };
    } finally {
      this.activeSyncs.delete(chatId);
    }
  }

  private extractContentType(msg: Api.Message): ContentType {
    if (!msg.media) return CONTENT_TEXT;

    if (msg.media instanceof Api.MessageMediaPhoto) return CONTENT_PHOTO;

    if (msg.media instanceof Api.MessageMediaDocument) {
      const doc = msg.media.document;
      if (doc instanceof Api.Document) {
        const mimeType = doc.mimeType || '';
        if (mimeType.startsWith('video/')) return CONTENT_VIDEO;
        if (mimeType.includes('webp') || mimeType.includes('tgs') || mimeType === 'application/x-tgsticker') {
          return CONTENT_STICKER;
        }
        // Check attributes for voice flag before falling back to audio
        if (mimeType.startsWith('audio/') || mimeType.includes('ogg')) {
          const attrs = (doc as unknown as Record<string, unknown>).attributes;
          if (Array.isArray(attrs)) {
            for (const attr of attrs) {
              if ((attr as Record<string, unknown>).className === 'DocumentAttributeAudio') {
                return (attr as Record<string, unknown>).voice ? CONTENT_VOICE : CONTENT_AUDIO;
              }
            }
          }
          // ogg without voice attribute is still voice (Telegram convention)
          if (mimeType.includes('ogg')) return CONTENT_VOICE;
          return CONTENT_AUDIO;
        }
      }
      return CONTENT_DOCUMENT;
    }

    if (msg.media instanceof Api.MessageMediaGeo || msg.media instanceof Api.MessageMediaGeoLive) {
      return CONTENT_LOCATION;
    }

    if (msg.media instanceof Api.MessageMediaContact) {
      return CONTENT_CONTACT;
    }

    return CONTENT_TEXT;
  }
}
