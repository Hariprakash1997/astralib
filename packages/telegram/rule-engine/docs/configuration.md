# Configuration

The `createTelegramRuleEngine(config)` factory accepts a `TelegramRuleEngineConfig` object. The config is validated at startup with Zod -- invalid configs throw a `ConfigValidationError` with field-level details.

> **Core delegation:** Most config options (`db`, `redis`, `platforms`, `audiences`, `categories`, `hooks`, `logger`, and base `options` like `lockTTLMs`, `defaultMaxPerRun`, `sendWindow`, `delayBetweenSendsMs`, `jitterMs`) are passed directly to `@astralibx/rule-engine` core. The sections below document all options, noting which are Telegram-specific.

## db (required)

| Field | Type | Default | Description |
|-------|------|---------|-------------|
| `connection` | `mongoose.Connection` | -- | Mongoose connection instance. The engine creates 6 collections on this connection. |
| `collectionPrefix` | `string` | `''` | Prefix for collection model names (e.g., `'myapp_'` produces `myapp_TelegramTemplate`). |

## redis (required)

| Field | Type | Default | Description |
|-------|------|---------|-------------|
| `connection` | `Redis` (ioredis) | -- | Used for distributed locking, run progress, and cancel flags. |
| `keyPrefix` | `string` | `''` | Prefix for Redis keys (e.g., `'myapp:'`). |

> **Multi-project warning:** `keyPrefix` defaults to empty string. If multiple projects share the same Redis, set unique prefixes to prevent key collisions. See README for details.

## adapters (required)

Five required functions that bridge your application to the engine. These are mapped internally to core's generic adapter interface (`send` -> `sendMessage`, `selectAgent` -> `selectAccount`).

> **Naming convention:** This package uses Telegram-specific adapter names (`sendMessage`, `selectAccount`, `findIdentifier`) rather than core's generic names (`send`, `selectAgent`, `findRecipient`). The `createTelegramAdapters` function handles the mapping.

| Adapter | Signature | Description |
|---------|-----------|-------------|
| `queryUsers` | `(target: RuleTarget, limit: number) => Promise<Record<string, unknown>[]>` | Fetch users matching a rule's target conditions. Called in query mode. Receives the full `RuleTarget` and the rule's `maxPerRun` limit. Return user objects with enough data for `resolveData` and `findIdentifier`. |
| `resolveData` | `(user: Record<string, unknown>) => Record<string, unknown>` | Transform a user object into Handlebars template data. The returned object is merged with template `fields` and passed to Handlebars for message rendering. |
| `sendMessage` | `(params: SendMessageParams) => Promise<void>` | Deliver a message via Telegram. Receives `identifierId`, `contactId`, `accountId`, `message` (rendered text), optional `media`, `ruleId`, and `templateId`. Maps to core's `send` adapter. |
| `selectAccount` | `(identifierId: string, context?) => Promise<AccountSelection \| null>` | Pick a Telegram account to send from. Receives the recipient identifier and optional `{ ruleId, templateId }` context. Return `{ accountId, phone, metadata }` or `null` to skip. Maps to core's `selectAgent` adapter. |
| `findIdentifier` | `(phoneOrUsername: string) => Promise<RecipientIdentifier \| null>` | Resolve a phone number or username to a contact record. Return `{ id, contactId }` or `null` if not found. Used in list mode to resolve each identifier. Maps to core's `findRecipient` adapter. |

### selectAccount and rate limits

The engine does **not** own account management -- it delegates account selection entirely to the `selectAccount` adapter. If an account has rate limits or cooldown periods, your `selectAccount` implementation must enforce them by picking a different account or returning `null` to skip.

```typescript
selectAccount: async (identifierId, context) => {
  const account = await pickNextAccount();
  if (account.rateLimited) {
    const fallback = await pickNextAccount({ exclude: [account._id] });
    if (!fallback) return null;
    return { accountId: fallback._id, phone: fallback.phone, metadata: fallback.metadata };
  }
  return { accountId: account._id, phone: account.phone, metadata: account.metadata };
},
```

## platforms, audiences, categories (optional)

String arrays that constrain the valid values in template and rule Mongoose schemas.

| Field | Type | Description |
|-------|------|-------------|
| `platforms` | `string[]` | Valid platform values (e.g., `['web', 'mobile', 'both']`) |
| `audiences` | `string[]` | Valid audience/role values (e.g., `['customer', 'provider', 'all']`) |
| `categories` | `string[]` | Valid template categories (e.g., `['onboarding', 'engagement']`) |

If omitted, the Mongoose schema accepts any string for these fields.

## options (optional)

Options marked with **(core)** are passed to `@astralibx/rule-engine`. Options marked with **(telegram)** are handled by this package's adapters and middleware.

| Field | Type | Default | Source | Description |
|-------|------|---------|--------|-------------|
| `lockTTLMs` | `number` | `1800000` (30 min) | core | Redis lock TTL in milliseconds. Must exceed your longest expected run. |
| `defaultMaxPerRun` | `number` | `100` | core | Default max users per rule when `rule.maxPerRun` is not set. |
| `sendWindow` | `object` | -- | core | Time-based execution window. Runs outside the window are skipped entirely. |
| `sendWindow.startHour` | `number` | -- | core | Start hour (0--23, inclusive). |
| `sendWindow.endHour` | `number` | -- | core | End hour (0--23, exclusive). |
| `sendWindow.timezone` | `string` | -- | core | IANA timezone (e.g., `'Asia/Kolkata'`). |
| `delayBetweenSendsMs` | `number` | `3000` | core | Base delay between individual sends in ms. Helps simulate human-like pacing. |
| `jitterMs` | `number` | `1500` | core | Max random additional delay in ms, added on top of `delayBetweenSendsMs`. |
| `maxConsecutiveFailures` | `number` | `3` | **telegram** | Stop processing a rule after this many consecutive send failures. |
| `thinkingPauseProbability` | `number` | `0.25` | **telegram** | Probability (0--1) of adding an extra "thinking" pause between sends for human-like behavior. |
| `batchProgressInterval` | `number` | `10` | **telegram** | Update Redis progress key every N sends. |
| `healthDelayMultiplier` | `number` | `3` | **telegram** | Multiplier for health-adjusted delays. At health 0, delay = base * (1 + multiplier). At health 100, delay = base * 1. |
| `useRedisThrottle` | `boolean` | `false` | **telegram** | Use Redis-based throttle tracking instead of MongoDB. When enabled, throttle checks and increments are performed against Redis for lower latency. Falls back to the default MongoDB-based throttle when `false`. See details below. |

### useRedisThrottle

**When to use:** Multi-instance deployments where the in-memory throttle map doesn't share state across processes. With `useRedisThrottle: true`, all instances read and write throttle data to the same Redis, ensuring consistent per-user limits regardless of which instance handles the send.

**Redis key pattern:** `${keyPrefix}throttle:${identifierId}` with a 7-day TTL (`DEFAULT_THROTTLE_TTL_SECONDS = 604800`).

**Tradeoffs:** There is a slight latency overhead per send for the Redis round-trip, but you gain consistent throttling across all instances. For single-instance deployments the default MongoDB-based throttle is sufficient and avoids the extra network hop.

**Concurrency note:** Redis throttle operations run under the built-in `RedisLock`, so they are safe in single-lock setups. For multi-lock setups (e.g., multiple engines sharing the same Redis with separate lock scopes), consider atomic Lua scripts to avoid race conditions between the check and increment steps.

**Send window example** -- only send between 9 AM and 8 PM IST:

```typescript
options: {
  sendWindow: { startHour: 9, endHour: 20, timezone: 'Asia/Kolkata' },
  delayBetweenSendsMs: 3000,
  jitterMs: 1500,
}
```

## hooks (optional)

Callbacks fired at key points during rule execution. All hooks are optional and called via optional chaining, so they never cause engine failures. Keep hooks lightweight and non-throwing.

| Hook | Fires When | Payload |
|------|-----------|---------|
| `onRunStart` | After loading active rules | `{ rulesCount: number, triggeredBy: string, runId: string }` |
| `onRuleStart` | After querying users for a rule | `{ ruleId: string, ruleName: string, matchedCount: number, templateId: string, runId: string }` |
| `onSend` | After each send attempt | `{ ruleId: string, ruleName: string, identifierId: string, status: 'sent' \| 'error' \| 'skipped' \| 'throttled', accountId: string, templateId: string, runId: string, messageIndex: number, failureReason?: string }` |
| `onRuleComplete` | After a rule finishes | `{ ruleId: string, ruleName: string, stats: RuleRunStats, templateId: string, runId: string }` |
| `onRunComplete` | After run log is saved | `{ duration: number, totalStats: RuleRunStats, perRuleStats: PerRuleStats[], runId: string }` |
| `beforeSend` | Before each message is delivered | `BeforeSendParams` (see below) |

The `beforeSend` hook is special -- it must return `{ message, media? }` and can modify the rendered content before delivery. This is useful for injecting account-level placeholders not available at template render time.

**`BeforeSendParams`:**

```typescript
{
  message: string;
  account: { id: string; phone: string; metadata: Record<string, unknown> };
  user: { id: string; contactId: string; name: string };
  context: { ruleId: string; templateId: string; runId: string };
  media?: { type: 'photo' | 'video' | 'voice' | 'audio' | 'document'; url: string; caption?: string };
}
```

**`BeforeSendResult`:**

```typescript
{
  message: string;
  media?: { type: string; url: string; caption?: string };
}
```

```typescript
hooks: {
  onRunStart: ({ rulesCount, triggeredBy, runId }) => {
    console.log(`Run ${runId} started: ${rulesCount} rules (${triggeredBy})`);
  },
  onSend: ({ ruleName, identifierId, status, accountId, runId, messageIndex }) => {
    console.log(`[${status}] ${ruleName} -> ${identifierId} (account: ${accountId}, run: ${runId})`);
  },
  onRunComplete: ({ duration, totalStats, runId }) => {
    console.log(`Run ${runId} done in ${duration}ms: ${totalStats.sent} sent, ${totalStats.failed} errors`);
  },
  beforeSend: async ({ message, account, user }) => {
    const modified = message
      .replace(/\{\{sender_name\}\}/g, account.metadata.senderName || account.phone);
    return { message: modified };
  },
},
```

## logger (optional)

Any object with `info`, `warn`, `error` methods. Compatible with `console`, Winston, Pino, etc. Defaults to a silent no-op logger.

```typescript
interface LogAdapter {
  info: (msg: string, meta?: Record<string, unknown>) => void;
  warn: (msg: string, meta?: Record<string, unknown>) => void;
  error: (msg: string, meta?: Record<string, unknown>) => void;
}
```

## Collections & Joins

Collections define the data source schema (fields + types) for the UI condition builder. They enable field validation, operator-type compatibility checks, and a variable picker in admin UIs. Joins let templates reference data from related collections (e.g., subscription status from a separate `subscriptions` collection).

> **Optional:** Collections are entirely optional. Without them, condition fields are free-text and the variable picker shows no suggestions.

```typescript
const engine = createTelegramRuleEngine({
  collections: [
    {
      name: 'telegram_contacts',
      label: 'Telegram Contacts',
      identifierField: 'chatId',
      fields: [
        { name: 'firstName', type: 'string', label: 'First Name' },
        { name: 'lastName', type: 'string', label: 'Last Name' },
        { name: 'username', type: 'string', label: 'Username' },
        { name: 'tags', type: 'array', label: 'Tags' },
        { name: 'lastMessageAt', type: 'date', label: 'Last Message' },
      ],
      joins: [
        {
          from: 'subscriptions',
          localField: '_id',
          foreignField: 'contactId',
          as: 'subscription',
        },
      ],
    },
  ],
  adapters: {
    queryUsers: async (target, limit, context) => {
      // When collections are configured, context includes collectionSchema and activeJoins
      if (context?.activeJoins && context.collectionSchema) {
        const pipeline = buildAggregationPipeline({
          joins: context.activeJoins,
          conditions: target.conditions,
          limit,
        });
        return mongoose.connection.db
          .collection(context.collectionSchema.name)
          .aggregate(pipeline)
          .toArray();
      }
      // Fallback: simple query without joins
      return MyContactModel.find(target.conditions).limit(limit).lean();
    },
  },
});
```

### How it works

- **Collections** declare the schema (fields, types, enums) for each data source. The engine uses these to validate conditions, suggest fields in the UI, and enforce operator-type compatibility.
- **Joins** map to MongoDB `$lookup` stages. Each join declares a source collection (`from`), matching fields (`localField`, `foreignField`), and an alias (`as`). Joined fields are accessed via the alias prefix (e.g., `subscription.plan`).
- **`queryUsers` adapter** receives a `context` parameter with the active collection schema and joins when collections are configured. Use `buildAggregationPipeline()` (exported from the package) to build MongoDB aggregation pipelines from joins + conditions.
- **Templates own their data source** via `collectionName` and `joins` fields. Only the joins declared on a template are active during condition validation and query execution.

See the [core collections documentation](https://github.com/Hariprakash1997/astralib/blob/main/packages/rule-engine/core/docs/collections-and-joins.md) for the full reference on field types, operators, pipeline builder, and API endpoints.

## Full Config Example

```typescript
const engine = createTelegramRuleEngine({
  db: { connection: dbConnection, collectionPrefix: 'myapp_' },
  redis: { connection: redis, keyPrefix: 'myapp:' },

  platforms: ['web', 'mobile', 'both'],
  audiences: ['customer', 'provider', 'all'],
  categories: ['onboarding', 'engagement', 'transactional', 're-engagement', 'announcement'],

  adapters: {
    queryUsers: async (target, limit) => { /* ... */ },
    resolveData: (user) => ({ /* ... */ }),
    sendMessage: async (params) => { /* ... */ },
    selectAccount: async (identifierId, context) => ({ accountId: 'default', phone: '+919876543210', metadata: {} }),
    findIdentifier: async (phoneOrUsername) => { /* ... */ },
  },

  logger: console,

  options: {
    lockTTLMs: 30 * 60 * 1000,
    defaultMaxPerRun: 100,
    sendWindow: { startHour: 9, endHour: 20, timezone: 'Asia/Kolkata' },
    delayBetweenSendsMs: 3000,
    jitterMs: 1500,
    maxConsecutiveFailures: 3,
    thinkingPauseProbability: 0.25,
    batchProgressInterval: 10,
    healthDelayMultiplier: 3,
    useRedisThrottle: false,
  },

  hooks: {
    onRunStart: ({ rulesCount, triggeredBy, runId }) => { /* ... */ },
    onRuleStart: ({ ruleId, ruleName, matchedCount, templateId, runId }) => { /* ... */ },
    onSend: ({ ruleId, ruleName, identifierId, status, accountId, templateId, runId, messageIndex, failureReason }) => { /* ... */ },
    onRuleComplete: ({ ruleId, ruleName, stats, templateId, runId }) => { /* ... */ },
    onRunComplete: ({ duration, totalStats, perRuleStats, runId }) => { /* ... */ },
    beforeSend: async ({ message, account, user, context, media }) => { /* ... */ },
  },
});
```
