# Aggregation

The `AggregatorService` rolls up raw events from the `email_events` collection into pre-computed daily stats stored in `analytics_stats`. This makes time-series queries fast regardless of raw event volume.

## How It Works

When `aggregateDaily()` runs for a given date, it performs four MongoDB aggregation pipelines:

1. **By Account** -- groups events by `accountId`, counts each event type
2. **By Rule** -- groups events by `ruleId` (only events that have a ruleId)
3. **By Template** -- groups events by `templateId` (only events that have a templateId)
4. **Overall** -- totals across all events for the day

Each pipeline produces a stats document with these metrics:

| Metric | Source Event Type |
|--------|------------------|
| `sent` | `EVENT_TYPE.Sent` |
| `delivered` | `EVENT_TYPE.Delivered` |
| `bounced` | `EVENT_TYPE.Bounced` |
| `complained` | `EVENT_TYPE.Complained` |
| `opened` | `EVENT_TYPE.Opened` |
| `clicked` | `EVENT_TYPE.Clicked` |
| `unsubscribed` | `EVENT_TYPE.Unsubscribed` |
| `failed` | `EVENT_TYPE.Failed` |

Results are upserted into the `analytics_stats` collection, so re-running aggregation for the same date safely overwrites previous values.

## Daily Aggregation

Aggregate today's events (or a specific date):

```typescript
const analytics = createEmailAnalytics({ db: { connection: conn } });

// Aggregate today
await analytics.aggregator.aggregateDaily();

// Aggregate a specific date
await analytics.aggregator.aggregateDaily(new Date('2025-03-10'));
```

Day boundaries are computed using the configured timezone (default: UTC). The date is normalized to `00:00:00.000` through `23:59:59.999`.

## Range Aggregation

Backfill or re-aggregate a range of dates. Iterates day-by-day from `from` to `to` (inclusive):

```typescript
await analytics.aggregator.aggregateRange(
  new Date('2025-01-01'),
  new Date('2025-01-31'),
);
```

This is useful for:

- Initial setup when historical events already exist
- Re-aggregating after fixing event data
- Recovering from missed daily aggregation runs

## Stats Document Shape

Each document in `analytics_stats` looks like:

```json
{
  "date": "2025-03-10",
  "interval": "daily",
  "accountId": "507f1f77bcf86cd799439011",
  "sent": 150,
  "delivered": 142,
  "bounced": 3,
  "complained": 1,
  "opened": 87,
  "clicked": 34,
  "unsubscribed": 2,
  "failed": 5,
  "createdAt": "2025-03-10T06:00:00.000Z",
  "updatedAt": "2025-03-10T06:00:00.000Z"
}
```

- **Overall stats** have no `accountId`, `ruleId`, or `templateId`
- **Account stats** have `accountId` set, no `ruleId`/`templateId`
- **Rule stats** have `ruleId` set, no `accountId`/`templateId`
- **Template stats** have `templateId` set, no `accountId`/`ruleId`

## Triggering via REST

The aggregation can also be triggered via the POST `/aggregate` endpoint:

```bash
# Aggregate today
curl -X POST http://localhost:3000/api/analytics/aggregate

# Aggregate a specific date
curl -X POST http://localhost:3000/api/analytics/aggregate \
  -H 'Content-Type: application/json' \
  -d '{ "from": "2025-01-15" }'

# Aggregate a range
curl -X POST http://localhost:3000/api/analytics/aggregate \
  -H 'Content-Type: application/json' \
  -d '{ "from": "2025-01-01", "to": "2025-01-31" }'
```

## Scheduling

The package does not include a built-in scheduler. Use your application's job system (cron, node-cron, Bull, Agenda, etc.) to call `aggregateDaily()` on a schedule:

```typescript
import cron from 'node-cron';

// Run at 1:00 AM daily
cron.schedule('0 1 * * *', async () => {
  const yesterday = new Date();
  yesterday.setDate(yesterday.getDate() - 1);
  await analytics.aggregator.aggregateDaily(yesterday);
});
```

## Collection Indexes

The `analytics_stats` collection has these indexes:

| Fields | Properties |
|--------|------------|
| `{ date: 1, interval: 1, accountId: 1 }` | Unique |
| `{ date: 1, interval: 1 }` | Compound for range queries |
| `{ date: 1 }` | Single field for date filtering |
