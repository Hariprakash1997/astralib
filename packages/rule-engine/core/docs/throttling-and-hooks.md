# Throttling and Hooks

## Throttle Configuration

Global throttle settings are stored in the `throttle_config` collection and managed via the API. Defaults are applied automatically on first use.

**PUT /throttle** — update the global throttle configuration at runtime without restarting the engine.

### Fields

| Field | Type | Default | Description |
|---|---|---|---|
| `maxPerUserPerDay` | `number` | `1` | Maximum messages a single recipient can receive per calendar day |
| `maxPerUserPerWeek` | `number` | `2` | Maximum messages a single recipient can receive in the rolling 7-day window |
| `minGapDays` | `number` | `3` | Minimum days that must elapse between any two sends to the same recipient |
| `throttleWindow` | `string` | `"rolling"` | Window strategy; currently only `"rolling"` is supported |
| `sendWindow` | `object?` | `undefined` | Optional time-of-day window (see below) |

### Example

```json
{
  "maxPerUserPerDay": 2,
  "maxPerUserPerWeek": 5,
  "minGapDays": 1,
  "throttleWindow": "rolling"
}
```

The throttle check evaluates all three limits independently. A recipient is throttled if **any** of the three conditions is violated.

---

## Send Window

The send window restricts rule execution to specific hours of the day. If the current hour is outside the window, the entire run is skipped — no rules are processed.

### Configuration Fields

| Field | Type | Description |
|---|---|---|
| `startHour` | `number` (0–23) | First hour (inclusive) when sends are allowed |
| `endHour` | `number` (0–23) | First hour (exclusive) when sends are no longer allowed |
| `timezone` | `string` | IANA timezone name (e.g. `"America/New_York"`, `"Asia/Kolkata"`) |

### Overnight Wrapping

When `startHour` is greater than `endHour` the window wraps midnight. The engine evaluates this correctly:

- Normal window (e.g. `startHour: 9`, `endHour: 17`): `currentHour >= 9 && currentHour < 17`
- Overnight window (e.g. `startHour: 22`, `endHour: 6`): `currentHour >= 22 || currentHour < 6`

### Runtime Configuration

The send window can be set or cleared via **PUT /throttle** without restarting the engine. The database-stored value always takes priority over the code-level `config.options.sendWindow` fallback. To remove a previously set send window, send `sendWindow: null`.

```json
{
  "sendWindow": {
    "startHour": 8,
    "endHour": 20,
    "timezone": "Europe/London"
  }
}
```

To revert to code-level defaults:

```json
{
  "sendWindow": null
}
```

---

## Per-Rule Throttle Overrides

Individual rules can override the global throttle limits without changing the global configuration.

### `throttleOverride`

Set on the rule object. Any field present replaces the corresponding global setting for that rule only. Omitted fields fall back to the global value.

```json
{
  "throttleOverride": {
    "maxPerUserPerDay": 3,
    "maxPerUserPerWeek": 10,
    "minGapDays": 0
  }
}
```

### `bypassThrottle`

When `bypassThrottle: true`, all throttle checks are skipped for that rule. The `throttleOverride` values are also ignored. Useful for high-priority campaigns or reactivation flows.

### Transactional Rules Bypass Throttle

Rules with `ruleType: "transactional"` automatically bypass all throttle checks, equivalent to `bypassThrottle: true`. This is unconditional — it cannot be overridden. Use `transactional` for password resets, OTPs, receipts, and other messages that must always be delivered.

### Throttle Priority (highest to lowest)

1. `ruleType === "transactional"` — always bypasses
2. `bypassThrottle: true` — bypasses all limits
3. `throttleOverride` — per-rule limits replace globals
4. Global throttle config — `maxPerUserPerDay`, `maxPerUserPerWeek`, `minGapDays`

---

## Lifecycle Hooks

Hooks are optional callbacks registered in `RuleEngineConfig.hooks`. They fire synchronously during a run (except `beforeSend`, which is `async`). Throwing inside a hook does not abort the run — hook errors are not caught by the engine, so wrap your hook code in try/catch if it can fail.

### `onRunStart`

Fires once at the beginning of a run, after active rules are loaded and the send window is confirmed, but before any rule is processed.

**Parameters:**

```ts
{
  rulesCount: number;   // number of active rules that will be processed
  triggeredBy: string;  // "cron" or "manual"
  runId: string;        // unique ID for this run
}
```

**Use case:** Initialize metrics counters, log run start events.

```ts
hooks: {
  onRunStart: ({ rulesCount, triggeredBy, runId }) => {
    logger.info('Rule run started', { rulesCount, triggeredBy, runId });
    metrics.increment('rule_engine.run.started');
  }
}
```

### `onRuleStart`

Fires before the engine processes each individual rule, after the recipient list has been resolved.

**Parameters:**

```ts
{
  ruleId: string;
  ruleName: string;
  matchedCount: number;  // recipients matched before throttle/sendOnce filtering
  templateId: string;
  runId: string;
}
```

**Use case:** Per-rule logging, alerting when a rule matches an unexpectedly large or small audience.

```ts
hooks: {
  onRuleStart: ({ ruleName, matchedCount }) => {
    if (matchedCount > 10000) {
      alerts.warn(`Large audience for rule "${ruleName}": ${matchedCount}`);
    }
  }
}
```

### `onSend`

Fires after each individual send attempt, whether it succeeded, was throttled, skipped, or failed.

**Parameters:**

```ts
{
  ruleId: string;
  ruleName: string;
  contactValue: string;    // email, phone number, or user ID
  status: string;          // "sent" | "skipped" | "throttled" | "error" | "invalid"
  accountId: string;       // sender account ID used
  templateId: string;
  runId: string;
  subjectIndex?: number;   // which subject variant was used (absent when platform has no subjects)
  bodyIndex?: number;      // which body variant was used
  failureReason?: string;  // present when status is "throttled" or "error"
}
```

**Use case:** Real-time delivery tracking, writing to an analytics stream.

```ts
hooks: {
  onSend: ({ contactValue, status, ruleName, failureReason }) => {
    analytics.track('message_send', { contactValue, status, ruleName, failureReason });
  }
}
```

### `onRuleComplete`

Fires after all recipients for a rule have been processed. The `stats` object contains the final counts for that rule.

**Parameters:**

```ts
{
  ruleId: string;
  ruleName: string;
  stats: {
    matched: number;
    sent: number;
    skipped: number;
    throttled: number;
    failed: number;
  };
  templateId: string;
  runId: string;
}
```

**Use case:** Per-rule metrics publishing, updating a dashboard.

```ts
hooks: {
  onRuleComplete: ({ ruleName, stats }) => {
    metrics.gauge('rule_engine.rule.sent', stats.sent, { rule: ruleName });
    metrics.gauge('rule_engine.rule.throttled', stats.throttled, { rule: ruleName });
  }
}
```

### `onRunComplete`

Fires once after all rules have been processed and the run log has been saved.

**Parameters:**

```ts
{
  duration: number;           // total run duration in milliseconds
  totalStats: RuleRunStats;   // aggregated across all rules
  perRuleStats: PerRuleStats[]; // stats broken down per rule
  runId: string;
}
```

**Use case:** Send a summary notification, flush buffered metrics.

```ts
hooks: {
  onRunComplete: ({ duration, totalStats, runId }) => {
    logger.info('Run complete', { runId, duration, ...totalStats });
    slack.post(`Rule run finished: ${totalStats.sent} sent, ${totalStats.failed} failed in ${duration}ms`);
  }
}
```

### `beforeSend` (async)

The only async hook. Fires for each recipient immediately before the send adapter is called. It receives the rendered content and recipient context, and must return the (optionally modified) content. This is the correct place to inject dynamic content that cannot be computed at template-render time.

**Parameters (`BeforeSendParams`):**

```ts
{
  body: string;          // rendered HTML body
  textBody?: string;     // rendered plain-text body
  subject?: string;      // rendered subject line
  account: {
    id: string;
    contactValue: string;
    metadata: Record<string, unknown>;
  };
  user: {
    id: string;
    contactValue: string;
    name: string;
  };
  context: {
    ruleId: string;
    templateId: string;
    runId: string;
  };
}
```

**Return value (`BeforeSendResult`):** Return an object with `body`, and optionally `textBody` and `subject`. Any field omitted from the return value retains its original rendered value.

```ts
{
  body: string;
  textBody?: string;
  subject?: string;
}
```

**Use case:** Inject a personalised unsubscribe link, add tracking pixels, append legal disclaimers.

```ts
hooks: {
  beforeSend: async ({ body, subject, user, context }) => {
    const unsubLink = await generateUnsubscribeToken(user.id, context.ruleId);
    return {
      subject,
      body: body.replace('{{unsubscribeUrl}}', unsubLink),
    };
  }
}
```

`beforeSend` runs inside the per-recipient processing loop. Keep it fast — any latency here multiplies across all recipients in the run.

---

## Hook Examples

### Logging and Metrics

```ts
import { RuleEngineConfig } from '@astralibx/rule-engine';

const config: RuleEngineConfig = {
  // ...adapters, db, redis...
  hooks: {
    onRunStart: ({ rulesCount, runId }) => {
      console.log(`[${runId}] Starting run with ${rulesCount} rules`);
    },
    onRuleComplete: ({ ruleName, stats }) => {
      console.log(`Rule "${ruleName}": sent=${stats.sent} throttled=${stats.throttled} failed=${stats.failed}`);
    },
    onRunComplete: ({ duration, totalStats }) => {
      console.log(`Run complete in ${duration}ms — total sent: ${totalStats.sent}`);
    },
  }
};
```

### Content Modification with `beforeSend`

```ts
hooks: {
  beforeSend: async ({ body, textBody, subject, user, context }) => {
    // Append a personalised footer with tracking
    const footer = `<p style="font-size:11px">
      <a href="https://app.example.com/unsubscribe?uid=${user.id}&rid=${context.ruleId}">Unsubscribe</a>
    </p>`;
    return {
      subject,
      body: body + footer,
      textBody: textBody ? textBody + '\n\nUnsubscribe: https://app.example.com/unsubscribe' : undefined,
    };
  }
}
```
