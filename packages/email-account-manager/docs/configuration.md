# Configuration Reference

The `createEmailAccountManager()` factory accepts a single `EmailAccountManagerConfig` object. This page documents every field.

## Full Config Example

```ts
import type { EmailAccountManagerConfig } from '@astralibx/email-account-manager';

const config: EmailAccountManagerConfig = {
  // --- Required ---
  db: {
    connection: mongooseConnection,    // Mongoose Connection instance
    collectionPrefix: 'myapp_',        // Optional prefix for all collection names
  },
  redis: {
    connection: redisInstance,          // ioredis instance
    keyPrefix: 'eam:',                 // Optional prefix for Redis keys (default: 'eam:')
  },

  // --- Optional ---
  logger: {
    info: (msg, meta) => {},
    warn: (msg, meta) => {},
    error: (msg, meta) => {},
  },

  options: {
    warmup: {
      defaultSchedule: [
        { days: [1, 3],   dailyLimit: 5,   delayMinMs: 60000,  delayMaxMs: 180000 },
        { days: [4, 7],   dailyLimit: 15,  delayMinMs: 30000,  delayMaxMs: 120000 },
        { days: [8, 14],  dailyLimit: 30,  delayMinMs: 15000,  delayMaxMs: 60000  },
        { days: [15, 21], dailyLimit: 80,  delayMinMs: 5000,   delayMaxMs: 30000  },
        { days: [22, 0],  dailyLimit: 200, delayMinMs: 2000,   delayMaxMs: 10000  },
        // days: [22, 0] means "day 22 onwards" (0 = no upper bound)
      ],
    },

    healthDefaults: {
      minScore: 50,              // Auto-disable below this score
      maxBounceRate: 5,          // Auto-disable above this bounce %
      maxConsecutiveErrors: 10,  // Auto-disable after N consecutive failures
    },

    ses: {
      enabled: true,
      validateSignature: true,     // Verify SNS message signatures (default: true)
      allowedTopicArns: [          // Restrict to specific SNS topic ARNs
        'arn:aws:sns:us-east-1:123456789:ses-notifications',
      ],
    },

    unsubscribe: {
      builtin: {
        enabled: true,
        secret: 'your-hmac-secret-key',
        baseUrl: 'https://yourdomain.com/unsubscribe',
        tokenExpiryDays: 365,
      },
      // OR provide a custom URL generator:
      // generateUrl: (email, accountId) => `https://yourdomain.com/unsub/${email}`,
    },

    queues: {
      sendQueueName: 'email-send',         // Default: 'email-send'
      approvalQueueName: 'email-approved', // Default: 'email-approved'
    },
  },

  hooks: {
    onAccountDisabled: ({ accountId, reason }) => {},
    onWarmupComplete: ({ accountId, email }) => {},
    onHealthDegraded: ({ accountId, healthScore }) => {},
    onSend: ({ accountId, email, messageId }) => {},
    onSendError: ({ accountId, email, error }) => {},
    onBounce: ({ accountId, email, bounceType, provider }) => {},
    onComplaint: ({ accountId, email }) => {},
    onDelivery: ({ accountId, email }) => {},
    onOpen: ({ accountId, email, timestamp }) => {},
    onClick: ({ accountId, email, link }) => {},
    onUnsubscribe: ({ email, accountId }) => {},
    onDraftCreated: ({ draftId, to, subject }) => {},
    onDraftApproved: ({ draftId, to, scheduledAt }) => {},
    onDraftRejected: ({ draftId, to, reason }) => {},
  },
};
```

## Section Details

### `db` (required)

| Field | Type | Default | Description |
|-------|------|---------|-------------|
| `connection` | `mongoose.Connection` | -- | A Mongoose connection instance |
| `collectionPrefix` | `string` | `''` | Prefix prepended to all MongoDB collection names |

### `redis` (required)

| Field | Type | Default | Description |
|-------|------|---------|-------------|
| `connection` | `Redis` (ioredis) | -- | An ioredis instance |
| `keyPrefix` | `string` | `'eam:'` | Prefix for all Redis keys |

> **Multi-project warning:** `keyPrefix` defaults to `'eam:'`. If multiple projects share the same Redis, set unique prefixes (e.g., `'myproject-eam:'`) to prevent BullMQ queue collisions. See README for details.

### `logger` (optional)

Provide an object with `info`, `warn`, and `error` methods. Each receives `(message: string, meta?: Record<string, unknown>)`. If omitted, logging is silent.

### `options.warmup`

| Field | Type | Default | Description |
|-------|------|---------|-------------|
| `defaultSchedule` | `WarmupPhase[]` | 5-phase schedule | Default warmup schedule for new accounts |

See [Warmup System](./warmup-system.md) for phase details.

### `options.healthDefaults`

| Field | Type | Default | Description |
|-------|------|---------|-------------|
| `minScore` | `number` | `50` | Auto-disable when health score drops below this |
| `maxBounceRate` | `number` | `5` | Auto-disable when bounce rate exceeds this percentage |
| `maxConsecutiveErrors` | `number` | `10` | Auto-disable after this many consecutive failures |

See [Health Tracking](./health-tracking.md) for scoring details.

### `options.ses`

| Field | Type | Default | Description |
|-------|------|---------|-------------|
| `enabled` | `boolean` | `false` | Enable SES webhook processing |
| `validateSignature` | `boolean` | `true` | Verify SNS message signatures |
| `allowedTopicArns` | `string[]` | `[]` | Restrict to specific SNS topic ARNs |

See [SES Webhooks](./ses-webhooks.md) for setup instructions.

### `options.unsubscribe`

Two modes are available -- built-in HMAC tokens or a custom URL generator.

**Built-in mode:**

| Field | Type | Default | Description |
|-------|------|---------|-------------|
| `builtin.enabled` | `boolean` | `false` | Enable built-in unsubscribe handling |
| `builtin.secret` | `string` | -- | HMAC-SHA256 secret key |
| `builtin.baseUrl` | `string` | -- | Base URL for unsubscribe links |
| `builtin.tokenExpiryDays` | `number` | `365` | Token validity period in days |

**Custom mode:**

| Field | Type | Description |
|-------|------|-------------|
| `generateUrl` | `(email: string, accountId: string) => string` | Custom URL generator function |

See [Unsubscribe](./unsubscribe.md) for details.

### `options.queues`

| Field | Type | Default | Description |
|-------|------|---------|-------------|
| `sendQueueName` | `string` | `'email-send'` | BullMQ queue name for send jobs |
| `approvalQueueName` | `string` | `'email-approved'` | BullMQ queue name for approved draft jobs |

### `hooks`

All hooks are optional. They fire after the corresponding event is processed.

| Hook | Payload |
|------|---------|
| `onAccountDisabled` | `{ accountId, reason }` |
| `onWarmupComplete` | `{ accountId, email }` |
| `onHealthDegraded` | `{ accountId, healthScore }` |
| `onSend` | `{ accountId, email, messageId }` |
| `onSendError` | `{ accountId, email, error }` |
| `onBounce` | `{ accountId, email, bounceType, provider }` |
| `onComplaint` | `{ accountId, email }` |
| `onDelivery` | `{ accountId, email }` |
| `onOpen` | `{ accountId, email, timestamp }` |
| `onClick` | `{ accountId, email, link }` |
| `onUnsubscribe` | `{ email, accountId }` |
| `onDraftCreated` | `{ draftId, to, subject }` |
| `onDraftApproved` | `{ draftId, to, scheduledAt }` |
| `onDraftRejected` | `{ draftId, to, reason }` |
