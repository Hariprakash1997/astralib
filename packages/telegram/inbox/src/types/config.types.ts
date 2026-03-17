import type { Connection } from 'mongoose';
import type { LogAdapter } from '@astralibx/core';
import type { TelegramAccountManager } from '@astralibx/telegram-account-manager';

export type { LogAdapter };

export type ContentType = 'text' | 'photo' | 'video' | 'voice' | 'audio' | 'document' | 'sticker' | 'location' | 'contact';
export type MessageDirection = 'inbound' | 'outbound';
export type SenderType = 'account' | 'user';
export type SessionStatus = 'active' | 'paused' | 'closed';

export interface MediaUploadResult {
  url: string;
  mimeType?: string;
  fileSize?: number;
}

export interface InboxMessage {
  conversationId: string;
  messageId: string;
  senderId: string;
  senderType: SenderType;
  direction: MessageDirection;
  contentType: ContentType;
  content: string;
  mediaUrl?: string;
  mediaType?: string;
  createdAt: Date;
}

export interface TelegramInboxConfig {
  accountManager: TelegramAccountManager;
  db: {
    connection: Connection;
    collectionPrefix?: string;
  };
  media?: {
    uploadAdapter?: (buffer: Buffer, filename: string, mimeType: string) => Promise<MediaUploadResult>;
    maxFileSizeMb?: number; // default 50
  };
  options?: {
    historySyncLimit?: number; // default 100, max messages per chat on sync
    autoAttachOnConnect?: boolean; // default true
    typingTimeoutMs?: number; // default 5000
  };
  logger?: LogAdapter;
  hooks?: {
    onNewMessage?: (message: InboxMessage) => void;
    onMessageRead?: (info: { messageId: string; chatId: string; readAt: Date }) => void;
    onTyping?: (info: { chatId: string; userId: string; accountId: string }) => void;
  };
}
