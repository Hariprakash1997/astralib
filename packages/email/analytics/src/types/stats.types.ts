import type { AggregationInterval } from '../constants';

export interface BaseMetrics {
  sent: number;
  delivered: number;
  bounced: number;
  complained: number;
  opened: number;
  clicked: number;
  unsubscribed: number;
  failed: number;
}

export interface DailyStats extends BaseMetrics {
  date: string;
}

export interface AccountStats extends BaseMetrics {
  accountId: string;
}

export interface RuleStats extends BaseMetrics {
  ruleId: string;
}

export interface TemplateStats extends BaseMetrics {
  templateId: string;
}

export interface OverviewStats extends BaseMetrics {
  startDate: string;
  endDate: string;
}

export interface TimelineEntry extends BaseMetrics {
  date: string;
  interval: AggregationInterval;
}

export interface ChannelBreakdown {
  channel: string;
  count: number;
  sent: number;
  delivered: number;
  opened: number;
  clicked: number;
  bounced: number;
  unsubscribed: number;
}

export interface VariantStats {
  subjectIndex: number;
  bodyIndex: number;
  sent: number;
  opened: number;
  clicked: number;
  bounced: number;
  openRate: number;
  clickRate: number;
}
