import type { Connection } from 'mongoose';
import type { Redis } from 'ioredis';
import type { LogAdapter } from '@astralibx/core';
import type { RuleTarget, RuleRunStats, PerRuleStats } from './rule.types';

export type { LogAdapter } from '@astralibx/core';

export interface SendEmailParams {
  identifierId: string;
  contactId: string;
  accountId: string;
  subject: string;
  htmlBody: string;
  textBody: string;
  ruleId: string;
  autoApprove: boolean;
}

export interface AgentSelection {
  accountId: string;
  email: string;
  metadata: Record<string, unknown>;
}

export interface BeforeSendParams {
  htmlBody: string;
  textBody: string;
  subject: string;
  account: { id: string; email: string; metadata: Record<string, unknown> };
  user: { id: string; email: string; name: string };
  context: {
    ruleId: string;
    templateId: string;
    runId: string;
  };
}

export interface BeforeSendResult {
  htmlBody: string;
  textBody: string;
  subject: string;
}

export interface RecipientIdentifier {
  id: string;
  contactId: string;
}

export interface RunProgress {
  rulesTotal: number;
  rulesCompleted: number;
  sent: number;
  failed: number;
  skipped: number;
  invalid: number;
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

export interface EmailRuleEngineConfig {
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
    sendEmail: (params: SendEmailParams) => Promise<void>;
    selectAgent: (identifierId: string, context?: { ruleId: string; templateId: string }) => Promise<AgentSelection | null>;
    findIdentifier: (email: string) => Promise<RecipientIdentifier | null>;
    sendTestEmail?: (to: string, subject: string, html: string, text: string) => Promise<void>;
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
  };

  hooks?: {
    onRunStart?: (info: { rulesCount: number; triggeredBy: string }) => void;
    onRuleStart?: (info: { ruleId: string; ruleName: string; matchedCount: number }) => void;
    onSend?: (info: { ruleId: string; ruleName: string; email: string; status: 'sent' | 'error' | 'skipped' | 'invalid' | 'throttled' }) => void;
    onRuleComplete?: (info: { ruleId: string; ruleName: string; stats: RuleRunStats }) => void;
    onRunComplete?: (info: { duration: number; totalStats: RuleRunStats; perRuleStats: PerRuleStats[] }) => void;
    beforeSend?: (params: BeforeSendParams) => Promise<BeforeSendResult>;
  };
}
