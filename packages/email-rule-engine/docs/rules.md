# Rules — Targeting & Automation Logic

Rules define **who** gets an email, **when**, and **how often**. Each rule links to a [template](templates.md) and contains targeting conditions, frequency controls, and throttle overrides.

## What Rules Are

A rule is an automation instruction: "Find users matching these conditions, and send them this template." Rules are processed in priority order during each runner execution.

## Rule Fields

| Field | Type | Default | Description |
|-------|------|---------|-------------|
| `name` | `string` | — | Display name (e.g., "Welcome new customers") |
| `description` | `string` | — | Internal notes |
| `isActive` | `boolean` | `true` | Only active rules are executed |
| `sortOrder` | `number` | `0` | Lower numbers run first |
| `target` | `RuleTarget` | — | Who to send to (see below) |
| `templateId` | `string` | — | Linked template ObjectId |
| `emailType` | `EmailType` | `automated` | `automated` or `transactional` |
| `maxPerRun` | `number` | Config default (500) | Max users processed per execution |
| `sendOnce` | `boolean` | `false` | Send only once per user, ever |
| `resendAfterDays` | `number` | — | Re-send after N days since last send |
| `cooldownDays` | `number` | — | Minimum days between sends of this rule to same user |
| `autoApprove` | `boolean` | `true` | `true` = send immediately, `false` = save as draft |
| `bypassThrottle` | `boolean` | `false` | Skip global [throttle](throttling.md) limits |
| `totalSent` | `number` | `0` | Lifetime send count (auto-tracked) |
| `totalSkipped` | `number` | `0` | Lifetime skip count (auto-tracked) |
| `lastRunAt` | `Date` | — | Last execution timestamp |
| `lastRunStats` | `RuleRunStats` | — | Stats from the most recent run |

## Target Object

The `target` field defines the audience:

```typescript
{
  role: 'customer' | 'provider' | 'all',
  platform: string,          // must match configured platforms
  conditions: RuleCondition[] // AND logic — all must match
}
```

## How Conditions Work

Conditions are filters passed to your `queryUsers` adapter. They use AND logic — a user must match **all** conditions.

```typescript
interface RuleCondition {
  field: string;      // dot-notation supported (e.g., "profile.city")
  operator: RuleOperator;
  value: unknown;
}
```

### All Operators

| Operator | Description | Example Value | Meaning |
|----------|-------------|---------------|---------|
| `eq` | Equals | `"active"` | `field === "active"` |
| `neq` | Not equals | `"blocked"` | `field !== "blocked"` |
| `gt` | Greater than | `30` | `field > 30` |
| `gte` | Greater than or equal | `18` | `field >= 18` |
| `lt` | Less than | `100` | `field < 100` |
| `lte` | Less than or equal | `5` | `field <= 5` |
| `exists` | Field exists | `true` | `field` is present |
| `not_exists` | Field missing | `true` | `field` is absent |
| `in` | In array | `["mumbai", "delhi"]` | `field` is one of these values |
| `not_in` | Not in array | `["test", "spam"]` | `field` is not any of these values |
| `contains` | Contains substring | `"gmail"` | `field` includes "gmail" (case-insensitive) |

### Example — targeting inactive premium users in Mumbai

```typescript
{
  target: {
    role: 'customer',
    platform: 'web',
    conditions: [
      { field: 'subscription.status', operator: 'eq', value: 'expired' },
      { field: 'profile.city', operator: 'in', value: ['mumbai', 'pune'] },
      { field: 'lastLoginAt', operator: 'lt', value: '2026-01-01T00:00:00Z' },
    ]
  }
}
```

## API Endpoints

| Method | Path | Description |
|--------|------|-------------|
| `GET` | `/rules` | List all rules (with populated template info) |
| `POST` | `/rules` | Create new rule |
| `GET` | `/rules/:id` | Get rule by ID |
| `PATCH` | `/rules/:id` | Update rule |
| `DELETE` | `/rules/:id` | Delete (or disable if has send history) |
| `PATCH` | `/rules/:id/toggle` | Toggle active/inactive |
| `POST` | `/rules/:id/dry-run` | Count matching users without sending |
| `GET` | `/rules/run-history` | Get execution history |

**Create example**:

```bash
curl -X POST http://localhost:3000/api/email-rules/rules \
  -H "Content-Type: application/json" \
  -d '{
    "name": "Welcome new customers",
    "templateId": "6654abc123...",
    "target": {
      "role": "customer",
      "platform": "web",
      "conditions": [
        { "field": "isNewUser", "operator": "eq", "value": true }
      ]
    },
    "sendOnce": true,
    "autoApprove": true,
    "sortOrder": 1,
    "maxPerRun": 200
  }'
```

## Dry Run

A dry run counts matching users without sending any emails. Useful for testing conditions before activating a rule.

```bash
curl -X POST http://localhost:3000/api/email-rules/rules/:id/dry-run
```

Response:

```json
{
  "success": true,
  "data": {
    "matchedUsers": 142,
    "ruleName": "Welcome new customers"
  }
}
```

## Frequency Controls

### sendOnce

When `true`, each user receives this rule's email exactly once. The engine checks `email_rule_sends` for prior sends.

### resendAfterDays

Re-send the email after N days since the last send. Useful for recurring reminders. Overrides `sendOnce` — if both are set, the user gets re-sent after the specified days.

### cooldownDays

Minimum gap between sends of this specific rule to the same user. Different from global throttling (see [throttling.md](throttling.md)), which limits across all rules.

### bypassThrottle

When `true`, this rule ignores global throttle limits. Also bypassed automatically for `emailType: 'transactional'`. See [throttling.md](throttling.md) for details.
