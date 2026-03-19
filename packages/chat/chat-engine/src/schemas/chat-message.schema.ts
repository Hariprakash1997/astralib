import { Schema, Model, HydratedDocument } from 'mongoose';
import {
  ChatSenderType,
  ChatContentType,
  ChatMessageStatus,
} from '@astralibx/chat-types';
import { TRAINING_QUALITY_VALUES, type TrainingQuality } from '../constants/index.js';

export interface IChatMessage {
  messageId: string;
  sessionId: string;
  senderType: ChatSenderType;
  senderName?: string;
  content: string;
  contentType: ChatContentType;
  status: ChatMessageStatus;
  trainingQuality?: TrainingQuality | null;
  aiGenerated?: boolean;
  tenantId?: string;
  metadata?: Record<string, unknown>;
  createdAt: Date;
  deliveredAt?: Date;
  readAt?: Date;
}

export type ChatMessageDocument = HydratedDocument<IChatMessage>;

export type ChatMessageModel = Model<IChatMessage>;

export function createChatMessageSchema() {
  const schema = new Schema<IChatMessage>(
    {
      messageId: { type: String, required: true, unique: true },
      sessionId: { type: String, required: true, index: true },
      senderType: {
        type: String,
        enum: Object.values(ChatSenderType),
        required: true,
      },
      senderName: { type: String },
      content: { type: String, required: true },
      contentType: {
        type: String,
        enum: Object.values(ChatContentType),
        default: ChatContentType.Text,
      },
      status: {
        type: String,
        enum: Object.values(ChatMessageStatus),
        default: ChatMessageStatus.Sent,
        index: true,
      },
      trainingQuality: {
        type: String,
        enum: [...TRAINING_QUALITY_VALUES, null],
        default: null,
      },
      aiGenerated: { type: Boolean, default: false },
      tenantId: { type: String, index: true, sparse: true },
      metadata: { type: Schema.Types.Mixed, default: {} },
      createdAt: { type: Date, default: Date.now },
      deliveredAt: { type: Date },
      readAt: { type: Date },
    },
    {
      timestamps: false,
    },
  );

  schema.index({ sessionId: 1, createdAt: 1 });

  return schema;
}
