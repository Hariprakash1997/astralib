# API Routes

All routes are mounted under your chosen prefix (e.g., `/api/telegram-rules`). All responses use `{ success: boolean, data?: any, error?: string }`.

## Authentication

This package does **not** include authentication. Routes are returned as bare Express routers -- apply your own auth middleware when mounting:

```typescript
app.use('/api/telegram-rules', authMiddleware, engine.routes);
```

---

## Templates

| Method | Path | Description |
|--------|------|-------------|
| `GET` | `/templates` | List templates (filter by `?category=`, `?platform=`, `?audience=`) |
| `POST` | `/templates` | Create a new template |
| `GET` | `/templates/:id` | Get template by ID |
| `PUT` | `/templates/:id` | Update template |
| `DELETE` | `/templates/:id` | Delete template |
| `POST` | `/templates/:id/preview` | Render saved template with sample data |

**Create template request body:**

| Field | Type | Required | Description |
|-------|------|----------|-------------|
| `name` | string | yes | Template name (must be unique) |
| `messages` | string[] | yes | Array of message text variants (Handlebars supported) |
| `category` | string | no | Must be a valid category value |
| `platform` | string | no | Must be a valid platform value |
| `audience` | string | no | Must be a valid audience value |
| `variables` | string[] | no | Handlebars variables (auto-extracted if omitted) |
| `media` | object | no | `{ type: 'photo'\|'video'\|'voice'\|'audio'\|'document', url: string, caption?: string }` |
| `fields` | `Record<string, string>` | no | Custom placeholder key-value pairs merged into render context as defaults |

**Create template example:**

```bash
curl -X POST http://localhost:3000/api/telegram-rules/templates \
  -H "Content-Type: application/json" \
  -d '{
    "name": "Welcome Message",
    "messages": [
      "Hi {{user.name}}, welcome to {{platform.name}}!",
      "Hey {{user.name}}! Glad to have you on {{platform.name}}."
    ],
    "category": "onboarding",
    "audience": "customer",
    "platform": "web",
    "media": { "type": "photo", "url": "https://example.com/welcome.jpg" }
  }'
```

**Response:**

```json
{
  "success": true,
  "data": { "template": { "_id": "...", "name": "Welcome Message", "messages": [...], ... } }
}
```

**Preview example:**

```bash
curl -X POST http://localhost:3000/api/telegram-rules/templates/665abc123/preview \
  -H "Content-Type: application/json" \
  -d '{ "sampleData": { "user": { "name": "John" }, "platform": { "name": "MyApp" } } }'
```

---

## Rules

| Method | Path | Description |
|--------|------|-------------|
| `GET` | `/rules` | List rules (filter by `?isActive=`, `?platform=`, `?audience=`) |
| `POST` | `/rules` | Create a new rule |
| `GET` | `/rules/:id` | Get rule by ID |
| `PUT` | `/rules/:id` | Update a rule |
| `DELETE` | `/rules/:id` | Delete rule |
| `POST` | `/rules/:id/activate` | Activate a rule |
| `POST` | `/rules/:id/deactivate` | Deactivate a rule |
| `POST` | `/rules/:id/dry-run` | Count matching users without sending |

**Create rule request body:**

| Field | Type | Required | Description |
|-------|------|----------|-------------|
| `name` | string | yes | Rule name |
| `target` | object | yes | `{ mode: 'query', conditions: {} }` or `{ mode: 'list', identifiers: string[] }` |
| `templateId` | string | yes | ID of the template to use |
| `sendOnce` | boolean | no | Send only once per user, ever (default `false`) |
| `maxPerRun` | number | no | Max users processed per execution (default from config) |
| `validFrom` | ISO date string | no | Rule is inactive before this date |
| `validTill` | ISO date string | no | Rule is inactive after this date |
| `platform` | string | no | Must be a valid platform value |
| `audience` | string | no | Must be a valid audience value |

**Create rule example (query mode):**

```bash
curl -X POST http://localhost:3000/api/telegram-rules/rules \
  -H "Content-Type: application/json" \
  -d '{
    "name": "Welcome new customers",
    "templateId": "665abc123...",
    "target": {
      "mode": "query",
      "conditions": {
        "isNewUser": true,
        "platform": "web"
      }
    },
    "sendOnce": true,
    "maxPerRun": 50
  }'
```

**Create rule example (list mode):**

```bash
curl -X POST http://localhost:3000/api/telegram-rules/rules \
  -H "Content-Type: application/json" \
  -d '{
    "name": "VIP outreach",
    "templateId": "665abc123...",
    "target": {
      "mode": "list",
      "identifiers": ["+919876543210", "+919876543211", "@username"]
    },
    "sendOnce": true
  }'
```

**Dry run response:**

```json
{
  "success": true,
  "data": {
    "valid": true,
    "templateExists": true,
    "targetValid": true,
    "matchedCount": 142,
    "effectiveLimit": 100,
    "errors": []
  }
}
```

---

## Runner

| Method | Path | Description |
|--------|------|-------------|
| `POST` | `/runner/trigger` | Trigger a manual run (non-blocking, returns `runId` immediately) |
| `GET` | `/runner/status/:runId` | Get progress for a specific run |
| `POST` | `/runner/cancel/:runId` | Gracefully cancel a running execution |

**Trigger request body (optional):**

```json
{ "triggeredBy": "manual" }
```

**Trigger response:**

```json
{
  "success": true,
  "data": { "message": "Rule run triggered", "runId": "run_abc123" }
}
```

**Status response:**

```json
{
  "success": true,
  "data": {
    "runId": "run_abc123",
    "status": "running",
    "currentRule": "Welcome new customers",
    "progress": {
      "rulesTotal": 3,
      "rulesCompleted": 1,
      "sent": 45,
      "failed": 2,
      "skipped": 3,
      "throttled": 5
    },
    "startedAt": "2026-03-14T09:00:00Z",
    "elapsed": 12500
  }
}
```

**Cancel response:**

```json
{ "success": true, "data": { "message": "Cancel requested" } }
```

---

## Settings (Throttle)

| Method | Path | Description |
|--------|------|-------------|
| `GET` | `/settings/throttle` | Get current throttle config |
| `PUT` | `/settings/throttle` | Update throttle config (all fields optional) |

**Default throttle values:**

| Field | Default |
|-------|---------|
| `maxPerUserPerDay` | `1` |
| `maxPerUserPerWeek` | `2` |
| `minGapDays` | `3` |
| `throttleWindow` | `'rolling'` |

**Update throttle request body (all optional):**

| Field | Type | Constraints |
|-------|------|-------------|
| `maxPerUserPerDay` | integer | >= 1 |
| `maxPerUserPerWeek` | integer | >= 1, must be >= `maxPerUserPerDay` |
| `minGapDays` | integer | >= 0 |
| `throttleWindow` | string | `'rolling'` or `'fixed'` |

**Update example:**

```bash
curl -X PUT http://localhost:3000/api/telegram-rules/settings/throttle \
  -H "Content-Type: application/json" \
  -d '{ "maxPerUserPerDay": 2, "maxPerUserPerWeek": 5, "minGapDays": 1 }'
```

---

## Analytics

| Method | Path | Description |
|--------|------|-------------|
| `GET` | `/analytics/send-logs` | Query send logs with filters and pagination |
| `GET` | `/analytics/error-logs` | Query error logs with filters and pagination |
| `GET` | `/analytics/run-logs` | Query run logs with filters and pagination |
| `GET` | `/analytics/stats` | Aggregated delivery statistics |

### Pagination

All list endpoints support pagination via query parameters:

| Param | Type | Default | Max | Description |
|-------|------|---------|-----|-------------|
| `page` | integer | `1` | -- | Page number (1-based) |
| `limit` | integer | `50` | `200` | Results per page |

### Date Filtering

All analytics endpoints support date range filtering:

| Param | Type | Description |
|-------|------|-------------|
| `from` | ISO date string | Start date (inclusive) |
| `to` | ISO date string | End date (inclusive) |

### Send Logs

**Additional filters:** `?ruleId=`, `?runId=`, `?contactId=`, `?status=`

Status values: `pending`, `sent`, `delivered`, `read`, `failed`

```bash
curl "http://localhost:3000/api/telegram-rules/analytics/send-logs?ruleId=665abc&status=sent&page=1&limit=20"
```

**Response:**

```json
{
  "success": true,
  "data": {
    "logs": [{ "ruleId": "...", "contactId": "...", "deliveryStatus": "sent", "sentAt": "..." }],
    "total": 142
  }
}
```

### Error Logs

**Additional filters:** `?errorCategory=`, `?operation=`

Error categories: `critical`, `account`, `recoverable`, `skip`, `unknown`

Operations: `send`, `sync`, `connect`, `other`

### Run Logs

**Additional filters:** `?status=`

### Stats

Returns aggregated counts by delivery status.

```bash
curl "http://localhost:3000/api/telegram-rules/analytics/stats?from=2026-03-01&to=2026-03-15"
```

**Response:**

```json
{
  "success": true,
  "data": {
    "totalSent": 500,
    "totalDelivered": 480,
    "totalRead": 320,
    "totalFailed": 10,
    "totalPending": 10,
    "total": 1000
  }
}
```
