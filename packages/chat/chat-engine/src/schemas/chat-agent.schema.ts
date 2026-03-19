import { Schema, Types, Model, HydratedDocument } from 'mongoose';
import { AgentStatus } from '@astralibx/chat-types';
import { MODE_OVERRIDE_VALUES, AGENT_VISIBILITY_VALUES, AGENT_VISIBILITY, type ModeOverride, type AgentVisibility } from '../constants/index.js';
import type { IAiCharacterProfile } from './chat-settings.schema.js';

export interface IChatAgent {
  name: string;
  avatar?: string;
  role?: string;
  isActive: boolean;
  isOnline: boolean;
  status: AgentStatus;
  isAI: boolean;
  aiConfig?: Record<string, unknown>;
  promptTemplateId?: string;
  maxConcurrentChats: number;
  activeChats: number;
  totalChatsHandled: number;
  modeOverride?: ModeOverride | null;
  aiEnabled?: boolean;
  autoAccept?: boolean;
  aiCharacter?: IAiCharacterProfile | null;
  visibility?: AgentVisibility;
  isDefault?: boolean;
  tenantId?: string;
  metadata?: Record<string, unknown>;
  // Hierarchy (adjacency list)
  level: number;
  parentId: Types.ObjectId | null;
  teamId: string | null;
  createdAt: Date;
  updatedAt: Date;
}

export type ChatAgentDocument = HydratedDocument<IChatAgent>;

export type ChatAgentModel = Model<IChatAgent>;

export function createChatAgentSchema() {
  const schema = new Schema<IChatAgent>(
    {
      name: { type: String, required: true },
      avatar: { type: String },
      role: { type: String },
      isActive: { type: Boolean, default: true, index: true },
      isOnline: { type: Boolean, default: false, index: true },
      status: {
        type: String,
        enum: Object.values(AgentStatus),
        default: AgentStatus.Offline,
        index: true,
      },
      isAI: { type: Boolean, default: false },
      aiConfig: { type: Schema.Types.Mixed },
      promptTemplateId: { type: String },
      maxConcurrentChats: { type: Number, default: 5 },
      activeChats: { type: Number, default: 0 },
      totalChatsHandled: { type: Number, default: 0 },
      modeOverride: { type: String, enum: [...MODE_OVERRIDE_VALUES, null], default: null },
      aiEnabled: { type: Boolean, default: undefined },
      autoAccept: { type: Boolean, default: false },
      aiCharacter: {
        type: new Schema(
          {
            name: { type: String, required: true },
            tone: { type: String, required: true },
            personality: { type: String, required: true },
            rules: { type: [String], default: [] },
            responseStyle: { type: String, required: true },
          },
          { _id: false },
        ),
        default: null,
      },
      visibility: { type: String, enum: AGENT_VISIBILITY_VALUES, default: AGENT_VISIBILITY.Internal },
      isDefault: { type: Boolean, default: false },
      tenantId: { type: String, index: true, sparse: true },
      metadata: { type: Schema.Types.Mixed, default: {} },
      // Hierarchy (adjacency list)
      level: { type: Number, default: 1, index: true },
      parentId: { type: Schema.Types.ObjectId, ref: 'ChatAgent', default: null, index: true },
      teamId: { type: String, default: null, index: true },
    },
    {
      timestamps: true,
    },
  );

  return schema;
}
