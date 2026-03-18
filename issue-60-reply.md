Thanks for the detailed report. Answering each question:

### 1. How to debug after match

Pass a `logger` in your config (`config.logger`). The runner logs at every step — query, identifier resolution, dedup, throttle, send. If nothing logs after `onRuleStart`, the issue is in the step between matching and the per-email loop: either `findIdentifier` or the DB query for previous sends is hanging.

### 2. Internal logging

Yes. Set `config.logger` to any `LogAdapter` (e.g. `console` or pino). The runner uses `this.logger.info/warn/error` throughout execution.

### 3. Conditions where runner matches but does not send

- `findIdentifier` returns `null` for the email → skipped as `invalid`
- `sendOnce` dedup — user already received this rule
- Throttle limits hit (daily/weekly/minGap)
- `selectAgent` returns `null` — no sending account available
- `beforeSend` hook throws an error
- **`findIdentifier` or `selectAgent` hangs (never resolves)** — this silently blocks the entire run

### 4. What to check in adapters

**Most likely cause for your symptoms** (onRuleStart fires, then silence) is that `findIdentifier` is hanging — it never resolves or rejects. The runner calls `processInChunks(emails, findIdentifier, 50)` right after `onRuleStart`. If this promise never settles, no further hooks fire and no errors appear.

Add a timeout wrapper around your `findIdentifier` implementation, or add logging inside it to confirm it is being called and returning.

### 5. Run monitoring

`GET /runner/status/:runId` already exists and returns real-time progress (`rulesTotal`, `rulesCompleted`, `sent`, `failed`, `skipped`, `currentRule`, `elapsed`). The latest patch also adds a live progress bar in the Run History UI that polls this endpoint automatically after triggering a run.

---

**Start by adding `console.log` inside your `findIdentifier` adapter** to verify it is called and returns. This is almost certainly where execution is stalling.
