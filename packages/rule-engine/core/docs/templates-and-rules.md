# Templates and Rules

## Templates

A **template** is the content unit in the rule engine. It holds the message content, the data source definition, and all variable declarations used to render personalized messages.

### Template Fields

| Field | Type | Description |
|---|---|---|
| `name` | `string` | Human-readable display name |
| `slug` | `string` | Unique URL-safe identifier, immutable after creation |
| `description` | `string?` | Optional notes for internal use |
| `category` | `string` | One of: `onboarding`, `engagement`, `transactional`, `re-engagement`, `announcement` |
| `audience` | `string` | One of: `customer`, `provider`, `all` |
| `platform` | `string` | Target platform (e.g. `email`, `sms`, `whatsapp`) |
| `version` | `number` | Auto-incremented on every content change (`subjects`, `bodies`, `textBody`, `preheaders`) |
| `subjects` | `string[]?` | Optional subject line variants (for A/B testing); not needed on platforms without subjects |
| `bodies` | `string[]` | One or more HTML body variants (for A/B testing) |
| `preheaders` | `string[]?` | Optional email preheader variants |
| `textBody` | `string?` | Plain-text fallback body |
| `fields` | `Record<string, string>` | Static fallback values for variables (e.g. `{ "appName": "Acme" }`) |
| `variables` | `string[]` | Declared variable names used in subjects/bodies (e.g. `["name", "subscription.plan"]`) |
| `collectionName` | `string?` | MongoDB collection that drives this template's audience query |
| `joins` | `string[]?` | Join aliases to activate for this template (defined in the engine config) |
| `attachments` | `Attachment[]?` | File attachments with `filename`, `url`, and `contentType` |
| `metadata` | `Record<string, unknown>?` | Platform-specific extra data passed through to the send adapter |
| `isActive` | `boolean` | Whether this template is available for use by rules |

### A/B Testing with `subjects` and `bodies`

`subjects` and `bodies` are arrays. Each element is one variant. During a run the engine assigns variant indices per-user so the distribution cycles through all variants. This enables split testing without any extra configuration — simply add multiple entries:

```json
{
  "subjects": ["Your invoice is ready", "Action required: new invoice"],
  "bodies": ["<p>Hi {{name}}, your invoice...</p>", "<p>{{name}}, please review..."]
}
```

Variant selection is index-based and tracked in the send log via `subjectIndex` / `bodyIndex`.

### Version Auto-Increment

The `version` field increments automatically whenever `subjects`, `bodies`, `textBody`, or `preheaders` are updated. It does not increment for metadata, field, or join changes. This lets you track which content version a recipient received through the send log.

### `collectionName` and `joins` — The Template Owns the Data Source

The template, not the rule, defines **which MongoDB collection** is queried when its rules run. `collectionName` must match the `name` of a collection registered in `RuleEngineConfig.collections`. The `joins` array lists join aliases (by their `as` value from the collection schema) that should be activated when querying.

This design means all rules linked to a template automatically inherit the same data context. Rules cannot override `collectionName` or `joins`.

```json
{
  "collectionName": "users",
  "joins": ["subscription", "profile"]
}
```

If `collectionName` is omitted the rule engine calls `queryUsers` with no collection context and relies entirely on the adapter's implementation.

### `metadata` — Platform-Specific Data

`metadata` is an opaque `Record<string, unknown>` forwarded as-is to the `send` adapter inside `SendParams.metadata`. Use it for platform-specific configuration such as email tags, campaign IDs, WhatsApp template names, or provider-level flags that should not appear in the message body.

---

## Handlebars Variables

Template `subjects` and `bodies` use Handlebars syntax for variable interpolation.

### Syntax

```
Hello {{name}}, your plan is {{subscription.plan}}.
```

Dot notation resolves nested objects. Handlebars escapes HTML by default; use triple braces `{{{body}}}` for unescaped output.

### How Variables Are Resolved

When the rule runner processes a recipient, it calls the `resolveData` adapter with the raw user object from `queryUsers`. The result is merged with the template's static `fields` map and used as the Handlebars context:

1. `resolveData(user)` — adapter returns enriched data (e.g. fetches subscription details)
2. Template `fields` values fill in any key not already present
3. Any key still missing renders as an empty string

The `variables` array on the template declares which keys are expected. It is used during preview to identify missing values but does not restrict rendering at runtime.

### Variable Declaration (`template.fields`)

`fields` serves as a static default map. Example:

```json
{
  "fields": {
    "appName": "Acme App",
    "supportEmail": "help@acme.com"
  }
}
```

If the `resolveData` adapter does not return `appName`, the static value from `fields` is used instead.

---

## Rules

A **rule** binds a template to a targeting strategy and controls when and how often messages are sent. Every rule references exactly one template via `templateId`.

### Rule Fields

| Field | Type | Description |
|---|---|---|
| `name` | `string` | Rule display name |
| `platform` | `string` | Platform this rule targets |
| `templateId` | `string` | ID of the linked template |
| `isActive` | `boolean` | Whether this rule participates in runs |
| `sortOrder` | `number` | Execution order (ascending); lower numbers run first |
| `target` | `RuleTarget` | Targeting configuration (see below) |
| `ruleType` | `RuleType` | `automated` or `transactional` |
| `sendOnce` | `boolean` | If true, each recipient is sent at most once |
| `resendAfterDays` | `number?` | Override `sendOnce` — allow resend after N days |
| `cooldownDays` | `number?` | Minimum days between sends per recipient |
| `maxPerRun` | `number?` | Cap on recipients processed in a single run |
| `validFrom` | `Date?` | Rule does not execute before this date |
| `validTill` | `Date?` | Rule does not execute after this date |
| `bypassThrottle` | `boolean` | Skip all throttle checks for this rule |
| `throttleOverride` | `object?` | Per-rule throttle limits (see Throttling docs) |
| `schedule` | `object?` | Cron schedule for this rule |
| `autoApprove` | `boolean` | Passed to the send adapter to skip manual approval |
| `totalSent` | `number` | Cumulative send count (read-only, updated by runner) |
| `lastRunAt` | `Date?` | Timestamp of the most recent run (read-only) |
| `lastRunStats` | `RuleRunStats?` | Stats from the last run (read-only) |

### Targeting Modes

Rules support two mutually exclusive targeting modes set via `target.mode`.

#### Query Mode (`mode: "query"`)

Queries the collection defined by the linked template using `conditions` evaluated by the `queryUsers` adapter.

```json
{
  "target": {
    "mode": "query",
    "role": "customer",
    "platform": "email",
    "conditions": [
      { "field": "subscription.plan", "operator": "eq", "value": "pro" },
      { "field": "createdAt", "operator": "gte", "value": "2024-01-01" }
    ]
  }
}
```

`role` and `platform` are passed to `queryUsers` as additional filter hints interpreted by the adapter.

#### List Mode (`mode: "list"`)

Sends to an explicit list of contact values (emails, phone numbers, user IDs).

```json
{
  "target": {
    "mode": "list",
    "identifiers": ["alice@example.com", "bob@example.com"]
  }
}
```

List mode bypasses `queryUsers` entirely. The engine resolves each identifier via the `findIdentifier` adapter to obtain internal IDs.

### Rule Type (`ruleType`)

| Value | Behaviour |
|---|---|
| `automated` | Subject to all throttle limits; standard delivery rules apply |
| `transactional` | Bypasses throttle checks entirely, regardless of `bypassThrottle` flag |

### Schedule

```json
{
  "schedule": {
    "enabled": true,
    "cron": "0 9 * * 1",
    "timezone": "America/New_York"
  }
}
```

The `cron` field uses standard five-field cron syntax. When `schedule.enabled` is `false` the rule participates in manual/cron-triggered runs but not scheduled runs. `timezone` defaults to UTC when omitted.

### `sendOnce` and `resendAfterDays`

When `sendOnce` is `true` a recipient who has already received this rule's message is skipped in all future runs. Set `resendAfterDays` to a positive integer to allow re-delivery after that many days have passed since the last send.

For list-mode rules with `sendOnce` enabled, the rule auto-disables itself once every identifier in the list has been processed and there are no throttled sends pending.

### `maxPerRun`

Caps the number of recipients processed in a single run. Recipients beyond the cap are deferred to the next run. Falls back to `config.options.defaultMaxPerRun` (default: 500) if not set.

### `validFrom` / `validTill`

Date boundaries that prevent a rule from executing outside its active window. Both are evaluated in the send window's configured timezone (or UTC if none).

---

## Condition Operators

Conditions in query-mode rules use the following operators. The engine validates conditions against the registered collection schema at save time.

| Operator | Value type | Description | Example |
|---|---|---|---|
| `eq` | scalar | Field equals value | `{ "field": "status", "operator": "eq", "value": "active" }` |
| `neq` | scalar | Field does not equal value | `{ "field": "status", "operator": "neq", "value": "banned" }` |
| `gt` | number / date | Field is greater than value | `{ "field": "age", "operator": "gt", "value": 18 }` |
| `gte` | number / date | Field is greater than or equal | `{ "field": "score", "operator": "gte", "value": 100 }` |
| `lt` | number / date | Field is less than value | `{ "field": "daysInactive", "operator": "lt", "value": 30 }` |
| `lte` | number / date | Field is less than or equal | `{ "field": "balance", "operator": "lte", "value": 0 }` |
| `exists` | — | Field is present and not null | `{ "field": "phoneNumber", "operator": "exists" }` |
| `not_exists` | — | Field is absent or null | `{ "field": "deletedAt", "operator": "not_exists" }` |
| `in` | array | Field value is in the array | `{ "field": "plan", "operator": "in", "value": ["pro", "enterprise"] }` |
| `not_in` | array | Field value is not in the array | `{ "field": "country", "operator": "not_in", "value": ["US", "CA"] }` |
| `contains` | scalar | String/array field contains value | `{ "field": "tags", "operator": "contains", "value": "beta" }` |

Not all operators apply to every field type. The engine enforces this via `TYPE_OPERATORS`:

- `string`: `eq`, `neq`, `contains`, `in`, `not_in`, `exists`, `not_exists`
- `number`: `eq`, `neq`, `gt`, `gte`, `lt`, `lte`, `in`, `not_in`, `exists`, `not_exists`
- `boolean`: `eq`, `neq`, `exists`, `not_exists`
- `date`: `eq`, `neq`, `gt`, `gte`, `lt`, `lte`, `exists`, `not_exists`
- `objectId`: `eq`, `neq`, `in`, `not_in`, `exists`, `not_exists`
- `array`: `contains`, `in`, `not_in`, `exists`, `not_exists`
- `object`: `exists`, `not_exists`

---

## Preview Conditions

**POST /rules/preview-conditions**

Test conditions against a collection before saving a rule. Returns a matched count and a sample of up to 10 recipients. Useful for validating targeting logic without creating a rule.

### Request Body

```json
{
  "collectionName": "users",
  "joins": ["subscription"],
  "conditions": [
    { "field": "subscription.plan", "operator": "eq", "value": "pro" },
    { "field": "isVerified", "operator": "eq", "value": true }
  ]
}
```

### Response

```json
{
  "matchedCount": 342,
  "sample": [
    { "contactValue": "alice@example.com", "name": "Alice", "id": "64a1..." },
    ...
  ]
}
```

The endpoint validates join aliases and condition operators against the registered collection schema before executing the query. An error is returned if `collectionName` is not registered, joins are invalid, or any condition uses an operator incompatible with the field's type.

---

## Dry Run

**POST /rules/:id/dry-run**

Simulates a rule run without sending any messages. Returns how many recipients would be matched and the effective processing cap.

### Response

```json
{
  "ruleId": "64b2...",
  "matchedCount": 1250,
  "effectiveLimit": 500,
  "willProcess": 500,
  "sample": [
    { "contactValue": "bob@example.com", "name": "Bob", "id": "64b3..." },
    ...
  ]
}
```

`effectiveLimit` reflects `rule.maxPerRun` or the engine's `defaultMaxPerRun` fallback. `willProcess` is `min(matchedCount, effectiveLimit)`.

---

## Template-Rule Relationship

Rules do not define their own data source. They inherit the collection context entirely from their linked template:

- `template.collectionName` determines which collection `queryUsers` queries
- `template.joins` determines which join aliases are activated for that query
- `rule.target.conditions` are validated against the fields of `template.collectionName` at save time
- If the template has no `collectionName`, conditions are passed through to the adapter without schema validation

This means changing a template's `collectionName` or `joins` affects all rules linked to that template. Conditions on existing rules are re-validated on every update to either the rule or the template.

A rule cannot be activated if its linked template is inactive.
