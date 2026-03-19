# Rules

> **Note:** The rule system (schema, CRUD, targeting, dry runs, validity dates, `sendOnce`, `maxPerRun`) is provided by `@astralibx/rule-engine` core. This package uses core's rule infrastructure with Telegram-specific adapters for message delivery and account selection.

Rules define **who** gets a message, **when**, and **how often**. Each rule links to a template and contains targeting conditions, frequency controls, and scheduling options.

## Rule Fields

| Field | Type | Default | Description |
|-------|------|---------|-------------|
| `name` | `string` | -- | Display name |
| `isActive` | `boolean` | `false` | Only active rules are executed |
| `target` | `RuleTarget` | -- | Targeting config (see below) |
| `templateId` | `string` | -- | Linked template ObjectId |
| `maxPerRun` | `number` | Config default (100) | Max users processed per execution |
| `sendOnce` | `boolean` | `false` | Send only once per user, ever |
| `validFrom` | `Date` | -- | Rule is inactive before this date |
| `validTill` | `Date` | -- | Rule is inactive after this date |
| `platform` | `string` | -- | Optional platform categorization (validated against `platforms` config if set) |
| `audience` | `string` | -- | Optional audience categorization (validated against `audiences` config if set) |

## Targeting (Discriminated Union)

The `target` field uses a discriminated union with the `mode` field:

```typescript
type RuleTarget = QueryTarget | ListTarget;
```

### Query Mode

Query mode uses your `queryUsers` adapter to find recipients by conditions. This is the standard approach for targeting users based on dynamic criteria.

```typescript
{
  target: {
    mode: 'query',
    conditions: {
      'subscription.status': 'expired',
      'profile.city': { $in: ['mumbai', 'pune'] },
      role: 'customer',
    },
  },
}
```

The `conditions` object is passed directly to your `queryUsers` adapter. Its structure is entirely up to your implementation -- the engine treats it as an opaque `Record<string, unknown>`.

### List Mode

List mode targets an explicit list of phone numbers or usernames. The engine skips `queryUsers` entirely and instead calls `findIdentifier` for each identifier in the list to resolve contact records.

```typescript
{
  target: {
    mode: 'list',
    identifiers: [
      '+919876543210',
      '+919876543211',
      '@telegram_username',
    ],
  },
}
```

List mode is useful for one-off campaigns, manual outreach, or when the recipient list is managed externally. The `sendOnce` deduplication check is applied per resolved identifier, same as in query mode.

## Validity Dates

Rules can optionally specify a time window during which they are active:

- `validFrom` (optional) -- the rule is skipped if the current date is before this value
- `validTill` (optional) -- the rule is skipped if the current date is after this value
- Rules with neither field set are always active
- The runner automatically checks validity dates before processing each rule; rules outside their window are silently skipped

```typescript
{
  name: 'New Year campaign',
  templateId: '665abc123...',
  validFrom: new Date('2026-12-31T18:00:00Z'),
  validTill: new Date('2027-01-01T23:59:59Z'),
  // ...other fields
}
```

## sendOnce Behavior

When `sendOnce` is `true`:

- The engine checks if a send log exists for each user + rule combination
- Users who have already received a message from this rule are skipped
- This is tracked per identifier, not per contact -- if a user has multiple identifiers, each is tracked independently

## maxPerRun

Limits the number of users processed per rule execution. Useful for:

- Gradual rollouts (send to 50 users per run, increasing over time)
- Rate limit compliance (keep within Telegram API limits per session)
- Resource management (prevent a single rule from monopolizing a run)

Default is `100` (configurable via `options.defaultMaxPerRun`).

## Schedule

The engine does not include a built-in scheduler. Trigger runs via:

- **Cron:** Call `engine.runner.trigger('cron')` from your cron job
- **Manual:** Use the `POST /runner/trigger` API endpoint
- **Programmatic:** Call the runner service directly from your application code

The `sendWindow` config option provides time-based gating -- runs triggered outside the window are skipped entirely.

## Dry Run

Test a rule's targeting without sending messages:

```
POST /rules/:id/dry-run
```

Returns `{ valid, templateExists, targetValid, matchedCount, effectiveLimit, errors }`.

## Example Rule (Query Mode)

```typescript
{
  name: 'Re-engage expired subscribers',
  templateId: '665abc123...',
  target: {
    mode: 'query',
    conditions: {
      'subscription.status': 'expired',
      'profile.city': { $in: ['mumbai', 'pune'] },
    },
  },
  sendOnce: false,
  maxPerRun: 50,
}
```

## Example Rule (List Mode)

```typescript
{
  name: 'VIP outreach',
  templateId: '665abc123...',
  target: {
    mode: 'list',
    identifiers: [
      '+919876543210',
      '+919876543211',
      '@vip_user',
    ],
  },
  sendOnce: true,
}
```
