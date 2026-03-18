import { Schema, Model, HydratedDocument } from 'mongoose';
import { SENDER_TYPES, MESSAGE_DIRECTIONS, CONTENT_TYPES, CONTENT_TEXT } from '../constants';

export interface ITelegramMessage {
  accountId: string;
  conversationId: string;
  messageId: string;
  senderId: string;
  senderType: 'account' | 'user';
  direction: 'inbound' | 'outbound';
  contentType: 'text' | 'photo' | 'video' | 'voice' | 'audio' | 'document' | 'sticker' | 'location' | 'contact';
  content: string;
  mediaType?: string;
  mediaUrl?: string;
  readAt?: Date;

  createdAt: Date;
  updatedAt: Date;
}

export type TelegramMessageDocument = HydratedDocument<ITelegramMessage>;

export type TelegramMessageModel = Model<ITelegramMessage>;

export function createTelegramMessageSchema(prefix?: string) {
  const schema = new Schema<ITelegramMessage, TelegramMessageModel>(
    {
      accountId: { type: String, required: true },
      conversationId: { type: String, required: true },
      messageId: { type: String, required: true },
      senderId: { type: String, required: true },
      senderType: {
        type: String,
        enum: SENDER_TYPES,
        required: true,
      },
      direction: {
        type: String,
        enum: MESSAGE_DIRECTIONS,
        required: true,
      },
      contentType: {
        type: String,
        enum: CONTENT_TYPES,
        default: CONTENT_TEXT,
      },
      content: { type: String, default: '' },
      mediaType: String,
      mediaUrl: String,
      readAt: Date,
    },
    {
      timestamps: true,
      collection: `${prefix || ''}telegram_messages`,
    },
  );

  schema.index({ accountId: 1, conversationId: 1, createdAt: -1 });
  schema.index({ conversationId: 1, createdAt: -1 });
  schema.index({ messageId: 1 }, { unique: true });
  schema.index({ accountId: 1, direction: 1, readAt: 1 });

  return schema;
}
