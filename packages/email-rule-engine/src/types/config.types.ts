import type { Connection } from 'mongoose';
import type { Redis } from 'ioredis';
import { RuleTarget } from './rule.types';

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
}

export interface RecipientIdentifier {
  id: string;
  contactId: string;
}

export interface LogAdapter {
  info: (msg: string, meta?: Record<string, unknown>) => void;
  warn: (msg: string, meta?: Record<string, unknown>) => void;
  error: (msg: string, meta?: Record<string, unknown>) => void;
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
    selectAgent: (identifierId: string) => Promise<AgentSelection | null>;
    findIdentifier: (email: string) => Promise<RecipientIdentifier | null>;
    sendTestEmail?: (to: string, subject: string, html: string, text: string) => Promise<void>;
  };

  platforms?: string[];

  audiences?: string[];

  logger?: LogAdapter;

  options?: {
    lockTTLMs?: number;
    defaultMaxPerRun?: number;
  };
}
