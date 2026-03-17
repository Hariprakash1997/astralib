import type { Connection } from 'mongoose';
import type { Redis } from 'ioredis';
import type { LogAdapter } from '@astralibx/core';
import type { RuleTarget, RuleRunStats, PerRuleStats } from './rule.types';

export type { LogAdapter } from '@astralibx/core';

export interface SendMessageParams {
  identifierId: string;
  contactId: string;
  accountId: string;
  message: string;
  media?: {
    type: 'photo' | 'video' | 'voice' | 'audio' | 'document';
    url: string;
    caption?: string;
  };
  ruleId: string;
  templateId: string;
}

export interface AccountSelection {
  accountId: string;
  phone: string;
  metadata: Record<string, unknown>;
}

export interface RecipientIdentifier {
  id: string;
  contactId: string;
}

export interface BeforeSendParams {
  message: string;
  account: { id: string; phone: string; metadata: Record<string, unknown> };
  user: { id: string; contactId: string; name: string };
  context: { ruleId: string; templateId: string; runId: string };
  media?: SendMessageParams['media'];
}

export interface BeforeSendResult {
  message: string;
  media?: SendMessageParams['media'];
}

export interface RunProgress {
  rulesTotal: number;
  rulesCompleted: number;
  sent: number;
  failed: number;
  skipped: number;
  throttled: number;
}

export type RunStatus = 'running' | 'completed' | 'cancelled' | 'failed';

export interface RunStatusResponse {
  runId: string;
  status: RunStatus;
  currentRule: string;
  progress: RunProgress;
  startedAt: string;
  elapsed: number;
}

export interface TelegramRuleEngineConfig {
  db: {
    connection: Connection;
    collectionPrefix?: string;
  };

  redis: {
    connection: Redis;
    keyPrefix?: string;
  };

  adapters: {
    queryUsers: (target: RuleTarget, limit: number) => Promise<Record<string, unknown>[]>;
    resolveData: (user: Record<string, unknown>) => Record<string, unknown>;
    sendMessage: (params: SendMessageParams) => Promise<void>;
    selectAccount: (identifierId: string, context?: { ruleId: string; templateId: string }) => Promise<AccountSelection | null>;
    findIdentifier: (phoneOrUsername: string) => Promise<RecipientIdentifier | null>;
  };

  platforms?: string[];

  audiences?: string[];

  categories?: string[];

  logger?: LogAdapter;

  options?: {
    lockTTLMs?: number;
    defaultMaxPerRun?: number;
    sendWindow?: {
      startHour: number;
      endHour: number;
      timezone: string;
    };
    delayBetweenSendsMs?: number;
    jitterMs?: number;
    maxConsecutiveFailures?: number;
    thinkingPauseProbability?: number;
    batchProgressInterval?: number;
  };

  hooks?: {
    onRunStart?: (info: { rulesCount: number; triggeredBy: string; runId: string }) => void;
    onRuleStart?: (info: { ruleId: string; ruleName: string; matchedCount: number; templateId: string; runId: string }) => void;
    onSend?: (info: {
      ruleId: string;
      ruleName: string;
      identifierId: string;
      status: 'sent' | 'error' | 'skipped' | 'throttled';
      accountId: string;
      templateId: string;
      runId: string;
      messageIndex: number;
      failureReason?: string;
    }) => void;
    onRuleComplete?: (info: { ruleId: string; ruleName: string; stats: RuleRunStats; templateId: string; runId: string }) => void;
    onRunComplete?: (info: { duration: number; totalStats: RuleRunStats; perRuleStats: PerRuleStats[]; runId: string }) => void;
    beforeSend?: (params: BeforeSendParams) => Promise<BeforeSendResult>;
  };
}
