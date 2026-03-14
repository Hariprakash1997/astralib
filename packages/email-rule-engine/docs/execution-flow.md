# Execution Flow — How the Runner Works

This document describes the step-by-step process when `engine.runner.runAllRules()` is called.

## Step-by-Step Flow

1. **Send window check** — If `options.sendWindow` is configured, check if the current hour (in the configured timezone) falls within `startHour` to `endHour`. If outside, log and return immediately.

2. **Acquire Redis lock** — Attempt to acquire a distributed lock. If another run is in progress, log a warning and return.

3. **Load throttle config** — Read the singleton throttle document from MongoDB (maxPerUserPerDay, maxPerUserPerWeek, minGapDays).

4. **Load active rules** — Query all rules where `isActive: true`, sorted by `sortOrder` ascending.

5. **Hook: onRunStart** — Fire with `{ rulesCount, triggeredBy }`.

6. **Early exit if no rules** — If no active rules, save an empty run log and return.

7. **Load recent sends** — Query the last 7 days of sends from `email_rule_sends` to build the throttle map.

8. **Build throttle map** — Create an in-memory `Map<userId, { today, thisWeek, lastSentDate }>` from recent sends.

9. **Execute each rule** (in sortOrder):
   - a. Load the linked template
   - b. Call `queryUsers` adapter with `rule.target` and `maxPerRun`
   - c. **Hook: onRuleStart** — Fire with `{ ruleId, ruleName, matchedCount }`
   - d. Batch-resolve identifiers via `findIdentifier` adapter
   - e. Compile template (MJML + Handlebars) once for the batch
   - f. For each matched user:
     - Check send history (sendOnce / resendAfterDays)
     - Look up identifier (skip if not found)
     - Check throttle limits (skip if exceeded)
     - Call `selectAgent` adapter (skip if null)
     - Call `resolveData` adapter
     - Render template with user data
     - Call `sendEmail` adapter
     - Log send to `email_rule_sends`
     - Update in-memory throttle map
     - **Hook: onSend** — Fire with `{ ruleId, ruleName, email, status: 'sent' }`
     - Apply delay + jitter (if configured, and not the last user)
     - On error: increment errors, **Hook: onSend** with `status: 'error'`
   - g. Update rule stats in MongoDB (lastRunAt, totalSent, totalSkipped)
   - h. **Hook: onRuleComplete** — Fire with `{ ruleId, ruleName, stats }`

10. **Aggregate stats** — Sum all per-rule stats into totalStats.

11. **Save run log** — Create a document in `email_rule_run_logs` with timing, stats, and per-rule breakdown.

12. **Hook: onRunComplete** — Fire with `{ duration, totalStats, perRuleStats }`.

13. **Release Redis lock** — Always runs in `finally` block, even on errors.

## Flowchart

```
                    runAllRules(triggeredBy)
                           │
                    ┌──────▼──────┐
                    │ Send window │
                    │   check?    │
                    └──────┬──────┘
                      pass │        fail → return
                    ┌──────▼──────┐
                    │ Acquire     │
                    │ Redis lock  │
                    └──────┬──────┘
                      got  │        busy → return
                    ┌──────▼──────┐
                    │ Load config │
                    │ Load rules  │
                    └──────┬──────┘
                           │
                    ★ onRunStart
                           │
                    ┌──────▼──────┐
                    │ Rules = 0?  │──yes──→ Save empty log → return
                    └──────┬──────┘
                      no   │
                    ┌──────▼──────┐
                    │ Build       │
                    │ throttle    │
                    │ map         │
                    └──────┬──────┘
                           │
               ┌───────────▼───────────┐
               │   For each rule       │◄─────────────────┐
               │                       │                   │
               │  Load template        │                   │
               │  queryUsers()         │                   │
               │  ★ onRuleStart        │                   │
               │                       │                   │
               │  ┌─────────────────┐  │                   │
               │  │ For each user   │  │                   │
               │  │                 │  │                   │
               │  │ Dedup check     │  │                   │
               │  │ Identifier      │  │                   │
               │  │ Throttle check  │  │                   │
               │  │ selectAgent()   │  │                   │
               │  │ resolveData()   │  │                   │
               │  │ Render template │  │                   │
               │  │ sendEmail()     │  │                   │
               │  │ Log send        │  │                   │
               │  │ ★ onSend        │  │                   │
               │  │ Delay + jitter  │  │                   │
               │  └─────────────────┘  │                   │
               │                       │                   │
               │  Update rule stats    │                   │
               │  ★ onRuleComplete     │                   │
               └───────────┬───────────┘                   │
                           │                               │
                    more rules? ──────yes──────────────────┘
                           │
                      no   │
                    ┌──────▼──────┐
                    │ Aggregate   │
                    │ Save run    │
                    │ log         │
                    └──────┬──────┘
                           │
                    ★ onRunComplete
                           │
                    ┌──────▼──────┐
                    │ Release     │
                    │ Redis lock  │
                    └─────────────┘
```

## Where Each Adapter Is Called

| Adapter | Called In | Frequency |
|---------|----------|-----------|
| `queryUsers` | `executeRule` | Once per rule |
| `findIdentifier` | `executeRule` | Once per unique email per rule |
| `selectAgent` | `executeRule` user loop | Once per user (after throttle check) |
| `resolveData` | `executeRule` user loop | Once per user (after agent selection) |
| `sendEmail` | `executeRule` user loop | Once per user (after rendering) |

## Lock Behavior

- Lock is acquired at the start, released in `finally`
- If the process crashes, the lock auto-expires after `lockTTLMs` (default 30 minutes)
- The send window check happens **before** lock acquisition to avoid unnecessary locking

## Error Handling

- Individual user errors are caught and counted in `stats.errors`
- The rule continues processing remaining users after a single user error
- Template or query failures cause the rule to return with `errors: 1` and move to the next rule
- Lock release always executes via `finally`, even if an error propagates
