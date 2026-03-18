import { Schema, Model, HydratedDocument } from 'mongoose';
import { SessionMode } from '@astralibx/chat-types';

export interface IChatSettings {
  key: string;
  defaultSessionMode: SessionMode;
  autoAssignEnabled: boolean;
  aiEnabled: boolean;
  requireAgentForChat?: boolean;
  visitorAgentSelection?: boolean;
  allowPerAgentMode?: boolean;
  metadata?: Record<string, unknown>;
  updatedAt: Date;
}

export type ChatSettingsDocument = HydratedDocument<IChatSettings>;

export type ChatSettingsModel = Model<IChatSettings>;

export function createChatSettingsSchema() {
  const schema = new Schema<IChatSettings>(
    {
      key: { type: String, required: true, unique: true, default: 'global' },
      defaultSessionMode: {
        type: String,
        enum: Object.values(SessionMode),
        default: SessionMode.AI,
      },
      autoAssignEnabled: { type: Boolean, default: true },
      aiEnabled: { type: Boolean, default: true },
      requireAgentForChat: { type: Boolean, default: false },
      visitorAgentSelection: { type: Boolean, default: false },
      allowPerAgentMode: { type: Boolean, default: false },
      metadata: { type: Schema.Types.Mixed, default: {} },
    },
    {
      timestamps: true,
    },
  );

  return schema;
}
