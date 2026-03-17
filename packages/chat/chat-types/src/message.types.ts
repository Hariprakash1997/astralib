import { ChatSenderType, ChatContentType, ChatMessageStatus } from './enums';

export interface ChatMessage {
  _id: string;
  messageId: string;
  sessionId: string;
  senderType: ChatSenderType;
  senderName?: string;
  content: string;
  contentType: ChatContentType;
  status: ChatMessageStatus;
  metadata?: Record<string, unknown>;
  createdAt: Date;
  deliveredAt?: Date;
  readAt?: Date;
}

export interface MessagePayload {
  content: string;
  contentType?: ChatContentType;
  tempId?: string;
  metadata?: Record<string, unknown>;
}

export interface MessageReceivedPayload {
  message: ChatMessage;
  tempId?: string;
}

export interface MessageStatusPayload {
  messageId: string;
  status: ChatMessageStatus;
  deliveredAt?: Date;
  readAt?: Date;
}
