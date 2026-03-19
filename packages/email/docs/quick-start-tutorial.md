# Quick Start Tutorial

> **Note:** This tutorial uses `@astralibx/email-rule-engine`, a thin wrapper over `@astralibx/rule-engine`. For core concepts (templates, rules, conditions, joins), see the [core documentation](https://github.com/Hariprakash1997/astralib/blob/main/packages/rule-engine/core/README.md).

End-to-end guide: from zero to your first email campaign in 11 steps.

**Prerequisites:**
- Node.js app with `@astralibx/email-account-manager`, `@astralibx/email-rule-engine`, `@astralibx/email-analytics` installed and mounted
- MongoDB and Redis running
- A Gmail account with an App Password (or AWS SES credentials)

See the [umbrella README](../README.md) for wiring all three packages together.

---

## Step 1: Create a Sender Account

Register your SMTP credentials. For Gmail, use an [App Password](https://myaccount.google.com/apppasswords), not your login password.

```bash
curl -X POST http://localhost:3000/api/email/accounts \
  -H "Content-Type: application/json" \
  -d '{
    "email": "sales@yourdomain.com",
    "senderName": "Sales Team",
    "provider": "gmail",
    "smtp": {
      "host": "smtp.gmail.com",
      "port": 465,
      "user": "sales@yourdomain.com",
      "pass": "xxxx-xxxx-xxxx-xxxx"
    }
  }'
```

**Response:**
```json
{
  "success": true,
  "data": {
    "account": {
      "_id": "507f1f77bcf86cd799439011",
      "email": "sales@yourdomain.com",
      "status": "active",
      "health": { "score": 100 }
    }
  }
}
```

Save the `_id` -- this is your `accountId` for all future operations.

> **Note:** Passwords are never returned in GET responses. Store them securely before calling this endpoint.

---

## Step 2: Test the Connection

Verify SMTP works before sending real emails.

```bash
curl -X POST http://localhost:3000/api/email/accounts/507f1f77bcf86cd799439011/test
```

```json
{ "success": true, "message": "SMTP connection successful" }
```

If this fails, double-check your credentials and that "Less secure app access" or App Passwords are configured.

---

## Step 3: Create an Email Template

Templates use MJML for responsive HTML and Handlebars for variables.

```bash
curl -X POST http://localhost:3000/api/email/rules/templates \
  -H "Content-Type: application/json" \
  -d '{
    "name": "Welcome Email",
    "slug": "welcome-email",
    "category": "onboarding",
    "audience": "customer",
    "platform": "web",
    "subjects": [
      "Welcome to {{company}}, {{firstName}}!",
      "Hi {{firstName}} -- glad to have you"
    ],
    "bodies": [
      "<mj-section><mj-column><mj-text>Hi {{firstName}}, welcome to {{company}}!</mj-text><mj-button href=\"{{loginUrl}}\">Get Started</mj-button></mj-column></mj-section>"
    ],
    "preheaders": ["Your account is ready"],
    "fields": {
      "company": "MyApp",
      "loginUrl": "https://myapp.com/login"
    }
  }'
```

**Response:**
```json
{
  "success": true,
  "data": {
    "template": {
      "_id": "665abc123def456789000001",
      "name": "Welcome Email",
      "slug": "welcome-email",
      "variables": ["company", "firstName", "loginUrl"],
      "isActive": true,
      "version": 1
    }
  }
}
```

**Key points:**
- `subjects` and `bodies` are arrays -- one variant is randomly picked per send (A/B testing)
- `variables` are auto-extracted from `{{placeholders}}` in subjects, bodies, and preheaders
- `fields` provide default values when your adapter doesn't supply them
- Templates must be `isActive: true` to be used by rules

---

## Step 4: Preview the Template

Test rendering with sample data before sending.

```bash
curl -X POST http://localhost:3000/api/email/rules/templates/665abc123def456789000001/preview \
  -H "Content-Type: application/json" \
  -d '{ "sampleData": { "firstName": "John" } }'
```

```json
{
  "success": true,
  "data": {
    "subject": "Welcome to MyApp, John!",
    "html": "<html><body>Hi John, welcome to MyApp!...</body></html>"
  }
}
```

The `company` and `loginUrl` values come from `fields` defaults. `firstName` came from your `sampleData`.

---

## Step 5: Configure Throttle Limits

Set global per-recipient rate limits. **Do this before running any rules** -- defaults (1/day, 2/week) may be too restrictive.

```bash
curl -X PUT http://localhost:3000/api/email/rules/throttle \
  -H "Content-Type: application/json" \
  -d '{
    "maxPerUserPerDay": 3,
    "maxPerUserPerWeek": 10,
    "minGapDays": 1
  }'
```

```json
{ "success": true }
```

**What each setting means:**
- `maxPerUserPerDay: 3` -- Each person receives max 3 emails per day, across ALL rules
- `maxPerUserPerWeek: 10` -- Max 10 per week per person
- `minGapDays: 1` -- Wait at least 1 day between emails to the same person

> **Important:** Throttle is global, not per-rule. If Rule A sends to john@example.com today, it counts against Rule B's limit too.

---

## Step 6: Create a Rule

Rules connect templates to recipients. Two targeting modes:

### Option A: List Mode (send to specific emails)

```bash
curl -X POST http://localhost:3000/api/email/rules/rules \
  -H "Content-Type: application/json" \
  -d '{
    "name": "Welcome Campaign - March",
    "templateId": "665abc123def456789000001",
    "target": {
      "mode": "list",
      "identifiers": ["john@example.com", "jane@example.com"]
    },
    "emailType": "automated",
    "sendOnce": true,
    "autoApprove": true,
    "maxPerRun": 100
  }'
```

### Option B: Query Mode (send to users matching conditions)

```bash
curl -X POST http://localhost:3000/api/email/rules/rules \
  -H "Content-Type: application/json" \
  -d '{
    "name": "Welcome New Users",
    "templateId": "665abc123def456789000001",
    "target": {
      "mode": "query",
      "role": "customer",
      "platform": "web",
      "conditions": [
        { "field": "createdAt", "operator": "gte", "value": "2026-03-01" }
      ]
    },
    "emailType": "automated",
    "sendOnce": true,
    "autoApprove": true
  }'
```

**Response:**
```json
{
  "success": true,
  "data": {
    "rule": {
      "_id": "665def789abc123456000001",
      "name": "Welcome Campaign - March",
      "isActive": true,
      "totalSent": 0
    }
  }
}
```

**Key fields:**
- `sendOnce: true` -- Each person gets this email only once, ever
- `autoApprove: true` -- Send immediately (no manual approval step)
- `emailType` -- `"automated"` respects throttle limits, `"transactional"` bypasses them
- `maxPerRun` -- Cap on how many recipients per execution (default: 500)

> **Query mode note:** Your `queryUsers` adapter is responsible for translating `conditions` into database queries. See the [core adapters doc](https://github.com/Hariprakash1997/astralib/blob/main/packages/rule-engine/core/docs/adapters.md).

---

## Step 7: Dry-Run (Verify Before Sending)

Check how many users match without actually sending anything.

```bash
curl -X POST http://localhost:3000/api/email/rules/rules/665def789abc123456000001/dry-run
```

```json
{
  "success": true,
  "data": {
    "valid": true,
    "templateExists": true,
    "matchedCount": 47,
    "errors": []
  }
}
```

If `matchedCount` is 0, check your conditions or identifiers list.

---

## Step 8: Run the Campaign

Trigger all active rules to execute. This is non-blocking -- the run happens in the background.

```bash
curl -X POST http://localhost:3000/api/email/rules/runner \
  -H "Content-Type: application/json" \
  -d '{ "triggeredBy": "manual" }'
```

```json
{
  "success": true,
  "data": { "message": "Rule run triggered", "runId": "run_a1b2c3d4" }
}
```

Save the `runId` to monitor progress.

---

## Step 9: Monitor Progress

```bash
curl http://localhost:3000/api/email/rules/runner/status/run_a1b2c3d4
```

**While running:**
```json
{
  "status": "running",
  "progress": { "matched": 47, "sent": 23, "skipped": 0, "errors": 0 }
}
```

**After completion:**
```json
{
  "status": "completed",
  "progress": { "matched": 47, "sent": 45, "skipped": 2, "errors": 0 }
}
```

`skipped` means the user was throttled or already received this email (if `sendOnce` is on).

---

## Step 10: View Send Logs

Check what happened to each recipient.

```bash
curl "http://localhost:3000/api/email/rules/runs?limit=10"
```

```json
{
  "success": true,
  "data": {
    "runs": [{
      "_id": "...",
      "ruleId": "665def789abc123456000001",
      "status": "completed",
      "stats": { "matched": 47, "sent": 45, "skipped": 2, "errors": 0 },
      "createdAt": "2026-03-18T11:00:00.000Z"
    }]
  }
}
```

---

## Step 11: Check Analytics

View delivery, open, and click metrics. **Analytics require aggregation first.**

```bash
# Aggregate events into queryable stats (run this on a schedule in production)
curl -X POST http://localhost:3000/api/email/analytics/aggregate

# Then query
curl "http://localhost:3000/api/email/analytics/overview?from=2026-03-18&to=2026-03-18"
```

```json
{
  "success": true,
  "data": {
    "sent": 45,
    "delivered": 43,
    "bounced": 2,
    "opened": 12,
    "clicked": 3,
    "unsubscribed": 1
  }
}
```

More endpoints:
- `GET /analytics/timeline?from=...&to=...&interval=daily` -- Time-series
- `GET /analytics/accounts?from=...&to=...` -- Per-account breakdown
- `GET /analytics/rules?from=...&to=...` -- Per-rule breakdown
- `GET /analytics/templates?from=...&to=...` -- Per-template breakdown
- `GET /analytics/variants?templateId=...&from=...&to=...` -- A/B test results

> **Important:** Without calling `/aggregate`, query endpoints return stale or empty data. In production, schedule aggregation via cron every 5-15 minutes.

---

## What's Next?

- [Core Adapters Guide](https://github.com/Hariprakash1997/astralib/blob/main/packages/rule-engine/core/docs/adapters.md) -- Implement `queryUsers`, `resolveData`, `sendEmail`, `selectAgent`, `findIdentifier`
- [Templates & Rules](https://github.com/Hariprakash1997/astralib/blob/main/packages/rule-engine/core/docs/templates-and-rules.md) -- Full template and rule reference including scheduling
- [Warmup System](../account-manager/docs/warmup-system.md) -- Protect new accounts from spam filters
- [Draft Approval](../account-manager/docs/draft-approval.md) -- Add manual review before sending
- [Glossary](glossary.md) -- All ID types, concepts, and constants explained
