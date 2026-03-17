# API Routes

The library exposes three Express routers. Mount them on your Express app at paths of your choosing.

```ts
// Admin API (protect with your own auth middleware)
app.use('/api/email', eam.routes);

// SES webhook endpoint (public, signature-verified)
app.use('/webhooks/ses', eam.webhookRoutes.ses);

// Unsubscribe pages (public)
app.use('/unsubscribe', eam.unsubscribeRoutes);
```

## Authentication

This package does **not** include authentication. Routes are returned as bare Express routers — apply your own auth middleware when mounting:

```typescript
app.use('/api/email', authMiddleware, eam.routes);
```

> **Important:** Always protect admin routes with authentication. Only webhook and unsubscribe routes (if applicable) should be publicly accessible — they use signature verification or token-based validation respectively.

Webhook routes (`eam.webhookRoutes.ses`) and unsubscribe routes (`eam.unsubscribeRoutes`) are intentionally public and have their own verification mechanisms — SES webhooks use SNS signature verification, and unsubscribe routes use token-based validation.

## Admin Routes (`eam.routes`)

Mount behind your authentication middleware. All paths below are relative to the mount point.

### Accounts

| Method | Path | Description |
|--------|------|-------------|
| `GET` | `/accounts` | List all accounts (passwords redacted) |
| `POST` | `/accounts` | Create a new account |
| `GET` | `/accounts/capacity` | Get all accounts' capacity |
| `GET` | `/accounts/health` | Get all accounts' health |
| `GET` | `/accounts/warmup` | Get all accounts in warmup |
| `PATCH` | `/accounts/bulk-update` | Bulk update status/limits |
| `GET` | `/accounts/:id` | Get account by ID |
| `PUT` | `/accounts/:id` | Update account |
| `DELETE` | `/accounts/:id` | Delete account |
| `POST` | `/accounts/:id/test` | Test SMTP connection |
| `POST` | `/accounts/:id/check-bounces` | Trigger IMAP bounce check |
| `GET` | `/accounts/:id/warmup` | Get warmup status |
| `PUT` | `/accounts/:id/warmup/schedule` | Update warmup schedule |
| `POST` | `/accounts/:id/warmup/start` | Start warmup |
| `POST` | `/accounts/:id/warmup/complete` | Complete warmup |
| `POST` | `/accounts/:id/warmup/reset` | Reset warmup |
| `PUT` | `/accounts/:id/health/thresholds` | Update health thresholds |

**Create account request body:**

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

**Update account request body:** Same fields as create (all optional). Empty password values in `smtp` and `imap` are ignored.

**Bulk update request body:** `{ accountIds: string[], updates: { status?, dailyMax? } }`

**Update health thresholds request body:** `{ thresholds: { minScore?, maxBounceRate?, maxConsecutiveErrors? } }`

### Identifiers

**Identifier statuses:** `active`, `bounced`, `unsubscribed`, `blocked`, `invalid`

**Bounce types:** `hard`, `soft`, `inbox_full`, `invalid_email`

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

| Method | Path | Description |
|--------|------|-------------|
| `GET` | `/identifiers` | List identifiers (filterable by status) |
| `GET` | `/identifiers/:email` | Get identifier by email |
| `PATCH` | `/identifiers/:email/status` | Update identifier status |
| `POST` | `/identifiers/merge` | Merge two identifiers |

**Identifier query params:** `?status=` (filter by status), `?page=` (default 1), `?limit=` (default 50)

**Update identifier status request body:** `{ status: "active" | "bounced" | "unsubscribed" | "blocked" | "invalid" }`

**Merge identifiers request body:** `{ sourceEmail: string, targetEmail: string }`

### Drafts

| Method | Path | Description |
|--------|------|-------------|
| `GET` | `/drafts` | List drafts (filterable by status) |
| `GET` | `/drafts/count` | Count drafts by status |
| `POST` | `/drafts/bulk-approve` | Bulk approve drafts |
| `POST` | `/drafts/bulk-reject` | Bulk reject drafts |
| `GET` | `/drafts/:id` | Get draft by ID |
| `POST` | `/drafts/:id/approve` | Approve a draft |
| `POST` | `/drafts/:id/reject` | Reject a draft |
| `POST` | `/drafts/:id/send-now` | Send draft immediately |
| `PATCH` | `/drafts/:id/content` | Update draft content |

**Draft query params:** `?status=` (filter by status), `?page=` (default 1), `?limit=` (default 50)

**Bulk approve/reject request body:** `{ draftIds: string[], reason?: string }` (reason for reject only)

### Settings

| Method | Path | Description |
|--------|------|-------------|
| `GET` | `/settings` | Get all settings |
| `PUT` | `/settings` | Update all settings |
| `PATCH` | `/settings/timezone` | Update timezone |
| `PATCH` | `/settings/dev-mode` | Update dev mode |
| `PATCH` | `/settings/imap` | Update IMAP settings |
| `PATCH` | `/settings/approval` | Update approval settings |
| `PATCH` | `/settings/queues` | Update queue settings |
| `PATCH` | `/settings/ses` | Update SES settings |

### Queues

| Method | Path | Description |
|--------|------|-------------|
| `GET` | `/queues/stats` | Get send and approval queue stats |

## Webhook Routes (`eam.webhookRoutes.ses`)

| Method | Path | Description |
|--------|------|-------------|
| `POST` | `/` | Receive AWS SNS notifications |

See [SES Webhooks](./ses-webhooks.md) for setup details.

## Unsubscribe Routes (`eam.unsubscribeRoutes`)

| Method | Path | Description |
|--------|------|-------------|
| `GET` | `/` | Show unsubscribe confirmation page |
| `POST` | `/` | Process one-click unsubscribe (RFC 8058) |

See [Unsubscribe](./unsubscribe.md) for details.
