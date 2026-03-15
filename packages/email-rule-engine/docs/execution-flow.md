# Execution Flow

When `engine.runner.runAllRules()` is called, the following sequence executes:

```
runAllRules(triggeredBy)
  |
  +-- Send window check (skip if outside configured hours)
  +-- Acquire Redis lock (skip if another run in progress)
  +-- Load throttle config from MongoDB
  +-- Load active rules (sorted by sortOrder)
  +-- [hook] onRunStart
  +-- Build throttle map from last 7 days of sends
  |
  +-- For each rule:
  |     +-- Load linked template
  |     +-- queryUsers() adapter
  |     +-- [hook] onRuleStart
  |     +-- Batch findIdentifier() for all unique emails
  |     +-- Compile template once (MJML -> HTML, then Handlebars compile)
  |     +-- For each user:
  |     |     +-- Check send history (sendOnce / resendAfterDays)
  |     |     +-- Look up identifier (skip if null)
  |     |     +-- Check throttle limits (skip if exceeded)
  |     |     +-- selectAgent() adapter (skip if null)
  |     |     +-- resolveData() adapter
  |     |     +-- Render template with user data
  |     |     +-- sendEmail() adapter
  |     |     +-- Log send to email_rule_sends
  |     |     +-- Update in-memory throttle map
  |     |     +-- [hook] onSend
  |     |     +-- Apply delay + jitter (if not last user)
  |     +-- Update rule stats in MongoDB
  |     +-- [hook] onRuleComplete
  |
  +-- Aggregate per-rule stats into totalStats
  +-- Save run log to email_rule_run_logs
  +-- [hook] onRunComplete
  +-- Release Redis lock (always, via finally)
```

## Error Behavior

- **Individual user errors** are caught and counted in `stats.errorCount` -- the rule continues with remaining users.
- **Template-not-found or query failures** cause the rule to return with `errorCount: 1` and move to the next rule.
- **Lock release** always executes via `finally`, even on unexpected errors.
- **Process crash** -- the Redis lock auto-expires after `lockTTLMs`.
