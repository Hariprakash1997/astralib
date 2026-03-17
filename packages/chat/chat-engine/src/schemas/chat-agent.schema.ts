import { Schema, Model, HydratedDocument } from 'mongoose';
import { AgentStatus } from '@astralibx/chat-types';

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
  metadata?: Record<string, unknown>;
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
      metadata: { type: Schema.Types.Mixed, default: {} },
    },
    {
      timestamps: true,
    },
  );

  return schema;
}
