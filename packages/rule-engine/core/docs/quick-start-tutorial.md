# Quick Start Tutorial

End-to-end guide: from zero to your first campaign run in 11 steps.

**Prerequisites:**
- Node.js app with `@astralibx/rule-engine` installed and wired up
- Express routes mounted at `/api/rules` via `createRoutes(deps)`
- MongoDB and Redis running
- Your adapter implementations registered (`queryUsers`, `resolveData`, `sendMessage`, etc.)

See the [adapters guide](https://github.com/Hariprakash1997/astralib/blob/main/packages/rule-engine/core/docs/adapters.md) for wiring all adapters before running any rules.

---

## Step 1: Create a Template

Templates define the message content. Bodies use Handlebars for variable interpolation. `subjects` and `bodies` are arrays -- one variant is randomly selected per send, enabling lightweight A/B testing.

```bash
curl -X POST http://localhost:3000/api/rules/templates \
  -H "Content-Type: application/json" \
  -d '{
    "name": "Re-engagement Nudge",
    "slug": "re-engagement-nudge",
    "category": "re-engagement",
    "audience": "customer",
    "platform": "web",
    "subjects": [
      "Hey {{firstName}}, we miss you!",
      "{{firstName}}, come back and see what'\''s new"
    ],
    "bodies": [
      "<p>Hi {{firstName}},</p><p>It'\''s been a while since you last logged in to {{appName}}. Check out what'\''s new: <a href=\"{{loginUrl}}\">Log in now</a></p>",
      "<p>{{firstName}} — your {{appName}} account is waiting. <a href=\"{{loginUrl}}\">Resume where you left off</a>.</p>"
    ],
    "preheaders": ["Your account is waiting for you"],
    "fields": {
      "appName": "MyApp",
      "loginUrl": "https://myapp.com/login"
    },
    "variables": ["firstName", "appName", "loginUrl"],
    "collectionName": "users",
    "joins": ["profiles"]
  }'
```

**Response:**
```json
{
  "success": true,
  "data": {
    "template": {
      "_id": "665abc123def456789000001",
      "name": "Re-engagement Nudge",
      "slug": "re-engagement-nudge",
      "category": "re-engagement",
      "audience": "customer",
      "platform": "web",
      "variables": ["firstName", "appName", "loginUrl"],
      "collectionName": "users",
      "joins": ["profiles"],
      "isActive": true,
      "version": 1,
      "createdAt": "2026-03-19T08:00:00.000Z"
    }
  }
}
```

Save the `_id` -- this is your `templateId` for all rule operations.

**Key points:**
- `category` must be one of: `onboarding`, `engagement`, `transactional`, `re-engagement`, `announcement`
- `audience` must be one of: `customer`, `provider`, `all`
- `fields` supply default variable values when your adapter does not provide them
- `collectionName` tells the engine which collection to query for recipient data
- `joins` names additional collections whose fields are merged into each recipient's data
- Templates are `isActive: true` by default; deactivated templates cannot be used by rules

---

## Step 2: Preview the Template

Verify rendering with sample data before wiring anything to a rule. The engine picks one subject and one body variant randomly.

```bash
curl -X POST http://localhost:3000/api/rules/templates/665abc123def456789000001/preview \
  -H "Content-Type: application/json" \
  -d '{
    "sampleData": {
      "firstName": "Sarah"
    }
  }'
```

**Response:**
```json
{
  "success": true,
  "data": {
    "subject": "Hey Sarah, we miss you!",
    "body": "<p>Hi Sarah,</p><p>It's been a while since you last logged in to MyApp. Check out what's new: <a href=\"https://myapp.com/login\">Log in now</a></p>",
    "textBody": "Hi Sarah, It's been a while since you last logged in to MyApp..."
  }
}
```

`appName` and `loginUrl` were filled from `fields` defaults. `firstName` came from `sampleData`. Any variable missing from both sources renders as an empty string.

---

## Step 3: Configure Throttle Limits

Set global per-recipient rate limits. **Configure this before triggering any run** -- the defaults (1 email/day, 3 emails/week, 1-day gap) may silently skip more recipients than you expect.

```bash
curl -X PUT http://localhost:3000/api/rules/throttle \
  -H "Content-Type: application/json" \
  -d '{
    "maxPerUserPerDay": 2,
    "maxPerUserPerWeek": 5,
    "minGapDays": 2,
    "sendWindow": {
      "startHour": 9,
      "endHour": 18,
      "timezone": "America/New_York"
    }
  }'
```

**Response:**
```json
{
  "success": true,
  "data": {
    "config": {
      "_id": "665cfg000000000000000001",
      "maxPerUserPerDay": 2,
      "maxPerUserPerWeek": 5,
      "minGapDays": 2,
      "sendWindow": {
        "startHour": 9,
        "endHour": 18,
        "timezone": "America/New_York"
      }
    }
  }
}
```

**What each field controls:**
- `maxPerUserPerDay` -- Maximum messages per recipient per calendar day, across ALL active rules
- `maxPerUserPerWeek` -- Maximum messages per recipient in any rolling 7-day window; must be >= `maxPerUserPerDay`
- `minGapDays` -- Minimum days that must elapse between any two messages to the same recipient
- `sendWindow` -- Optional delivery window; sends outside `startHour`-`endHour` in the given timezone are deferred

> **Important:** Throttle is global, not per-rule. A message sent by Rule A today counts against Rule B's limit for the same recipient.

---

## Step 4: Create a Rule (Query Mode)

Query-mode rules resolve recipients dynamically at run time by calling your `queryUsers` adapter with the conditions you define.

```bash
curl -X POST http://localhost:3000/api/rules/rules \
  -H "Content-Type: application/json" \
  -d '{
    "name": "Re-engage Inactive Users (March)",
    "platform": "web",
    "templateId": "665abc123def456789000001",
    "target": {
      "mode": "query",
      "role": "customer",
      "platform": "web",
      "conditions": [
        { "field": "lastLoginAt", "operator": "lte", "value": "2026-02-17" },
        { "field": "isActive", "operator": "eq", "value": true }
      ]
    },
    "sendOnce": true,
    "autoApprove": true,
    "ruleType": "automated",
    "maxPerRun": 500
  }'
```

**Response:**
```json
{
  "success": true,
  "data": {
    "rule": {
      "_id": "665def789abc123456000001",
      "name": "Re-engage Inactive Users (March)",
      "platform": "web",
      "templateId": "665abc123def456789000001",
      "target": {
        "mode": "query",
        "role": "customer",
        "platform": "web",
        "conditions": [
          { "field": "lastLoginAt", "operator": "lte", "value": "2026-02-17" },
          { "field": "isActive", "operator": "eq", "value": true }
        ]
      },
      "sendOnce": true,
      "autoApprove": true,
      "ruleType": "automated",
      "maxPerRun": 500,
      "isActive": false,
      "totalSent": 0,
      "sortOrder": 10
    }
  }
}
```

> **Note:** Rules are created with `isActive: false`. You must call `PATCH /api/rules/rules/:id` or the toggle endpoint to activate a rule before the runner will process it.

**Available condition operators:** `eq`, `neq`, `gt`, `gte`, `lt`, `lte`, `exists`, `not_exists`, `in`, `not_in`, `contains`

---

## Step 5: Create a Rule (List Mode)

List-mode rules target a fixed set of recipient identifiers directly -- no adapter query is needed.

```bash
curl -X POST http://localhost:3000/api/rules/rules \
  -H "Content-Type: application/json" \
  -d '{
    "name": "VIP Re-engagement Blast",
    "platform": "web",
    "templateId": "665abc123def456789000001",
    "target": {
      "mode": "list",
      "identifiers": [
        "user_1001",
        "user_1042",
        "user_2087"
      ]
    },
    "sendOnce": true,
    "autoApprove": true,
    "ruleType": "automated"
  }'
```

**Response:**
```json
{
  "success": true,
  "data": {
    "rule": {
      "_id": "665def789abc123456000099",
      "name": "VIP Re-engagement Blast",
      "platform": "web",
      "target": {
        "mode": "list",
        "identifiers": ["user_1001", "user_1042", "user_2087"]
      },
      "isActive": false,
      "totalSent": 0
    }
  }
}
```

**Key fields:**
- `sendOnce: true` -- Each recipient receives this message at most once, forever
- `ruleType: "automated"` respects global throttle limits; `"transactional"` bypasses them
- `maxPerRun` -- Hard cap on recipients processed per execution (default: no cap). Useful for gradual rollouts

---

## Step 6: Preview Conditions

Before saving or activating a rule, verify how many users match your conditions without persisting anything.

```bash
curl -X POST http://localhost:3000/api/rules/rules/preview-conditions \
  -H "Content-Type: application/json" \
  -d '{
    "target": {
      "mode": "query",
      "role": "customer",
      "platform": "web",
      "conditions": [
        { "field": "lastLoginAt", "operator": "lte", "value": "2026-02-17" },
        { "field": "isActive", "operator": "eq", "value": true }
      ]
    }
  }'
```

**Response:**
```json
{
  "success": true,
  "data": {
    "matchedCount": 312,
    "sample": [
      { "userId": "user_1001", "email": "alice@example.com" },
      { "userId": "user_1042", "email": "bob@example.com" }
    ]
  }
}
```

Use this to calibrate conditions before committing. A `matchedCount` of 0 means either no users match the conditions or your `queryUsers` adapter is not returning results for that role/platform combination.

---

## Step 7: Dry Run

Simulate execution for an existing rule: resolves recipients and validates the template but sends nothing.

First, activate the rule (required for the runner to process it):

```bash
curl -X POST http://localhost:3000/api/rules/rules/665def789abc123456000001/toggle
```

Then dry-run it:

```bash
curl -X POST http://localhost:3000/api/rules/rules/665def789abc123456000001/dry-run
```

**Response:**
```json
{
  "success": true,
  "data": {
    "valid": true,
    "templateExists": true,
    "matchedCount": 312,
    "wouldSend": 298,
    "wouldSkip": 14,
    "skipReasons": {
      "throttled": 9,
      "alreadySent": 5
    },
    "errors": []
  }
}
```

`wouldSkip` breaks down into `throttled` (hit global limits) and `alreadySent` (rule has `sendOnce: true` and already sent to that user). Fix any `errors` before triggering a real run.

---

## Step 8: Trigger a Run

Execute all active rules. The runner is non-blocking -- it starts a background job and returns a `runId` immediately.

```bash
curl -X POST http://localhost:3000/api/rules/runner
```

**Response:**
```json
{
  "success": true,
  "data": {
    "message": "Rule run triggered",
    "runId": "run_a1b2c3d4e5f6"
  }
}
```

Save the `runId` to monitor progress in the next step.

> **Note:** If a run is already in progress, the engine will not start a second concurrent run. The endpoint still returns `200` but the runner will queue or reject the duplicate trigger depending on your configuration.

---

## Step 9: Monitor Progress

Poll the status endpoint to watch the run in real time.

```bash
curl http://localhost:3000/api/rules/runner/status/run_a1b2c3d4e5f6
```

**While running:**
```json
{
  "success": true,
  "data": {
    "runId": "run_a1b2c3d4e5f6",
    "status": "running",
    "triggeredBy": "manual",
    "rulesProcessed": 1,
    "progress": {
      "matched": 312,
      "sent": 140,
      "skipped": 6,
      "throttled": 4,
      "failed": 0
    }
  }
}
```

**After completion:**
```json
{
  "success": true,
  "data": {
    "runId": "run_a1b2c3d4e5f6",
    "status": "completed",
    "triggeredBy": "manual",
    "rulesProcessed": 2,
    "duration": 4821,
    "totalStats": {
      "matched": 312,
      "sent": 298,
      "skipped": 14,
      "throttled": 9,
      "failed": 0
    },
    "perRuleStats": [
      {
        "ruleId": "665def789abc123456000001",
        "ruleName": "Re-engage Inactive Users (March)",
        "matched": 312,
        "sent": 298,
        "skipped": 14,
        "throttled": 9,
        "failed": 0
      }
    ]
  }
}
```

`duration` is in milliseconds. To cancel an in-progress run:

```bash
curl -X POST http://localhost:3000/api/rules/runner/cancel/run_a1b2c3d4e5f6
```

---

## Step 10: View Run History

List all completed run logs, paginated, sorted newest first.

```bash
curl "http://localhost:3000/api/rules/runner/logs?page=1&limit=10"
```

**Response:**
```json
{
  "success": true,
  "data": {
    "logs": [
      {
        "_id": "665log000000000000000001",
        "runId": "run_a1b2c3d4e5f6",
        "status": "completed",
        "triggeredBy": "manual",
        "rulesProcessed": 2,
        "duration": 4821,
        "runAt": "2026-03-19T09:15:00.000Z",
        "totalStats": {
          "matched": 312,
          "sent": 298,
          "skipped": 14,
          "throttled": 9,
          "failed": 0
        }
      }
    ],
    "total": 1
  }
}
```

Run logs are automatically expired after 90 days.

---

## Step 11: View Send Logs

Inspect per-recipient delivery records. Filter by rule, user, status, or date range.

```bash
curl "http://localhost:3000/api/rules/sends?ruleId=665def789abc123456000001&status=sent&limit=20"
```

**Response:**
```json
{
  "success": true,
  "data": {
    "sends": [
      {
        "_id": "665snd000000000000000001",
        "ruleId": "665def789abc123456000001",
        "userId": "user_1001",
        "identifierId": "alice@example.com",
        "subject": "Hey Sarah, we miss you!",
        "status": "sent",
        "accountId": "acc_smtp_01",
        "senderName": "MyApp Team",
        "sentAt": "2026-03-19T09:15:03.000Z"
      },
      {
        "_id": "665snd000000000000000002",
        "ruleId": "665def789abc123456000001",
        "userId": "user_1042",
        "identifierId": "bob@example.com",
        "subject": "Sarah, come back and see what's new",
        "status": "throttled",
        "sentAt": "2026-03-19T09:15:04.000Z"
      }
    ],
    "total": 298
  }
}
```

**Available `status` filter values:** `sent`, `error`, `skipped`, `invalid`, `throttled`

**Additional query parameters:**
- `userId` -- Filter to a specific user (partial match, case-insensitive)
- `from` / `to` -- ISO date strings to filter by `sentAt` range (e.g. `from=2026-03-19&to=2026-03-19`)
- `page` / `limit` -- Pagination (max `limit` is 200, default 50)

---

## What's Next?

- [Adapters Guide](https://github.com/Hariprakash1997/astralib/blob/main/packages/rule-engine/core/docs/adapters.md) -- Implement `queryUsers`, `resolveData`, `sendMessage`, `selectAgent`, and `findIdentifier` for your platform
- [Collections and Joins](https://github.com/Hariprakash1997/astralib/blob/main/packages/rule-engine/core/docs/collections-and-joins.md) -- Register collection schemas so the UI and conditions builder know what fields are available
- [Templates and Rules Reference](https://github.com/Hariprakash1997/astralib/blob/main/packages/rule-engine/core/docs/templates-and-rules.md) -- Full field reference for templates, rules, conditions, throttle overrides, schedules, and `sendOnce` semantics
