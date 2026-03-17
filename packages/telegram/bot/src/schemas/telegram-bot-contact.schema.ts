import { Schema, type Model, type Document } from 'mongoose';

export interface BotInteraction {
  botUsername: string;
  botId: string;
  status: 'active' | 'blocked' | 'stopped';
  interactionCount: number;
  firstInteractionAt: Date;
  lastInteractionAt: Date;
  blockedAt?: Date;
  blockReason?: string;
}

export interface TelegramBotContactDocument extends Document {
  telegramUserId: string;
  firstName: string;
  lastName?: string;
  username?: string;
  languageCode?: string;
  interactions: BotInteraction[];
  createdAt: Date;
  updatedAt: Date;
}

export type TelegramBotContactModel = Model<TelegramBotContactDocument>;

export function createTelegramBotContactSchema(
  options?: { collectionName?: string },
): Schema<TelegramBotContactDocument> {
  const interactionSchema = new Schema<BotInteraction>(
    {
      botUsername: { type: String, required: true },
      botId: { type: String, required: true },
      status: { type: String, enum: ['active', 'blocked', 'stopped'], default: 'active' },
      interactionCount: { type: Number, default: 1 },
      firstInteractionAt: { type: Date, default: Date.now },
      lastInteractionAt: { type: Date, default: Date.now },
      blockedAt: { type: Date },
      blockReason: { type: String },
    },
    { _id: false },
  );

  const schema = new Schema<TelegramBotContactDocument>(
    {
      telegramUserId: { type: String, required: true, index: true },
      firstName: { type: String, required: true },
      lastName: { type: String },
      username: { type: String },
      languageCode: { type: String },
      interactions: { type: [interactionSchema], default: [] },
    },
    {
      timestamps: true,
      collection: options?.collectionName,
    },
  );

  schema.index({ 'interactions.botUsername': 1 });
  schema.index({ telegramUserId: 1, 'interactions.botUsername': 1 }, { unique: true });

  return schema;
}
