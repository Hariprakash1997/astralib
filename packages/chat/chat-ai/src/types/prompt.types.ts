import type { ChatMessage } from '@astralibx/chat-types';

export interface PromptSection {
  key: string;
  label: string;
  content: string;
  position: number;
  isEnabled: boolean;
  isSystem: boolean;
  variables?: string[];
}

export interface ChatPromptTemplate {
  templateId: string;
  name: string;
  description?: string;
  isDefault: boolean;
  isActive: boolean;
  sections: PromptSection[];
  responseFormat?: string;
  temperature?: number;
  maxTokens?: number;
  metadata?: Record<string, unknown>;
  createdAt: Date;
  updatedAt: Date;
  createdBy?: string;
}

export interface CreatePromptInput {
  name: string;
  description?: string;
  isDefault?: boolean;
  isActive?: boolean;
  sections: PromptSection[];
  responseFormat?: string;
  temperature?: number;
  maxTokens?: number;
  metadata?: Record<string, unknown>;
  createdBy?: string;
}

export interface UpdatePromptInput {
  name?: string;
  description?: string;
  isDefault?: boolean;
  isActive?: boolean;
  sections?: PromptSection[];
  responseFormat?: string;
  temperature?: number;
  maxTokens?: number;
  metadata?: Record<string, unknown>;
}

export interface PromptListQuery {
  isActive?: boolean;
  search?: string;
}

export interface PromptBuildContext {
  agentName: string;
  agentId?: string;
  visitorId: string;
  channel: string;
  message: string;
  recentMessages: ChatMessage[];
  conversationSummary?: string;
  variables?: Record<string, string>;
}

export interface PromptBuildInput {
  templateId?: string | null;
  context: PromptBuildContext;
}

export interface PromptOutput {
  systemPrompt: string;
  userMessage: string;
  templateId: string | null;
  resolvedVariables: Record<string, string>;
}

export interface ParsedAIResponse {
  messages: string[];
  conversationSummary?: string;
  shouldEscalate?: boolean;
  escalationReason?: string;
  extracted?: Record<string, unknown>;
  metadata?: Record<string, unknown>;
}
