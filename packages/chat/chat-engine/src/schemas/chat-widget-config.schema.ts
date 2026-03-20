import { Schema, Model, HydratedDocument } from 'mongoose';
import { WIDGET_DEFAULT } from '../constants/index.js';

export interface IChatWidgetConfig {
  key: string;
  preChatFlow?: Record<string, unknown>;
  branding?: {
    primaryColor?: string;
    secondaryColor?: string;
    backgroundColor?: string;
    textColor?: string;
    companyName?: string;
    logoUrl?: string;
    buttonIcon?: string;
    buttonShape?: 'circle' | 'rounded' | 'square';
    customCss?: string;
    showPoweredBy?: boolean;
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
  tenantId?: string;
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
          secondaryColor: { type: String, default: null },
          backgroundColor: { type: String, default: null },
          textColor: { type: String, default: null },
          companyName: { type: String },
          logoUrl: { type: String },
          buttonIcon: { type: String, default: null },
          buttonShape: { type: String, enum: ['circle', 'rounded', 'square'], default: 'circle' },
          customCss: { type: String, default: null },
          showPoweredBy: { type: Boolean, default: true },
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
      position: { type: String, default: WIDGET_DEFAULT.Position },
      theme: { type: String, default: WIDGET_DEFAULT.Theme },
      tenantId: { type: String, index: true, sparse: true },
      metadata: { type: Schema.Types.Mixed, default: {} },
      updatedBy: { type: String },
    },
    {
      timestamps: true,
    },
  );

  return schema;
}
