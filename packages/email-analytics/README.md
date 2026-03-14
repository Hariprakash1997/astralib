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

- **Event Recording** -- single and batch insert with automatic timestamps ([docs](docs/event-recording.md))
- **Daily Aggregation** -- rolls up raw events into per-day stats by account, rule, template, and overall ([docs](docs/aggregation.md))
- **Range Aggregation** -- backfill or re-aggregate any date range ([docs](docs/aggregation.md))
- **Time-Series Queries** -- overview, timeline (daily/weekly/monthly), per-account, per-rule, per-template ([docs](docs/querying.md))
- **REST API** -- six endpoints with date-range query params ([docs](docs/api-routes.md))
- **TTL Cleanup** -- MongoDB TTL index auto-expires old events; manual purge also available ([docs](docs/event-recording.md#ttl-and-cleanup))
- **Programmatic API** -- use services directly without HTTP ([docs](docs/programmatic-api.md))
- **Error Handling** -- typed error classes for validation, date range, and aggregation failures ([docs](docs/error-handling.md))

## Integration with Other Packages

Wire hooks from `@astralibx/email-account-manager` and `@astralibx/email-rule-engine` to automatically record analytics events. See the [integration guide](docs/integration.md) for full examples.

```typescript
import { createEmailAccountManager } from '@astralibx/email-account-manager';
import { createEmailRuleEngine } from '@astralibx/email-rule-engine';
import { createEmailAnalytics } from '@astralibx/email-analytics';

const analytics = createEmailAnalytics({ db: { connection: conn } });
const accountManager = createEmailAccountManager({ db: { connection: conn } });
const ruleEngine = createEmailRuleEngine({ db: { connection: conn } });

// Record events from rule engine execution
ruleEngine.on('emailSent', async (detail) => {
  await analytics.events.record({
    type: 'sent',
    accountId: detail.accountId,
    ruleId: detail.ruleId,
    templateId: detail.templateId,
    recipientEmail: detail.recipientEmail,
  });
});

ruleEngine.on('emailFailed', async (detail) => {
  await analytics.events.record({
    type: 'failed',
    accountId: detail.accountId,
    ruleId: detail.ruleId,
    recipientEmail: detail.recipientEmail,
    metadata: { error: detail.error },
  });
});
```

## Documentation

| Guide | Description |
|-------|-------------|
| [Configuration](docs/configuration.md) | Full config reference |
| [Event Recording](docs/event-recording.md) | Recording events, batch insert, TTL |
| [Aggregation](docs/aggregation.md) | Daily aggregation, range backfill |
| [Querying](docs/querying.md) | Overview, timeline, grouped stats |
| [API Routes](docs/api-routes.md) | REST endpoints reference |
| [Programmatic API](docs/programmatic-api.md) | Using services directly |
| [Integration](docs/integration.md) | Wiring with account-manager and rule-engine |
| [Error Handling](docs/error-handling.md) | Error classes and codes |

## Exported Types

```typescript
// Core types
export type { EmailAnalyticsConfig } from './types/config.types';
export type { EmailEvent, CreateEventInput } from './types/event.types';
export type { DailyStats, AccountStats, RuleStats, TemplateStats, OverviewStats, TimelineEntry } from './types/stats.types';

// Constants
export { EVENT_TYPE, AGGREGATION_INTERVAL, STATS_GROUP_BY } from './constants';
export type { EventType, AggregationInterval, StatsGroupBy } from './constants';

// Errors
export { AlxAnalyticsError, ConfigValidationError, InvalidDateRangeError, AggregationError } from './errors';
```

## License

MIT
