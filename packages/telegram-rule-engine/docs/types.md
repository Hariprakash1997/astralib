# Exported Types

All types can be imported from `@astralibx/telegram-rule-engine`:

```ts
import type {
  CreateTelegramTemplateInput, UpdateTelegramTemplateInput,
  RuleTarget, QueryTarget, ListTarget, RuleRunStats, PerRuleStats,
  ThrottleConfig, ThrottleWindow,
  TelegramRuleEngineConfig, SendMessageParams, AccountSelection,
  RecipientIdentifier, BeforeSendParams, BeforeSendResult,
  LogAdapter, RunProgress, RunStatus, RunStatusResponse,
  TelegramRuleEngine,
  // Enum types
  DeliveryStatus, ErrorCategory, SendStatus, ErrorOperation,
} from '@astralibx/telegram-rule-engine';

import {
  DELIVERY_STATUS, ERROR_CATEGORY, SEND_STATUS, ERROR_OPERATION,
  // Error classes
  AlxTelegramError, ConfigValidationError, TemplateNotFoundError,
  RuleNotFoundError, RunError, ThrottleError, LockError,
  // Constants
  DEFAULT_LOCK_TTL_MS, DEFAULT_MAX_PER_RUN,
  DEFAULT_DELAY_BETWEEN_SENDS_MS, DEFAULT_JITTER_MS,
  DEFAULT_MAX_CONSECUTIVE_FAILURES, DEFAULT_THINKING_PAUSE_PROBABILITY,
  DEFAULT_BATCH_PROGRESS_INTERVAL, DEFAULT_THROTTLE_CONFIG,
  REDIS_KEY_PREFIX, RUN_PROGRESS_TTL_SECONDS, MESSAGE_PREVIEW_LENGTH,
  // Utilities
  RedisLock, calculateDelay, isWithinSendWindow, getHumanDelay,
  // Config validator
  validateConfig,
  // Factory
  createTelegramRuleEngine,
} from '@astralibx/telegram-rule-engine';
```

---

## Template Types

| Type | Description |
|------|-------------|
| `CreateTelegramTemplateInput` | Input for creating a template. Required: `name`, `messages` (string[]). Optional: `variables`, `category`, `platform`, `audience`, `media`, `fields`. |
| `UpdateTelegramTemplateInput` | Partial input for updating a template. All fields optional. Set `media` to `null` to remove. |

## Rule Types

| Type | Description |
|------|-------------|
| `RuleTarget` | Discriminated union: `QueryTarget \| ListTarget`. |
| `QueryTarget` | Query-based targeting. Fields: `mode: 'query'`, `conditions: Record<string, unknown>`. |
| `ListTarget` | List-based targeting. Fields: `mode: 'list'`, `identifiers: string[]`. |
| `RuleRunStats` | Aggregated stats for a run. Fields: `sent`, `failed`, `skipped`, `throttled` (all `number`). |
| `PerRuleStats` | Per-rule stats. Fields: `ruleId: string`, `ruleName: string`, `stats: RuleRunStats`. |

## Config & Adapter Types

| Type | Description |
|------|-------------|
| `TelegramRuleEngineConfig` | Top-level config passed to `createTelegramRuleEngine()`. |
| `SendMessageParams` | Params passed to the `sendMessage` adapter. Fields: `identifierId`, `contactId`, `accountId`, `message`, `media?`, `ruleId`, `templateId`. |
| `AccountSelection` | Return type of the `selectAccount` adapter. Fields: `accountId: string`, `phone: string`, `metadata: Record<string, unknown>`. |
| `RecipientIdentifier` | Return type of the `findIdentifier` adapter. Fields: `id: string`, `contactId: string`. |
| `BeforeSendParams` | Params passed to the `beforeSend` hook. Fields: `message`, `account: { id, phone, metadata }`, `user: { id, contactId, name }`, `context: { ruleId, templateId, runId }`, `media?`. |
| `BeforeSendResult` | Return type of the `beforeSend` hook. Fields: `message: string`, `media?`. |
| `LogAdapter` | Logger interface (re-exported from `@astralibx/core`). Methods: `info`, `warn`, `error`. |
| `TelegramRuleEngine` | Return type of `createTelegramRuleEngine()`. Fields: `routes: Router`, `runner`, `templateService`, `ruleService`, `models`. |

### Required Adapter Signatures

```ts
adapters: {
  queryUsers: (target: RuleTarget, limit: number) => Promise<Record<string, unknown>[]>;
  resolveData: (user: Record<string, unknown>) => Record<string, unknown>;
  sendMessage: (params: SendMessageParams) => Promise<void>;
  selectAccount: (
    identifierId: string,
    context?: { ruleId: string; templateId: string }
  ) => Promise<AccountSelection | null>;
  findIdentifier: (phoneOrUsername: string) => Promise<RecipientIdentifier | null>;
}
```

### Optional Hook Signatures

```ts
hooks?: {
  onRunStart?: (info: { rulesCount: number; triggeredBy: string; runId: string }) => void;
  onRuleStart?: (info: { ruleId: string; ruleName: string; matchedCount: number; templateId: string; runId: string }) => void;
  onSend?: (info: {
    ruleId: string; ruleName: string; identifierId: string;
    status: 'sent' | 'error' | 'skipped' | 'throttled';
    accountId: string; templateId: string; runId: string;
    messageIndex: number; failureReason?: string;
  }) => void;
  onRuleComplete?: (info: { ruleId: string; ruleName: string; stats: RuleRunStats; templateId: string; runId: string }) => void;
  onRunComplete?: (info: { duration: number; totalStats: RuleRunStats; perRuleStats: PerRuleStats[]; runId: string }) => void;
  beforeSend?: (params: BeforeSendParams) => Promise<BeforeSendResult>;
}
```

## Run Status Types

| Type | Description |
|------|-------------|
| `RunProgress` | Progress counters. Fields: `rulesTotal`, `rulesCompleted`, `sent`, `failed`, `skipped`, `throttled` (all `number`). |
| `RunStatus` | Union: `'running' \| 'completed' \| 'cancelled' \| 'failed'`. |
| `RunStatusResponse` | Full status response. Fields: `runId`, `status`, `currentRule`, `progress`, `startedAt`, `elapsed`. |

## Throttle Types

| Type | Description |
|------|-------------|
| `ThrottleConfig` | Throttle config. Fields: `maxPerUserPerDay`, `maxPerUserPerWeek`, `minGapDays` (all `number`), `throttleWindow: ThrottleWindow`. |
| `ThrottleWindow` | Union: `'rolling' \| 'fixed'`. |

## Media Type

The `media` field on templates and `SendMessageParams` uses:

```ts
{
  type: 'photo' | 'video' | 'voice' | 'audio' | 'document';
  url: string;
  caption?: string;
}
```

## Enums

Each constant is an object whose values form the corresponding union type.

### `DELIVERY_STATUS`

| Key | Value |
|-----|-------|
| `Pending` | `'pending'` |
| `Sent` | `'sent'` |
| `Delivered` | `'delivered'` |
| `Read` | `'read'` |
| `Failed` | `'failed'` |

Type: `DeliveryStatus = 'pending' | 'sent' | 'delivered' | 'read' | 'failed'`

### `ERROR_CATEGORY`

| Key | Value |
|-----|-------|
| `Critical` | `'critical'` |
| `Account` | `'account'` |
| `Recoverable` | `'recoverable'` |
| `Skip` | `'skip'` |
| `Unknown` | `'unknown'` |

Type: `ErrorCategory = 'critical' | 'account' | 'recoverable' | 'skip' | 'unknown'`

### `SEND_STATUS`

| Key | Value |
|-----|-------|
| `Sent` | `'sent'` |
| `Error` | `'error'` |
| `Skipped` | `'skipped'` |
| `Throttled` | `'throttled'` |
| `Invalid` | `'invalid'` |

Type: `SendStatus = 'sent' | 'error' | 'skipped' | 'throttled' | 'invalid'`

### `ERROR_OPERATION`

| Key | Value |
|-----|-------|
| `Send` | `'send'` |
| `Sync` | `'sync'` |
| `Connect` | `'connect'` |
| `Other` | `'other'` |

Type: `ErrorOperation = 'send' | 'sync' | 'connect' | 'other'`

## Constants

| Constant | Value | Description |
|----------|-------|-------------|
| `DEFAULT_LOCK_TTL_MS` | `1800000` | 30 min lock TTL |
| `DEFAULT_MAX_PER_RUN` | `100` | Default max users per rule per run |
| `DEFAULT_DELAY_BETWEEN_SENDS_MS` | `3000` | Base delay between sends |
| `DEFAULT_JITTER_MS` | `1500` | Max random jitter |
| `DEFAULT_MAX_CONSECUTIVE_FAILURES` | `3` | Stop rule after N consecutive failures |
| `DEFAULT_THINKING_PAUSE_PROBABILITY` | `0.25` | Probability of extra thinking pause |
| `DEFAULT_BATCH_PROGRESS_INTERVAL` | `10` | Progress update frequency |
| `DEFAULT_THROTTLE_CONFIG` | `{ maxPerUserPerDay: 1, maxPerUserPerWeek: 2, minGapDays: 3, throttleWindow: 'rolling' }` | Default throttle settings |
| `REDIS_KEY_PREFIX` | `'tg-rule-engine'` | Base Redis key prefix |
| `RUN_PROGRESS_TTL_SECONDS` | `3600` | TTL for run progress keys in Redis |
| `MESSAGE_PREVIEW_LENGTH` | `200` | Max preview text length |

## Error Classes

All extend `AlxTelegramError` (which extends `AlxError` from `@astralibx/core`).

| Class | Description |
|-------|-------------|
| `AlxTelegramError` | Base error for the telegram rule engine. |
| `ConfigValidationError` | Invalid engine configuration. |
| `TemplateNotFoundError` | Template lookup failed. |
| `RuleNotFoundError` | Rule lookup failed. |
| `RunError` | Error during rule run execution. |
| `ThrottleError` | Throttle-related error. |
| `LockError` | Distributed lock acquisition failed. |

## Mongoose Schema Types

| Type | Description |
|------|-------------|
| `TelegramTemplateModel` | Mongoose model type for templates. |
| `TelegramRuleModel` | Mongoose model type for rules. |
| `TelegramSendLogModel` | Mongoose model type for send logs. |
| `TelegramRunLogModel` | Mongoose model type for run logs. |
| `TelegramErrorLogModel` | Mongoose model type for error logs. |
| `TelegramThrottleConfigModel` | Mongoose model type for throttle config. |

Schema factory functions: `createTelegramTemplateSchema()`, `createTelegramRuleSchema()`, `createTelegramSendLogSchema()`, `createTelegramRunLogSchema()`, `createTelegramErrorLogSchema()`, `createTelegramThrottleConfigSchema()`.

## Services & Utilities

| Export | Description |
|--------|-------------|
| `createTelegramRuleEngine(config)` | Factory function. Returns `TelegramRuleEngine`. |
| `validateConfig(config)` | Validates `TelegramRuleEngineConfig`, throws `ConfigValidationError` on failure. |
| `RedisLock` | Distributed lock utility using Redis. |
| `calculateDelay` | Compute delay with jitter. |
| `isWithinSendWindow` | Check if current time is within the configured send window. |
| `getHumanDelay` | Get a human-like delay with optional thinking pause. |
