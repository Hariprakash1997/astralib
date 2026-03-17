# Event Recording

Record individual email events as they happen. Events are the raw data that gets aggregated into daily stats.

## Event Types

Eight event types are available via the `EVENT_TYPE` constant:

| Constant | Value | Description |
|----------|-------|-------------|
| `EVENT_TYPE.Sent` | `'sent'` | Email dispatched to mail server |
| `EVENT_TYPE.Delivered` | `'delivered'` | Mail server confirmed delivery |
| `EVENT_TYPE.Bounced` | `'bounced'` | Email bounced (hard or soft) |
| `EVENT_TYPE.Complained` | `'complained'` | Recipient marked as spam |
| `EVENT_TYPE.Opened` | `'opened'` | Tracking pixel loaded |
| `EVENT_TYPE.Clicked` | `'clicked'` | Link in email clicked |
| `EVENT_TYPE.Unsubscribed` | `'unsubscribed'` | Recipient unsubscribed |
| `EVENT_TYPE.Failed` | `'failed'` | Send attempt failed before dispatch |

## CreateEventInput

```typescript
interface CreateEventInput {
  type: EventType;              // Required -- one of the eight event types
  accountId: string;            // Required -- email account ObjectId
  ruleId?: string;              // Optional -- rule that triggered the send
  templateId?: string;          // Optional -- template used
  recipientEmail: string;       // Required -- recipient address
  identifierId?: string;        // Optional -- contact/lead identifier
  metadata?: Record<string, unknown>;  // Optional -- arbitrary extra data
  timestamp?: Date;             // Optional -- defaults to now
}
```

## Recording a Single Event

```typescript
const analytics = createEmailAnalytics({ db: { connection: conn } });

await analytics.events.record({
  type: 'sent',
  accountId: '507f1f77bcf86cd799439011',
  recipientEmail: 'user@example.com',
  ruleId: '507f1f77bcf86cd799439012',
  templateId: '507f1f77bcf86cd799439013',
  metadata: { campaign: 'welcome-series' },
});
```

## Batch Recording

Use `recordBatch()` for high-throughput scenarios. Uses `insertMany` with `ordered: false` so individual failures don't block the rest.

```typescript
await analytics.events.recordBatch([
  { type: 'sent', accountId: acctId, recipientEmail: 'a@test.com' },
  { type: 'sent', accountId: acctId, recipientEmail: 'b@test.com' },
  { type: 'delivered', accountId: acctId, recipientEmail: 'a@test.com' },
]);
```

Empty arrays are handled gracefully (no-op).

## Querying Raw Events

Retrieve paginated raw events with filters:

```typescript
const result = await analytics.events.getEvents(
  {
    dateFrom: new Date('2025-01-01'),
    dateTo: new Date('2025-01-31'),
    type: 'bounced',             // optional
    accountId: '507f...',        // optional
    ruleId: '507f...',           // optional
    recipientEmail: 'user@x.com' // optional
  },
  1,   // page (default: 1)
  50,  // limit (default: 50)
);

console.log(result.events);  // EmailEvent[]
console.log(result.total);   // total matching count
```

Results are sorted by `timestamp` descending (newest first).

### EventQueryFilters

```typescript
interface EventQueryFilters {
  dateFrom: Date;
  dateTo: Date;
  type?: string;
  accountId?: string;
  ruleId?: string;
  recipientEmail?: string;
}
```

### PaginatedEvents

```typescript
interface PaginatedEvents {
  events: EmailEvent[];
  total: number;
}
```

## TTL and Cleanup

### Automatic TTL

A MongoDB TTL index is created on the `timestamp` field. By default, events expire after 90 days. Configure via `options.eventTTLDays`:

```typescript
createEmailAnalytics({
  db: { connection: conn },
  options: { eventTTLDays: 30 },  // Auto-delete after 30 days
});
```

MongoDB's background TTL thread runs approximately every 60 seconds.

### Manual Purge

For immediate cleanup, call `purgeOldEvents()`:

```typescript
const deletedCount = await analytics.events.purgeOldEvents(60);
// Deletes all events with timestamp older than 60 days ago
```

## Schema Indexes

The `email_events` collection has these indexes for query performance:

| Fields | Purpose |
|--------|---------|
| `{ type: 1 }` | Filter by event type |
| `{ accountId: 1 }` | Filter by account |
| `{ ruleId: 1 }` | Filter by rule |
| `{ templateId: 1 }` | Filter by template |
| `{ timestamp: 1 }` (TTL) | Auto-expiry and date range queries |
| `{ type: 1, timestamp: -1 }` | Type + date compound |
| `{ accountId: 1, timestamp: -1 }` | Account + date compound |
| `{ ruleId: 1, timestamp: -1 }` | Rule + date compound |
