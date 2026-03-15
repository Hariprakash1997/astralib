# Exported Types

All types can be imported from `@astralibx/email-analytics`:

```ts
import type { EmailAnalyticsConfig, EmailEvent, BaseMetrics } from '@astralibx/email-analytics';
```

---

## Configuration

### `EmailAnalyticsConfig`

Top-level configuration for initializing the analytics module.

```ts
interface EmailAnalyticsConfig {
  db: {
    connection: Connection;       // Mongoose connection instance
    collectionPrefix?: string;    // Prefix for collection names
  };
  logger?: LogAdapter;            // Optional logger (from @astralibx/core)
  options?: {
    eventTTLDays?: number;            // TTL for event documents (default: 90)
    timezone?: string;                // Timezone for aggregation (default: 'UTC')
    aggregationSchedule?: AggregationInterval[];
  };
}
```

### `EmailAnalytics`

Return type of `createEmailAnalytics()`.

```ts
interface EmailAnalytics {
  routes: Router;                          // Express router with analytics endpoints
  events: EventRecorderService;            // Service for recording events
  aggregator: AggregatorService;           // Service for running aggregations
  query: QueryService;                     // Service for querying stats
  models: {
    EmailEvent: EmailEventModel;           // Mongoose model for raw events
    AnalyticsStats: AnalyticsStatsModel;   // Mongoose model for aggregated stats
  };
}
```

---

## Event Types

### `EmailEvent`

Alias for `IEmailEvent`. Represents a tracked email event document.

```ts
interface IEmailEvent {
  type: EventType;
  accountId: Types.ObjectId;
  ruleId?: Types.ObjectId;
  templateId?: Types.ObjectId;
  recipientEmail: string;
  identifierId?: Types.ObjectId;
  metadata?: Record<string, unknown>;
  timestamp: Date;
  createdAt: Date;
  updatedAt: Date;
}
```

### `CreateEventInput`

Input shape for recording a new event.

```ts
interface CreateEventInput {
  type: EventType;
  accountId: string;
  ruleId?: string;
  templateId?: string;
  recipientEmail: string;
  identifierId?: string;
  metadata?: Record<string, unknown>;
  timestamp?: Date;
}
```

### `EventQueryFilters`

Filters for querying raw events.

```ts
interface EventQueryFilters {
  dateFrom: Date;
  dateTo: Date;
  type?: string;
  accountId?: string;
  ruleId?: string;
  recipientEmail?: string;
}
```

### `PaginatedEvents`

Return type for paginated event queries.

```ts
interface PaginatedEvents {
  events: EmailEvent[];
  total: number;
}
```

---

## Stats Types

### `BaseMetrics`

Common metric counters shared by all stats types.

```ts
interface BaseMetrics {
  sent: number;
  delivered: number;
  bounced: number;
  complained: number;
  opened: number;
  clicked: number;
  unsubscribed: number;
  failed: number;
}
```

### `DailyStats`

Metrics for a single day.

```ts
interface DailyStats extends BaseMetrics {
  date: string;
}
```

### `AccountStats`

Metrics grouped by account.

```ts
interface AccountStats extends BaseMetrics {
  accountId: string;
}
```

### `RuleStats`

Metrics grouped by rule.

```ts
interface RuleStats extends BaseMetrics {
  ruleId: string;
}
```

### `TemplateStats`

Metrics grouped by template.

```ts
interface TemplateStats extends BaseMetrics {
  templateId: string;
}
```

### `OverviewStats`

Aggregated metrics over a date range.

```ts
interface OverviewStats extends BaseMetrics {
  startDate: string;
  endDate: string;
}
```

### `TimelineEntry`

A single data point in a time-series response.

```ts
interface TimelineEntry extends BaseMetrics {
  date: string;
  interval: AggregationInterval;
}
```

---

## Schema Types (Mongoose)

### `IEmailEvent`

Raw Mongoose document interface for email events. See [Event Types](#emailevent) above.

### `EmailEventDocument`

Hydrated Mongoose document: `HydratedDocument<IEmailEvent>`.

### `EmailEventStatics`

Static methods available on the `EmailEvent` model.

```ts
interface EmailEventStatics {
  record(event: CreateEventInput): Promise<EmailEventDocument>;
  findByDateRange(
    start: Date,
    end: Date,
    filters?: { type?: EventType; accountId?: string; ruleId?: string; templateId?: string },
  ): Promise<EmailEventDocument[]>;
}
```

### `EmailEventModel`

Full model type: `Model<IEmailEvent> & EmailEventStatics`.

### `CreateEmailEventSchemaOptions`

Options for `createEmailEventSchema()`.

```ts
interface CreateEmailEventSchemaOptions {
  collectionName?: string;    // Default: 'email_events'
  eventTTLDays?: number;      // TTL in days (default: 90)
}
```

### `IAnalyticsStats`

Mongoose document interface for pre-aggregated statistics.

```ts
interface IAnalyticsStats {
  date: string;
  interval: AggregationInterval;
  accountId: Types.ObjectId | null;
  ruleId: Types.ObjectId | null;
  templateId: Types.ObjectId | null;
  sent: number;
  delivered: number;
  bounced: number;
  complained: number;
  opened: number;
  clicked: number;
  unsubscribed: number;
  failed: number;
  createdAt: Date;
  updatedAt: Date;
}
```

### `AnalyticsStatsDocument`

Hydrated Mongoose document: `HydratedDocument<IAnalyticsStats>`.

### `AnalyticsStatsStatics`

Static methods available on the `AnalyticsStats` model.

```ts
interface AnalyticsStatsStatics {
  upsertStats(
    date: string,
    interval: AggregationInterval,
    dimensions: { accountId?: string; ruleId?: string; templateId?: string },
    increments: Partial<Record<'sent' | 'delivered' | 'bounced' | 'complained' | 'opened' | 'clicked' | 'unsubscribed' | 'failed', number>>,
  ): Promise<AnalyticsStatsDocument>;
}
```

### `AnalyticsStatsModel`

Full model type: `Model<IAnalyticsStats> & AnalyticsStatsStatics`.

### `CreateAnalyticsStatsSchemaOptions`

Options for `createAnalyticsStatsSchema()`.

```ts
interface CreateAnalyticsStatsSchemaOptions {
  collectionName?: string;    // Default: 'analytics_stats'
}
```

---

## Constants

### `EVENT_TYPE`

All supported email event types.

```ts
import { EVENT_TYPE } from '@astralibx/email-analytics';

EVENT_TYPE.Sent          // 'sent'
EVENT_TYPE.Delivered     // 'delivered'
EVENT_TYPE.Bounced       // 'bounced'
EVENT_TYPE.Complained    // 'complained'
EVENT_TYPE.Opened        // 'opened'
EVENT_TYPE.Clicked       // 'clicked'
EVENT_TYPE.Unsubscribed  // 'unsubscribed'
EVENT_TYPE.Failed        // 'failed'
```

**Type:** `EventType = 'sent' | 'delivered' | 'bounced' | 'complained' | 'opened' | 'clicked' | 'unsubscribed' | 'failed'`

### `AGGREGATION_INTERVAL`

Supported time intervals for aggregation.

```ts
import { AGGREGATION_INTERVAL } from '@astralibx/email-analytics';

AGGREGATION_INTERVAL.Daily    // 'daily'
AGGREGATION_INTERVAL.Weekly   // 'weekly'
AGGREGATION_INTERVAL.Monthly  // 'monthly'
```

**Type:** `AggregationInterval = 'daily' | 'weekly' | 'monthly'`

### `STATS_GROUP_BY`

Supported grouping dimensions for stats queries.

```ts
import { STATS_GROUP_BY } from '@astralibx/email-analytics';

STATS_GROUP_BY.Account   // 'account'
STATS_GROUP_BY.Rule      // 'rule'
STATS_GROUP_BY.Template  // 'template'
```

**Type:** `StatsGroupBy = 'account' | 'rule' | 'template'`

---

## Error Classes

All errors extend `AlxError` from `@astralibx/core`.

```ts
import { AlxAnalyticsError, InvalidDateRangeError, AggregationError } from '@astralibx/email-analytics';
```

| Class | Code | Description |
|---|---|---|
| `AlxAnalyticsError` | *(custom)* | Base error for all analytics errors |
| `ConfigValidationError` | *(from core)* | Thrown when config validation fails |
| `InvalidDateRangeError` | `INVALID_DATE_RANGE` | Thrown when start date is after end date |
| `AggregationError` | `AGGREGATION_FAILED` | Thrown when a MongoDB aggregation pipeline fails |

### `InvalidDateRangeError`

```ts
class InvalidDateRangeError extends AlxAnalyticsError {
  readonly startDate: string;
  readonly endDate: string;
}
```

### `AggregationError`

```ts
class AggregationError extends AlxAnalyticsError {
  readonly pipeline: string;
  readonly originalError: Error;
}
```
