# Exported Types

All types can be imported from `@astralibx/telegram-account-manager`:

```ts
import type {
  TelegramAccountManagerConfig,
  CreateTelegramAccountInput,
  AccountCapacity,
  // ... etc.
} from '@astralibx/telegram-account-manager';
```

---

## Account Types

**`CreateTelegramAccountInput`** -- Input for creating an account.
- `phone: string` -- Phone number
- `name: string` -- Display name
- `session: string` -- TDLib session string
- `tags?: string[]` -- Optional tags for categorization and filtering

**`UpdateTelegramAccountInput`** -- Partial input for updating an account. All fields optional.
- `name?: string`
- `session?: string`
- `currentDailyLimit?: number`
- `currentDelayMin?: number`
- `currentDelayMax?: number`
- `tags?: string[]`

**`AccountCapacity`** -- Snapshot of an account's daily send capacity.
- `accountId: string`, `phone: string`
- `dailyMax: number`, `sentToday: number`, `remaining: number`, `usagePercent: number`
- `status: AccountStatus`

**`AccountHealth`** -- Snapshot of an account's health.
- `accountId: string`, `phone: string`
- `healthScore: number`, `consecutiveErrors: number`, `floodWaitCount: number`
- `status: AccountStatus`
- `lastSuccessfulSendAt: Date | null`

**`ConnectedAccount`** -- A connected TDLib client.
- `accountId: string`, `phone: string`, `name: string`, `isConnected: boolean`

---

## Identifier Types

**`CreateTelegramIdentifierInput`** -- Input for creating an identifier.
- `contactId: string` (required) -- Your system's contact ID
- `telegramUserId: string` (required) -- Telegram user ID
- `username?: string`, `firstName?: string`, `lastName?: string`, `phone?: string`

**`UpdateTelegramIdentifierInput`** -- Input for updating an identifier. All fields optional.
- `username?: string`, `firstName?: string`, `lastName?: string`, `phone?: string`
- `status?: IdentifierStatus`
- `lastActiveAt?: Date`

---

## Config Types

**`TelegramAccountManagerConfig`** -- Main configuration passed to `createTelegramAccountManager()`.
- `db.connection: Connection` -- Mongoose connection
- `db.collectionPrefix?: string` -- Prefix for collection names
- `credentials.apiId: number` -- Telegram API ID
- `credentials.apiHash: string` -- Telegram API hash
- `logger?: LogAdapter` -- Logger adapter
- `options?.maxAccounts` -- Max accounts (default: 50)
- `options?.connectionTimeoutMs` -- Connection timeout (default: 30000)
- `options?.healthCheckIntervalMs` -- Health check interval (default: 300000)
- `options?.autoReconnect` -- Auto-reconnect (default: true)
- `options?.reconnectMaxRetries` -- Max retries (default: 5)
- `options?.warmup` -- Warmup options (enabled, defaultSchedule, autoAdvance)
- `options?.idleTimeoutMs` -- Disconnect idle accounts after this duration (disabled by default)
- `options?.quarantine` -- Quarantine options (monitorIntervalMs, defaultDurationMs)
- `hooks?` -- Lifecycle event hooks (see [Configuration](./configuration.md#hooks))

**`LogAdapter`** -- Logger interface (re-exported from `@astralibx/core`).
- `info(msg: string, meta?: any): void`
- `warn(msg: string, meta?: any): void`
- `error(msg: string, meta?: any): void`

**`WarmupStatus`** -- Warmup state for a single account (returned by `WarmupManager.getStatus()`).
- `accountId: string`, `phone: string`
- `enabled: boolean`, `currentDay: number`
- `startedAt?: Date`, `completedAt?: Date`
- `currentPhase: WarmupPhase | null`
- `dailyLimit: number`
- `delayRange: { min: number; max: number }`

**`WarmupPhase`** -- A single phase in a warmup schedule.
- `days: [number, number]` -- Day range (e.g., `[1, 3]`; `[15, 0]` means "day 15 onwards")
- `dailyLimit: number` -- Max messages per day during this phase
- `delayMinMs: number`, `delayMaxMs: number` -- Random delay range between sends

### Config Hooks

Available hooks on `TelegramAccountManagerConfig.hooks`:

| Hook | Payload |
|------|---------|
| `onAccountConnected` | `{ accountId, phone }` |
| `onAccountDisconnected` | `{ accountId, phone, reason }` |
| `onAccountQuarantined` | `{ accountId, phone, reason, until }` |
| `onAccountReleased` | `{ accountId, phone }` |
| `onAccountBanned` | `{ accountId, phone, errorCode }` |
| `onHealthChange` | `{ accountId, phone, oldScore, newScore }` |
| `onWarmupComplete` | `{ accountId, phone }` |

---

## Constants

All constants are exported as `const` objects with corresponding union types.

```ts
import { ACCOUNT_STATUS, IDENTIFIER_STATUS, ROTATION_STRATEGIES } from '@astralibx/telegram-account-manager';
```

**`ACCOUNT_STATUS`** / `AccountStatus`
```ts
{ Connected: 'connected', Disconnected: 'disconnected', Error: 'error', Banned: 'banned', Quarantined: 'quarantined', Warmup: 'warmup' }
```

**`IDENTIFIER_STATUS`** / `IdentifierStatus`
```ts
{ Active: 'active', Blocked: 'blocked', PrivacyBlocked: 'privacy_blocked', Inactive: 'inactive', Invalid: 'invalid' }
```

**Other constants:**

| Constant | Default | Description |
|----------|---------|-------------|
| `DEFAULT_HEALTH_SCORE` | `100` | Initial health score for new accounts |
| `MIN_HEALTH_SCORE` | `0` | Minimum health score |
| `MAX_HEALTH_SCORE` | `100` | Maximum health score |
| `DEFAULT_DAILY_LIMIT` | `40` | Default daily message limit |
| `DEFAULT_CONNECTION_TIMEOUT_MS` | `30000` | TDLib connection timeout |
| `DEFAULT_HEALTH_CHECK_INTERVAL_MS` | `300000` | Health monitor interval |
| `DEFAULT_QUARANTINE_MONITOR_INTERVAL_MS` | `300000` | Quarantine release check interval |
| `DEFAULT_QUARANTINE_DURATION_MS` | `86400000` | Default quarantine duration (24h) |
| `DEFAULT_MAX_ACCOUNTS` | `50` | Maximum accounts |
| `DEFAULT_RECONNECT_MAX_RETRIES` | `5` | Max reconnect attempts |
| `DEFAULT_WARMUP_SCHEDULE` | 4-phase array | Default warmup schedule (see [Configuration](./configuration.md#optionswarmup)) |

**Error classification constants:**

| Constant | Errors | Behavior |
|----------|--------|----------|
| `CRITICAL_ERRORS` | `AUTH_KEY_UNREGISTERED`, `SESSION_REVOKED`, `USER_DEACTIVATED_BAN`, `AUTH_KEY_DUPLICATED`, `PHONE_NUMBER_BANNED` | Account marked as banned |
| `QUARANTINE_ERRORS` | `PEER_FLOOD`, `USER_RESTRICTED` | Account quarantined |
| `SKIP_ERRORS` | `USER_NOT_FOUND`, `INPUT_USER_DEACTIVATED`, `USER_PRIVACY_RESTRICTED`, `USER_IS_BLOCKED`, `PEER_ID_INVALID`, `USER_IS_BOT`, `CHAT_WRITE_FORBIDDEN`, `USER_NOT_MUTUAL_CONTACT`, `CHAT_SEND_PLAIN_FORBIDDEN`, `CHAT_SEND_MEDIA_FORBIDDEN` | Skipped (not account's fault) |
| `RECOVERABLE_ERRORS` | `TIMEOUT`, `NETWORK_ERROR`, `RPC_TIMEOUT`, `CONNECTION_ERROR`, `MSG_WAIT_FAILED`, `RPC_CALL_FAIL`, `CONNECTION_NOT_INITED` | Retried |

---

## Error Classes

All errors extend `AlxTelegramAccountError` (which extends `AlxError` from `@astralibx/core`).

```ts
import { AccountNotFoundError, ConnectionError } from '@astralibx/telegram-account-manager';
```

| Class | Code | Key Properties |
|-------|------|----------------|
| `AlxTelegramAccountError` | *(custom)* | `message`, `code` |
| `ConfigValidationError` | `CONFIG_VALIDATION` | `field` |
| `ConnectionError` | `CONNECTION_ERROR` | `accountId`, `originalError` |
| `AccountNotFoundError` | `ACCOUNT_NOT_FOUND` | `accountId` |
| `AccountBannedError` | `ACCOUNT_BANNED` | `accountId`, `errorCode` |
| `QuarantineError` | `QUARANTINE` | `accountId`, `reason`, `until` |

**`normalizeErrorCode(error: unknown)`** -- Extracts a normalized error code string from GramJS `RPCError`, standard `Error`, or unknown values. Returns `{ code: string; floodWaitSeconds?: number }`.

---

## Mongoose Schema Types

```ts
import {
  createTelegramAccountSchema,
  createTelegramDailyStatsSchema,
  createTelegramIdentifierSchema,
} from '@astralibx/telegram-account-manager';
```

| Interface | Document Type | Model Type | Schema Factory |
|-----------|---------------|------------|----------------|
| `ITelegramAccount` | `TelegramAccountDocument` | `TelegramAccountModel` | `createTelegramAccountSchema()` |
| `ITelegramDailyStats` | `TelegramDailyStatsDocument` | `TelegramDailyStatsModel` | `createTelegramDailyStatsSchema()` |
| `ITelegramIdentifier` | `TelegramIdentifierDocument` | `TelegramIdentifierModel` | `createTelegramIdentifierSchema()` |

Each schema factory accepts an optional `{ collectionName?: string }` options object.

The `ITelegramAccount` interface includes a `tags: string[]` field for categorizing accounts (e.g., by purpose, region, or priority).

**`TelegramAccountMethods`** -- Instance methods on `TelegramAccountDocument`:
- `preflightCheck(): { ok: boolean; reason?: string }` -- Checks if account can send (not banned, not in error, not quarantined, health score >= 20)
- `quarantine(reason: string, durationMs: number): void` -- Sets quarantine status, reason, and expiry on the document
- `releaseFromQuarantine(): void` -- Clears quarantine fields and sets status to `disconnected`

---

## Exported Service Classes

Instances are available on the `TelegramAccountManager` object returned by `createTelegramAccountManager()`.

```ts
import type { ConnectionService, CapacityManager } from '@astralibx/telegram-account-manager';
```

| Class | Access via | Purpose |
|-------|-----------|---------|
| `ConnectionService` | `.connection` | TDLib client lifecycle (connect, disconnect, reconnect) |
| `HealthTracker` | `.health` | Account health scoring and monitoring |
| `WarmupManager` | `.warmup` | Warmup schedule management |
| `CapacityManager` | `.capacity` | Daily send capacity tracking |
| `IdentifierService` | `.identifiers` | Telegram identifier CRUD |
| `QuarantineService` | `.quarantine` | Quarantine lifecycle and monitoring |
| `SessionGeneratorService` | `.sessions` | Phone auth flow and session string generation |
| `AccountRotator` | `.rotator` | Account selection with rotation strategies |

**`RotationStrategy`** -- Strategy for rotating between accounts when sending messages.
- `'round-robin'` -- Cycle through accounts in order
- `'least-used'` -- Pick the account with the lowest daily usage percentage
- `'highest-health'` -- Pick the account with the highest health score and remaining capacity (default)

**`AccountRotator`** -- Service class for rotating account selection based on a `RotationStrategy`. Available on the `TelegramAccountManager` instance via `.rotator`.
- `selectAccount(strategy?: RotationStrategy): Promise<AccountCapacity | null>` -- Select the next account based on strategy (defaults to `'highest-health'`). Returns `null` if no accounts have remaining capacity.

---

## `TelegramAccountManager` Interface

Returned by `createTelegramAccountManager()`:

```ts
interface TelegramAccountManager {
  routes: Router;                      // Express router with all endpoints

  connection: ConnectionService;
  health: HealthTracker;
  warmup: WarmupManager;
  capacity: CapacityManager;
  identifiers: IdentifierService;
  quarantine: QuarantineService;
  sessions: SessionGeneratorService;
  rotator: AccountRotator;

  models: {
    TelegramAccount: TelegramAccountModel;
    TelegramDailyStats: TelegramDailyStatsModel;
    TelegramIdentifier: TelegramIdentifierModel;
  };

  getClient(accountId: string): TelegramClient | null;
  getConnectedAccounts(): ConnectedAccount[];
  sendMessage(accountId: string, chatId: string, text: string): Promise<{ messageId: string }>;
  destroy(): Promise<void>;            // Graceful shutdown
}
```

---

## Route Dependencies

**`TelegramAccountManagerRouteDeps`** -- Dependency object for `createRoutes()` (advanced usage for custom route setup).
- `accountController: ReturnType<typeof createAccountController>`
- `identifierController: ReturnType<typeof createIdentifierController>`
- `sessionController: ReturnType<typeof createSessionController>`
- `logger?: LogAdapter`

---

## `validateConfig`

```ts
import { validateConfig } from '@astralibx/telegram-account-manager';

validateConfig(config); // throws ConfigValidationError if invalid
```
