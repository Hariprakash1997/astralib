# Email Analytics -- API Routes

All routes are relative to the mount point you choose when calling `createAnalyticsRoutes()`.

All responses follow the shape `{ success: boolean, data?: ..., error?: string }`.

All GET endpoints accept optional `from` and `to` query params for date filtering. Defaults to the last 30 days when omitted.

| Common Query Param | Type | Default | Description |
|---|---|---|---|
| `from` | `YYYY-MM-DD` | 30 days ago | Start date (inclusive) |
| `to` | `YYYY-MM-DD` | today | End date (inclusive) |

---

## Routes

### `GET /overview`

Get aggregate stats (sent, delivered, bounced, complained, opened, clicked) for the date range.

| Query Param | Type | Default |
|---|---|---|
| `from` | `YYYY-MM-DD` | 30 days ago |
| `to` | `YYYY-MM-DD` | today |

**Response:** `{ success, data: { sent, delivered, bounced, complained, opened, clicked, ... } }`

### `GET /timeline`

Get stats broken down by time interval.

| Query Param | Type | Default | Description |
|---|---|---|---|
| `from` | `YYYY-MM-DD` | 30 days ago | Start date |
| `to` | `YYYY-MM-DD` | today | End date |
| `interval` | string | `"daily"` | One of `daily`, `weekly`, `monthly` |

**Response:** `{ success, data: [ { date, sent, delivered, ... }, ... ] }`

### `GET /accounts`

Get per-account stats for the date range.

| Query Param | Type | Default |
|---|---|---|
| `from` | `YYYY-MM-DD` | 30 days ago |
| `to` | `YYYY-MM-DD` | today |

**Response:** `{ success, data: [ { accountId, sent, delivered, bounced, ... }, ... ] }`

### `GET /rules`

Get per-rule stats for the date range.

| Query Param | Type | Default |
|---|---|---|
| `from` | `YYYY-MM-DD` | 30 days ago |
| `to` | `YYYY-MM-DD` | today |

**Response:** `{ success, data: [ { ruleId, sent, ... }, ... ] }`

### `GET /templates`

Get per-template stats for the date range.

| Query Param | Type | Default |
|---|---|---|
| `from` | `YYYY-MM-DD` | 30 days ago |
| `to` | `YYYY-MM-DD` | today |

**Response:** `{ success, data: [ { templateId, sent, ... }, ... ] }`

### `POST /aggregate`

Trigger aggregation of raw email events into daily stats. Must be called (or cron-scheduled) before query endpoints return up-to-date numbers.

**Request body (all optional):**

| Field | Type | Description |
|---|---|---|
| `from` | `YYYY-MM-DD` | Aggregate starting from this date. If only `from` is provided, runs daily aggregation for that date. |
| `to` | `YYYY-MM-DD` | Aggregate up to this date. When both `from` and `to` are provided, runs range aggregation (max 365 days). |

When called with no body, aggregates for the current day.

**Response:** `{ success, message: "Daily aggregation complete" }` or `{ success, message: "Range aggregation complete" }`

---

## Getting today's sent count

The analytics endpoints query pre-aggregated daily stats. To get accurate numbers you need to ensure aggregation has run first.

**Step 1 -- Aggregate today's data:**

```
POST /aggregate
```

Call with no body (or schedule via cron). This processes raw events into the daily stats collection.

**Step 2 -- Query total sent today:**

```
GET /overview?from=2026-03-14&to=2026-03-14
```

Pass today's date as both `from` and `to` to get stats for today only. The response `data.sent` field contains today's total sent count.

**Step 3 -- Query per-account sent today:**

```
GET /accounts?from=2026-03-14&to=2026-03-14
```

Returns an array with each account's stats for today, including per-account `sent` counts.

**Important:** If `POST /aggregate` has not been called since the last emails were sent, the query endpoints will return stale data. In production, schedule aggregation via cron (e.g., every 5-15 minutes) to keep stats current.
