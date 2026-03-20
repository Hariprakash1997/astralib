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
  resolvedAt?: Date;
  closedAt?: Date;
  escalatedAt?: Date;
  visibleUntil?: Date;
  queuePosition?: number;
  conversationSummary?: string;
  preferences?: Record<string, unknown>;
  feedback?: {
    rating?: number;
    survey?: Record<string, unknown>;
    ratingType?: string;
    ratingValue?: number | string;
    followUpSelections?: string[];
    comment?: string;
    submittedAt?: Date;
  };
  userInfo?: {
    name?: string | null;
    email?: string | null;
    mobile?: string | null;
  };
  analytics?: {
    ip?: string | null;
    browser?: string | null;
    os?: string | null;
    screenResolution?: string | null;
    currentPage?: string | null;
    currentPageTitle?: string | null;
    location?: string | null;
  };
  agentNotes: string[];
  isDeletedForUser: boolean;
  userCategory?: string | null;
  tags: string[];
  tenantId?: string;
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
        index: true,
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
      resolvedAt: { type: Date, index: true },
      closedAt: { type: Date },
      escalatedAt: { type: Date, index: true },
      visibleUntil: { type: Date, index: true },
      queuePosition: { type: Number, index: true },
      conversationSummary: { type: String },
      preferences: { type: Schema.Types.Mixed, default: {} },
      feedback: {
        type: {
          rating: { type: Number, min: 1, max: 5 },
          survey: { type: Schema.Types.Mixed },
          ratingType: { type: String },
          ratingValue: { type: Schema.Types.Mixed },
          followUpSelections: { type: [String], default: undefined },
          comment: { type: String },
          submittedAt: { type: Date },
        },
        _id: false,
      },
      userInfo: {
        type: {
          name: { type: String, default: null },
          email: { type: String, default: null },
          mobile: { type: String, default: null },
        },
        _id: false,
      },
      analytics: {
        type: {
          ip: { type: String, default: null },
          browser: { type: String, default: null },
          os: { type: String, default: null },
          screenResolution: { type: String, default: null },
          currentPage: { type: String, default: null },
          currentPageTitle: { type: String, default: null },
          location: { type: String, default: null },
        },
        _id: false,
      },
      agentNotes: { type: [String], default: [] },
      isDeletedForUser: { type: Boolean, default: false },
      userCategory: { type: String, default: null, index: true },
      tags: { type: [String], default: [], index: true },
      tenantId: { type: String, index: true, sparse: true },
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
