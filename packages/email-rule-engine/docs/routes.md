# Email Rule Engine -- API Routes

All routes are relative to the mount point you choose when calling `createRoutes()`.

All responses follow the shape `{ success: boolean, data?: ..., error?: string }`.

---

## Templates

### `GET /templates`

List all templates with optional filters.

| Query Param | Type | Description |
|---|---|---|
| `category` | string | Filter by category |
| `audience` | string | Filter by audience |
| `platform` | string | Filter by platform |
| `isActive` | `"true"` / `"false"` | Filter by active status |

**Response:** `{ success, data: { templates } }`

### `POST /templates`

Create a new template.

**Request body:**

| Field | Type | Required | Description |
|---|---|---|---|
| `name` | string | yes | Template name (must be unique) |
| `subject` | string | yes | Email subject (supports Handlebars) |
| `subjects` | string[] | no | Array of subject variants for A/B testing |
| `body` | string | yes | Email HTML body (supports Handlebars) |
| `bodies` | string[] | no | Array of body variants for A/B testing |
| `category` | string | yes | Must be a valid category value |
| `audience` | string | yes | Must be a valid audience value |
| `platform` | string | yes | Must be a valid platform value |

**Response:** `201 { success, data: { template } }`

### `POST /templates/validate`

Validate a template body for Handlebars syntax errors.

**Request body:**

| Field | Type | Required |
|---|---|---|
| `body` | string | yes |

**Response:** `{ success, data: { valid, errors? } }`

### `POST /templates/preview`

Preview raw template content without saving.

**Request body:**

| Field | Type | Required |
|---|---|---|
| `subject` | string | yes |
| `body` | string | yes |
| `textBody` | string | no |
| `sampleData` | object | no |

**Response:** `{ success, data: { subject, body, textBody? } }`

### `GET /templates/:id`

Get a single template by ID.

**Response:** `{ success, data: { template } }`

### `PUT /templates/:id`

Update a template by ID. Accepts same fields as create (all optional).

**Response:** `{ success, data: { template } }`

### `DELETE /templates/:id`

Delete a template by ID.

**Response:** `{ success: true }`

### `PATCH /templates/:id/toggle`

Toggle the `isActive` flag on a template.

**Response:** `{ success, data: { template } }`

### `POST /templates/:id/preview`

Preview a saved template rendered with sample data.

**Request body:**

| Field | Type | Required |
|---|---|---|
| `sampleData` | object | no |

**Response:** `{ success, data: { subject, body } }`

### `POST /templates/:id/test-email`

Send a test email using the template.

**Request body:**

| Field | Type | Required |
|---|---|---|
| `testEmail` | string | yes |
| `sampleData` | object | no |

**Response:** `{ success: true }`

---

## Rules

### `GET /rules`

List all rules.

**Response:** `{ success, data: { rules } }`

### `POST /rules`

Create a new rule.

**Request body:**

| Field | Type | Required | Description |
|---|---|---|---|
| `name` | string | yes | Rule name |
| `target` | object | yes | `{ role, platform, conditions[], mode?, identifiers? }`. Set `mode: "list"` and provide `identifiers` (string array of emails) for list-mode targeting |
| `templateId` | string | yes | ID of the template to use |
| `emailType` | string | no | Must be a valid email type |

**Response:** `201 { success, data: { rule } }`

### `GET /rules/run-history`

Get rule run history logs.

| Query Param | Type | Default | Description |
|---|---|---|---|
| `limit` | number | 20 | Max number of logs to return |

**Response:** `{ success, data: { logs } }`

### `GET /rules/:id`

Get a single rule by ID.

**Response:** `{ success, data: { rule } }`

### `PATCH /rules/:id`

Update a rule by ID. Accepts same fields as create (all optional).

**Response:** `{ success, data: { rule } }`

### `DELETE /rules/:id`

Delete (or disable) a rule by ID.

**Response:** `{ success, data: { deleted, disabled } }`

### `PATCH /rules/:id/toggle`

Toggle the `isActive` flag on a rule.

**Response:** `{ success, data: { rule } }`

### `POST /rules/:id/dry-run`

Simulate running a rule without sending emails.

**Response:** `{ success, data: { ...dryRunResult } }`

---

## Runner

### `POST /runner`

Trigger a manual run of all active rules. Returns immediately; the run executes in the background.

**Response:** `{ success, data: { message: "Rule run triggered", runId } }`

### `GET /runner/status`

Get the most recent rule run log entry.

**Response:** `{ success, data: { latestRun } }`

### `GET /runner/status/:runId`

Get real-time progress of a specific run by its `runId`.

**Response:** `{ success, data: { runId, status, currentRule, progress: { rulesTotal, rulesCompleted, sent, failed, skipped, invalid }, startedAt, elapsed } }`

### `POST /runner/cancel/:runId`

Cancel a running rule execution by its `runId`.

**Response:** `{ success, data: { ok } }`

---

## Settings

### `GET /settings/throttle`

Get the current throttle configuration.

**Response:** `{ success, data: { config } }`

### `PATCH /settings/throttle`

Update throttle configuration.

**Request body (all optional):**

| Field | Type | Constraints |
|---|---|---|
| `maxPerUserPerDay` | integer | >= 1 |
| `maxPerUserPerWeek` | integer | >= 1, must be >= `maxPerUserPerDay` |
| `minGapDays` | integer | >= 0 |

**Response:** `{ success, data: { config } }`
