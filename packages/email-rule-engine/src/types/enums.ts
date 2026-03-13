export const TemplateCategory = {
  Onboarding: 'onboarding',
  Engagement: 'engagement',
  Transactional: 'transactional',
  ReEngagement: 're-engagement',
  Announcement: 'announcement'
} as const;
export type TemplateCategory = typeof TemplateCategory[keyof typeof TemplateCategory];

export const TemplateAudience = {
  Customer: 'customer',
  Provider: 'provider',
  All: 'all'
} as const;
export type TemplateAudience = typeof TemplateAudience[keyof typeof TemplateAudience];

export const RuleOperator = {
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
  Contains: 'contains'
} as const;
export type RuleOperator = typeof RuleOperator[keyof typeof RuleOperator];

export const EmailType = {
  Automated: 'automated',
  Transactional: 'transactional'
} as const;
export type EmailType = typeof EmailType[keyof typeof EmailType];

export const RunTrigger = {
  Cron: 'cron',
  Manual: 'manual'
} as const;
export type RunTrigger = typeof RunTrigger[keyof typeof RunTrigger];

export const ThrottleWindow = {
  Rolling: 'rolling'
} as const;
export type ThrottleWindow = typeof ThrottleWindow[keyof typeof ThrottleWindow];
