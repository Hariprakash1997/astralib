# Configuration

The `createEmailRuleEngine(config)` factory accepts an `EmailRuleEngineConfig` object. The config is validated at startup with Zod -- invalid configs throw a `ConfigValidationError` with field-level details.

## db (required)

| Field | Type | Default | Description |
|-------|------|---------|-------------|
| `connection` | `mongoose.Connection` | -- | Mongoose connection instance. The engine creates 5 collections on this connection. |
| `collectionPrefix` | `string` | `''` | Prefix for collection model names (e.g., `'myapp_'` produces `myapp_EmailTemplate`). |

## redis (required)

| Field | Type | Default | Description |
|-------|------|---------|-------------|
| `connection` | `Redis` (ioredis) | -- | Used for distributed locking only. |
| `keyPrefix` | `string` | `''` | Prefix for Redis keys (e.g., `'myapp:'`). |

> **Multi-project warning:** `keyPrefix` defaults to empty string. If multiple projects share the same Redis, set unique prefixes to prevent queue/key collisions. See README for details.

## adapters (required)

Five required functions and one optional. See [adapters.md](adapters.md) for full details and example implementations.

| Adapter | Signature | Required |
|---------|-----------|----------|
| `queryUsers` | `(target: RuleTarget, limit: number, context?: { collectionSchema?: CollectionSchema }) => Promise<Record<string, unknown>[]>` | Yes |
| `resolveData` | `(user: Record<string, unknown>) => Record<string, unknown>` | Yes |
| `sendEmail` | `(params: SendEmailParams) => Promise<void>` | Yes |
| `selectAgent` | `(identifierId: string, context?) => Promise<AgentSelection \| null>` | Yes |
| `findIdentifier` | `(email: string) => Promise<RecipientIdentifier \| null>` | Yes |
| `sendTestEmail` | `(to, subject, html, text) => Promise<void>` | No |

### selectAgent and warmup limits

The rule-engine does **not** own account management or warmup state -- it delegates account selection entirely to the `selectAgent` adapter. This means your `selectAgent` implementation **must** respect warmup daily-send limits itself. If an account is in warmup phase and has already hit its daily cap, `selectAgent` should either pick a different account or return `null` to skip the send.

```typescript
selectAgent: async (identifierId, context) => {
  // Pick a candidate account (round-robin, random, etc.)
  const account = await pickNextAccount();

  // Check warmup capacity before returning
  if (account.warmupPhase) {
    const sentToday = await getSentTodayCount(account._id);
    if (sentToday >= account.warmupDailyLimit) {
      // Try another account, or return null to skip
      const fallback = await pickNextAccount({ exclude: [account._id] });
      if (!fallback) return null;
      return { accountId: fallback._id, email: fallback.email, metadata: fallback.metadata };
    }
  }

  return { accountId: account._id, email: account.email, metadata: account.metadata };
},
```

If you use `@astralibx/email-account-manager`, its built-in `selectAgent` helper already enforces warmup limits. See the email-account-manager docs for details.

## collections (optional)

Register MongoDB collection schemas so the admin UI shows real field names in dropdowns, filters operators by type, and offers a variable picker for templates. See [collections.md](collections.md) for the full reference.

```typescript
collections: [
  {
    name: 'users',
    label: 'Users',
    identifierField: 'email',
    fields: [
      { name: 'name', type: 'string', label: 'Full Name' },
      { name: 'email', type: 'string' },
      { name: 'age', type: 'number' },
      { name: 'isActive', type: 'boolean' },
      { name: 'role', type: 'string', enumValues: ['customer', 'provider'] },
      {
        name: 'address',
        type: 'object',
        fields: [
          { name: 'city', type: 'string' },
          { name: 'zip', type: 'string' },
        ],
      },
    ],
  },
],
```

When configured:
- **Rule editor** shows field dropdowns and type-aware operators instead of free-text inputs
- **Template editor** shows an "Insert Variable" picker with collection fields
- **Backend** validates condition fields and operators on rule create/update
- **queryUsers adapter** receives the collection schema as an optional third argument

When not configured, everything falls back to free-text inputs with no validation — zero breaking changes.

## platforms, audiences, categories (optional)

String arrays that constrain the valid values in template and rule Mongoose schemas.

| Field | Type | Description |
|-------|------|-------------|
| `platforms` | `string[]` | Valid platform values (e.g., `['web', 'mobile', 'both']`) |
| `audiences` | `string[]` | Valid audience/role values (e.g., `['customer', 'provider', 'all']`) |
| `categories` | `string[]` | Valid template categories (e.g., `['onboarding', 'engagement']`) |

If omitted, the Mongoose schema accepts any string for these fields.

## options (optional)

| Field | Type | Default | Description |
|-------|------|---------|-------------|
| `lockTTLMs` | `number` | `1800000` (30 min) | Redis lock TTL in milliseconds. Must exceed your longest expected run. |
| `defaultMaxPerRun` | `number` | `500` | Default max users per rule when `rule.maxPerRun` is not set. |
| `sendWindow` | `object` | -- | Time-based execution window. Runs outside the window are skipped entirely. Also configurable at runtime via `PUT /throttle` — DB setting takes priority over code config. |
| `sendWindow.startHour` | `number` | -- | Start hour (0--23, inclusive). |
| `sendWindow.endHour` | `number` | -- | End hour (0--23, exclusive). |
| `sendWindow.timezone` | `string` | -- | IANA timezone (e.g., `'Asia/Kolkata'`). |
| `delayBetweenSendsMs` | `number` | `0` | Base delay between individual sends in ms. Helps avoid SMTP rate limits. |
| `jitterMs` | `number` | `0` | Max random additional delay in ms, added on top of `delayBetweenSendsMs`. |

**Send window example** -- only send between 9 AM and 8 PM IST:

```typescript
options: {
  sendWindow: { startHour: 9, endHour: 20, timezone: 'Asia/Kolkata' },
  delayBetweenSendsMs: 2000,
  jitterMs: 1000,
}
```

## hooks (optional)

Callbacks fired at key points during rule execution. All hooks are optional and called via optional chaining, so they never cause engine failures. Keep hooks lightweight and non-throwing.

| Hook | Fires When | Payload |
|------|-----------|---------|
| `onRunStart` | After loading active rules | `{ rulesCount: number, triggeredBy: string, runId: string }` |
| `onRuleStart` | After querying users for a rule | `{ ruleId: string, ruleName: string, matchedCount: number, templateId: string, runId: string }` |
| `onSend` | After each send attempt | `{ ruleId: string, ruleName: string, email: string, status: 'sent' \| 'error' \| 'skipped' \| 'invalid' \| 'throttled', accountId: string, templateId: string, runId: string, subjectIndex: number, bodyIndex: number, preheaderIndex?: number, failureReason?: string }` |
| `onRuleComplete` | After a rule finishes | `{ ruleId: string, ruleName: string, stats: RuleRunStats, templateId: string, runId: string }` |
| `onRunComplete` | After run log is saved | `{ duration: number, totalStats: RuleRunStats, perRuleStats: PerRuleStats[], runId: string }` |
| `beforeSend` | Before each email is delivered | `{ htmlBody: string, textBody: string, subject: string, account: { id: string, email: string, metadata: Record<string, unknown> }, user: { id: string, email: string, name: string }, context: { ruleId: string, templateId: string, runId: string } }` |

The `beforeSend` hook is special -- it must return `{ htmlBody, textBody, subject }` and can modify the rendered content before delivery. This is useful for replacing account-level placeholders that are not available at template render time. It also receives a `context` object with `{ ruleId, templateId, runId }` for per-send tracking and attribution.

```typescript
hooks: {
  onRunStart: ({ rulesCount, triggeredBy, runId }) => {
    console.log(`Run ${runId} started: ${rulesCount} rules (${triggeredBy})`);
  },
  onSend: ({ ruleName, email, status, accountId, templateId, runId, subjectIndex, bodyIndex, failureReason }) => {
    console.log(`[${status}] ${ruleName} -> ${email} (account: ${accountId}, template: ${templateId}, run: ${runId})`);
  },
  onRunComplete: ({ duration, totalStats, runId }) => {
    console.log(`Run ${runId} done in ${duration}ms: ${totalStats.sent} sent, ${totalStats.errorCount} errors`);
  },
  beforeSend: async ({ htmlBody, textBody, subject, account, user }) => {
    // Replace account-level placeholders after template rendering
    const modified = htmlBody
      .replace(/\{\{sender_name\}\}/g, account.metadata.sender_names?.[Math.floor(Math.random() * account.metadata.sender_names.length)] || account.email)
      .replace(/\{\{contact_number\}\}/g, account.metadata.contact_numbers?.[0] || '');
    return { htmlBody: modified, textBody, subject };
  },
},
```

## SchedulerService

The engine includes a `SchedulerService` for cron-based rule execution. Rules with a `schedule` field are automatically executed on their cron schedule.

### Schedule field on rules

Rules accept an optional `schedule` object:

| Field | Type | Description |
|-------|------|-------------|
| `schedule.cron` | `string` | Cron expression (e.g., `'0 9 * * *'` for daily at 9 AM) |
| `schedule.timezone` | `string` | IANA timezone (e.g., `'Asia/Kolkata'`) |
| `schedule.enabled` | `boolean` | Whether scheduled execution is active |

### Creating and wiring the scheduler

The scheduler is available on the engine instance and must be started explicitly:

```typescript
const engine = createEmailRuleEngine({ /* config */ });

// Start the scheduler -- it reads schedule fields from active rules
engine.scheduler.start();

// Stop on shutdown
process.on('SIGTERM', () => engine.scheduler.stop());
```

### Cron format examples

| Expression | Schedule |
|-----------|----------|
| `0 9 * * *` | Every day at 9:00 AM |
| `0 9 * * 1-5` | Weekdays at 9:00 AM |
| `0 */6 * * *` | Every 6 hours |
| `0 9,18 * * *` | Twice daily at 9 AM and 6 PM |
| `0 0 1 * *` | First day of each month at midnight |

---

## logger (optional)

Any object with `info`, `warn`, `error` methods. Compatible with `console`, Winston, Pino, etc. Defaults to a silent no-op logger.

```typescript
interface LogAdapter {
  info: (msg: string, meta?: Record<string, unknown>) => void;
  warn: (msg: string, meta?: Record<string, unknown>) => void;
  error: (msg: string, meta?: Record<string, unknown>) => void;
}
```

## Template Preview

Preview rendering uses non-strict Handlebars mode — missing variables render as empty strings instead of throwing errors. When no sample data is provided, the preview auto-generates placeholder values from the template's variables list (e.g., `{{name}}` renders as `[name]`).

To provide sample data for more realistic previews:

```typescript
// Via API
POST /templates/:id/preview
{ "sampleData": { "name": "John", "company": "Acme" } }

// Via raw preview
POST /templates/preview
{ "subject": "Hello {{name}}", "body": "...", "variables": ["name"], "sampleData": { "name": "John" } }
```

## Full Config Example

```typescript
const engine = createEmailRuleEngine({
  db: { connection: dbConnection, collectionPrefix: 'myapp_' },
  redis: { connection: redis, keyPrefix: 'myapp:' },

  collections: [
    {
      name: 'users',
      label: 'Users',
      identifierField: 'email',
      fields: [
        { name: 'name', type: 'string' },
        { name: 'email', type: 'string' },
        { name: 'age', type: 'number' },
        { name: 'isActive', type: 'boolean' },
      ],
    },
  ],

  platforms: ['web', 'mobile', 'both'],
  audiences: ['customer', 'provider', 'all'],
  categories: ['onboarding', 'engagement', 'transactional', 're-engagement', 'announcement'],

  adapters: {
    queryUsers: async (target, limit, context?) => { /* ... */ },
    resolveData: (user) => ({ /* ... */ }),
    sendEmail: async (params) => { /* ... */ },
    selectAgent: async (identifierId, context) => ({ accountId: 'default', email: 'noreply@example.com', metadata: {} }),
    findIdentifier: async (email) => { /* ... */ },
    sendTestEmail: async (to, subject, html, text) => { /* ... */ },
  },

  logger: console,

  options: {
    lockTTLMs: 30 * 60 * 1000,
    defaultMaxPerRun: 500,
    sendWindow: { startHour: 9, endHour: 20, timezone: 'Asia/Kolkata' },
    delayBetweenSendsMs: 2000,
    jitterMs: 1000,
  },

  hooks: {
    onRunStart: ({ rulesCount, triggeredBy, runId }) => { /* ... */ },
    onRuleStart: ({ ruleId, ruleName, matchedCount, templateId, runId }) => { /* ... */ },
    onSend: ({ ruleId, ruleName, email, status, accountId, templateId, runId, subjectIndex, bodyIndex, failureReason }) => { /* ... */ },
    onRuleComplete: ({ ruleId, ruleName, stats, templateId, runId }) => { /* ... */ },
    onRunComplete: ({ duration, totalStats, perRuleStats, runId }) => { /* ... */ },
  },
});
```
