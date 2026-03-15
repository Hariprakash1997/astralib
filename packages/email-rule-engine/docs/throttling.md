# Throttling

Throttling prevents email fatigue by limiting how many automated emails each user receives. The throttle config is a singleton MongoDB document managed via the settings API.

## Throttle Settings

| Setting | Default | Description |
|---------|---------|-------------|
| `maxPerUserPerDay` | `2` | Max emails to one user per calendar day |
| `maxPerUserPerWeek` | `5` | Max emails to one user in a rolling 7-day window |
| `minGapDays` | `1` | Minimum days between any two emails to the same user |

## What Bypasses Throttle

1. **Transactional emails** -- rules with `emailType: 'transactional'` (e.g., order confirmations, password resets)
2. **Bypass flag** -- rules with `bypassThrottle: true`

## Throttle vs. Per-Rule Frequency Controls

| Setting | Scope | Purpose |
|---------|-------|---------|
| `maxPerUserPerDay` / `maxPerUserPerWeek` | Global (all rules) | User-level daily/weekly caps |
| `minGapDays` | Global (all rules) | Minimum gap between any emails |
| `sendOnce` | Single rule | Send exactly once per user, ever |
| `resendAfterDays` | Single rule | Re-send after N days |
| `cooldownDays` | Single rule | Per-rule cooldown period |

A user can be throttled globally even if per-rule settings allow a send. Global limits act as a safety net.

## How Throttle Is Tracked

At the start of each run, the engine loads the last 7 days of sends from `email_rule_sends` and builds an in-memory map:

```
userId -> { today: count, thisWeek: count, lastSentDate: Date }
```

This map is updated in real-time during the run, so throttle limits are enforced accurately within a single execution.

## Managing Throttle Settings

Use the settings API endpoints:

```bash
# Get current throttle config
curl http://localhost:3000/api/email-rules/throttle

# Update throttle config
curl -X PUT http://localhost:3000/api/email-rules/throttle \
  -H "Content-Type: application/json" \
  -d '{ "maxPerUserPerDay": 3, "maxPerUserPerWeek": 10 }'
```

Validation: `maxPerUserPerWeek` must be >= `maxPerUserPerDay`. Both must be positive integers. `minGapDays` must be a non-negative integer.
