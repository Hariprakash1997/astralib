import { NewMessage, NewMessageEvent } from 'telegram/events';
import { Api } from 'telegram';
import type { TelegramAccountManager } from '@astralibx/telegram-account-manager';
import type { TelegramMessageModel, TelegramMessageDocument } from '../schemas/telegram-message.schema';
import type { TelegramConversationSessionModel } from '../schemas/telegram-conversation-session.schema';
import { noopLogger } from '@astralibx/core';
import type { LogAdapter, TelegramInboxConfig, InboxMessage, ContentType } from '../types/config.types';
import { DEFAULT_MAX_FILE_SIZE_MB } from '../constants';
import type { InboxEventGateway } from './websocket-gateway';

type EventHandler = (event: NewMessageEvent) => Promise<void>;

export class MessageListenerService {
  private listeners = new Map<string, EventHandler>();
  private logger: LogAdapter;
  private accountManager: TelegramAccountManager;
  private config: TelegramInboxConfig;
  private gateway?: InboxEventGateway;

  constructor(
    accountManager: TelegramAccountManager,
    private TelegramMessage: TelegramMessageModel,
    private TelegramConversationSession: TelegramConversationSessionModel,
    config: TelegramInboxConfig,
    gateway?: InboxEventGateway,
  ) {
    this.accountManager = accountManager;
    this.config = config;
    this.logger = config.logger || noopLogger;
    this.gateway = gateway;
  }

  async attach(accountId: string): Promise<boolean> {
    if (this.listeners.has(accountId)) {
      this.logger.warn('Listener already attached', { accountId });
      return true;
    }

    const client = this.accountManager.getClient(accountId);
    if (!client) {
      this.logger.warn('No connected client for account', { accountId });
      return false;
    }

    const handler: EventHandler = async (event: NewMessageEvent) => {
      await this.handleNewMessage(accountId, event);
    };

    client.addEventHandler(handler, new NewMessage({
      chats: undefined,
      incoming: undefined,
    }));

    this.listeners.set(accountId, handler);
    this.logger.info('Listener attached', { accountId });
    return true;
  }

  async detach(accountId: string): Promise<void> {
    const handler = this.listeners.get(accountId);
    if (!handler) return;

    try {
      const client = this.accountManager.getClient(accountId);
      if (client) {
        client.removeEventHandler(handler, new NewMessage({}));
      }
    } catch (err) {
      this.logger.error('Error removing event handler', {
        accountId,
        error: err instanceof Error ? err.message : String(err),
      });
    }

    this.listeners.delete(accountId);
    this.logger.info('Listener detached', { accountId });
  }

  async attachAll(): Promise<void> {
    const accounts = this.accountManager.getConnectedAccounts();
    for (const account of accounts) {
      await this.attach(account.accountId);
    }
    this.logger.info('All listeners attached', { count: accounts.length });
  }

  async detachAll(): Promise<void> {
    const accountIds = Array.from(this.listeners.keys());
    for (const accountId of accountIds) {
      await this.detach(accountId);
    }
    this.logger.info('All listeners detached', { count: accountIds.length });
  }

  isAttached(accountId: string): boolean {
    return this.listeners.has(accountId);
  }

  getAttachedAccounts(): string[] {
    return Array.from(this.listeners.keys());
  }

  private async handleNewMessage(accountId: string, event: NewMessageEvent): Promise<void> {
    try {
      const message = event.message;

      // Only handle private (DM) messages
      if (!event.isPrivate) return;

      const chat = await event.getChat();
      if (!chat || !('id' in chat)) return;

      // Skip bot messages
      if ('bot' in chat && chat.bot) return;

      const isOutgoing = message.out || false;
      const chatId = chat.id.toString();
      const senderId = isOutgoing ? accountId : chatId;
      const senderType = isOutgoing ? 'account' : 'user';
      const direction = isOutgoing ? 'outbound' : 'inbound';

      const contentType = this.extractContentType(message);
      const content = message.message || '';

      // Download media if uploadAdapter provided
      let mediaUrl: string | undefined;
      let mediaType: string | undefined;

      if (message.media && this.config.media?.uploadAdapter) {
        try {
          const mediaResult = await this.downloadAndUploadMedia(message, accountId);
          if (mediaResult) {
            mediaUrl = mediaResult.url;
            mediaType = mediaResult.mimeType;
          }
        } catch (err) {
          this.logger.error('Media upload failed', {
            accountId,
            chatId,
            error: err instanceof Error ? err.message : String(err),
          });
        }
      }

      // Skip if message already exists (dedup by messageId)
      const existingMessage = await this.TelegramMessage.findOne({ messageId: String(message.id) });
      if (existingMessage) return;

      // Save message to DB
      const savedMessage = await this.TelegramMessage.create({
        conversationId: chatId,
        messageId: String(message.id),
        senderId,
        senderType,
        direction,
        contentType,
        content,
        mediaType,
        mediaUrl,
      });

      // Update or create conversation session
      await this.updateConversationSession(chatId, accountId, direction);

      // Build InboxMessage for hooks and gateway
      const inboxMessage: InboxMessage = {
        conversationId: chatId,
        messageId: String(message.id),
        senderId,
        senderType,
        direction,
        contentType,
        content,
        mediaUrl,
        mediaType,
        createdAt: savedMessage.createdAt,
      };

      // Fire onNewMessage hook
      try {
        this.config.hooks?.onNewMessage?.(inboxMessage);
      } catch (e) {
        this.logger.error('Hook onNewMessage error', {
          error: e instanceof Error ? e.message : String(e),
        });
      }

      // Emit via gateway
      if (this.gateway) {
        this.gateway.emitNewMessage(inboxMessage);
      }
    } catch (err) {
      this.logger.error('Failed to process incoming message', {
        accountId,
        error: err instanceof Error ? err.message : String(err),
      });
    }
  }

  private async updateConversationSession(
    conversationId: string,
    accountId: string,
    direction: string,
  ): Promise<void> {
    const session = await this.TelegramConversationSession.findOneAndUpdate(
      { conversationId, accountId, status: 'active' },
      {
        $inc: { messageCount: 1 },
        $set: { lastMessageAt: new Date() },
        $setOnInsert: {
          conversationId,
          accountId,
          contactId: conversationId, // chatId is used as contactId when auto-creating
          status: 'active',
          startedAt: new Date(),
        },
      },
      { upsert: true, new: true },
    );
  }

  private extractContentType(message: Api.Message): ContentType {
    if (!message.media) return 'text';

    const mediaClass = message.media.className;

    switch (mediaClass) {
      case 'MessageMediaPhoto':
        return 'photo';
      case 'MessageMediaDocument': {
        const doc = message.media as Api.MessageMediaDocument;
        if (doc.document && 'mimeType' in doc.document) {
          const mimeType = (doc.document as any).mimeType || '';
          if (mimeType.startsWith('video/')) return 'video';
          if (mimeType.startsWith('audio/')) return 'audio';
          if (mimeType === 'application/x-tgsticker' || mimeType.includes('webp') || mimeType.includes('tgs')) {
            return 'sticker';
          }
        }
        if (doc.document && 'attributes' in doc.document) {
          const attrs = (doc.document as any).attributes || [];
          for (const attr of attrs) {
            if (attr.className === 'DocumentAttributeAudio') {
              return attr.voice ? 'voice' : 'audio';
            }
            if (attr.className === 'DocumentAttributeVideo') return 'video';
            if (attr.className === 'DocumentAttributeSticker') return 'sticker';
          }
        }
        return 'document';
      }
      case 'MessageMediaGeo':
      case 'MessageMediaGeoLive':
        return 'location';
      case 'MessageMediaContact':
        return 'contact';
      default:
        return 'text';
    }
  }

  private async downloadAndUploadMedia(
    message: Api.Message,
    accountId: string,
  ): Promise<{ url: string; mimeType?: string } | null> {
    const uploadAdapter = this.config.media?.uploadAdapter;
    if (!uploadAdapter) return null;

    const client = this.accountManager.getClient(accountId);
    if (!client) return null;

    try {
      const buffer = await client.downloadMedia(message.media!, {}) as Buffer;
      if (!buffer || buffer.length === 0) return null;

      // Check file size limit
      const maxSizeMb = this.config.media?.maxFileSizeMb ?? DEFAULT_MAX_FILE_SIZE_MB;
      if (buffer.length > maxSizeMb * 1024 * 1024) {
        this.logger.warn('Media exceeds max file size', {
          accountId,
          sizeBytes: buffer.length,
          maxSizeMb,
        });
        return null;
      }

      const mimeType = this.extractMimeType(message);
      const filename = this.extractFilename(message) || `media_${Date.now()}`;

      const result = await uploadAdapter(buffer, filename, mimeType);
      return { url: result.url, mimeType: result.mimeType || mimeType };
    } catch (err) {
      this.logger.error('Failed to download/upload media', {
        error: err instanceof Error ? err.message : String(err),
      });
      return null;
    }
  }

  private extractMimeType(message: Api.Message): string {
    if (!message.media) return 'application/octet-stream';

    if (message.media.className === 'MessageMediaPhoto') return 'image/jpeg';

    if (message.media.className === 'MessageMediaDocument') {
      const doc = message.media as Api.MessageMediaDocument;
      if (doc.document && 'mimeType' in doc.document) {
        return (doc.document as any).mimeType || 'application/octet-stream';
      }
    }

    return 'application/octet-stream';
  }

  private extractFilename(message: Api.Message): string | null {
    if (!message.media || message.media.className !== 'MessageMediaDocument') return null;

    const doc = message.media as Api.MessageMediaDocument;
    if (doc.document && 'attributes' in doc.document) {
      const attrs = (doc.document as any).attributes || [];
      for (const attr of attrs) {
        if (attr.className === 'DocumentAttributeFilename' && attr.fileName) {
          return attr.fileName;
        }
      }
    }

    return null;
  }
}
