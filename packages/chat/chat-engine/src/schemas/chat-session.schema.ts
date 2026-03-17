import { Schema, Model, HydratedDocument } from 'mongoose';
import {
  ChatSessionStatus,
  SessionMode,
} from '@astralibx/chat-types';

export interface IChatSession {
  sessionId: string;
  visitorId: string;
  visitorFingerprint?: string;
  status: ChatSessionStatus;
  mode: SessionMode;
  channel: string;
  agentId?: string;
  takenOverBy?: string;
  transferredFrom?: string;
  transferNote?: string;
  messageCount: number;
  lastMessageAt?: Date;
  startedAt: Date;
  endedAt?: Date;
  escalatedAt?: Date;
  visibleUntil?: Date;
  queuePosition?: number;
  conversationSummary?: string;
  preferences?: Record<string, unknown>;
  feedback?: {
    rating?: number;
    survey?: Record<string, unknown>;
    submittedAt?: Date;
  };
  metadata?: Record<string, unknown>;
  createdAt: Date;
  updatedAt: Date;
}

export type ChatSessionDocument = HydratedDocument<IChatSession>;

export type ChatSessionModel = Model<IChatSession>;

export function createChatSessionSchema() {
  const schema = new Schema<IChatSession>(
    {
      sessionId: { type: String, required: true, unique: true },
      visitorId: { type: String, required: true, index: true },
      visitorFingerprint: { type: String },
      status: {
        type: String,
        enum: Object.values(ChatSessionStatus),
        default: ChatSessionStatus.New,
        index: true,
      },
      mode: {
        type: String,
        enum: Object.values(SessionMode),
        default: SessionMode.AI,
      },
      channel: { type: String, required: true, index: true },
      agentId: { type: String, index: true },
      takenOverBy: { type: String },
      transferredFrom: { type: String },
      transferNote: { type: String },
      messageCount: { type: Number, default: 0 },
      lastMessageAt: { type: Date, index: true },
      startedAt: { type: Date, default: Date.now },
      endedAt: { type: Date },
      escalatedAt: { type: Date, index: true },
      visibleUntil: { type: Date, index: true },
      queuePosition: { type: Number },
      conversationSummary: { type: String },
      preferences: { type: Schema.Types.Mixed, default: {} },
      feedback: {
        type: {
          rating: { type: Number, min: 1, max: 5 },
          survey: { type: Schema.Types.Mixed },
          submittedAt: { type: Date },
        },
        _id: false,
      },
      metadata: { type: Schema.Types.Mixed, default: {} },
    },
    {
      timestamps: true,
    },
  );

  schema.index({ status: 1, lastMessageAt: -1 });
  schema.index({ visitorId: 1, status: 1 });

  return schema;
}
