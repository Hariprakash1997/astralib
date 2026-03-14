# Configuration

Full reference for `EmailAnalyticsConfig` passed to `createEmailAnalytics()`.

## Config Shape

```typescript
interface EmailAnalyticsConfig {
  db: {
    connection: Connection;       // Mongoose connection instance (required)
    collectionPrefix?: string;    // Prefix for collection names (default: '')
  };
  logger?: LogAdapter;            // Logger with info/warn/error methods (default: noop)
  options?: {
    eventTTLDays?: number;        // Days before events auto-expire (default: 90)
    timezone?: string;            // IANA timezone for aggregation (default: 'UTC')
    aggregationSchedule?: AggregationInterval[];  // Reserved for scheduled aggregation
  };
}
```

## `db` (required)

### `db.connection`

A Mongoose `Connection` instance. The package registers two models on this connection:

- `{prefix}EmailEvent` -- raw event documents
- `{prefix}AnalyticsStats` -- aggregated daily stats

```typescript
import mongoose from 'mongoose';

// Dedicated connection
const conn = mongoose.createConnection('mongodb://localhost:27017/analytics');

// Or reuse an existing connection
const conn = mongoose.connection;
```

### `db.collectionPrefix`

Optional string prepended to model names. Useful when sharing a database with other packages.

```typescript
// Models registered as "crm_EmailEvent" and "crm_AnalyticsStats"
createEmailAnalytics({ db: { connection: conn, collectionPrefix: 'crm_' } });
```

The underlying MongoDB collection names are always `email_events` and `analytics_stats` (set in the schemas). The prefix only affects the Mongoose model name to avoid conflicts.

## `logger`

Any object implementing `LogAdapter` from `@astralibx/core`:

```typescript
interface LogAdapter {
  info(message: string, meta?: Record<string, unknown>): void;
  warn(message: string, meta?: Record<string, unknown>): void;
  error(message: string, meta?: Record<string, unknown>): void;
}
```

If omitted, a no-op logger is used (no output).

```typescript
createEmailAnalytics({
  db: { connection: conn },
  logger: {
    info: (msg, meta) => console.log(`[analytics] ${msg}`, meta),
    warn: (msg, meta) => console.warn(`[analytics] ${msg}`, meta),
    error: (msg, meta) => console.error(`[analytics] ${msg}`, meta),
  },
});
```

## `options`

### `options.eventTTLDays`

Number of days before raw event documents are automatically deleted by MongoDB's TTL index on the `timestamp` field. Defaults to `90`.

- Set to a higher value if you need longer raw event retention.
- The TTL index is created at schema initialization time and cannot be changed without dropping and recreating the index.

```typescript
createEmailAnalytics({
  db: { connection: conn },
  options: { eventTTLDays: 180 },  // Keep raw events for 6 months
});
```

### `options.timezone`

IANA timezone string used by the aggregator when computing day boundaries. Defaults to `'UTC'`.

```typescript
createEmailAnalytics({
  db: { connection: conn },
  options: { timezone: 'America/New_York' },
});
```

### `options.aggregationSchedule`

Array of `AggregationInterval` values (`'daily'`, `'weekly'`, `'monthly'`). Currently reserved for future scheduled aggregation support. The aggregator always produces daily stats; weekly/monthly are derived at query time.

## Validation

Config is validated with Zod at initialization. Invalid config throws `ConfigValidationError` with details about which fields failed:

```typescript
try {
  createEmailAnalytics({ db: {} as any });
} catch (err) {
  // ConfigValidationError: Invalid EmailAnalyticsConfig:
  //   db.connection: Required
}
```

## Return Value

`createEmailAnalytics()` returns an `EmailAnalytics` object:

```typescript
interface EmailAnalytics {
  routes: Router;                  // Express router with all endpoints
  events: EventRecorderService;    // Record and query raw events
  aggregator: AggregatorService;   // Run daily/range aggregation
  query: QueryService;             // Query aggregated stats
  models: {
    EmailEvent: EmailEventModel;
    AnalyticsStats: AnalyticsStatsModel;
  };
}
```
