# Programmatic API

Use the three services directly without going through HTTP routes.

## Accessing Services

```typescript
const analytics = createEmailAnalytics({
  db: { connection: conn },
});

const { events, aggregator, query, models } = analytics;
```

## EventRecorderService

### `record(event: CreateEventInput): Promise<void>`

Record a single event.

```typescript
await events.record({
  type: 'delivered',
  accountId: '507f1f77bcf86cd799439011',
  recipientEmail: 'user@example.com',
});
```

### `recordBatch(events: CreateEventInput[]): Promise<void>`

Insert multiple events in one operation. Uses `insertMany` with `ordered: false`.

```typescript
await events.recordBatch([
  { type: 'sent', accountId: acctId, recipientEmail: 'a@test.com' },
  { type: 'sent', accountId: acctId, recipientEmail: 'b@test.com' },
]);
```

### `getEvents(filters, page?, limit?): Promise<PaginatedEvents>`

Query raw events with pagination.

```typescript
const { events: list, total } = await events.getEvents(
  {
    dateFrom: new Date('2025-01-01'),
    dateTo: new Date('2025-01-31'),
    type: 'bounced',
    accountId: '507f...',
  },
  2,   // page 2
  25,  // 25 per page
);
```

### `purgeOldEvents(olderThanDays: number): Promise<number>`

Manually delete events older than N days. Returns the count of deleted documents.

```typescript
const deleted = await events.purgeOldEvents(60);
```

## AggregatorService

### `aggregateDaily(date?: Date): Promise<void>`

Run the four aggregation pipelines (by account, by rule, by template, overall) for a single day. Defaults to today.

```typescript
await aggregator.aggregateDaily();
await aggregator.aggregateDaily(new Date('2025-03-10'));
```

### `aggregateRange(from: Date, to: Date): Promise<void>`

Iterate day-by-day and run `aggregateDaily()` for each date in the range (inclusive).

```typescript
await aggregator.aggregateRange(
  new Date('2025-01-01'),
  new Date('2025-03-01'),
);
```

## QueryService

### `getOverview(dateFrom, dateTo): Promise<OverviewStats>`

Summed totals across all accounts for a date range.

```typescript
const stats = await query.getOverview(
  new Date('2025-01-01'),
  new Date('2025-01-31'),
);
// { startDate, endDate, sent, delivered, bounced, ... }
```

### `getTimeline(dateFrom, dateTo, interval?): Promise<TimelineEntry[]>`

Time-series breakdown. Interval defaults to `'daily'`.

```typescript
const daily = await query.getTimeline(
  new Date('2025-01-01'),
  new Date('2025-01-31'),
);

const monthly = await query.getTimeline(
  new Date('2025-01-01'),
  new Date('2025-12-31'),
  'monthly',
);
```

### `getAccountStats(dateFrom, dateTo): Promise<AccountStats[]>`

Stats per email account, sorted by `sent` descending.

```typescript
const accounts = await query.getAccountStats(
  new Date('2025-01-01'),
  new Date('2025-01-31'),
);
```

### `getRuleStats(dateFrom, dateTo): Promise<RuleStats[]>`

Stats per automation rule.

```typescript
const rules = await query.getRuleStats(
  new Date('2025-01-01'),
  new Date('2025-01-31'),
);
```

### `getTemplateStats(dateFrom, dateTo): Promise<TemplateStats[]>`

Stats per email template.

```typescript
const templates = await query.getTemplateStats(
  new Date('2025-01-01'),
  new Date('2025-01-31'),
);
```

## Direct Model Access

The `models` object exposes the Mongoose models for advanced queries:

```typescript
const { EmailEvent, AnalyticsStats } = analytics.models;

// Custom aggregation pipeline
const results = await EmailEvent.aggregate([
  { $match: { type: 'bounced', accountId: someId } },
  { $group: { _id: '$recipientEmail', count: { $sum: 1 } } },
  { $sort: { count: -1 } },
  { $limit: 10 },
]);

// Static helper methods
const doc = await EmailEvent.record({
  type: 'sent',
  accountId: '507f...',
  recipientEmail: 'user@example.com',
});

const events = await EmailEvent.findByDateRange(
  new Date('2025-01-01'),
  new Date('2025-01-31'),
  { type: 'bounced' },
);

// Upsert stats directly
await AnalyticsStats.upsertStats(
  '2025-01-15',
  'daily',
  { accountId: '507f...' },
  { sent: 10, delivered: 9 },
);
```
