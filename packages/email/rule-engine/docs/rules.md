# Rules

Rules define **who** gets an email, **when**, and **how often**. Each rule links to a template and contains targeting conditions, frequency controls, and throttle overrides. Rules are processed in `sortOrder` during each runner execution.

## Rule Fields

| Field | Type | Default | Description |
|-------|------|---------|-------------|
| `name` | `string` | -- | Display name |
| `description` | `string` | -- | Internal notes |
| `isActive` | `boolean` | `true` | Only active rules are executed |
| `sortOrder` | `number` | `0` | Execution priority (lower = first) |
| `target` | `RuleTarget` | -- | Targeting config (see below) |
| `templateId` | `string` | -- | Linked template ObjectId |
| `emailType` | `EmailType` | `'automated'` | `'automated'` or `'transactional'` |
| `maxPerRun` | `number` | Config default (500) | Max users processed per execution |
| `sendOnce` | `boolean` | `false` | Send only once per user, ever |
| `resendAfterDays` | `number` | -- | Re-send after N days since last send |
| `cooldownDays` | `number` | -- | Minimum days between sends of this rule |
| `autoApprove` | `boolean` | `true` | `true` = send immediately, `false` = save as draft |
| `bypassThrottle` | `boolean` | `false` | Skip global throttle limits |
| `totalSent` | `number` | `0` | Lifetime send count (auto-tracked) |
| `totalSkipped` | `number` | `0` | Lifetime skip count (auto-tracked) |
| `lastRunAt` | `Date` | -- | Last execution timestamp (auto-tracked) |
| `validFrom` | `Date` | -- | Rule is inactive before this date |
| `validTill` | `Date` | -- | Rule is inactive after this date |
| `lastRunStats` | `RuleRunStats` | -- | Stats from the most recent run (auto-tracked) |

## Validity Dates

Rules can optionally specify a time window during which they are active:

- `validFrom` (optional) -- the rule is skipped if the current date is before this value
- `validTill` (optional) -- the rule is skipped if the current date is after this value
- Rules with neither field set are always active
- The runner automatically checks validity dates before processing each rule; rules outside their window are silently skipped

```typescript
{
  name: "Black Friday campaign",
  templateId: "665abc123...",
  validFrom: new Date("2026-11-28T00:00:00Z"),
  validTill: new Date("2026-12-01T23:59:59Z"),
  // ...other fields
}
```

## Targeting

The `target` object defines the audience:

```typescript
{
  role: 'customer' | 'provider' | 'all',  // audience
  platform: string,                        // must match configured platforms
  conditions: RuleCondition[]              // AND logic -- all must match
}
```

## Target Mode

The `target.mode` field controls how recipients are resolved. It is required and must be either `'query'` or `'list'`.

### Query Mode

Query mode uses `queryUsers` to find recipients by conditions. This is the standard approach for targeting users based on dynamic criteria.

```typescript
{
  target: {
    mode: 'query',
    role: 'customer',
    platform: 'web',
    collection: 'users',  // optional — enables field dropdowns and validation in the UI
    conditions: [
      { field: 'subscription.status', operator: 'eq', value: 'expired' },
    ],
  },
}
```

The optional `collection` field links the rule to a registered collection schema. When set, the admin UI shows field dropdowns instead of free-text inputs and validates conditions against the schema on save. See [collections.md](collections.md).

### List Mode

List mode targets an explicit list of email addresses. The engine skips `queryUsers` entirely and instead calls `findIdentifier` for each email in the list to resolve contact/identifier records. The `sendOnce` deduplication check is applied per resolved identifier, same as in query mode.

```typescript
{
  target: {
    mode: 'list',
    emails: [
      'alice@example.com',
      'bob@example.com',
      'carol@example.com',
    ],
  },
}
```

List mode is useful for one-off campaigns, manual outreach, or when the recipient list is managed externally. The `role`, `platform`, and `conditions` fields are ignored in list mode.

**Auto-disable:** When a list-mode rule has `sendOnce: true` and all identifiers have been processed (none pending, none throttled), the rule is automatically set to `isActive: false`. Throttled identifiers count as pending -- the rule stays active until they can be retried. This prevents stale one-off rules from accumulating.

## Condition Operators

Conditions are filters passed to your `queryUsers` adapter. They use AND logic -- a user must match **all** conditions.

```typescript
interface RuleCondition {
  field: string;       // dot-notation supported (e.g., "profile.city")
  operator: RuleOperator;
  value: unknown;
}
```

| Operator | Description | Example Value |
|----------|-------------|---------------|
| `eq` | Equals | `"active"` |
| `neq` | Not equals | `"blocked"` |
| `gt` | Greater than | `30` |
| `gte` | Greater than or equal | `18` |
| `lt` | Less than | `100` |
| `lte` | Less than or equal | `5` |
| `exists` | Field exists | `true` |
| `not_exists` | Field missing | `true` |
| `in` | In array | `["mumbai", "delhi"]` |
| `not_in` | Not in array | `["test", "spam"]` |
| `contains` | Substring (case-insensitive) | `"gmail"` |

## Example Rule

```typescript
{
  name: "Re-engage expired subscribers",
  templateId: "665abc123...",
  target: {
    role: "customer",
    platform: "web",
    conditions: [
      { field: "subscription.status", operator: "eq", value: "expired" },
      { field: "profile.city", operator: "in", value: ["mumbai", "pune"] },
      { field: "lastLoginAt", operator: "lt", value: "2026-01-01T00:00:00Z" },
    ],
  },
  sendOnce: false,
  resendAfterDays: 30,
  maxPerRun: 200,
  autoApprove: true,
  emailType: "automated",
}
```

## Dry Run

Test a rule's targeting without sending emails:

```
POST /rules/:id/dry-run
```

Returns `{ matchedUsers: 142, ruleName: "Re-engage expired subscribers" }`.

## Rule-Template Compatibility

When creating or updating a rule, the engine validates that the rule's target audience and platform are compatible with the linked template. Mismatches throw a `RuleTemplateIncompatibleError`.
