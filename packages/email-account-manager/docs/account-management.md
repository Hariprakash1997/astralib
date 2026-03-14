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
  limits: { dailyMax: 450 },          // Default: 450
  warmup: {
    schedule: [/* custom phases */],   // Falls back to config default
  },
  health: {
    thresholds: {                      // Falls back to config defaults
      minScore: 50,
      maxBounceRate: 5,
      maxConsecutiveErrors: 10,
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

## Related

- [Health Tracking](./health-tracking.md) -- how health scores affect account status
- [Warmup System](./warmup-system.md) -- gradual volume increase for new accounts
- [API Routes](./api-routes.md) -- REST endpoints for account management
