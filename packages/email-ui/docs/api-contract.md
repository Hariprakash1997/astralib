# API Response Contract

> **This document is the source of truth for API response shapes.** All backend endpoints consumed by `@astralibx/email-ui` MUST follow this contract. Changing response shapes without updating this document and the UI will break the frontend.

## Response Envelope

Every API response uses a consistent envelope:

```json
{
  "success": true,
  "data": { ... }
}
```

**Error responses:**

```json
{
  "success": false,
  "error": "Human-readable error message"
}
```

### How the UI Unwraps Responses

The `HttpClient` in `src/api/http-client.ts` processes responses in this order:

1. Non-2xx status → throws `HttpClientError`
2. 204 No Content → returns `undefined`
3. `success: false` → throws error with `json.error` message
4. `success: true` → returns `json.data`
5. **Auto-unwrap:** If `data` is an object with exactly 1 key whose value is a non-array object, it unwraps one level (e.g., `{ account: {...} }` → `{...}`)
6. Multi-key objects and arrays pass through as-is

**This means components receive `json.data` (or its unwrapped inner value), never the raw envelope.**

---

## Account Manager API (`/mailer/eam`)

### `GET /accounts`

**Component:** `<alx-account-list>`

**Query params:** `page`, `limit`, `status`, `provider`

**Response `data`:**
```json
{
  "accounts": [
    {
      "_id": "string",
      "email": "string",
      "senderName": "string",
      "provider": "gmail | ses",
      "status": "active | disabled | error | warmup",
      "smtp": {
        "host": "string",
        "port": "number",
        "user": "string"
      },
      "imap": {
        "host": "string",
        "port": "number",
        "user": "string"
      },
      "limits": {
        "dailyMax": "number"
      },
      "health": {
        "score": "number (0-100)",
        "consecutiveErrors": "number",
        "bounceCount": "number",
        "thresholds": {
          "minScore": "number",
          "maxBounceRate": "number",
          "maxConsecutiveErrors": "number"
        }
      },
      "warmup": {
        "enabled": "boolean",
        "currentDay": "number",
        "schedule": "array"
      },
      "metadata": {
        "key": "string | string[]"
      },
      "totalEmailsSent": "number",
      "createdAt": "ISO 8601 string",
      "updatedAt": "ISO 8601 string"
    }
  ],
  "total": "number (optional)"
}
```

**UI reads:** `data.accounts[]`, `data.total`

> **DO NOT rename** `accounts` to `items`, `results`, etc. The UI destructures `res.accounts`.

---

### `GET /accounts/:id`

**Component:** `<alx-account-form>` (edit mode)

**Response `data`:**
```json
{
  "account": {
    "_id": "string",
    "email": "string",
    "senderName": "string",
    "provider": "string",
    "smtp": { "host": "string", "port": "number", "user": "string", "pass": "string" },
    "imap": { "host": "string", "port": "number", "user": "string", "pass": "string" },
    "metadata": { ... },
    ...
  }
}
```

**UI reads:** Auto-unwrapped (single-key `account`) → receives the inner account object directly.

> **DO NOT add** a second key to this response (e.g., `{ account: {...}, meta: {...} }`). The auto-unwrap depends on exactly 1 key.

---

### `POST /accounts`

**Component:** `<alx-account-form>` (create)

**Request body:**
```json
{
  "email": "string (required)",
  "senderName": "string",
  "provider": "gmail | ses",
  "smtp": { "host": "string", "port": "number", "user": "string", "pass": "string" },
  "imap": { "host": "string", "port": "number", "user": "string", "pass": "string" },
  "metadata": { ... }
}
```

**Response `data`:** Created account object (same shape as GET by ID).

---

### `PUT /accounts/:id`

**Component:** `<alx-account-form>` (update)

**Request/Response:** Same shape as POST.

---

### `DELETE /accounts/:id`

**Component:** `<alx-account-list>`, `<alx-account-form>`

**Response `data`:** Any (UI ignores response body).

---

### `GET /accounts/:id/health`

**Component:** `<alx-account-health>`

**Response `data`:**
```json
{
  "health": {
    "score": "number",
    "consecutiveErrors": "number",
    "bounceCount": "number",
    "lastChecked": "ISO 8601 string"
  }
}
```

---

### `GET /accounts/health`

**Component:** `<alx-account-health>` (all accounts overview)

**Response `data`:** Array or object of health records per account.

---

### `GET /accounts/capacity`

**Component:** `<alx-account-capacity>`

**Response `data`:** Array of account capacity objects.

---

### `GET /accounts/:id/warmup`

**Component:** `<alx-account-warmup>`

**Response `data`:**
```json
{
  "warmup": {
    "enabled": "boolean",
    "currentDay": "number",
    "schedule": "array",
    "startedAt": "ISO 8601 string"
  }
}
```

---

### `POST /accounts/:id/warmup/start`

**Response `data`:** Updated warmup object.

---

### `POST /accounts/:id/test`

**Component:** `<alx-smtp-tester>`

**Response `data`:**
```json
{
  "success": true,
  "message": "string"
}
```

---

### `GET /settings`

**Component:** `<alx-global-settings>`

**Response `data`:**
```json
{
  "settings": {
    "timezone": "string",
    "devMode": "boolean",
    "imap": {
      "enabled": "boolean",
      "pollIntervalMinutes": "number"
    },
    "approval": {
      "enabled": "boolean",
      "autoApproveAfterMinutes": "number"
    },
    "queue": {
      "concurrency": "number",
      "retryAttempts": "number",
      "retryDelayMs": "number"
    }
  }
}
```

> Auto-unwrapped (single-key `settings`). **DO NOT** add a second key.

---

### `PATCH /settings`

**Request body:** Partial settings object. Only send changed fields.

**Response `data`:** Updated settings object.

---

### `GET /identifiers`

**Component:** `<alx-rule-editor>` (list mode)

**Response `data`:** `{ identifiers: [...], total: number }`

---

### `GET /drafts`

**Component:** `<alx-approval-queue>`

**Response `data`:** `{ drafts: [...], total: number }`

---

### `POST /drafts/:id/approve` / `POST /drafts/:id/reject`

**Response `data`:** Updated draft object.

---

### `POST /drafts/bulk-approve`

**Request body:** `{ ids: ["string"] }`

**Response `data`:** `{ approved: number }`

---

## Rule Engine API (`/mailer/engine`)

### `GET /templates`

**Component:** `<alx-template-list>`, `<alx-rule-editor>` (template dropdown)

**Query params:** `page`, `limit`, `category`, `audience`, `platform`, `_id`

**Response `data`:**
```json
{
  "templates": [
    {
      "_id": "string",
      "name": "string",
      "slug": "string",
      "category": "string",
      "audience": "string",
      "platform": "string",
      "subjects": ["string"],
      "bodies": ["string"],
      "preheaders": ["string"],
      "fields": { "key": "string" },
      "textBody": "string",
      "variables": ["string"],
      "isActive": "boolean"
    }
  ],
  "total": "number (optional)"
}
```

**UI reads:** `res.templates[]`, `res.total`

> **DO NOT rename** `templates` key. UI destructures it directly.

---

### `POST /templates` / `PUT /templates/:id` / `DELETE /templates/:id`

Standard CRUD. Response returns the template object.

---

### `POST /templates/preview`

**Component:** `<alx-template-editor>` (preview button)

**Request body:** `{ body: "string", subject: "string", variables: ["string"] }`

**Response `data`:**
```json
{
  "html": "string (rendered HTML)"
}
```

> This HTML is rendered in a sandboxed iframe. Keep it safe.

---

### `GET /rules`

**Component:** `<alx-rule-list>`

**Query params:** `page`, `limit`, `_id`

**Response `data`:**
```json
{
  "rules": [
    {
      "_id": "string",
      "name": "string",
      "templateName": "string (optional, for display)",
      "templateId": "string",
      "isActive": "boolean",
      "lastRunAt": "ISO 8601 string | null",
      "totalSent": "number",
      "totalSkipped": "number"
    }
  ],
  "total": "number (optional)"
}
```

**UI reads:** `res.rules[]`, `res.total`

---

### `POST /rules` / `PUT /rules/:id` / `DELETE /rules/:id`

Standard CRUD. Request body matches the `RuleData` interface.

---

### `POST /rules/:id/toggle`

**Response `data`:** Updated rule object.

---

### `POST /rules/:id/dry-run`

**Response `data`:** Dry run result (matched count, etc.).

---

### `POST /runner`

**Component:** `<alx-run-history>` (Run Now button)

**Response `data`:**
```json
{
  "runId": "string"
}
```

**UI reads:** `res.runId` (with fallback to `res._id`)

> **DO NOT** wrap this in another object. The auto-unwrap will handle `{ data: { runId: "..." } }` from the envelope.

---

### `POST /runner/cancel/:runId`

**Response `data`:** Any (UI ignores body, reloads history).

---

### `GET /runner/status` / `GET /runner/status/:runId`

**Response `data`:** Run status object.

---

### `GET /runner/logs`

**Component:** `<alx-run-history>`

**Query params:** `page`, `limit`, `from`, `to`

**Response `data`:**
```json
{
  "logs": [
    {
      "_id": "string",
      "runId": "string (optional)",
      "runAt": "ISO 8601 string",
      "status": "running | completed | failed | cancelled",
      "triggeredBy": "string",
      "duration": "number (ms)",
      "rulesProcessed": "number",
      "totalSent": "number",
      "totalSkipped": "number",
      "totalErrors": "number",
      "perRuleStats": [
        {
          "ruleName": "string",
          "ruleId": "string",
          "sent": "number",
          "skipped": "number",
          "errors": "number"
        }
      ]
    }
  ],
  "total": "number (optional)"
}
```

**UI reads:** `res.logs[]`, `res.total`

---

### `GET /throttle`

**Component:** `<alx-throttle-settings>`

**Response `data`:**
```json
{
  "maxPerUserPerDay": "number",
  "maxPerUserPerWeek": "number",
  "minGapDays": "number"
}
```

> **Note:** This is a flat object, not wrapped in a `throttle` key. It passes through the auto-unwrap unchanged because it has 3 keys.

---

### `PUT /throttle`

**Request body:** Same shape as GET response.

---

## Analytics API (`/mailer/analytics`)

### `GET /overview`

**Component:** `<alx-analytics-overview>`

**Query params:** `from`, `to`

**Response `data`:** Overview metrics object.

---

### `GET /timeline`

**Component:** `<alx-analytics-timeline>`

**Query params:** `from`, `to`

**Response `data`:** Array of daily/hourly data points.

---

### `GET /accounts`

**Component:** `<alx-analytics-accounts>`

**Response `data`:** Per-account stats array.

---

### `GET /rules`

**Component:** `<alx-analytics-rules>`

**Response `data`:** Per-rule stats array.

---

### `GET /templates`

**Response `data`:** Per-template stats array.

---

### `POST /aggregate`

**Response `data`:** Aggregation result.

---

### `GET /channels`

**Component:** `<alx-analytics-channels>`

**Query params:** `dateFrom`, `dateTo`, `type` (event type filter, default: clicked)

**Response `data`:**
```json
{
  "channels": [
    {
      "channel": "whatsapp | telegram | email | sms | web | form | phone | other",
      "count": "number",
      "sent": "number",
      "opened": "number",
      "clicked": "number",
      "bounced": "number",
      "unsubscribed": "number"
    }
  ],
  "total": "number"
}
```

**UI reads:** `res.channels[]`

---

### `POST /track`

**Component:** Direct API call (no UI component — used by external tracking pages)

**CORS:** Enabled

**Request body:**
```json
{
  "type": "clicked (required — EventType enum)",
  "recipientEmail": "string (required if no externalUserId)",
  "externalUserId": "string (required if no recipientEmail)",
  "channel": "string (optional — EventChannel enum)",
  "ruleId": "string (optional)",
  "templateId": "string (optional)",
  "accountId": "string (optional)",
  "metadata": "object (optional)"
}
```

**Response `data`:** `{ ok: true }`

---

## Auto-Unwrap Rules (Critical)

The HTTP client auto-unwraps single-item responses:

```
{ success: true, data: { account: { _id: "..." } } }
                        ^^^^^^^^^^^^^^^^^^^^^^^^^
                        1 key, value is object → unwrapped
                        Component receives: { _id: "..." }
```

```
{ success: true, data: { accounts: [...], total: 5 } }
                        ^^^^^^^^^^^^^^^^^^^^^^^^^^^^^
                        2 keys → NOT unwrapped
                        Component receives: { accounts: [...], total: 5 }
```

### Endpoints That Depend on Auto-Unwrap

| Endpoint | Response `data` shape | Unwrap? |
|----------|----------------------|---------|
| `GET /accounts/:id` | `{ account: {...} }` | YES → inner object |
| `GET /accounts/:id/health` | `{ health: {...} }` | YES → inner object |
| `GET /accounts/:id/warmup` | `{ warmup: {...} }` | YES → inner object |
| `GET /settings` | `{ settings: {...} }` | YES → inner object |
| All list endpoints | `{ items: [...], total: N }` | NO (2+ keys) |
| `GET /throttle` | `{ maxPerUserPerDay: N, ... }` | NO (3 keys) |
| `POST /runner` | `{ runId: "..." }` | NO (string value, not object) |

### Rules for Backend Developers

1. **Never add a second key** to single-key object responses — it silently breaks unwrap
2. **Never rename** list keys (`accounts`, `templates`, `rules`, `logs`, `drafts`)
3. **Always include** `total` in paginated list responses
4. **Always use** ISO 8601 for dates
5. **Always use** `_id` as the primary key field name
6. **Always wrap** in `{ success: true/false, data: ... }` envelope
7. **Error responses** must have `{ success: false, error: "message" }`
