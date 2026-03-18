export const TEMPLATE_CATEGORY = {
  Onboarding: 'onboarding',
  Engagement: 'engagement',
  Transactional: 'transactional',
  ReEngagement: 're-engagement',
  Announcement: 'announcement',
} as const;

export type TemplateCategory = (typeof TEMPLATE_CATEGORY)[keyof typeof TEMPLATE_CATEGORY];

export const TEMPLATE_AUDIENCE = {
  Customer: 'customer',
  Provider: 'provider',
  All: 'all',
} as const;

export type TemplateAudience = (typeof TEMPLATE_AUDIENCE)[keyof typeof TEMPLATE_AUDIENCE];

export const RULE_OPERATOR = {
  Eq: 'eq',
  Neq: 'neq',
  Gt: 'gt',
  Gte: 'gte',
  Lt: 'lt',
  Lte: 'lte',
  Exists: 'exists',
  NotExists: 'not_exists',
  In: 'in',
  NotIn: 'not_in',
  Contains: 'contains',
} as const;

export type RuleOperator = (typeof RULE_OPERATOR)[keyof typeof RULE_OPERATOR];

export const EMAIL_TYPE = {
  Automated: 'automated',
  Transactional: 'transactional',
} as const;

export type EmailType = (typeof EMAIL_TYPE)[keyof typeof EMAIL_TYPE];

export const RUN_TRIGGER = {
  Cron: 'cron',
  Manual: 'manual',
} as const;

export type RunTrigger = (typeof RUN_TRIGGER)[keyof typeof RUN_TRIGGER];

export const THROTTLE_WINDOW = {
  Rolling: 'rolling',
} as const;

export type ThrottleWindow = (typeof THROTTLE_WINDOW)[keyof typeof THROTTLE_WINDOW];

export const EMAIL_SEND_STATUS = {
  Sent: 'sent',
  Error: 'error',
  Skipped: 'skipped',
  Invalid: 'invalid',
  Throttled: 'throttled',
} as const;

export type EmailSendStatus = (typeof EMAIL_SEND_STATUS)[keyof typeof EMAIL_SEND_STATUS];

export const TARGET_MODE = {
  Query: 'query',
  List: 'list',
} as const;

export type TargetMode = (typeof TARGET_MODE)[keyof typeof TARGET_MODE];

export const RUN_LOG_STATUS = {
  Completed: 'completed',
  Cancelled: 'cancelled',
  Failed: 'failed',
} as const;

export type RunLogStatus = (typeof RUN_LOG_STATUS)[keyof typeof RUN_LOG_STATUS];
