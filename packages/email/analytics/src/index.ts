import type { Router } from 'express';
import type { LogAdapter } from '@astralibx/core';
import type { EmailAnalyticsConfig } from './types/config.types';
import { validateConfig } from './validation/config.schema';
import { createEmailEventSchema, type EmailEventModel } from './schemas/email-event.schema';
import { createAnalyticsStatsSchema, type AnalyticsStatsModel } from './schemas/analytics-stats.schema';
import { EventRecorderService } from './services/event-recorder';
import { AggregatorService } from './services/aggregator';
import { QueryService } from './services/query.service';
import { createAnalyticsController } from './controllers/analytics.controller';
import { createAnalyticsRoutes } from './routes';

export interface EmailAnalytics {
  routes: Router;
  events: EventRecorderService;
  aggregator: AggregatorService;
  query: QueryService;
  models: {
    EmailEvent: EmailEventModel;
    AnalyticsStats: AnalyticsStatsModel;
  };
}

const noopLogger: LogAdapter = {
  info: () => {},
  warn: () => {},
  error: () => {},
};

export function createEmailAnalytics(config: EmailAnalyticsConfig): EmailAnalytics {
  validateConfig(config);

  const conn = config.db.connection;
  const prefix = config.db.collectionPrefix || '';
  const logger = config.logger || noopLogger;
  const timezone = config.options?.timezone || 'UTC';
  const ttlDays = config.options?.eventTTLDays;

  const EmailEvent = conn.model<any>(
    `${prefix}EmailEvent`,
    createEmailEventSchema(ttlDays ? { eventTTLDays: ttlDays } : undefined),
  ) as EmailEventModel;

  const AnalyticsStats = conn.model<any>(
    `${prefix}AnalyticsStats`,
    createAnalyticsStatsSchema(),
  ) as AnalyticsStatsModel;

  const eventRecorder = new EventRecorderService(EmailEvent, logger);
  const aggregator = new AggregatorService(EmailEvent, AnalyticsStats, timezone, logger);
  const queryService = new QueryService(AnalyticsStats, logger);

  const controller = createAnalyticsController(eventRecorder, aggregator, queryService);
  const routes = createAnalyticsRoutes(controller);

  return {
    routes,
    events: eventRecorder,
    aggregator,
    query: queryService,
    models: {
      EmailEvent,
      AnalyticsStats,
    },
  };
}

export type { EmailAnalyticsConfig } from './types/config.types';
export type { EmailEvent, CreateEventInput } from './types/event.types';
export type { BaseMetrics, DailyStats, AccountStats, RuleStats, TemplateStats, OverviewStats, TimelineEntry, ChannelBreakdown, VariantStats } from './types/stats.types';

export { EVENT_TYPE, AGGREGATION_INTERVAL, STATS_GROUP_BY, EVENT_CHANNEL } from './constants';
export type { EventType, AggregationInterval, StatsGroupBy, EventChannel } from './constants';

export { AlxAnalyticsError, ConfigValidationError, InvalidDateRangeError, AggregationError } from './errors';

export { validateConfig } from './validation/config.schema';

export {
  createEmailEventSchema,
  type IEmailEvent, type EmailEventDocument,
  type EmailEventModel, type EmailEventStatics,
  type CreateEmailEventSchemaOptions,
} from './schemas';

export {
  createAnalyticsStatsSchema,
  type IAnalyticsStats, type AnalyticsStatsDocument,
  type AnalyticsStatsModel, type AnalyticsStatsStatics,
  type CreateAnalyticsStatsSchemaOptions,
} from './schemas';

export { EventRecorderService, type EventQueryFilters, type PaginatedEvents } from './services/event-recorder';
export { AggregatorService } from './services/aggregator';
export { QueryService } from './services/query.service';
export { createAnalyticsController } from './controllers/analytics.controller';
export { createAnalyticsRoutes } from './routes';

export { createAnalyticsBridge } from './bridge.js';
