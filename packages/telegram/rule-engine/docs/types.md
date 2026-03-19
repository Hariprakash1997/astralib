# Exported Types

Most types, constants, errors, and utilities are re-exported from `@astralibx/rule-engine` core. This package adds Telegram-specific config types, error categorization, and delay utilities.

All types can be imported from `@astralibx/telegram-rule-engine`:

```ts
import type {
  // ── Re-exported from core ──────────────────────────────────────
  RuleEngine, RuleEngineConfig, RuleEngineAdapters,
  SendParams, AgentSelection, RecipientIdentifier,
  BeforeSendParams, BeforeSendResult,
  RunProgress, RunStatus, RunStatusResponse,
  Template, CreateTemplateInput, UpdateTemplateInput, Attachment,
  RuleRunStats, PerRuleStats,
  CollectionSchema, JoinDefinition,
  TemplateCategory, TemplateAudience, RuleOperator, RuleType,
  RunTrigger, SendStatus, TargetMode, RunLogStatus, FieldType,
  LogAdapter,

  // ── Telegram-specific types ────────────────────────────────────
  TelegramRuleEngineConfig,   // Top-level config for createTelegramRuleEngine
  TelegramRuleEngine,         // Return type of createTelegramRuleEngine
  SendMessageParams,          // Alias for core's SendParams (telegram naming)
  AccountSelection,           // Alias for core's AgentSelection (telegram naming)
  CreateTelegramTemplateInput, UpdateTelegramTemplateInput,
  RuleTarget, QueryTarget, ListTarget,
  ThrottleConfig, ThrottleWindow,
  DeliveryStatus, ErrorCategory, ErrorOperation,
} from '@astralibx/telegram-rule-engine';

import {
  // ── Re-exported from core ──────────────────────────────────────
  TEMPLATE_CATEGORY, TEMPLATE_AUDIENCE, RULE_OPERATOR, RULE_TYPE,
  RUN_TRIGGER, THROTTLE_WINDOW, SEND_STATUS, TARGET_MODE,
  RUN_LOG_STATUS, FIELD_TYPE, TYPE_OPERATORS,
  AlxRuleEngineError, ConfigValidationError, TemplateNotFoundError,
  TemplateSyntaxError, RuleNotFoundError, RuleTemplateIncompatibleError,
  LockAcquisitionError, DuplicateSlugError,
  validateConfig, RedisLock,
  TemplateRenderService, TemplateService, RuleService,
  RuleRunnerService, SchedulerService,
  createTemplateSchema, createRuleSchema, createSendLogSchema,
  createRunLogSchema, createErrorLogSchema, createThrottleConfigSchema,
  validateConditions, flattenFields, buildAggregationPipeline,

  // ── Telegram-specific exports ──────────────────────────────────
  DELIVERY_STATUS, ERROR_CATEGORY, ERROR_OPERATION,
  RunError, ThrottleError,
  // Backward compat aliases
  AlxRuleEngineError as AlxTelegramError,
  LockAcquisitionError as LockError,
  // Constants
  DEFAULT_LOCK_TTL_MS, DEFAULT_MAX_PER_RUN,
  DEFAULT_DELAY_BETWEEN_SENDS_MS, DEFAULT_JITTER_MS,
  DEFAULT_MAX_CONSECUTIVE_FAILURES, DEFAULT_THINKING_PAUSE_PROBABILITY,
  DEFAULT_BATCH_PROGRESS_INTERVAL, DEFAULT_THROTTLE_CONFIG,
  DEFAULT_THROTTLE_TTL_SECONDS, DEFAULT_HEALTH_DELAY_MULTIPLIER,
  REDIS_KEY_PREFIX, RUN_PROGRESS_TTL_SECONDS, MESSAGE_PREVIEW_LENGTH,
  // Utilities
  calculateDelay, isWithinSendWindow, getHumanDelay, getHealthAdjustedDelay,
  categorizeError, isRetryableError, checkRedisThrottle, incrementRedisThrottle,
  calculateTelegramDelay,
  createTelegramAdapters,
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

| Type | Source | Description |
|------|--------|-------------|
| `TelegramRuleEngineConfig` | **telegram** | Top-level config passed to `createTelegramRuleEngine()`. Includes telegram-specific options like `useRedisThrottle`, `maxConsecutiveFailures`, `thinkingPauseProbability`, `healthDelayMultiplier`, `batchProgressInterval`. |
| `SendMessageParams` | **telegram** (alias) | Alias for core's `SendParams`. Params passed to the `sendMessage` adapter. Fields: `identifierId`, `contactId`, `accountId`, `message`, `media?`, `ruleId`, `templateId`. |
| `AccountSelection` | **telegram** (alias) | Alias for core's `AgentSelection`. Return type of the `selectAccount` adapter. Fields: `accountId: string`, `phone: string`, `metadata: Record<string, unknown>`. |
| `RecipientIdentifier` | core | Return type of the `findIdentifier` adapter. Fields: `id: string`, `contactId: string`. |
| `BeforeSendParams` | core | Params passed to the `beforeSend` hook. Fields: `message`, `account: { id, phone, metadata }`, `user: { id, contactId, name }`, `context: { ruleId, templateId, runId }`, `media?`. |
| `BeforeSendResult` | core | Return type of the `beforeSend` hook. Fields: `message: string`, `media?`. |
| `LogAdapter` | core | Logger interface (re-exported from `@astralibx/core`). Methods: `info`, `warn`, `error`. |
| `TelegramRuleEngine` | **telegram** | Return type of `createTelegramRuleEngine()`. Fields: `routes: Router`, `runner`, `templateService`, `ruleService`, `models`, `destroy()`. |

> **Note:** The `TelegramRuleEngineConfig.options` type includes `useRedisThrottle?: boolean`. When set to `true`, the engine uses Redis-based throttle tracking instead of MongoDB for lower-latency throttle checks during rule execution.

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
| `DEFAULT_THROTTLE_TTL_SECONDS` | `604800` | TTL for Redis throttle keys (7 days) |
| `REDIS_KEY_PREFIX` | `'tg-rule-engine'` | Base Redis key prefix |
| `RUN_PROGRESS_TTL_SECONDS` | `3600` | TTL for run progress keys in Redis |
| `MESSAGE_PREVIEW_LENGTH` | `200` | Max preview text length |

## Error Classes

Most error classes are re-exported from core. `RunError` and `ThrottleError` are Telegram-specific. `AlxTelegramError` and `LockError` are backward-compatibility aliases.

| Class | Source | Description |
|-------|--------|-------------|
| `AlxRuleEngineError` | core | Base error for the rule engine. |
| `AlxTelegramError` | alias | Backward-compat alias for `AlxRuleEngineError`. |
| `ConfigValidationError` | core | Invalid engine configuration. |
| `TemplateNotFoundError` | core | Template lookup failed. |
| `TemplateSyntaxError` | core | Handlebars template syntax error. |
| `RuleNotFoundError` | core | Rule lookup failed. |
| `RuleTemplateIncompatibleError` | core | Rule-template mismatch. |
| `LockAcquisitionError` | core | Distributed lock acquisition failed. |
| `LockError` | alias | Backward-compat alias for `LockAcquisitionError`. |
| `DuplicateSlugError` | core | Duplicate slug/name conflict. |
| `RunError` | **telegram** | Error during rule run execution. |
| `ThrottleError` | **telegram** | Throttle-related error. |

## Collection Types

These types are re-exported from `@astralibx/rule-engine` core and used when configuring collections and joins.

| Type | Source | Description |
|------|--------|-------------|
| `CollectionSchema` | core | Defines a collection's name, label, identifier field, fields, and joins. Passed in the `collections` config array. |
| `JoinDefinition` | core | Declares a join between two collections. Fields: `from`, `localField`, `foreignField`, `as`. Maps to a MongoDB `$lookup`. |
| `FieldDefinition` | core | Describes a single field in a collection. Fields: `name`, `type` (`FieldType`), `label?`, `description?`, `enumValues?`, `fields?` (for nested objects/arrays). |
| `FlattenedField` | core | A field flattened to a dot-notation path with its resolved type. Returned by `flattenFields()` and the `/collections/:name/fields` endpoint. |
| `PipelineBuilderOptions` | core | Options for `buildAggregationPipeline()`. Fields: `joins: JoinDefinition[]`, `conditions: RuleCondition[]`, `limit?: number`. |

## Mongoose Schema Types

All schema factories and model types are re-exported from core. The generic names are used (no `Telegram` prefix).

| Type | Description |
|------|-------------|
| `TemplateModel` | Mongoose model type for templates. |
| `RuleModel` | Mongoose model type for rules. |
| `SendLogModel` | Mongoose model type for send logs. |
| `RunLogModel` | Mongoose model type for run logs. |
| `ErrorLogModel` | Mongoose model type for error logs. |
| `ThrottleConfigModel` | Mongoose model type for throttle config. |

Schema factory functions (re-exported from core): `createTemplateSchema()`, `createRuleSchema()`, `createSendLogSchema()`, `createRunLogSchema()`, `createErrorLogSchema()`, `createThrottleConfigSchema()`.

## Services & Utilities

### Core (re-exported)

| Export | Description |
|--------|-------------|
| `createTelegramRuleEngine(config)` | Factory function. Wraps core's `createRuleEngine` with Telegram adapters. Returns `TelegramRuleEngine`. |
| `validateConfig(config)` | Validates config, throws `ConfigValidationError` on failure. Re-exported from core. |
| `RedisLock` | Distributed lock utility using Redis. Re-exported from `@astralibx/core`. |
| `TemplateRenderService` | Handlebars template compilation and rendering. Re-exported from core. |
| `TemplateService` | Template CRUD service. Re-exported from core. |
| `RuleService` | Rule CRUD and dry run service. Re-exported from core. |
| `RuleRunnerService` | Rule execution orchestrator. Re-exported from core. |
| `SchedulerService` | Scheduling service. Re-exported from core. |
| `validateConditions` | Validate rule conditions. Re-exported from core. |
| `flattenFields` | Flatten nested field definitions. Re-exported from core. |
| `buildAggregationPipeline` | Build MongoDB aggregation pipelines. Re-exported from core. |

### Telegram-specific utilities

| Export | Description |
|--------|-------------|
| `categorizeError(error)` | Classifies a Telegram API error into `ErrorCategory`: `'critical'`, `'account'`, `'recoverable'`, `'skip'`, or `'unknown'`. Used to decide whether to retry, skip, or halt. |
| `isRetryableError(error)` | Returns `true` if the error is recoverable and the send can be retried. |
| `calculateTelegramDelay(options)` | Compute the full Telegram-specific delay including base delay, jitter, thinking pauses, and health adjustment. |
| `checkRedisThrottle(redis, key, config)` | Check Redis-backed throttle state for an identifier. Returns whether the send should be throttled. |
| `incrementRedisThrottle(redis, key)` | Increment the Redis throttle counter after a successful send. |
| `calculateDelay` | Compute delay with jitter. |
| `isWithinSendWindow` | Check if current time is within the configured send window. |
| `getHumanDelay` | Get a human-like delay with optional thinking pause. |
| `getHealthAdjustedDelay` | Adjust delay based on account health score. Signature: `(baseMs: number, healthScore: number, multiplier?: number) => number`. Health 100 = 1x, Health 0 = (1 + multiplier)x. |
| `createTelegramAdapters(config)` | Maps `TelegramRuleEngineConfig` adapters to core's `RuleEngineAdapters` interface. |
