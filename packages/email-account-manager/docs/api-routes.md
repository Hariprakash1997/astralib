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

### Identifiers

| Method | Path | Description |
|--------|------|-------------|
| `GET` | `/identifiers` | List identifiers (filterable by status) |
| `GET` | `/identifiers/:email` | Get identifier by email |
| `PATCH` | `/identifiers/:email/status` | Update identifier status |
| `POST` | `/identifiers/merge` | Merge two identifiers |

### Drafts

| Method | Path | Description |
|--------|------|-------------|
| `GET` | `/drafts` | List drafts (filterable by status) |
| `GET` | `/drafts/count` | Count drafts by status |
| `POST` | `/drafts/bulk-approve` | Bulk approve drafts |
| `POST` | `/drafts/bulk-reject` | Bulk reject drafts |
| `GET` | `/drafts/:id` | Get draft by ID |
| `PATCH` | `/drafts/:id/approve` | Approve a draft |
| `PATCH` | `/drafts/:id/reject` | Reject a draft |
| `POST` | `/drafts/:id/send-now` | Send draft immediately |
| `PATCH` | `/drafts/:id/content` | Update draft content |

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
