import { Schema, Model, HydratedDocument } from 'mongoose';
import { SESSION_STATUSES } from '../constants';

export interface ITelegramConversationSession {
  accountId: string;
  contactId: string;
  identifierId?: string;
  conversationId: string;
  status: 'active' | 'paused' | 'closed';
  startedAt: Date;
  endedAt?: Date;
  messageCount: number;
  lastMessageAt?: Date;

  createdAt: Date;
  updatedAt: Date;
}

export type TelegramConversationSessionDocument = HydratedDocument<ITelegramConversationSession>;

export type TelegramConversationSessionModel = Model<ITelegramConversationSession>;

export function createTelegramConversationSessionSchema(prefix?: string) {
  const schema = new Schema<ITelegramConversationSession, TelegramConversationSessionModel>(
    {
      accountId: { type: String, required: true },
      contactId: { type: String, required: true },
      identifierId: String,
      conversationId: { type: String, required: true },
      status: {
        type: String,
        enum: SESSION_STATUSES,
        default: 'active',
      },
      startedAt: { type: Date, default: Date.now },
      endedAt: Date,
      messageCount: { type: Number, default: 0 },
      lastMessageAt: Date,
    },
    {
      timestamps: true,
      collection: `${prefix || ''}telegram_conversation_sessions`,
    },
  );

  schema.index({ accountId: 1, contactId: 1 });
  schema.index({ conversationId: 1 });
  schema.index({ status: 1 });

  return schema;
}
