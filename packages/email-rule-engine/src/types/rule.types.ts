import type { RuleOperator, EmailType, RunTrigger } from '../constants';

export interface RuleCondition {
  field: string;
  operator: RuleOperator;
  value: unknown;
}

export interface RuleRunStats {
  matched: number;
  sent: number;
  skipped: number;
  skippedByThrottle: number;
  errorCount: number;
}

export interface QueryTarget {
  mode: 'query';
  role: string;
  platform: string;
  conditions: RuleCondition[];
}

export interface ListTarget {
  mode: 'list';
  identifiers: string[];
}

export type RuleTarget = QueryTarget | ListTarget;

export interface EmailRule {
  _id: string;
  name: string;
  description?: string;
  isActive: boolean;

  sortOrder: number;

  target: RuleTarget;
  templateId: string;

  sendOnce: boolean;
  resendAfterDays?: number;
  cooldownDays?: number;
  autoApprove: boolean;
  maxPerRun?: number;

  validFrom?: Date;
  validTill?: Date;

  bypassThrottle: boolean;
  throttleOverride?: {
    maxPerUserPerDay?: number;
    maxPerUserPerWeek?: number;
    minGapDays?: number;
  };
  emailType: EmailType;

  schedule?: {
    enabled: boolean;
    cron: string;
    timezone?: string;
  };

  totalSent: number;
  totalSkipped: number;
  lastRunAt?: Date;
  lastRunStats?: RuleRunStats;

  createdAt: Date;
  updatedAt: Date;
}

export interface CreateEmailRuleInput {
  name: string;
  description?: string;
  target: RuleTarget;
  templateId: string;
  sortOrder?: number;
  sendOnce?: boolean;
  resendAfterDays?: number;
  cooldownDays?: number;
  autoApprove?: boolean;
  maxPerRun?: number;
  validFrom?: Date;
  validTill?: Date;
  bypassThrottle?: boolean;
  throttleOverride?: {
    maxPerUserPerDay?: number;
    maxPerUserPerWeek?: number;
    minGapDays?: number;
  };
  emailType?: EmailType;
  schedule?: {
    enabled: boolean;
    cron: string;
    timezone?: string;
  };
}

export interface UpdateEmailRuleInput {
  name?: string;
  description?: string;
  isActive?: boolean;
  sortOrder?: number;
  target?: RuleTarget;
  templateId?: string;
  sendOnce?: boolean;
  resendAfterDays?: number;
  cooldownDays?: number;
  autoApprove?: boolean;
  maxPerRun?: number;
  validFrom?: Date;
  validTill?: Date;
  bypassThrottle?: boolean;
  throttleOverride?: {
    maxPerUserPerDay?: number;
    maxPerUserPerWeek?: number;
    minGapDays?: number;
  };
  emailType?: EmailType;
  schedule?: {
    enabled: boolean;
    cron: string;
    timezone?: string;
  };
}

export interface EmailRuleSend {
  _id: string;
  ruleId: string;
  userId: string;
  emailIdentifierId?: string;
  messageId?: string;
  sentAt: Date;
  status?: string;
  accountId?: string;
  senderName?: string;
  subject?: string;
  failureReason?: string;
}

export interface PerRuleStats extends RuleRunStats {
  ruleId: string;
  ruleName: string;
}

export interface EmailRuleRunLog {
  _id: string;
  runAt: Date;
  triggeredBy: RunTrigger;
  duration: number;
  rulesProcessed: number;
  totalStats: RuleRunStats;
  perRuleStats: PerRuleStats[];
}
