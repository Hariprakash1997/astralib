import { ChatMessage } from './message.types';
import { ChatAgentInfo, AgentIdentity } from './agent.types';
import { VisitorContext, ChatUserInfo } from './session.types';

// Re-export AgentIdentity from agent.types for convenience
export type { AgentIdentity } from './agent.types';

// Agent assignment adapter
export interface AssignAgentContext {
  visitorId: string;
  channel: string;
  preferences?: Record<string, unknown>;
  metadata?: Record<string, unknown>;
}

// AI response adapter
export interface AiCharacterProfile {
  name: string;
  tone: string;
  personality: string;
  rules: string[];
  responseStyle: string;
}

export interface AiResponseInput {
  sessionId: string;
  visitorId: string;
  messages: ChatMessage[];
  agent: ChatAgentInfo;
  visitorContext: VisitorContext;
  conversationSummary?: string;
  metadata?: Record<string, unknown>;
  aiCharacter?: AiCharacterProfile | null;
}

export interface AiResponseOutput {
  messages: string[];
  conversationSummary?: string;
  shouldEscalate?: boolean;
  escalationReason?: string;
  extracted?: Record<string, unknown>;
  memoryHints?: MemoryHint[];
  metadata?: Record<string, unknown>;
}

export interface MemoryHint {
  key: string;
  content: string;
  category?: string;
  confidence: number;
}

// Visitor identity adapter
export interface VisitorIdentity {
  userId: string;
  name?: string;
  email?: string;
  avatar?: string;
  metadata?: Record<string, unknown>;
}

// Event tracking adapter
export interface ChatTrackingEvent {
  sessionId: string;
  visitorId: string;
  eventType: string;
  description?: string;
  data?: Record<string, unknown>;
  channel: string;
  timestamp: Date;
}

// Chat metric (for onMetric hook)
export interface ChatMetric {
  name: string;
  value: number;
  labels: Record<string, string>;
}

// Error context (for onError hook)
export interface ErrorContext {
  sessionId?: string;
  visitorId?: string;
  agentId?: string;
  event?: string;
  [key: string]: unknown;
}
