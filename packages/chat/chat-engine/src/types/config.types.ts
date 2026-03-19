import type { Connection } from 'mongoose';
import type { Redis } from 'ioredis';
import type { LogAdapter } from '@astralibx/core';
import type {
  ChatSessionSummary,
  ChatMessage,
  ChatAgentInfo,
  AgentIdentity,
  VisitorContext,
  SessionStats,
  AssignAgentContext,
  AiResponseInput,
  AiResponseOutput,
  VisitorIdentity,
  ChatTrackingEvent,
  ChatMetric,
  ErrorContext,
  ChatFeedback,
} from '@astralibx/chat-types';

export type { LogAdapter };

export interface ChatEngineConfig {
  /** If provided, enables multi-tenant mode — all data is scoped to this tenant */
  tenantId?: string;

  db: {
    connection: Connection;
    collectionPrefix?: string;
  };

  redis: {
    connection: Redis;
    keyPrefix?: string;
  };

  socket: {
    pingIntervalMs?: number;
    pingTimeoutMs?: number;
    cors?: {
      origin: string | string[];
      credentials?: boolean;
    };
    namespaces?: {
      visitor?: string;
      agent?: string;
    };
  };

  options?: {
    maxMessageLength?: number;
    rateLimitPerMinute?: number;
    sessionVisibilityMs?: number;
    sessionResumptionMs?: number;
    maxSessionHistory?: number;
    idleTimeoutMs?: number;
    sessionTimeoutCheckMs?: number;
    reconnectWindowMs?: number;
    pendingMessageTTLMs?: number;
    maxConcurrentChatsPerAgent?: number;
    aiDebounceMs?: number;
    aiTypingSimulation?: boolean;
    aiTypingSpeedCpm?: number;
    singleSessionPerVisitor?: boolean;
    trackEventsAsMessages?: boolean;
    labelingEnabled?: boolean;
    maxUploadSizeMb?: number;
    aiSimulation?: {
      deliveryDelay?: { min: number; max: number };
      readDelay?: { min: number; max: number };
      preTypingDelay?: { min: number; max: number };
      bubbleDelay?: { min: number; max: number };
      minTypingDuration?: number;
    };
  };

  adapters: {
    assignAgent?: (context: AssignAgentContext) => Promise<ChatAgentInfo | null>;
    generateAiResponse?: (input: AiResponseInput) => Promise<AiResponseOutput>;
    identifyVisitor?: (visitorId: string, identifyData: Record<string, unknown>) => Promise<VisitorIdentity | null>;
    trackEvent?: (event: ChatTrackingEvent) => Promise<void>;
    authenticateAgent?: (token: string) => Promise<AgentIdentity | null>;
    authenticateVisitor?: (context: VisitorContext) => Promise<boolean>;
    authenticateRequest?: (req: any) => Promise<{ userId: string; permissions?: string[] } | null>;
    uploadFile?: (file: { buffer: Buffer; mimetype: string; originalname: string }) => Promise<string>;
    enrichSessionContext?: (context: Record<string, unknown>) => Promise<Record<string, unknown>>;
    resolveUserIdentity?: (visitorContext: VisitorContext) => Promise<string | null>;
    fileStorage?: {
      upload(file: Buffer, fileName: string, mimeType: string): Promise<string>;
      delete(fileUrl: string): Promise<void>;
      getSignedUrl?(fileUrl: string, expiresIn?: number): Promise<string>;
    };
  };

  hooks?: {
    onSessionCreated?: (session: ChatSessionSummary) => void;
    onSessionResolved?: (session: ChatSessionSummary, stats: SessionStats) => void;
    onSessionAbandoned?: (session: ChatSessionSummary) => void;
    onSessionClosed?: (session: ChatSessionSummary) => void;
    onSessionTimeout?: (session: { sessionId: string; visitorId: string; channel: string; startedAt: Date }) => Promise<void>;
    onMessageSent?: (message: ChatMessage) => void;
    onAgentTakeOver?: (sessionId: string, agentId: string) => void;
    onAgentHandBack?: (sessionId: string) => void;
    onEscalation?: (sessionId: string, reason?: string) => void;
    onVisitorConnected?: (visitorId: string, sessionId: string) => void;
    onVisitorDisconnected?: (visitorId: string, sessionId: string) => void;
    onAgentTransfer?: (sessionId: string, fromAgentId: string, toAgentId: string) => void;
    onQueueJoin?: (sessionId: string, position: number) => void;
    onQueuePositionChanged?: (sessionId: string, position: number) => void;
    onFeedbackReceived?: (sessionId: string, feedback: ChatFeedback) => void;
    onOfflineMessage?: (data: { visitorId: string; formData: Record<string, unknown> }) => void;
    onSaveMemory?: (payload: { sessionId: string; visitorId: string; content: string; key?: string; category?: string }) => Promise<void>;
    onDeleteMemory?: (payload: { sessionId: string; memoryId: string }) => Promise<void>;
    onSessionArchive?: (session: { sessionId: string; visitorId: string; messages: unknown[]; metadata?: Record<string, unknown> }) => Promise<void>;
    onAiRequest?: (payload: { sessionId: string; stage: 'received' | 'processing' | 'completed' | 'failed'; durationMs?: number; metadata?: Record<string, unknown> }) => Promise<void>;
    onMetric?: (metric: ChatMetric) => void;
    onError?: (error: Error, context: ErrorContext) => void;
  };

  logger?: LogAdapter;
}

export interface ResolvedOptions {
  maxMessageLength: number;
  rateLimitPerMinute: number;
  sessionVisibilityMs: number;
  sessionResumptionMs: number;
  maxSessionHistory: number;
  idleTimeoutMs: number;
  sessionTimeoutCheckMs: number;
  reconnectWindowMs: number;
  pendingMessageTTLMs: number;
  maxConcurrentChatsPerAgent: number;
  aiDebounceMs: number;
  aiTypingSimulation: boolean;
  aiTypingSpeedCpm: number;
  singleSessionPerVisitor: boolean;
  trackEventsAsMessages: boolean;
  labelingEnabled: boolean;
  maxUploadSizeMb: number;
}

export interface AiSimulationConfig {
  deliveryDelay?: { min: number; max: number };
  readDelay?: { min: number; max: number };
  preTypingDelay?: { min: number; max: number };
  bubbleDelay?: { min: number; max: number };
  minTypingDuration?: number;
}

export const DEFAULT_OPTIONS: ResolvedOptions = {
  maxMessageLength: 5000,
  rateLimitPerMinute: 30,
  sessionVisibilityMs: 86_400_000,
  sessionResumptionMs: 86_400_000,
  maxSessionHistory: 50,
  idleTimeoutMs: 300_000,
  sessionTimeoutCheckMs: 30_000,
  reconnectWindowMs: 300_000,
  pendingMessageTTLMs: 86_400_000,
  maxConcurrentChatsPerAgent: 5,
  aiDebounceMs: 15_000,
  aiTypingSimulation: true,
  aiTypingSpeedCpm: 600,
  singleSessionPerVisitor: true,
  trackEventsAsMessages: false,
  labelingEnabled: false,
  maxUploadSizeMb: 5,
};
