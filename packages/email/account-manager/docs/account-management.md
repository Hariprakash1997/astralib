# Account Management

Accounts represent SMTP email senders. Each account has credentials, health tracking, warmup state, and daily send limits.

## Adding Accounts

Accounts can be created via the REST API (`POST /accounts`) or programmatically:

```ts
const account = await eam.accounts.create({
  email: 'outreach@yourdomain.com',
  senderName: 'Your Company',
  provider: 'gmail',  // 'gmail' | 'ses'
  smtp: {
    host: 'smtp.gmail.com',
    port: 587,
    user: 'outreach@yourdomain.com',
    pass: 'app-password',
  },
  imap: {                              // Optional, for bounce checking
    host: 'imap.gmail.com',
    port: 993,
    user: 'outreach@yourdomain.com',
    pass: 'app-password',
  },
  ses: {                               // Optional, for SES accounts
    region: 'us-east-1',
    configurationSet: 'my-config-set',
  },
  metadata: {                          // Optional freeform data
    sender_names: ['Sales', 'Support'],
    contact_number: '+1-555-0100',
  },
  limits: { dailyMax: 50 },           // Default: 50
  warmup: {
    schedule: [/* custom phases */],   // Falls back to config default
  },
  health: {
    thresholds: {                      // Falls back to config defaults
      minScore: 50,
      maxBounceRate: 0.1,
      maxConsecutiveErrors: 5,
    },
  },
});
```

## Providers

| Provider | Value | SMTP | IMAP Bounce Check | SES Webhooks |
|----------|-------|------|--------------------|--------------|
| Gmail    | `'gmail'` | Yes | Yes | No |
| AWS SES  | `'ses'`   | Yes (SES SMTP) | No | Yes |

### Gmail

- Uses standard SMTP (`smtp.gmail.com:587`) with an app password
- Supports IMAP bounce checking via `imap.gmail.com:993`
- Requires a Google App Password (not your regular password)

### AWS SES

- Uses SES SMTP endpoint (e.g., `email-smtp.us-east-1.amazonaws.com:587`)
- Supports SES webhooks for bounce/complaint/delivery notifications via SNS
- Requires a Configuration Set for event publishing

## Account Status Lifecycle

```
  warmup --> active --> disabled
    ^          |           |
    |          v           |
    +--- quota_exceeded    |
    |          |           |
    +----------+-----------+
              error
```

| Status | Description |
|--------|-------------|
| `warmup` | New account gradually increasing send volume |
| `active` | Fully operational, available for sending |
| `disabled` | Auto-disabled by health checks or manually disabled |
| `quota_exceeded` | Daily send limit reached, resets next day |
| `error` | Temporary error state, may recover |

## Metadata

Each account has an optional `metadata` field (`Record<string, unknown>`) for storing freeform, project-specific data -- for example, sender names, contact numbers, internal tags, or team assignments.

- **Type**: `Record<string, unknown>` (arbitrary key-value pairs)
- **Max size**: 64KB (serialized JSON). Exceeding this limit throws an error.
- **Sanitization**: Dangerous keys (`__proto__`, `constructor`, `prototype`) are automatically stripped.
- **Default**: `{}` (empty object)

```ts
await eam.accounts.create({
  email: 'outreach@yourdomain.com',
  provider: 'gmail',
  smtp: { host: 'smtp.gmail.com', port: 587, user: '...', pass: '...' },
  metadata: {
    sender_names: ['Sales Team', 'Support'],
    contact_number: '+1-555-0100',
    region: 'us-west',
  },
});

// Update metadata later
await eam.accounts.update(accountId, {
  metadata: { sender_names: ['Marketing'], region: 'eu-central' },
});
```

## Programmatic Account Operations

```ts
// List all accounts
const accounts = await eam.accounts.model.find({});

// Find by ID
const account = await eam.accounts.findById(accountId);

// Update
await eam.accounts.update(accountId, { senderName: 'New Name' });

// Delete
await eam.accounts.remove(accountId);
```

## Default Values

When creating an account with minimal input (`email`, `senderName`, `provider`, `smtp`), these defaults apply:

| Field | Default | Description |
|-------|---------|-------------|
| `status` | `warmup` | New accounts always start in warmup |
| `limits.dailyMax` | `50` | Conservative starting limit |
| `health.score` | `100` | Full health |
| `health.consecutiveErrors` | `0` | No errors yet |
| `health.bounceCount` | `0` | No bounces yet |
| `health.thresholds.minScore` | `50` | Disable below 50% health |
| `health.thresholds.maxBounceRate` | `0.1` | Disable above 10% bounce rate |
| `health.thresholds.maxConsecutiveErrors` | `5` | Disable after 5 consecutive errors |
| `warmup.enabled` | `true` | Warmup active |
| `warmup.currentDay` | `1` | Start from day 1 |
| `warmup.schedule` | Config default or `[]` | Set via `config.options.warmup.defaultSchedule` |
| `totalEmailsSent` | `0` | Fresh counter |
| `metadata` | `{}` | Empty |

Health thresholds can be overridden per-account at creation or via config-level `healthDefaults`.

## Related

- [Health Tracking](./health-tracking.md) -- how health scores affect account status
- [Warmup System](./warmup-system.md) -- gradual volume increase for new accounts
- [API Routes](./api-routes.md) -- REST endpoints for account management
