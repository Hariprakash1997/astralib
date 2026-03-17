import { Schema, Model, HydratedDocument } from 'mongoose';
import { SENDER_TYPES, MESSAGE_DIRECTIONS, CONTENT_TYPES } from '../constants';

export interface ITelegramMessage {
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
        default: 'text',
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

  schema.index({ conversationId: 1, createdAt: -1 });
  schema.index({ messageId: 1 }, { unique: true });
  schema.index({ senderId: 1 });
  schema.index({ direction: 1 });

  return schema;
}
