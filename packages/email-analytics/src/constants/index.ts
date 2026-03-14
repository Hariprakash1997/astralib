export const EVENT_TYPE = {
  Sent: 'sent',
  Delivered: 'delivered',
  Bounced: 'bounced',
  Complained: 'complained',
  Opened: 'opened',
  Clicked: 'clicked',
  Unsubscribed: 'unsubscribed',
  Failed: 'failed',
} as const;

export type EventType = (typeof EVENT_TYPE)[keyof typeof EVENT_TYPE];

export const AGGREGATION_INTERVAL = {
  Daily: 'daily',
  Weekly: 'weekly',
  Monthly: 'monthly',
} as const;

export type AggregationInterval = (typeof AGGREGATION_INTERVAL)[keyof typeof AGGREGATION_INTERVAL];

export const STATS_GROUP_BY = {
  Account: 'account',
  Rule: 'rule',
  Template: 'template',
} as const;

export type StatsGroupBy = (typeof STATS_GROUP_BY)[keyof typeof STATS_GROUP_BY];
