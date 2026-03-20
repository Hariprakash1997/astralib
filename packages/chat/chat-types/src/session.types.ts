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
  userCategory?: string | null;
  tags?: string[];
  metadata?: Record<string, unknown>;
}

export interface VisitorAnalytics {
  ip?: string | null;
  browser?: string | null;
  os?: string | null;
  screenResolution?: string | null;
  currentPage?: string | null;
  currentPageTitle?: string | null;
  location?: string | null;
}

export interface VisitorContext {
  visitorId: string;
  fingerprint?: string;
  channel: string;
  userAgent?: string;
  page?: string;
  referrer?: string;
  user?: ChatUserInfo;
  analytics?: VisitorAnalytics;
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
  ratingType?: string;
  ratingValue?: number | string;
  followUpSelections?: string[];
  comment?: string;
}
