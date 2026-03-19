import type { Connection } from 'mongoose';
import type { Redis } from 'ioredis';
import type { LogAdapter } from '@astralibx/core';
import type { RuleTarget, RuleRunStats, PerRuleStats } from './rule.types';
import type { CollectionSchema, JoinDefinition } from './collection.types';

export type { LogAdapter } from '@astralibx/core';

export interface SendParams {
  identifierId: string;
  contactId: string;
  accountId: string;
  subject?: string;
  body: string;
  textBody?: string;
  ruleId: string;
  autoApprove: boolean;
  metadata?: Record<string, unknown>;
}

export interface AgentSelection {
  accountId: string;
  contactValue: string;
  metadata: Record<string, unknown>;
}

export interface RecipientIdentifier {
  id: string;
  contactId: string;
}

export interface BeforeSendParams {
  body: string;
  textBody?: string;
  subject?: string;
  account: { id: string; contactValue: string; metadata: Record<string, unknown> };
  user: { id: string; contactValue: string; name: string };
  context: { ruleId: string; templateId: string; runId: string };
}

export interface BeforeSendResult {
  body: string;
  textBody?: string;
  subject?: string;
}

export interface RuleEngineAdapters {
  queryUsers: (
    target: RuleTarget,
    limit: number,
    context?: { collectionSchema?: CollectionSchema; activeJoins?: JoinDefinition[] }
  ) => Promise<Record<string, unknown>[]>;
  resolveData: (user: Record<string, unknown>) => Record<string, unknown>;
  send: (params: SendParams) => Promise<void>;
  selectAgent: (
    identifierId: string,
    context?: { ruleId: string; templateId: string }
  ) => Promise<AgentSelection | null>;
  findIdentifier: (contactValue: string) => Promise<RecipientIdentifier | null>;
  sendTest?: (
    to: string, body: string, subject?: string, metadata?: Record<string, unknown>
  ) => Promise<void>;
}

export interface RuleEngineConfig {
  db: { connection: Connection; collectionPrefix?: string };
  redis: { connection: Redis; keyPrefix?: string };
  adapters: RuleEngineAdapters;
  collections?: CollectionSchema[];
  platforms?: string[];
  audiences?: string[];
  categories?: string[];
  logger?: LogAdapter;
  options?: {
    lockTTLMs?: number;
    defaultMaxPerRun?: number;
    sendWindow?: { startHour: number; endHour: number; timezone: string };
    delayBetweenSendsMs?: number;
    jitterMs?: number;
  };
  hooks?: {
    onRunStart?: (info: { rulesCount: number; triggeredBy: string; runId: string }) => void;
    onRuleStart?: (info: { ruleId: string; ruleName: string; matchedCount: number; templateId: string; runId: string }) => void;
    onSend?: (info: {
      ruleId: string; ruleName: string; contactValue: string; status: string;
      accountId: string; templateId: string; runId: string;
      subjectIndex?: number; bodyIndex?: number; failureReason?: string;
    }) => void;
    onRuleComplete?: (info: { ruleId: string; ruleName: string; stats: RuleRunStats; templateId: string; runId: string }) => void;
    onRunComplete?: (info: { duration: number; totalStats: RuleRunStats; perRuleStats: PerRuleStats[]; runId: string }) => void;
    beforeSend?: (params: BeforeSendParams) => Promise<BeforeSendResult>;
  };
}
