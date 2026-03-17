# API Routes

The `analytics.routes` Express router provides six endpoints. Mount it at any path:

```typescript
app.use('/api/analytics', analytics.routes);
```

## Authentication

This package does **not** include authentication. Routes are returned as bare Express routers — apply your own auth middleware when mounting:

```typescript
app.use('/api/analytics', authMiddleware, analytics.routes);
```

> **Important:** Always protect admin routes with authentication. Only webhook and unsubscribe routes (if applicable) should be publicly accessible — they use signature verification or token-based validation respectively.

All GET endpoints accept optional `from` and `to` query parameters (ISO date strings). Defaults to the last 30 days if omitted.

## Endpoints

### GET `/overview`

Aggregated totals for the date range.

**Query params:**

| Param | Type | Default | Description |
|-------|------|---------|-------------|
| `from` | ISO date string | 30 days ago | Start date |
| `to` | ISO date string | today | End date |

**Response:**

```json
{
  "success": true,
  "data": {
    "startDate": "2025-01-01",
    "endDate": "2025-01-31",
    "sent": 1500,
    "delivered": 1420,
    "bounced": 30,
    "complained": 5,
    "opened": 870,
    "clicked": 340,
    "unsubscribed": 12,
    "failed": 50
  }
}
```

---

### GET `/timeline`

Time-series data broken down by interval.

**Query params:**

| Param | Type | Default | Description |
|-------|------|---------|-------------|
| `from` | ISO date string | 30 days ago | Start date |
| `to` | ISO date string | today | End date |
| `interval` | `daily` \| `weekly` \| `monthly` | `daily` | Grouping interval |

**Response:**

```json
{
  "success": true,
  "data": [
    {
      "date": "2025-01-01",
      "interval": "daily",
      "sent": 50,
      "delivered": 47,
      "bounced": 1,
      "complained": 0,
      "opened": 30,
      "clicked": 12,
      "unsubscribed": 0,
      "failed": 2
    }
  ]
}
```

Returns `400` if `interval` is not one of the three valid values.

---

### GET `/accounts`

Stats grouped by email account for the date range.

**Query params:**

| Param | Type | Default | Description |
|-------|------|---------|-------------|
| `from` | ISO date string | 30 days ago | Start date |
| `to` | ISO date string | today | End date |

**Response:**

```json
{
  "success": true,
  "data": [
    {
      "accountId": "507f1f77bcf86cd799439011",
      "sent": 800,
      "delivered": 760,
      "bounced": 15,
      "complained": 2,
      "opened": 500,
      "clicked": 200,
      "unsubscribed": 5,
      "failed": 25
    }
  ]
}
```

Results sorted by `sent` descending.

---

### GET `/rules`

Stats grouped by automation rule.

**Query params:** Same as `/accounts`.

**Response:**

```json
{
  "success": true,
  "data": [
    {
      "ruleId": "507f1f77bcf86cd799439012",
      "sent": 300,
      "delivered": 285,
      "bounced": 5,
      "complained": 1,
      "opened": 180,
      "clicked": 72,
      "unsubscribed": 3,
      "failed": 10
    }
  ]
}
```

Results sorted by `sent` descending.

---

### GET `/templates`

Stats grouped by email template.

**Query params:** Same as `/accounts`.

**Response:**

```json
{
  "success": true,
  "data": [
    {
      "templateId": "507f1f77bcf86cd799439013",
      "sent": 450,
      "delivered": 430,
      "bounced": 8,
      "complained": 2,
      "opened": 290,
      "clicked": 115,
      "unsubscribed": 4,
      "failed": 12
    }
  ]
}
```

Results sorted by `sent` descending.

---

### POST `/aggregate`

Manually trigger aggregation. Accepts a JSON body.

**Request body:**

| Field | Type | Description |
|-------|------|-------------|
| `from` | ISO date string | Date to aggregate (or range start) |
| `to` | ISO date string | Range end (triggers range aggregation) |

**Examples:**

```bash
# Aggregate today
curl -X POST /api/analytics/aggregate

# Aggregate specific date
curl -X POST /api/analytics/aggregate \
  -H 'Content-Type: application/json' \
  -d '{ "from": "2025-03-10" }'

# Aggregate range
curl -X POST /api/analytics/aggregate \
  -H 'Content-Type: application/json' \
  -d '{ "from": "2025-01-01", "to": "2025-01-31" }'
```

**Response:**

```json
{ "success": true, "message": "Daily aggregation complete" }
```

or

```json
{ "success": true, "message": "Range aggregation complete" }
```

## Getting Today's Sent Count

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

## Error Responses

All endpoints return errors in the same shape:

```json
{
  "success": false,
  "error": "Error message here"
}
```

Server errors return HTTP `500`. Validation errors (invalid interval) return HTTP `400`.
