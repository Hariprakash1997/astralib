# Quick Start Tutorial

This tutorial walks you through setting up a complete Telegram CRM from scratch using curl commands. By the end, you'll have:
- A connected Telegram account
- An inbox receiving messages
- A template and rule for outbound campaigns
- A triggered campaign run

## Prerequisites

- MongoDB running on localhost:27017
- Redis running on localhost:6379
- Your Telegram API credentials from https://my.telegram.org (you need `apiId` and `apiHash`)
- Node.js server running with all 4 packages mounted (see [Integration Guide](./integration-guide.md))

> All examples assume the API is mounted at:
> - Account Manager: `http://localhost:3000/api/accounts`
> - Inbox: `http://localhost:3000/api/inbox`
> - Rule Engine: `http://localhost:3000/api/rules`
>
> These match the mount points in the Integration Guide. Adjust if you used different prefixes.

---

## Step 1: Generate a Telegram Session

Before you can add an account, you need a TDLib session string. This is a two-step flow: request a code, then verify it.

**Request the auth code:**

```bash
curl -X POST http://localhost:3000/api/accounts/sessions/request-code \
  -H "Content-Type: application/json" \
  -d '{
    "phone": "+919876543210"
  }'
```

**Response:**

```json
{
  "success": true,
  "data": {
    "phoneCodeHash": "abc123def456..."
  }
}
```

Telegram sends an OTP to the phone's Telegram app (not SMS). Save the `phoneCodeHash` -- you need it next.

**Verify the code:**

```bash
curl -X POST http://localhost:3000/api/accounts/sessions/verify-code \
  -H "Content-Type: application/json" \
  -d '{
    "phone": "+919876543210",
    "code": "52941",
    "phoneCodeHash": "abc123def456..."
  }'
```

If the account has 2FA enabled, add `"password": "your2FApassword"` to the body.

**Response:**

```json
{
  "success": true,
  "data": {
    "session": "1AgAOMTQ5LjE1NC4xNjcuOTEBu..."
  }
}
```

Save the `session` string. This is your reusable auth token.

---

## Step 2: Create an Account

Register the Telegram account in the system using the session from step 1.

```bash
curl -X POST http://localhost:3000/api/accounts/accounts \
  -H "Content-Type: application/json" \
  -d '{
    "phone": "+919876543210",
    "name": "Sales Account 1",
    "session": "1AgAOMTQ5LjE1NC4xNjcuOTEBu...",
    "tags": ["sales", "outreach"]
  }'
```

**Response:**

```json
{
  "success": true,
  "data": {
    "account": {
      "_id": "507f1f77bcf86cd799439011",
      "phone": "+919876543210",
      "name": "Sales Account 1",
      "status": "disconnected",
      "healthScore": 100,
      "consecutiveErrors": 0,
      "floodWaitCount": 0,
      "currentDailyLimit": 40,
      "tags": ["sales", "outreach"],
      "createdAt": "2026-03-18T10:00:00.000Z"
    }
  }
}
```

The account starts as `disconnected` with a health score of 100 and a daily send limit of 40. The `session` field is redacted in responses.

> New accounts also start warmup automatically (if enabled in config). Warmup gradually increases the daily send limit over ~2 weeks to avoid Telegram bans. See the [Glossary](./glossary.md#warmup) for details.

---

## Step 3: Connect the Account

Start the TDLib client session so the account can send and receive messages.

```bash
curl -X POST http://localhost:3000/api/accounts/accounts/507f1f77bcf86cd799439011/connect
```

**Response:**

```json
{ "success": true }
```

The account status changes from `disconnected` to `connected`. The TDLib client is now active and listening for incoming messages.

---

## Step 4: Verify -- Check Account Status

Confirm the account is connected and healthy.

```bash
curl http://localhost:3000/api/accounts/accounts/507f1f77bcf86cd799439011
```

**Response:**

```json
{
  "success": true,
  "data": {
    "account": {
      "_id": "507f1f77bcf86cd799439011",
      "phone": "+919876543210",
      "name": "Sales Account 1",
      "status": "connected",
      "healthScore": 100,
      "consecutiveErrors": 0,
      "floodWaitCount": 0,
      "currentDailyLimit": 40,
      "tags": ["sales", "outreach"],
      "createdAt": "2026-03-18T10:00:00.000Z"
    }
  }
}
```

Status should be `connected`. If it shows `error` or `quarantined`, check your session string and Telegram API credentials.

---

## Step 5: Sync Dialogs to Inbox

Pull existing Telegram conversations into the inbox database.

```bash
curl -X POST "http://localhost:3000/api/inbox/conversations/sync-dialogs?accountId=507f1f77bcf86cd799439011&limit=50"
```

**Response:**

```json
{
  "success": true,
  "data": {
    "synced": 12,
    "total": 12
  }
}
```

This fetches up to 50 dialogs from Telegram and stores them as conversation records. New incoming messages are captured automatically once the account is connected (if `autoAttachOnConnect` is enabled).

---

## Step 6: View Conversations

List all synced conversations with their last message and unread counts.

```bash
curl "http://localhost:3000/api/inbox/conversations?accountId=507f1f77bcf86cd799439011&page=1&limit=20"
```

**Response:**

```json
{
  "success": true,
  "data": {
    "conversations": [
      {
        "conversationId": "123456789",
        "lastMessage": {
          "content": "Hey, are you available?",
          "contentType": "text",
          "direction": "inbound",
          "createdAt": "2026-03-18T09:15:00.000Z"
        },
        "messageCount": 42,
        "unreadCount": 3
      },
      {
        "conversationId": "987654321",
        "lastMessage": {
          "content": "Thanks for the info!",
          "contentType": "text",
          "direction": "outbound",
          "createdAt": "2026-03-17T14:00:00.000Z"
        },
        "messageCount": 8,
        "unreadCount": 0
      }
    ],
    "total": 12
  }
}
```

The `conversationId` is Telegram's chat ID as a string. For DMs, this equals the other user's Telegram user ID.

---

## Step 7: View Messages in a Conversation

Fetch the message history for a specific chat.

```bash
curl "http://localhost:3000/api/inbox/conversations/123456789/messages?page=1&limit=20"
```

**Response:**

```json
{
  "success": true,
  "data": {
    "messages": [
      {
        "conversationId": "123456789",
        "messageId": "4521",
        "senderId": "123456789",
        "senderType": "user",
        "direction": "inbound",
        "contentType": "text",
        "content": "Hey, are you available?",
        "readAt": null,
        "createdAt": "2026-03-18T09:15:00.000Z"
      },
      {
        "conversationId": "123456789",
        "messageId": "4520",
        "senderId": "507f1f77bcf86cd799439011",
        "senderType": "account",
        "direction": "outbound",
        "contentType": "text",
        "content": "Sure, what do you need?",
        "readAt": "2026-03-18T09:16:00.000Z",
        "createdAt": "2026-03-18T09:14:00.000Z"
      }
    ],
    "total": 42
  }
}
```

---

## Step 8: Send a Direct Message

Send a message through the connected account using the account-manager's send endpoint.

```bash
curl -X POST http://localhost:3000/api/accounts/accounts/507f1f77bcf86cd799439011/send \
  -H "Content-Type: application/json" \
  -d '{
    "chatId": "123456789",
    "text": "Hi! Just following up on our conversation."
  }'
```

**Response:**

```json
{
  "success": true,
  "data": {
    "messageId": "4522"
  }
}
```

The account must be connected. You can also send via the inbox endpoint (`POST /conversations/:chatId/send`) which requires `accountId` in the body.

---

## Step 9: Create a Message Template

Create a template for campaign messages. Templates support Handlebars variables and multiple message variants (one is picked randomly per send).

```bash
curl -X POST http://localhost:3000/api/rules/templates \
  -H "Content-Type: application/json" \
  -d '{
    "name": "Product Launch Outreach",
    "messages": [
      "Hi {{firstName}}, we just launched {{productName}}! Check it out: {{link}}",
      "Hey {{firstName}}! {{productName}} is live now. Details here: {{link}}",
      "{{firstName}}, exciting news -- {{productName}} just dropped. Take a look: {{link}}"
    ],
    "category": "marketing",
    "audience": "customer",
    "fields": {
      "productName": "AstraCRM Pro",
      "link": "https://example.com/launch"
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
      "name": "Product Launch Outreach",
      "messages": [
        "Hi {{firstName}}, we just launched {{productName}}! Check it out: {{link}}",
        "Hey {{firstName}}! {{productName}} is live now. Details here: {{link}}",
        "{{firstName}}, exciting news -- {{productName}} just dropped. Take a look: {{link}}"
      ],
      "variables": ["firstName", "productName", "link"],
      "category": "marketing",
      "audience": "customer",
      "fields": {
        "productName": "AstraCRM Pro",
        "link": "https://example.com/launch"
      },
      "createdAt": "2026-03-18T10:30:00.000Z"
    }
  }
}
```

The `fields` object provides default values for variables. The `variables` array is auto-extracted from the template text if you omit it.

**Preview the template with sample data:**

```bash
curl -X POST http://localhost:3000/api/rules/templates/665abc123def456789000001/preview \
  -H "Content-Type: application/json" \
  -d '{
    "sampleData": {
      "firstName": "Priya"
    }
  }'
```

This renders one of the message variants with your sample data merged with the template's `fields` defaults.

---

## Step 10: Create an Identifier (Contact)

Register a Telegram contact so the rule engine can target them. An identifier maps your CRM's contact ID to a Telegram user ID.

```bash
curl -X POST http://localhost:3000/api/accounts/identifiers \
  -H "Content-Type: application/json" \
  -d '{
    "contactId": "crm-contact-42",
    "telegramUserId": "123456789",
    "username": "priya_dev",
    "firstName": "Priya",
    "lastName": "Sharma",
    "phone": "+919876500001"
  }'
```

**Response:**

```json
{
  "success": true,
  "data": {
    "identifier": {
      "_id": "507f1f77bcf86cd799439012",
      "contactId": "crm-contact-42",
      "telegramUserId": "123456789",
      "username": "priya_dev",
      "firstName": "Priya",
      "lastName": "Sharma",
      "phone": "+919876500001",
      "status": "active",
      "sentCount": 0,
      "knownByAccounts": [],
      "createdAt": "2026-03-18T10:35:00.000Z"
    }
  }
}
```

Each `telegramUserId` must be unique -- you can't register the same Telegram user twice. The `contactId` is your external CRM identifier; use whatever your system already has.

---

## Step 11: Create a Rule

Create a rule that links the template to a set of targets. Rules support two targeting modes:

- **`list` mode** -- send to a specific list of identifiers (phone numbers, usernames, or IDs)
- **`query` mode** -- send to users matching a query (resolved by your `queryUsers` adapter)

```bash
curl -X POST http://localhost:3000/api/rules/rules \
  -H "Content-Type: application/json" \
  -d '{
    "name": "Product Launch - VIP List",
    "templateId": "665abc123def456789000001",
    "target": {
      "mode": "list",
      "identifiers": ["+919876500001", "@priya_dev"]
    },
    "sendOnce": true,
    "maxPerRun": 50
  }'
```

**Response:**

```json
{
  "success": true,
  "data": {
    "rule": {
      "_id": "665def789abc123456000001",
      "name": "Product Launch - VIP List",
      "templateId": "665abc123def456789000001",
      "target": {
        "mode": "list",
        "identifiers": ["+919876500001", "@priya_dev"]
      },
      "sendOnce": true,
      "maxPerRun": 50,
      "isActive": true,
      "createdAt": "2026-03-18T10:40:00.000Z"
    }
  }
}
```

**Activate the rule** (rules are active by default, but if you deactivated one):

```bash
curl -X POST http://localhost:3000/api/rules/rules/665def789abc123456000001/activate
```

**Dry run** -- check how many users match without actually sending:

```bash
curl -X POST http://localhost:3000/api/rules/rules/665def789abc123456000001/dry-run
```

```json
{
  "success": true,
  "data": {
    "valid": true,
    "templateExists": true,
    "targetValid": true,
    "matchedCount": 2,
    "effectiveLimit": 50,
    "errors": []
  }
}
```

---

## Step 12: Configure Throttle Settings

Set safe throttle limits before triggering a run. These protect your accounts from sending too fast.

```bash
curl -X PUT http://localhost:3000/api/rules/settings/throttle \
  -H "Content-Type: application/json" \
  -d '{
    "maxPerUserPerDay": 1,
    "maxPerUserPerWeek": 2,
    "minGapDays": 3,
    "throttleWindow": "rolling"
  }'
```

**Response:**

```json
{ "success": true }
```

| Setting | What it does |
|---------|-------------|
| `maxPerUserPerDay: 1` | Each contact receives at most 1 message per day |
| `maxPerUserPerWeek: 2` | Each contact receives at most 2 messages per week |
| `minGapDays: 3` | Wait at least 3 days between messages to the same contact |
| `throttleWindow: "rolling"` | Use a rolling window (not calendar-based) |

**Check current throttle config:**

```bash
curl http://localhost:3000/api/rules/settings/throttle
```

---

## Step 13: Trigger a Rule Run

Start executing all active rules. This is non-blocking -- it returns a `runId` immediately and processes in the background.

```bash
curl -X POST http://localhost:3000/api/rules/runner/trigger \
  -H "Content-Type: application/json" \
  -d '{
    "triggeredBy": "manual"
  }'
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

The rule engine now processes each active rule: resolves targets, selects accounts (via your `selectAccount` adapter), renders templates, applies throttle checks, and sends messages with delays.

---

## Step 14: Monitor Progress

Poll the run status to track progress.

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
    "currentRule": "Product Launch - VIP List",
    "progress": {
      "rulesTotal": 1,
      "rulesCompleted": 0,
      "sent": 1,
      "failed": 0,
      "skipped": 0,
      "throttled": 0
    },
    "startedAt": "2026-03-18T11:00:00.000Z",
    "elapsed": 5200
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
    "currentRule": null,
    "progress": {
      "rulesTotal": 1,
      "rulesCompleted": 1,
      "sent": 2,
      "failed": 0,
      "skipped": 0,
      "throttled": 0
    },
    "startedAt": "2026-03-18T11:00:00.000Z",
    "elapsed": 12500
  }
}
```

To cancel a running execution:

```bash
curl -X POST http://localhost:3000/api/rules/runner/cancel/run_a1b2c3d4e5f6
```

---

## Step 15: Check Send Logs

Review what was sent, to whom, and the delivery status.

```bash
curl "http://localhost:3000/api/rules/analytics/send-logs?runId=run_a1b2c3d4e5f6&page=1&limit=20"
```

**Response:**

```json
{
  "success": true,
  "data": {
    "logs": [
      {
        "ruleId": "665def789abc123456000001",
        "contactId": "crm-contact-42",
        "deliveryStatus": "sent",
        "sentAt": "2026-03-18T11:00:05.000Z"
      },
      {
        "ruleId": "665def789abc123456000001",
        "contactId": "crm-contact-43",
        "deliveryStatus": "sent",
        "sentAt": "2026-03-18T11:00:09.000Z"
      }
    ],
    "total": 2
  }
}
```

**Get aggregated stats:**

```bash
curl "http://localhost:3000/api/rules/analytics/stats?from=2026-03-18&to=2026-03-18"
```

```json
{
  "success": true,
  "data": {
    "totalSent": 2,
    "totalDelivered": 2,
    "totalRead": 0,
    "totalFailed": 0,
    "totalPending": 0,
    "total": 2
  }
}
```

**Check error logs** (if any sends failed):

```bash
curl "http://localhost:3000/api/rules/analytics/error-logs?from=2026-03-18"
```

---

## What's Next?

- **Add more accounts** and use `AccountRotator` for load balancing across them (see [Integration Guide - Wiring AccountRotator](./integration-guide.md#3-wiring-accountrotator-into-rule-engine))
- **Set up the Telegram Bot** for admin notifications when new messages arrive
- **Auto-create identifiers from inbox contacts** using the `onNewContact` hook (see [Integration Guide - Common Patterns](./integration-guide.md#6-common-patterns))
- **Monitor account health** with `GET /accounts/health` and set up quarantine alerts via the `onAccountQuarantined` hook
- **Check capacity** before campaigns with `GET /accounts/capacity` to see how many messages each account can still send today
- Read the [Glossary](./glossary.md) to understand ID types, warmup, quarantine, and health scoring
