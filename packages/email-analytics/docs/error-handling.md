# Error Handling

All custom errors extend `AlxError` from `@astralibx/core` and carry a `code` string for programmatic handling.

## Error Classes

### `AlxAnalyticsError`

Base error for all analytics-specific errors.

```typescript
import { AlxAnalyticsError } from '@astralibx/email-analytics';

try {
  // ...
} catch (err) {
  if (err instanceof AlxAnalyticsError) {
    console.log(err.code);    // e.g. "INVALID_DATE_RANGE"
    console.log(err.message); // Human-readable message
  }
}
```

**Properties:**

| Property | Type | Description |
|----------|------|-------------|
| `message` | `string` | Descriptive error message |
| `code` | `string` | Machine-readable error code |
| `name` | `string` | `'AlxAnalyticsError'` |

---

### `ConfigValidationError`

Thrown by `createEmailAnalytics()` when the config object fails Zod validation. Re-exported from `@astralibx/core`.

```typescript
import { ConfigValidationError } from '@astralibx/email-analytics';

try {
  createEmailAnalytics({ db: {} as any });
} catch (err) {
  if (err instanceof ConfigValidationError) {
    console.log(err.message);
    // "Invalid EmailAnalyticsConfig:
    //   db.connection: Required"
  }
}
```

---

### `InvalidDateRangeError`

Thrown when a date range is invalid (e.g., start date after end date).

```typescript
import { InvalidDateRangeError } from '@astralibx/email-analytics';
```

**Properties:**

| Property | Type | Description |
|----------|------|-------------|
| `code` | `string` | `'INVALID_DATE_RANGE'` |
| `startDate` | `string` | The invalid start date |
| `endDate` | `string` | The invalid end date |

---

### `AggregationError`

Thrown when a MongoDB aggregation pipeline fails during the aggregation process.

```typescript
import { AggregationError } from '@astralibx/email-analytics';

try {
  await analytics.aggregator.aggregateDaily();
} catch (err) {
  if (err instanceof AggregationError) {
    console.log(err.pipeline);       // Which pipeline failed (e.g., "byAccount")
    console.log(err.originalError);  // The underlying MongoDB error
  }
}
```

**Properties:**

| Property | Type | Description |
|----------|------|-------------|
| `code` | `string` | `'AGGREGATION_FAILED'` |
| `pipeline` | `string` | Name of the failed pipeline |
| `originalError` | `Error` | The original error from MongoDB |

## Error Codes Summary

| Code | Error Class | Cause |
|------|-------------|-------|
| `INVALID_DATE_RANGE` | `InvalidDateRangeError` | Start date is after end date |
| `AGGREGATION_FAILED` | `AggregationError` | MongoDB aggregation pipeline error |
| *(varies)* | `ConfigValidationError` | Invalid config structure |

## REST API Errors

Controller endpoints catch all errors and return a consistent JSON shape:

```json
{
  "success": false,
  "error": "Error message here"
}
```

- `400` -- invalid input (e.g., bad interval value)
- `500` -- server/database errors

## Handling in Application Code

```typescript
import {
  AlxAnalyticsError,
  ConfigValidationError,
  InvalidDateRangeError,
  AggregationError,
} from '@astralibx/email-analytics';

try {
  await analytics.aggregator.aggregateRange(from, to);
} catch (err) {
  if (err instanceof InvalidDateRangeError) {
    console.error(`Bad range: ${err.startDate} to ${err.endDate}`);
  } else if (err instanceof AggregationError) {
    console.error(`Pipeline ${err.pipeline} failed:`, err.originalError);
  } else if (err instanceof AlxAnalyticsError) {
    console.error(`Analytics error [${err.code}]: ${err.message}`);
  } else {
    throw err;
  }
}
```
