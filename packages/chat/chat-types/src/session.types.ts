import { ChatSessionStatus, SessionMode } from './enums';
import { ChatAgentInfo } from './agent.types';

export interface ChatSessionSummary {
  sessionId: string;
  status: ChatSessionStatus;
  mode: SessionMode;
  visitorId: string;
  visitorName?: string;
  agentId?: string;
  agentName?: string;
  messageCount: number;
  lastMessageAt?: Date;
  startedAt: Date;
  endedAt?: Date;
  channel?: string;
  queuePosition?: number;
  metadata?: Record<string, unknown>;
}

export interface VisitorContext {
  visitorId: string;
  fingerprint?: string;
  channel: string;
  userAgent?: string;
  page?: string;
  referrer?: string;
  user?: ChatUserInfo;
  metadata?: Record<string, unknown>;
}

export interface ChatUserInfo {
  userId?: string;
  name?: string;
  email?: string;
  avatar?: string;
  metadata?: Record<string, unknown>;
}

export interface SessionStats {
  totalMessages: number;
  visitorMessages: number;
  agentMessages: number;
  aiMessages: number;
  durationMs: number;
}

export interface ChatFeedback {
  rating?: number;
  survey?: Record<string, unknown>;
  submittedAt?: Date;
}
