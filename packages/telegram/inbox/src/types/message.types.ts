import type { SenderType, MessageDirection, ContentType } from './config.types';

export interface CreateMessageInput {
  accountId: string;
  conversationId: string;
  messageId: string;
  senderId: string;
  senderType: SenderType;
  direction: MessageDirection;
  contentType: ContentType;
  content: string;
  mediaType?: string;
  mediaUrl?: string;
}

export interface MessageFilters {
  conversationId?: string;
  direction?: MessageDirection;
  contentType?: ContentType;
  startDate?: Date;
  endDate?: Date;
}
