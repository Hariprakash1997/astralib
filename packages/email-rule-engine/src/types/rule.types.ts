import type { RuleOperator, EmailType, RunTrigger, TemplateAudience } from '../constants';

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
  errors: number;
}

export interface RuleTarget {
  role: TemplateAudience;
  platform: string;
  conditions: RuleCondition[];
}

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

  bypassThrottle: boolean;
  emailType: EmailType;

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
  bypassThrottle?: boolean;
  emailType?: EmailType;
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
  bypassThrottle?: boolean;
  emailType?: EmailType;
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
