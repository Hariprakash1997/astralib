# API Routes

All routes are mounted under your chosen prefix (e.g., `/api/email-rules`). All responses use `{ success: boolean, data?: any, error?: string }`.

## Authentication

This package does **not** include authentication. Routes are returned as bare Express routers — apply your own auth middleware when mounting:

```typescript
app.use('/api/email-rules', authMiddleware, engine.routes);
```

> **Important:** Always protect admin routes with authentication. Only webhook and unsubscribe routes (if applicable) should be publicly accessible — they use signature verification or token-based validation respectively.

## Templates

| Method | Path | Description |
|--------|------|-------------|
| `GET` | `/templates` | List templates (filter by `?category=`, `?audience=`, `?platform=`, `?isActive=`) |
| `POST` | `/templates` | Create a new template. Accepts optional `fields` (`Record<string, string>`) for custom placeholder defaults |
| `POST` | `/templates/validate` | Validate MJML + Handlebars syntax without saving |
| `POST` | `/templates/preview` | Preview raw template with sample data (no save) |
| `GET` | `/templates/:id` | Get template by ID |
| `PUT` | `/templates/:id` | Update template (auto-increments `version`). Accepts `fields` (optional `Record<string, string>` of custom placeholder values) |
| `DELETE` | `/templates/:id` | Delete template |
| `PATCH` | `/templates/:id/toggle` | Toggle `isActive` on/off |
| `POST` | `/templates/:id/preview` | Render saved template with sample data |
| `POST` | `/templates/:id/test-email` | Send a test email (requires `sendTestEmail` adapter) |

**Create template:**

```bash
curl -X POST http://localhost:3000/api/email-rules/templates \
  -H "Content-Type: application/json" \
  -d '{
    "name": "Welcome Email",
    "slug": "welcome-email",
    "category": "onboarding",
    "audience": "customer",
    "platform": "web",
    "subjects": ["Welcome to {{platform.name}}, {{user.name}}!"],
    "bodies": ["<mj-text>Hi {{user.name}}, welcome aboard!</mj-text>"],
    "fields": { "whatsapp_link": "https://wa.me/919876543210" }
  }'
```

**Preview without saving:**

```bash
curl -X POST http://localhost:3000/api/email-rules/templates/preview \
  -H "Content-Type: application/json" \
  -d '{
    "subjects": ["Hello {{user.name}}"],
    "bodies": ["<mj-text>Welcome, {{user.name}}!</mj-text>"],
    "sampleData": { "user": { "name": "John" } }
  }'
```

## Rules

| Method | Path | Description |
|--------|------|-------------|
| `GET` | `/rules` | List all rules (with populated template name/slug) |
| `POST` | `/rules` | Create a new rule (validates template compatibility). Accepts optional `validFrom` and `validTill` (Date) for time-windowed activation |
| `GET` | `/rules/run-history` | Get execution history (`?limit=20`) |
| `GET` | `/rules/:id` | Get rule by ID |
| `PATCH` | `/rules/:id` | Update a rule (accepts `validFrom` and `validTill`) |
| `DELETE` | `/rules/:id` | Delete rule (disables instead if it has send history) |
| `PATCH` | `/rules/:id/toggle` | Toggle `isActive` (validates template is active before enabling) |
| `POST` | `/rules/:id/dry-run` | Count matching users without sending |

**Create rule:**

```bash
curl -X POST http://localhost:3000/api/email-rules/rules \
  -H "Content-Type: application/json" \
  -d '{
    "name": "Welcome new customers",
    "templateId": "6654abc123...",
    "target": {
      "role": "customer",
      "platform": "web",
      "conditions": [
        { "field": "isNewUser", "operator": "eq", "value": true }
      ]
    },
    "sendOnce": true,
    "autoApprove": true,
    "sortOrder": 1,
    "maxPerRun": 200,
    "validFrom": "2026-11-28T00:00:00Z",
    "validTill": "2026-12-01T23:59:59Z"
  }'
```

**Delete behavior:** If a rule has `totalSent > 0`, it is disabled (`isActive: false`) instead of deleted, preserving send history. The response indicates `{ deleted: false, disabled: true }`.

## Runner

| Method | Path | Description |
|--------|------|-------------|
| `POST` | `/runner` | Trigger a manual run (non-blocking, returns `{ runId }` immediately) |
| `GET` | `/runner/status` | Get the most recent run log entry |
| `GET` | `/runner/status/:runId` | Get progress for a specific run |
| `POST` | `/runner/cancel/:runId` | Gracefully cancel a running execution |

**Run history response:**

```json
{
  "success": true,
  "data": {
    "logs": [{
      "runAt": "2026-03-14T09:00:00Z",
      "triggeredBy": "cron",
      "duration": 45230,
      "rulesProcessed": 3,
      "totalStats": {
        "matched": 500, "sent": 342, "skipped": 148, "skippedByThrottle": 10, "errors": 0
      },
      "perRuleStats": [{
        "ruleId": "...", "ruleName": "Welcome new customers",
        "matched": 200, "sent": 180, "skipped": 20, "skippedByThrottle": 0, "errors": 0
      }]
    }]
  }
}
```

## Settings

| Method | Path | Description |
|--------|------|-------------|
| `GET` | `/settings/throttle` | Get current throttle config |
| `PATCH` | `/settings/throttle` | Update throttle config (all fields optional) |

Validation: `maxPerUserPerWeek` must be >= `maxPerUserPerDay`. Both must be positive integers. `minGapDays` must be a non-negative integer.
