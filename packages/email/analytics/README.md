# @astralibx/email-analytics

Event-level email tracking with automatic daily aggregation and pre-built query APIs. Record individual send/deliver/bounce/open/click events, aggregate them into daily stats by account, rule, or template, and query time-series data through REST endpoints or the programmatic API.

## Install

```bash
npm install @astralibx/email-analytics
```

**Peer dependencies** (install separately):

```bash
npm install mongoose express
```

## Quick Start

```typescript
import mongoose from 'mongoose';
import express from 'express';
import { createEmailAnalytics } from '@astralibx/email-analytics';

const conn = mongoose.createConnection('mongodb://localhost:27017/myapp');

const analytics = createEmailAnalytics({
  db: { connection: conn, collectionPrefix: 'myapp_' },
  options: {
    eventTTLDays: 90,
    timezone: 'Asia/Kolkata',
  },
});

// Mount REST routes
const app = express();
app.use('/api/analytics', analytics.routes);

// Record an event programmatically
await analytics.events.record({
  type: 'sent',
  accountId: '507f1f77bcf86cd799439011',
  recipientEmail: 'user@example.com',
  ruleId: '507f1f77bcf86cd799439012',
});

// Run daily aggregation
await analytics.aggregator.aggregateDaily();

// Query overview stats
const overview = await analytics.query.getOverview(
  new Date('2025-01-01'),
  new Date('2025-01-31'),
);
```

## Features

- **Event Recording** -- single and batch insert with automatic timestamps; supports `externalUserId` for external system user tracking and `channel` for CTA attribution (whatsapp, telegram, sms, web, etc.) ([docs](https://github.com/Hariprakash1997/astralib/blob/main/packages/email/analytics/docs/event-recording.md))
- **Daily Aggregation** -- rolls up raw events into per-day stats by account, rule, template, and overall ([docs](https://github.com/Hariprakash1997/astralib/blob/main/packages/email/analytics/docs/aggregation.md))
- **Range Aggregation** -- backfill or re-aggregate any date range ([docs](https://github.com/Hariprakash1997/astralib/blob/main/packages/email/analytics/docs/aggregation.md))
- **Time-Series Queries** -- overview, timeline (daily/weekly/monthly), per-account, per-rule, per-template ([docs](https://github.com/Hariprakash1997/astralib/blob/main/packages/email/analytics/docs/querying.md))
- **Variant Analytics** -- per-variant (subjectIndex/bodyIndex) performance stats via `GET /variants` endpoint for A/B test analysis ([docs](https://github.com/Hariprakash1997/astralib/blob/main/packages/email/analytics/docs/api-routes.md))
- **REST API** -- endpoints with date-range query params, including `GET /channels` for channel breakdown, `GET /variants` for variant performance, and `POST /track` for public event ingestion with CORS ([docs](https://github.com/Hariprakash1997/astralib/blob/main/packages/email/analytics/docs/api-routes.md))
- **TTL Cleanup** -- MongoDB TTL index auto-expires old events; manual purge also available ([docs](https://github.com/Hariprakash1997/astralib/blob/main/packages/email/analytics/docs/event-recording.md#ttl-and-cleanup))
- **Programmatic API** -- use services directly without HTTP ([docs](https://github.com/Hariprakash1997/astralib/blob/main/packages/email/analytics/docs/programmatic-api.md))
- **Error Handling** -- typed error classes for validation, date range, and aggregation failures ([docs](https://github.com/Hariprakash1997/astralib/blob/main/packages/email/analytics/docs/error-handling.md))

## Integration with Other Packages

Wire hooks from `@astralibx/email-account-manager` and `@astralibx/email-rule-engine` to automatically record analytics events. See the [integration guide](https://github.com/Hariprakash1997/astralib/blob/main/packages/email/analytics/docs/integration.md) for full examples.

```typescript
import { createEmailAccountManager } from '@astralibx/email-account-manager';
import { createEmailRuleEngine } from '@astralibx/email-rule-engine';
import { createEmailAnalytics } from '@astralibx/email-analytics';

const analytics = createEmailAnalytics({ db: { connection: conn } });
const accountManager = createEmailAccountManager({ db: { connection: conn } });

// Record events via rule engine hooks config
const ruleEngine = createEmailRuleEngine({
  db: { connection: conn },
  hooks: {
    onSend: async ({ ruleId, ruleName, email, status }) => {
      await analytics.events.record({
        type: status === 'sent' ? 'sent' : 'failed',
        accountId: '...', // from your send context
        recipientEmail: email,
        ruleId,
      });
    },
  },
});
```

## Getting Started Guide

1. [Configuration](https://github.com/Hariprakash1997/astralib/blob/main/packages/email/analytics/docs/configuration.md) — Set up database and timezone
2. [Event Recording](https://github.com/Hariprakash1997/astralib/blob/main/packages/email/analytics/docs/event-recording.md) — Record email events (sent, delivered, bounced, etc.)
3. [Aggregation](https://github.com/Hariprakash1997/astralib/blob/main/packages/email/analytics/docs/aggregation.md) — Aggregate events into queryable stats (**must be scheduled via cron**)
4. [Querying](https://github.com/Hariprakash1997/astralib/blob/main/packages/email/analytics/docs/querying.md) — Query aggregated stats by date range, account, rule, or template
5. [Integration](https://github.com/Hariprakash1997/astralib/blob/main/packages/email/analytics/docs/integration.md) — Wire analytics to email-rule-engine and email-account-manager hooks

Reference: [API Routes](https://github.com/Hariprakash1997/astralib/blob/main/packages/email/analytics/docs/api-routes.md) | [Programmatic API](https://github.com/Hariprakash1997/astralib/blob/main/packages/email/analytics/docs/programmatic-api.md) | [Types](https://github.com/Hariprakash1997/astralib/blob/main/packages/email/analytics/docs/types.md) | [Error Handling](https://github.com/Hariprakash1997/astralib/blob/main/packages/email/analytics/docs/error-handling.md)

> **Important:** Events must be aggregated before querying. Schedule `aggregateDaily()` via cron (hourly recommended). Without aggregation, query endpoints return empty results.

## Exported Types

```typescript
// Core types
export type { EmailAnalyticsConfig } from './types/config.types';
export type { EmailEvent, CreateEventInput } from './types/event.types';
export type { DailyStats, AccountStats, RuleStats, TemplateStats, OverviewStats, TimelineEntry, VariantStats } from './types/stats.types';

// Constants
export { EVENT_TYPE, EVENT_CHANNEL, AGGREGATION_INTERVAL, STATS_GROUP_BY } from './constants';
export type { EventType, EventChannel, AggregationInterval, StatsGroupBy } from './constants';

// Errors
export { AlxAnalyticsError, ConfigValidationError, InvalidDateRangeError, AggregationError } from './errors';
```

## License

MIT
