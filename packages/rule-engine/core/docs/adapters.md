# Adapters

Adapters are the bridge between the rule engine and your application. The engine handles orchestration — scheduling, throttling, deduplication, template rendering, and run logging — while adapters supply the platform-specific logic: how to query your database, how to resolve contacts, which account to use, and how to deliver a message. You implement the five required adapters (and one optional one) once at startup and pass them in `RuleEngineConfig.adapters`.

---

## 1. `queryUsers(target, limit, context?)`

```ts
queryUsers: (
  target: RuleTarget,
  limit: number,
  context?: { collectionSchema?: CollectionSchema; activeJoins?: JoinDefinition[] }
) => Promise<Record<string, unknown>[]>
```

**Purpose:** Return the list of users that match a rule's targeting criteria. Each returned object must include at least `_id` and `contactValue` so the engine can look up the user's identifier record.

**When called:**

- During a normal rule run (query mode) — once per rule, before per-user processing begins.
- During a dry run (`GET /rules/:id/dry-run`) — called with a limit of `50000` to preview match counts without sending.
- During a collection-level query test (`POST /collections/:name/query`) — also called with `50000`.

**Parameters:**

| Parameter | Type | Notes |
|-----------|------|-------|
| `target` | `RuleTarget` | Contains `mode`, `conditions`, `role`, `platform`, and other rule targeting fields. |
| `limit` | `number` | Maximum number of records to fetch. Respect this at the database level to avoid loading unbounded result sets. |
| `context` | `object \| undefined` | Present only when the rule's template is linked to a named collection. |
| `context.collectionSchema` | `CollectionSchema` | The full schema definition for the collection, including field metadata. Use it to understand field types when building filters. |
| `context.activeJoins` | `JoinDefinition[]` | The subset of joins that the template has opted into. When non-empty, you should run an aggregation pipeline instead of a simple find. |

**Implementation example — MongoDB with joins:**

```typescript
import { buildAggregationPipeline } from '@astralibx/rule-engine';

queryUsers: async (target, limit, context) => {
  if (context?.activeJoins?.length) {
    const pipeline = buildAggregationPipeline({
      joins: context.activeJoins,
      conditions: target.conditions,
      limit,
    });
    return db.collection('users').aggregate(pipeline).toArray();
  }

  // Simple find when no joins are needed
  return User.find(buildFilter(target.conditions)).limit(limit).lean();
},
```

---

## 2. `resolveData(user)`

```ts
resolveData: (user: Record<string, unknown>) => Record<string, unknown>
```

**Purpose:** Transform a raw database record into the variable map used when rendering the Handlebars template. This is where you rename fields, compute derived values, format dates, and add anything the template needs.

**When called:** Once per user, immediately before template rendering, inside `processSingleUser`. The return value is merged with the template's static `fields` object, with your resolved data taking precedence.

**Implementation example:**

```typescript
resolveData: (user) => ({
  firstName: user.first_name ?? 'there',
  lastName: user.last_name ?? '',
  email: user.email,
  plan: user.subscription_tier ?? 'free',
  trialEndsAt: user.trial_end
    ? new Date(user.trial_end as string).toLocaleDateString('en-US', { month: 'long', day: 'numeric' })
    : null,
}),
```

---

## 3. `send(params)`

```ts
send: (params: SendParams) => Promise<void>
```

**Purpose:** Deliver the rendered message to the recipient using your messaging platform (SMTP, Telegram bot API, SMS gateway, etc.).

**When called:** After template rendering and after the optional `beforeSend` hook have both completed successfully, inside `processSingleUser`. If this function throws, the engine logs the error, increments the `failed` counter, and continues to the next user.

**`SendParams` fields:**

| Field | Type | Notes |
|-------|------|-------|
| `identifierId` | `string` | The identifier record ID for this recipient. |
| `contactId` | `string` | The contact record ID (e.g., the email address record or phone record). |
| `accountId` | `string` | The sender account ID returned by `selectAgent`. |
| `subject` | `string \| undefined` | Rendered subject line. Present for email; absent for channels that do not use subjects. |
| `body` | `string` | Rendered HTML (or message text) body. |
| `textBody` | `string \| undefined` | Plain-text fallback body, if the template defines one. |
| `ruleId` | `string` | ID of the rule being executed. Useful for send-log correlation. |
| `autoApprove` | `boolean` | Whether the message should bypass any manual approval queue in your system. |
| `metadata` | `Record<string, unknown> \| undefined` | Template-level metadata merged with attachment list. |

**Email (SMTP) example:**

```typescript
send: async (params) => {
  const account = await EmailAccount.findById(params.accountId);
  await transporter.sendMail({
    from: `"${account.name}" <${account.email}>`,
    to: await resolveContactEmail(params.contactId),
    subject: params.subject,
    html: params.body,
    text: params.textBody,
  });
},
```

**Telegram example:**

```typescript
send: async (params) => {
  const account = await TelegramAccount.findById(params.accountId);
  const chatId = await resolveTelegramChatId(params.contactId);
  await telegramBot.sendMessage(account.botToken, chatId, { text: params.body });
},
```

---

## 4. `selectAgent(identifierId, context?)`

```ts
selectAgent: (
  identifierId: string,
  context?: { ruleId: string; templateId: string }
) => Promise<AgentSelection | null>
```

**Purpose:** Choose which sender account (email account, Telegram bot, SMS number, etc.) will send the message for this specific recipient. Return `null` to skip the user without counting it as a failure.

**When called:** Once per user, before `resolveData` and template rendering, inside `processSingleUser`. The engine calls it after throttle checks pass, so you are only selecting an agent for users that are actually going to receive a message. If `null` is returned, the user is counted as `skipped` with reason `"no account available"`.

**`AgentSelection` fields:**

| Field | Type | Notes |
|-------|------|-------|
| `accountId` | `string` | ID of the account/agent to use. Passed directly to `send`. |
| `contactValue` | `string` | The sender contact value (e.g., `from@example.com`). Available in the `beforeSend` hook. |
| `metadata` | `Record<string, unknown>` | Any extra account data you want available in the `beforeSend` hook. |

**Round-robin example:**

```typescript
selectAgent: async (identifierId, context) => {
  const accounts = await EmailAccount.find({ isActive: true }).lean();
  if (!accounts.length) return null;

  const index = await redis.incr('agent:round-robin:index');
  const account = accounts[index % accounts.length];

  return {
    accountId: account._id.toString(),
    contactValue: account.email,
    metadata: { name: account.name },
  };
},
```

---

## 5. `findIdentifier(contactValue)`

```ts
findIdentifier: (contactValue: string) => Promise<RecipientIdentifier | null>
```

**Purpose:** Resolve a contact value (an email address, phone number, Telegram username, etc.) to the identifier record in your system. The engine needs both the identifier ID and the contact ID to pass to `selectAgent` and `send`.

**When called:** In bulk before per-user processing starts, once for each unique `contactValue` in the matched user set. The engine batches calls in chunks of 50 to avoid overwhelming the database. Users whose `contactValue` cannot be resolved are skipped with status `"invalid"`.

**`RecipientIdentifier` fields:**

| Field | Type | Notes |
|-------|------|-------|
| `id` | `string` | The identifier record's ID. Used as `identifierId` in `send` and as the throttle key. |
| `contactId` | `string` | The contact record's ID. Passed to `send` as `contactId`. |

**Implementation example:**

```typescript
findIdentifier: async (contactValue) => {
  const identifier = await Identifier.findOne({
    contactValue: contactValue.toLowerCase().trim(),
    isActive: true,
  }).lean();

  if (!identifier) return null;

  return {
    id: identifier._id.toString(),
    contactId: identifier.contactId.toString(),
  };
},
```

---

## Optional: `sendTest(to, body, subject?, metadata?)`

```ts
sendTest?: (
  to: string,
  body: string,
  subject?: string,
  metadata?: Record<string, unknown>
) => Promise<void>
```

**Purpose:** Send a one-off test message from the Settings UI or via the `POST /templates/:id/test-send` API endpoint. This bypasses all rule logic, throttling, and identifier resolution — it is purely a direct delivery to the address you specify.

**When called:** Only when a test-send is requested explicitly. The engine will not call this during normal runs. If `sendTest` is not provided, the test-send endpoint will return an error.

---

## Execution Flow

The diagram below shows the order in which adapters are called for each user during a normal rule run.

```
runAllRules()
  │
  ├─ [for each active rule]
  │     │
  │     ├─ queryUsers(target, limit, context?)   ← fetch matching users
  │     │
  │     ├─ findIdentifier(contactValue)          ← bulk-resolve identifiers (50 at a time)
  │     │
  │     └─ [for each user]
  │           │
  │           ├─ throttle / skip / cooldown checks
  │           │
  │           ├─ selectAgent(identifierId, context?)   ← pick sender account
  │           │
  │           ├─ resolveData(user)               ← map DB record → template variables
  │           │
  │           ├─ render template (Handlebars)
  │           │
  │           ├─ hooks.beforeSend(...)            ← optional hook (not an adapter)
  │           │
  │           ├─ send(params)                    ← deliver message
  │           │
  │           └─ log to SendLog
```
