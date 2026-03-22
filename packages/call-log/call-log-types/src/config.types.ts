import type { ICallLog } from './call-log.types';
import type { AgentInfo, ContactInfo, AuthResult } from './adapter.types';
import type { CallLogMetric } from './analytics.types';

export interface CallLogEngineConfig {
  db: {
    connection: unknown;
    collectionPrefix?: string;
  };

  logger?: {
    info: (...args: unknown[]) => void;
    warn: (...args: unknown[]) => void;
    error: (...args: unknown[]) => void;
    debug: (...args: unknown[]) => void;
  };

  agents: {
    collectionName?: string;
    resolveAgent?: (agentId: string) => Promise<AgentInfo | null>;
  };

  adapters: {
    lookupContact: (query: { phone?: string; email?: string; externalId?: string }) => Promise<ContactInfo | null>;
    addContact?: (data: { displayName: string; phone?: string; email?: string; metadata?: Record<string, unknown> }) => Promise<ContactInfo>;
    authenticateAgent: (token: string) => Promise<AuthResult | null>;
  };

  hooks?: {
    onCallCreated?: (callLog: ICallLog) => void | Promise<void>;
    onStageChanged?: (callLog: ICallLog, fromStage: string, toStage: string) => void | Promise<void>;
    onCallClosed?: (callLog: ICallLog) => void | Promise<void>;
    onCallAssigned?: (callLog: ICallLog, previousAgentId?: string) => void | Promise<void>;
    onFollowUpDue?: (callLog: ICallLog) => void | Promise<void>;
    onMetric?: (metric: CallLogMetric) => void | Promise<void>;
  };

  options?: {
    maxTimelineEntries?: number;
    followUpCheckIntervalMs?: number;
    enableAgentScoping?: boolean;
  };
}

export const DEFAULT_OPTIONS = {
  maxTimelineEntries: 200,
  followUpCheckIntervalMs: 60_000,
  enableAgentScoping: true,
} as const;

export interface ResolvedOptions {
  maxTimelineEntries: number;
  followUpCheckIntervalMs: number;
  enableAgentScoping: boolean;
}
