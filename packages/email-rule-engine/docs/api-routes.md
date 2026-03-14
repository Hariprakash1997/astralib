# API Routes — REST Endpoint Reference

All routes are mounted under your chosen prefix (e.g., `/api/email-rules`). All responses use the `{ success: boolean, data?: any, error?: string }` format.

## Templates

### List Templates

```
GET /templates?category=onboarding&audience=customer&platform=web&isActive=true
```

All query parameters are optional filters.

**Response**:
```json
{
  "success": true,
  "data": {
    "templates": [
      {
        "_id": "665abc123...",
        "name": "Welcome Email",
        "slug": "welcome-email",
        "category": "onboarding",
        "audience": "customer",
        "platform": "web",
        "subject": "Welcome {{user.name}}!",
        "body": "<mjml>...</mjml>",
        "variables": ["user.name"],
        "version": 1,
        "isActive": true,
        "createdAt": "2026-01-15T10:00:00Z",
        "updatedAt": "2026-01-15T10:00:00Z"
      }
    ]
  }
}
```

### Create Template

```
POST /templates
Content-Type: application/json

{
  "name": "Welcome Email",
  "slug": "welcome-email",
  "category": "onboarding",
  "audience": "customer",
  "platform": "web",
  "subject": "Welcome to {{platform.name}}, {{user.name}}!",
  "body": "<mjml><mj-body><mj-section><mj-column><mj-text>Hello {{user.name}}</mj-text></mj-column></mj-section></mj-body></mjml>",
  "description": "Sent to new customers after signup"
}
```

**Response** (201):
```json
{
  "success": true,
  "data": {
    "template": { "_id": "...", "name": "Welcome Email", "slug": "welcome-email", "..." : "..." }
  }
}
```

Required fields: `name`, `subject`, `body`, `category`, `audience`, `platform`.

### Get Template by ID

```
GET /templates/:id
```

### Update Template

```
PUT /templates/:id
Content-Type: application/json

{
  "subject": "Updated subject: {{user.name}}",
  "body": "<mjml>...</mjml>"
}
```

Updates increment the `version` field automatically.

### Delete Template

```
DELETE /templates/:id
```

### Toggle Active

```
PATCH /templates/:id/toggle
```

Toggles `isActive` between `true` and `false`.

### Preview Template (saved)

```
POST /templates/:id/preview
Content-Type: application/json

{
  "sampleData": {
    "user": { "name": "Jane" },
    "platform": { "name": "MyApp" }
  }
}
```

**Response**:
```json
{
  "success": true,
  "data": {
    "html": "<html>..rendered HTML..</html>",
    "text": "Plain text version...",
    "subject": "Welcome to MyApp, Jane!"
  }
}
```

### Preview Template (raw)

```
POST /templates/preview
Content-Type: application/json

{
  "subject": "Hello {{user.name}}",
  "body": "<mj-text>Welcome, {{user.name}}!</mj-text>",
  "sampleData": { "user": { "name": "Test" } }
}
```

Preview without saving — useful for template editors.

### Validate Template

```
POST /templates/validate
Content-Type: application/json

{
  "body": "<mjml><mj-body><mj-section><mj-column><mj-text>{{user.name}}</mj-text></mj-column></mj-section></mj-body></mjml>"
}
```

**Response**:
```json
{
  "success": true,
  "data": {
    "valid": true,
    "errors": []
  }
}
```

### Send Test Email

```
POST /templates/:id/test-email
Content-Type: application/json

{
  "testEmail": "test@example.com",
  "sampleData": {
    "user": { "name": "Test User" }
  }
}
```

Requires the `sendTestEmail` adapter to be configured.

## Rules

### List Rules

```
GET /rules
```

Returns all rules with populated template info.

### Create Rule

```
POST /rules
Content-Type: application/json

{
  "name": "Welcome new customers",
  "templateId": "665abc123...",
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
  "maxPerRun": 200,
  "emailType": "automated"
}
```

Required fields: `name`, `templateId`, `target` (with `role`, `platform`, `conditions`).

### Get Rule by ID

```
GET /rules/:id
```

### Update Rule

```
PATCH /rules/:id
Content-Type: application/json

{
  "maxPerRun": 500,
  "sortOrder": 2
}
```

### Delete Rule

```
DELETE /rules/:id
```

If the rule has send history, it's disabled instead of deleted:

```json
{
  "success": true,
  "data": {
    "deleted": false,
    "disabled": true
  }
}
```

### Toggle Active

```
PATCH /rules/:id/toggle
```

### Dry Run

```
POST /rules/:id/dry-run
```

Counts matching users without sending.

### Run History

```
GET /rules/run-history?limit=20
```

**Response**:
```json
{
  "success": true,
  "data": {
    "logs": [
      {
        "_id": "...",
        "runAt": "2026-03-14T09:00:00Z",
        "triggeredBy": "cron",
        "duration": 45230,
        "rulesProcessed": 3,
        "totalStats": {
          "matched": 500,
          "sent": 342,
          "skipped": 148,
          "skippedByThrottle": 10,
          "errors": 0
        },
        "perRuleStats": [
          {
            "ruleId": "...",
            "ruleName": "Welcome new customers",
            "matched": 200,
            "sent": 180,
            "skipped": 20,
            "skippedByThrottle": 0,
            "errors": 0
          }
        ]
      }
    ]
  }
}
```

## Runner

### Trigger Manual Run

```
POST /runner
```

Triggers a rule run with `triggeredBy: 'manual'`. Returns immediately (fire-and-forget).

**Response**:
```json
{
  "success": true,
  "data": {
    "message": "Rule run triggered"
  }
}
```

### Get Latest Run Status

```
GET /runner/status
```

Returns the most recent run log entry.

## Settings

### Get Throttle Config

```
GET /settings/throttle
```

**Response**:
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

### Update Throttle Config

```
PATCH /settings/throttle
Content-Type: application/json

{
  "maxPerUserPerDay": 3,
  "maxPerUserPerWeek": 10,
  "minGapDays": 0
}
```

All fields are optional. Validates that `maxPerUserPerWeek >= maxPerUserPerDay`.

See [throttling.md](throttling.md) for how throttle settings affect rule execution.
