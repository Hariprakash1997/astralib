# Throttling — Rate Limits & User Protection

Throttling prevents email fatigue by limiting how many automated emails a single user receives per day and per week. It protects your users from being overwhelmed and your sender reputation from degradation.

## What Throttling Does

The engine tracks every send per user. Before sending, it checks:

1. **Daily limit** — has this user received too many emails today?
2. **Weekly limit** — has this user received too many emails this week?
3. **Minimum gap** — has enough time passed since this user's last email?

If any check fails, the user is skipped for that rule execution (counted as `skippedByThrottle` in stats).

## Global Settings

The throttle config is a singleton document in MongoDB, managed via the API:

```json
{
  "maxPerUserPerDay": 2,
  "maxPerUserPerWeek": 5,
  "minGapDays": 1,
  "window": "rolling"
}
```

| Setting | Default | Description |
|---------|---------|-------------|
| `maxPerUserPerDay` | `2` | Max emails to a single user in one calendar day |
| `maxPerUserPerWeek` | `5` | Max emails to a single user in a rolling 7-day window |
| `minGapDays` | `1` | Minimum days between any two emails to the same user |

## What Bypasses Throttle

Two mechanisms skip throttle checks entirely:

1. **Transactional emails** — Rules with `emailType: 'transactional'` (order confirmations, password resets, etc.)
2. **Bypass flag** — Rules with `bypassThrottle: true`

```typescript
// This rule ignores throttle limits
{
  name: "Order Confirmation",
  emailType: "transactional",  // auto-bypasses throttle
  // ...
}

// Or explicitly:
{
  name: "Urgent Announcement",
  bypassThrottle: true,  // manual bypass
  // ...
}
```

## How to Configure via API

**Get current config**:

```bash
curl http://localhost:3000/api/email-rules/settings/throttle
```

```json
{
  "success": true,
  "data": {
    "config": {
      "maxPerUserPerDay": 2,
      "maxPerUserPerWeek": 5,
      "minGapDays": 1,
      "throttleWindow": "rolling"
    }
  }
}
```

**Update config**:

```bash
curl -X PATCH http://localhost:3000/api/email-rules/settings/throttle \
  -H "Content-Type: application/json" \
  -d '{
    "maxPerUserPerDay": 3,
    "maxPerUserPerWeek": 10,
    "minGapDays": 0
  }'
```

Validation rules:
- `maxPerUserPerDay` must be a positive integer
- `maxPerUserPerWeek` must be a positive integer and >= `maxPerUserPerDay`
- `minGapDays` must be a non-negative integer

## Relationship with Per-Rule Settings

Global throttle and per-rule settings serve different purposes:

| Setting | Scope | Purpose |
|---------|-------|---------|
| `maxPerUserPerDay` | All rules combined | User-level daily cap |
| `maxPerUserPerWeek` | All rules combined | User-level weekly cap |
| `minGapDays` | All rules combined | Minimum gap between any emails |
| Rule `cooldownDays` | Single rule | Minimum gap between sends of *this specific* rule |
| Rule `sendOnce` | Single rule | Send only once ever per user |
| Rule `resendAfterDays` | Single rule | Re-send after N days |

A user can be skipped by global throttle even if the per-rule settings allow a send. The global limits act as a safety net across all rules.

See [rules.md](rules.md) for per-rule frequency controls.

## How Throttle Is Tracked

The engine loads the last 7 days of sends from `email_rule_sends` at the start of each run. It builds an in-memory map:

```
userId → { today: count, thisWeek: count, lastSentDate: Date }
```

This map is updated in real-time as emails are sent during the run, so throttle limits are enforced accurately even within a single execution.
