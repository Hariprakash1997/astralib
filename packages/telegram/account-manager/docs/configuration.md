# Configuration Reference

The `createTelegramAccountManager()` factory accepts a single `TelegramAccountManagerConfig` object. This page documents every field.

## Full Config Example

```ts
import type { TelegramAccountManagerConfig } from '@astralibx/telegram-account-manager';

const config: TelegramAccountManagerConfig = {
  // --- Required ---
  db: {
    connection: mongooseConnection,    // Mongoose Connection instance
    collectionPrefix: 'myapp_',        // Optional prefix for all collection names
  },

  credentials: {
    apiId: 12345678,                   // Telegram API ID (from my.telegram.org)
    apiHash: 'your-api-hash-here',     // Telegram API hash
  },

  // --- Optional ---
  logger: {
    info: (msg, meta) => {},
    warn: (msg, meta) => {},
    error: (msg, meta) => {},
  },

  options: {
    maxAccounts: 50,                   // Maximum accounts allowed (default: 50)
    connectionTimeoutMs: 30000,        // TDLib connection timeout (default: 30000)
    healthCheckIntervalMs: 300000,     // Health monitor interval (default: 300000 / 5 min)
    autoReconnect: true,               // Auto-reconnect on disconnect (default: true)
    reconnectMaxRetries: 5,            // Max reconnect attempts (default: 5)

    warmup: {
      enabled: true,                   // Enable warmup for new accounts (default: true)
      defaultSchedule: [
        { days: [1, 3],   dailyLimit: 10,  delayMinMs: 60000,  delayMaxMs: 120000 },
        { days: [4, 7],   dailyLimit: 25,  delayMinMs: 45000,  delayMaxMs: 90000  },
        { days: [8, 14],  dailyLimit: 50,  delayMinMs: 30000,  delayMaxMs: 60000  },
        { days: [15, 0],  dailyLimit: 100, delayMinMs: 15000,  delayMaxMs: 45000  },
        // days: [15, 0] means "day 15 onwards" (0 = no upper bound)
      ],
      autoAdvance: true,                 // Automatically advance warmup day counter daily (default: true)
    },

    idleTimeoutMs: 600000,               // Disconnect idle accounts after this duration (default: disabled)

    quarantine: {
      monitorIntervalMs: 300000,       // Quarantine release check interval (default: 300000 / 5 min)
      defaultDurationMs: 86400000,     // Default quarantine duration (default: 86400000 / 24 hours)
    },
  },

  hooks: {
    onAccountConnected: ({ accountId, phone }) => {},
    onAccountDisconnected: ({ accountId, phone, reason }) => {},
    onAccountQuarantined: ({ accountId, phone, reason, until }) => {},
    onAccountReleased: ({ accountId, phone }) => {},
    onAccountBanned: ({ accountId, phone, errorCode }) => {},
    onHealthChange: ({ accountId, phone, oldScore, newScore }) => {},
    onWarmupComplete: ({ accountId, phone }) => {},
  },
};
```

## Section Details

### `db` (required)

| Field | Type | Default | Description |
|-------|------|---------|-------------|
| `connection` | `mongoose.Connection` | -- | A Mongoose connection instance |
| `collectionPrefix` | `string` | `''` | Prefix prepended to all MongoDB collection names |

### `credentials` (required)

| Field | Type | Default | Description |
|-------|------|---------|-------------|
| `apiId` | `number` | -- | Telegram API ID from [my.telegram.org](https://my.telegram.org) |
| `apiHash` | `string` | -- | Telegram API hash from [my.telegram.org](https://my.telegram.org) |

### `logger` (optional)

Provide an object with `info`, `warn`, and `error` methods. Each receives `(message: string, meta?: Record<string, unknown>)`. If omitted, logging is silent. Re-exported as `LogAdapter` from `@astralibx/core`.

### `options.maxAccounts`

| Field | Type | Default | Description |
|-------|------|---------|-------------|
| `maxAccounts` | `number` | `50` | Maximum number of accounts allowed |

### `options` -- Connection

| Field | Type | Default | Description |
|-------|------|---------|-------------|
| `connectionTimeoutMs` | `number` | `30000` | Timeout for TDLib client connection |
| `autoReconnect` | `boolean` | `true` | Automatically reconnect on unexpected disconnect |
| `reconnectMaxRetries` | `number` | `5` | Maximum reconnect attempts before marking as error |
| `healthCheckIntervalMs` | `number` | `300000` | Interval for health monitor checks (ms) |

### `options.warmup`

| Field | Type | Default | Description |
|-------|------|---------|-------------|
| `enabled` | `boolean` | `true` | Enable warmup phase for new accounts |
| `defaultSchedule` | `WarmupPhase[]` | 4-phase schedule | Default warmup schedule for new accounts |
| `autoAdvance` | `boolean` | `true` | When `true`, the library automatically calls `advanceAllAccounts()` every 24 hours via an internal `setInterval` -- no cron job needed. When `false`, you must call `warmup.advanceDay(accountId)` manually for each account. |

Default warmup schedule:

| Phase | Days | Daily Limit | Delay Range |
|-------|------|-------------|-------------|
| 1 | 1--3 | 10 | 60s--120s |
| 2 | 4--7 | 25 | 45s--90s |
| 3 | 8--14 | 50 | 30s--60s |
| 4 | 15+ | 100 | 15s--45s |

### `options.idleTimeoutMs`

| Field | Type | Default | Description |
|-------|------|---------|-------------|
| `idleTimeoutMs` | `number` | `undefined` (disabled) | Disconnect accounts that have been idle (no sends) for this duration in milliseconds. When set, the connection service starts an idle monitor that periodically checks each connected account's last activity timestamp and automatically disconnects idle ones to free resources. |

**Usage example:**

```ts
const tam = createTelegramAccountManager({
  // ...
  options: {
    idleTimeoutMs: 600000, // 10 minutes -- auto-disconnect accounts with no sends for 10 minutes
  },
});
```

When `idleTimeoutMs` is set, the library calls `connectionService.startIdleMonitor()` on startup. Accounts that haven't sent a message within the specified duration are automatically disconnected. This is useful for freeing TDLib client resources when accounts are not actively in use.

### `options.quarantine`

| Field | Type | Default | Description |
|-------|------|---------|-------------|
| `monitorIntervalMs` | `number` | `300000` | Interval to check for quarantine release (ms) |
| `defaultDurationMs` | `number` | `86400000` | Default quarantine duration (ms, 24 hours) |

### `hooks`

All hooks are optional. They fire after the corresponding event is processed.

| Hook | Payload |
|------|---------|
| `onAccountConnected` | `{ accountId, phone }` |
| `onAccountDisconnected` | `{ accountId, phone, reason }` |
| `onAccountQuarantined` | `{ accountId, phone, reason, until }` |
| `onAccountReleased` | `{ accountId, phone }` |
| `onAccountBanned` | `{ accountId, phone, errorCode }` |
| `onHealthChange` | `{ accountId, phone, oldScore, newScore }` |
| `onWarmupComplete` | `{ accountId, phone }` |

## Collections Created

The following MongoDB collections are created when `createTelegramAccountManager()` initializes:

| Collection | Purpose | Key Indexes |
|-----------|---------|-------------|
| `telegram_accounts` | Account records with session, health, warmup | `phone` (unique), `status`, `{warmup.enabled, status}`, `tags`, `{status, quarantinedUntil}`, `{status, healthScore}` |
| `telegram_daily_stats` | Per-account daily send/fail/skip counters | `{accountId, date}` (unique) |
| `telegram_identifiers` | Telegram user/contact records | `telegramUserId` (unique), `contactId`, `status`, `phone` (sparse) |

When `collectionPrefix` is set (e.g., `'myapp_'`), collections become `myapp_telegram_accounts`, `myapp_telegram_daily_stats`, `myapp_telegram_identifiers`.
