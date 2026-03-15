# Email Account Manager -- API Routes

The package exposes three route groups:

- **Admin routes** -- mounted via `createAdminRoutes()`
- **SES webhook routes** -- mounted via `createSesWebhookRoutes()`
- **Unsubscribe routes** -- mounted via `createUnsubscribeRoutes()`

All responses follow the shape `{ success: boolean, data?: ..., error?: string }` unless noted otherwise.

---

## Admin Routes

### Accounts

#### `GET /accounts`

List all email accounts (passwords excluded from response).

**Response:** `{ success, data: { accounts } }`

#### `POST /accounts`

Create a new email account. Starts in `warmup` status.

**Request body:**

| Field | Type | Required | Description |
|---|---|---|---|
| `email` | string | yes | Email address |
| `senderName` | string | yes | Display name |
| `provider` | string | no | Provider identifier |
| `smtp` | object | no | `{ host, port, user, pass, secure? }` |
| `imap` | object | no | `{ host, port, user, pass }` |
| `ses` | object | no | SES configuration |
| `limits.dailyMax` | number | no | Daily send limit (default 450) |
| `health.thresholds` | object | no | `{ minScore, maxBounceRate, maxConsecutiveErrors }` |
| `warmup.schedule` | array | no | Warmup schedule entries |
| `metadata` | object | no | Freeform project-specific data (e.g., `{ sender_names: [...], contact_numbers: [...] }`). Max 64KB. Keys `__proto__`, `constructor`, `prototype` are stripped. |

**Response:** `201 { success, data: { account } }`

#### `GET /accounts/capacity`

Get current sending capacity across all accounts.

**Response:** `{ success, data: { ...capacityInfo } }`

#### `GET /accounts/health`

Get health status for all accounts.

**Response:** `{ success, data: { accounts } }`

#### `GET /accounts/warmup`

Get warmup status for all accounts currently in warmup.

**Response:** `{ success, data: { accounts } }`

#### `PATCH /accounts/bulk-update`

Bulk update multiple accounts.

**Request body:**

| Field | Type | Required |
|---|---|---|
| `accountIds` | string[] | yes |
| `updates.status` | string | no |
| `updates.dailyMax` | number | no |

**Response:** `{ success, data: { matched, modified } }`

#### `GET /accounts/:id`

Get a single account by ID (passwords excluded).

**Response:** `{ success, data: { account } }`

#### `PUT /accounts/:id`

Update an account by ID.

**Request body:**

| Field | Type | Description |
|---|---|---|
| `senderName` | string | Display name |
| `status` | string | Account status |
| `smtp` | object | SMTP settings (empty pass is ignored) |
| `imap` | object | IMAP settings (empty pass is ignored) |
| `ses` | object | SES settings |
| `limits.dailyMax` | number | Daily send limit |
| `metadata` | object | Freeform project-specific data. Max 64KB. |

**Response:** `{ success, data: { account } }`

#### `DELETE /accounts/:id`

Delete an account by ID.

**Response:** `{ success: true }`

#### `POST /accounts/:id/test`

Test SMTP connection for an account.

**Response:** `{ success, data: { ...testResult } }`

#### `POST /accounts/:id/check-bounces`

Check for bounced emails via IMAP. Requires IMAP bounce checker to be configured.

**Response:** `{ success, data: { ...bounceResult } }`

#### `GET /accounts/:id/warmup`

Get warmup status for a specific account.

**Response:** `{ success, data: { ...warmupStatus } }`

#### `PUT /accounts/:id/warmup/schedule`

Update the warmup schedule for an account.

**Request body:**

| Field | Type | Required |
|---|---|---|
| `schedule` | array | yes |

**Response:** `{ success: true }`

#### `POST /accounts/:id/warmup/start`

Start warmup for an account.

**Response:** `{ success: true }`

#### `POST /accounts/:id/warmup/complete`

Mark warmup as complete for an account.

**Response:** `{ success: true }`

#### `POST /accounts/:id/warmup/reset`

Reset warmup state for an account.

**Response:** `{ success: true }`

#### `PUT /accounts/:id/health/thresholds`

Update health thresholds for an account.

**Request body:**

| Field | Type |
|---|---|
| `thresholds.minScore` | number |
| `thresholds.maxBounceRate` | number |
| `thresholds.maxConsecutiveErrors` | number |

**Response:** `{ success, data: { account } }`

---

### Identifiers

**Identifier statuses:** `active`, `bounced`, `unsubscribed`, `blocked`, `invalid`

**Bounce types** (stored in `bounceType` field when status is `bounced`): `hard`, `soft`, `inbox_full`, `invalid_email`

**Identifier object shape:**

| Field | Type | Description |
|---|---|---|
| `email` | string | Email address (lowercase) |
| `status` | string | Current status |
| `sentCount` | number | Total emails sent |
| `bounceCount` | number | Total bounces |
| `bounceType` | string | Most recent bounce classification |
| `lastSentAt` | Date | When last email was sent |
| `lastBouncedAt` | Date | When last bounce occurred |
| `unsubscribedAt` | Date | When unsubscribed |
| `metadata` | object | Custom data |

**How statuses are set automatically:**

| Trigger | Status | bounceType |
|---|---|---|
| IMAP: "inbox full" / "mailbox full" | `bounced` | `inbox_full` |
| IMAP: "address not found" / "user unknown" | `bounced` | `invalid_email` |
| IMAP: other bounce | `bounced` | `soft` |
| SES: Permanent bounce (noemail/general) | `invalid` | `hard` |
| SES: Transient bounce (mailboxfull) | `bounced` | `inbox_full` |
| SES: Transient bounce (other) | `bounced` | `soft` |
| SES: Complaint | `blocked` | -- |
| Unsubscribe link | `unsubscribed` | -- |

#### `GET /identifiers`

List recipient identifiers with pagination.

| Query Param | Type | Default | Description |
|---|---|---|---|
| `status` | string | -- | Filter by status (e.g., `bounced`, `active`) |
| `page` | number | 1 | Page number |
| `limit` | number | 50 | Items per page |

**Response:** `{ success, data: { identifiers, total, page, limit } }`

#### `GET /identifiers/:email`

Look up an identifier by email address.

**Response:** `{ success, data: { identifier } }`

#### `PATCH /identifiers/:email/status`

Update the status of an identifier.

**Request body:**

| Field | Type | Required | Description |
|---|---|---|---|
| `status` | string | yes | One of: `active`, `bounced`, `unsubscribed`, `blocked`, `invalid` |

**Response:** `{ success: true }`

#### `POST /identifiers/merge`

Merge two identifier records.

**Request body:**

| Field | Type | Required |
|---|---|---|
| `sourceEmail` | string | yes |
| `targetEmail` | string | yes |

**Response:** `{ success: true }`

---

### Drafts / Approval

#### `GET /drafts`

List email drafts with pagination.

| Query Param | Type | Default | Description |
|---|---|---|---|
| `status` | string | -- | Filter by status |
| `page` | number | 1 | Page number |
| `limit` | number | 50 | Items per page |

**Response:** `{ success, data: { drafts, total, page, limit } }`

#### `GET /drafts/count`

Get draft counts grouped by status.

**Response:** `{ success, data: { pending, approved, rejected, ... } }`

#### `POST /drafts/bulk-approve`

Approve multiple drafts at once.

**Request body:**

| Field | Type | Required |
|---|---|---|
| `draftIds` | string[] | yes |

**Response:** `{ success, data: { approved: N } }`

#### `POST /drafts/bulk-reject`

Reject multiple drafts at once.

**Request body:**

| Field | Type | Required |
|---|---|---|
| `draftIds` | string[] | yes |
| `reason` | string | no |

**Response:** `{ success, data: { rejected: N } }`

#### `GET /drafts/:id`

Get a single draft by ID.

**Response:** `{ success, data: { draft } }`

#### `PATCH /drafts/:id/approve`

Approve a single draft.

**Response:** `{ success: true }`

#### `PATCH /drafts/:id/reject`

Reject a single draft.

**Request body:**

| Field | Type | Required |
|---|---|---|
| `reason` | string | no |

**Response:** `{ success: true }`

#### `POST /drafts/:id/send-now`

Immediately send an approved draft.

**Response:** `{ success: true }`

#### `PATCH /drafts/:id/content`

Edit draft content before approval.

**Request body:** Draft content fields (subject, body, etc.)

**Response:** `{ success, data: { draft } }`

---

### Settings

#### `GET /settings`

Get all settings.

**Response:** `{ success, data: { settings } }`

#### `PUT /settings`

Replace all settings.

**Request body:** Full settings object.

**Response:** `{ success, data: { settings } }`

#### `PATCH /settings/timezone`

Update timezone setting.

**Request body:** `{ timezone: string }`

**Response:** `{ success, data: { settings } }`

#### `PATCH /settings/dev-mode`

Update dev mode settings.

**Request body:** Dev mode configuration object.

**Response:** `{ success, data: { settings } }`

#### `PATCH /settings/imap`

Update IMAP settings.

**Request body:** IMAP configuration object.

**Response:** `{ success, data: { settings } }`

#### `PATCH /settings/approval`

Update approval workflow settings.

**Request body:** Approval configuration object.

**Response:** `{ success, data: { settings } }`

#### `PATCH /settings/queues`

Update queue settings.

**Request body:** Queue configuration object.

**Response:** `{ success, data: { settings } }`

#### `PATCH /settings/ses`

Update SES settings.

**Request body:** SES configuration object.

**Response:** `{ success, data: { settings } }`

---

### Queue Stats

#### `GET /queues/stats`

Get statistics for all processing queues.

**Response:** `{ success, data: { ...queueStats } }`

---

## SES Webhook Routes

Mounted separately via `createSesWebhookRoutes()`.

### `POST /`

Receive SNS notifications from AWS SES (bounces, complaints, deliveries). Accepts both `text/*` and `application/json` content types. The handler verifies SNS message signatures.

**Request body:** Raw SNS message (JSON).

**Response:** `{ success, ...result }`

---

## Unsubscribe Routes

Mounted separately via `createUnsubscribeRoutes()`.

### `GET /`

Browser-facing unsubscribe endpoint. Processes the token and returns an HTML confirmation page.

| Query Param | Type | Required |
|---|---|---|
| `token` | string | yes |

**Response:** HTML page (not JSON).

### `POST /`

Programmatic unsubscribe endpoint.

**Request body / query:**

| Field | Type | Required |
|---|---|---|
| `token` | string | yes |

**Response:** `{ success, error? }`
