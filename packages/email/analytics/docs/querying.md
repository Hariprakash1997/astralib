# Querying

The `QueryService` reads from the pre-aggregated `analytics_stats` collection. All methods accept a date range and return summed metrics.

## Overview

Get totals across all accounts for a date range:

```typescript
const overview = await analytics.query.getOverview(
  new Date('2025-01-01'),
  new Date('2025-01-31'),
);
```

Returns `OverviewStats`:

```typescript
interface OverviewStats {
  startDate: string;    // "2025-01-01"
  endDate: string;      // "2025-01-31"
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

If no stats exist for the range, all counters return `0`.

## Timeline

Get time-series data broken down by interval:

```typescript
const timeline = await analytics.query.getTimeline(
  new Date('2025-01-01'),
  new Date('2025-01-31'),
  'daily',  // 'daily' | 'weekly' | 'monthly'
);
```

Returns `TimelineEntry[]`:

```typescript
interface TimelineEntry {
  date: string;           // "2025-01-15" for daily, "2025-01" for monthly
  interval: AggregationInterval;
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

**Interval behavior:**

| Interval | Grouping | Date format |
|----------|----------|-------------|
| `'daily'` | Each calendar day | `YYYY-MM-DD` |
| `'weekly'` | By month (YYYY-MM) | `YYYY-MM` |
| `'monthly'` | By month (YYYY-MM) | `YYYY-MM` |

Results are sorted by date ascending.

## Per-Account Stats

Get stats grouped by email account, sorted by `sent` descending:

```typescript
const accounts = await analytics.query.getAccountStats(
  new Date('2025-01-01'),
  new Date('2025-01-31'),
);
```

Returns `AccountStats[]`:

```typescript
interface AccountStats {
  accountId: string;
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

## Per-Rule Stats

Get stats grouped by automation rule:

```typescript
const rules = await analytics.query.getRuleStats(
  new Date('2025-01-01'),
  new Date('2025-01-31'),
);
```

Returns `RuleStats[]` with the same metric fields plus `ruleId`.

## Per-Template Stats

Get stats grouped by email template:

```typescript
const templates = await analytics.query.getTemplateStats(
  new Date('2025-01-01'),
  new Date('2025-01-31'),
);
```

Returns `TemplateStats[]` with the same metric fields plus `templateId`.

## Date Handling

All query methods convert `Date` objects to `YYYY-MM-DD` string keys internally. The comparison is string-based against the `date` field in `analytics_stats`, so timezone differences in the input `Date` objects don't affect results -- only the calendar date portion is used.
