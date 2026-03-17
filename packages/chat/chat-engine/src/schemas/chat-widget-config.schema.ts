import { Schema, Model, HydratedDocument } from 'mongoose';

export interface IChatWidgetConfig {
  key: string;
  preChatFlow?: Record<string, unknown>;
  branding?: {
    primaryColor?: string;
    companyName?: string;
    logoUrl?: string;
  };
  features?: {
    soundNotifications?: boolean;
    desktopNotifications?: boolean;
    typingIndicator?: boolean;
    readReceipts?: boolean;
    autoOpen?: boolean;
    autoOpenDelayMs?: number;
    liveChatEnabled?: boolean;
  };
  translations?: Record<string, string>;
  position?: string;
  theme?: string;
  metadata?: Record<string, unknown>;
  updatedAt: Date;
  updatedBy?: string;
}

export type ChatWidgetConfigDocument = HydratedDocument<IChatWidgetConfig>;

export type ChatWidgetConfigModel = Model<IChatWidgetConfig>;

export function createChatWidgetConfigSchema() {
  const schema = new Schema<IChatWidgetConfig>(
    {
      key: { type: String, required: true, unique: true, default: 'global' },
      preChatFlow: { type: Schema.Types.Mixed },
      branding: {
        type: {
          primaryColor: { type: String },
          companyName: { type: String },
          logoUrl: { type: String },
        },
        _id: false,
      },
      features: {
        type: {
          soundNotifications: { type: Boolean },
          desktopNotifications: { type: Boolean },
          typingIndicator: { type: Boolean },
          readReceipts: { type: Boolean },
          autoOpen: { type: Boolean },
          autoOpenDelayMs: { type: Number },
          liveChatEnabled: { type: Boolean },
        },
        _id: false,
      },
      translations: { type: Schema.Types.Mixed, default: {} },
      position: { type: String, default: 'bottom-right' },
      theme: { type: String, default: 'light' },
      metadata: { type: Schema.Types.Mixed, default: {} },
      updatedBy: { type: String },
    },
    {
      timestamps: true,
    },
  );

  return schema;
}
