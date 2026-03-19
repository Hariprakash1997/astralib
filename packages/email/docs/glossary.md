# Glossary

> **Note:** For rule engine terms (conditions, operators, throttle, hooks, rule types, target modes), see the [core glossary](https://github.com/Hariprakash1997/astralib/blob/main/packages/rule-engine/core/docs/glossary.md).

Reference for email-specific ID types, concepts, and constants across the email packages.

---

## ID Types

| ID | What it is | Example | Created by |
|----|-----------|---------|------------|
| `accountId` | MongoDB `_id` of an email sender account | `"507f1f77bcf86cd799439011"` | `POST /accounts` |
| `templateId` | MongoDB `_id` of an email template | `"665abc123def456789000001"` | `POST /templates` |
| `ruleId` | MongoDB `_id` of a targeting rule | `"665def789abc123456000001"` | `POST /rules` |
| `runId` | Unique execution ID for a rule run | `"run_a1b2c3d4"` | `POST /runner` |
| `draftId` | MongoDB `_id` of a pending email draft | `"507f1f77bcf86cd799439013"` | Auto-created when `autoApprove: false` |
| `identifierId` | MongoDB `_id` of a tracked email recipient | `"507f1f77bcf86cd799439012"` | `POST /identifiers` or via `findIdentifier` adapter |
| `contactId` | Your CRM's internal contact ID | `"crm_user_123"` | Your system -- passed via `findIdentifier` adapter |
| `messageId` | SMTP message ID from the provider | `"<msg-abc@smtp.gmail.com>"` | Set by SMTP server after send |

### Key Relationships

- `accountId` scopes all sending operations -- every email is sent FROM an account
- `templateId` is referenced by rules -- a rule says "send THIS template to THESE people"
- `identifierId` and `contactId` are different: `identifierId` is the library's internal record, `contactId` is YOUR system's user ID. The `findIdentifier` adapter maps between them.
- `runId` is ephemeral -- exists only while monitoring a run. Historical data is in run logs.

---

## Account Concepts

### Provider
The email service backend. Determines SMTP configuration and bounce detection method.

| Value | SMTP | Bounce Detection |
|-------|------|-----------------|
| `'gmail'` | Gmail SMTP (`smtp.gmail.com:465`) | IMAP polling |
| `'ses'` | AWS SES SMTP | SNS webhooks |

### Account Status (`ACCOUNT_STATUS`)

| Status | Meaning | Can Send? |
|--------|---------|-----------|
| `'active'` | Ready to send | Yes |
| `'warmup'` | New account, daily limit ramping up | Yes (reduced volume) |
| `'disabled'` | Manually disabled or auto-disabled by health check | No |
| `'quota_exceeded'` | Hit daily send limit | No (resets next day) |
| `'error'` | Connection or auth failure | No |

### Health Score (0-100)
Tracks account reliability. Affects account selection.

| Event | Score Change |
|-------|-------------|
| Successful send | +2 (capped at 100) |
| Send error | -10 |
| Bounce | -5 |
| Complaint | -10 |

Auto-disables account when score drops below threshold (default: 50).

### Warmup
Gradual ramp-up of sending volume for new accounts to avoid spam filters.

| Phase | Days | Daily Limit |
|-------|------|-------------|
| 1 | 1-3 | 5 |
| 2 | 4-7 | 15 |
| 3 | 8-14 | 30 |
| 4 | 15-21 | 80 |
| 5 | 22+ | Full limit |

> **Requires daily cron.** Call `advanceDay()` once per day to progress warmup. Without this, accounts stay in phase 1 forever.

### Daily Limit / Capacity
Max emails an account can send per day. Set via `limits.dailyMax` at account creation. The `selectAgent` adapter should check remaining capacity before picking an account.

---

## Template Concepts

### MJML (Mailjet Markup Language)
Responsive email markup that compiles to cross-client HTML. The `@astralibx/email-rule-engine` wrapper auto-wraps body fragments in a full MJML document structure before compiling. Write fragments like:

```xml
<mj-section>
  <mj-column>
    <mj-text>Hi {{firstName}}!</mj-text>
    <mj-button href="{{url}}">Click Here</mj-button>
  </mj-column>
</mj-section>
```

The library compiles them to bulletproof HTML tables that render correctly in Gmail, Outlook, Apple Mail, etc.

For Handlebars syntax, A/B testing variants, attachments, and all other template and rule concepts (conditions, operators, throttle, target modes, `sendOnce`, `autoApprove`, `maxPerRun`), see the [core glossary](https://github.com/Hariprakash1997/astralib/blob/main/packages/rule-engine/core/docs/glossary.md).

---

## Identifier Concepts

### Identifier Status (`IDENTIFIER_STATUS`)

| Status | Meaning | Sent to? |
|--------|---------|----------|
| `'active'` | Valid recipient | Yes |
| `'bounced'` | Email bounced (hard or soft) | No |
| `'unsubscribed'` | Clicked unsubscribe link | No |
| `'blocked'` | Marked as spam / complaint | No |
| `'invalid'` | Bad email format | No |

Statuses update automatically via bounce detection (IMAP/SES) and unsubscribe link clicks.

### Bounce Type (`BOUNCE_TYPE`)

| Type | Meaning | Action |
|------|---------|--------|
| `'hard'` | Permanent -- address doesn't exist | Auto-marks identifier as bounced |
| `'soft'` | Temporary -- mailbox full, try later | Retries, marks after repeated failures |
| `'inbox_full'` | Mailbox storage exceeded | Retries later |
| `'invalid_email'` | Format issue | Auto-marks as invalid |

---

## Draft & Approval Concepts

### Draft Status (`DRAFT_STATUS`)

```
pending --> approved --> queued --> sent
   |                               |
   +--> rejected               failed
```

| Status | Meaning |
|--------|---------|
| `'pending'` | Waiting for admin review |
| `'approved'` | Approved, entering send queue |
| `'rejected'` | Admin rejected (with reason) |
| `'queued'` | In BullMQ send queue |
| `'sent'` | Successfully delivered |
| `'failed'` | Send error |

### Approval Mode (`APPROVAL_MODE`)
- `'manual'` -- Admin must approve each draft
- `'auto'` -- Auto-approve after configurable delay

### Spread Strategy (`SPREAD_STRATEGY`)
How approved drafts are distributed within the send window:
- `'random'` -- Random delay within window (looks more natural)
- `'even'` -- Evenly spaced within window

---

## Analytics Concepts

### Event Types (`EMAIL_EVENT_TYPE`)

| Event | Meaning | Source |
|-------|---------|--------|
| `'sent'` | Email queued for delivery | Rule engine |
| `'delivered'` | Confirmed by recipient server | SES webhook |
| `'bounced'` | Rejected by recipient server | IMAP/SES |
| `'complained'` | Marked as spam | SES webhook |
| `'opened'` | Recipient opened email | SES open tracking |
| `'clicked'` | Recipient clicked a link | SES click tracking |
| `'unsubscribed'` | Clicked unsubscribe link | Unsubscribe handler |
| `'failed'` | Send error (may retry) | SMTP service |

### Aggregation
Raw events must be aggregated before querying. Call `POST /analytics/aggregate` to roll up events into daily stats.

> **In production, schedule aggregation via cron every 5-15 minutes.** Without this, analytics queries return stale or empty data.

### Aggregation Intervals (`AGGREGATION_INTERVAL`)
- `'daily'` -- Per-day rollup
- `'weekly'` -- Per-week rollup
- `'monthly'` -- Per-month rollup

---

## Run Concepts

### Run Log Status (`RUN_LOG_STATUS`)

| Status | Meaning |
|--------|---------|
| `'completed'` | All rules processed successfully |
| `'cancelled'` | Run was stopped mid-execution |
| `'failed'` | Run errored out |

### Run Trigger (`RUN_TRIGGER`)
- `'manual'` -- Triggered via API call
- `'cron'` -- Triggered by scheduled cron job

---

## Global Settings

### IMAP Search Since (`IMAP_SEARCH_SINCE`)
How far back to search for bounced emails:
- `'last_check'` -- Since the last poll (most efficient)
- `'last_24h'` -- Last 24 hours
- `'last_7d'` -- Last 7 days (catches missed bounces)

---

## Gotchas

1. **Throttle is global, not per-rule.** `maxPerUserPerDay: 2` applies across ALL rules for that recipient.

2. **Warmup needs a daily cron.** Call `advanceDay()` once per day or warmup phases never progress.

3. **Analytics need aggregation.** `POST /aggregate` must run on a schedule, or query endpoints return empty/stale data.

4. **Passwords are never returned.** SMTP/IMAP passwords are write-only. Store them before calling the API.

5. **selectAgent must enforce capacity.** The rule engine doesn't know about warmup limits or daily caps. Your adapter must check.

6. **Query mode conditions depend on your adapter.** The engine passes conditions through -- your `queryUsers` adapter must apply them to your database query.

7. **Templates must be active.** Deactivated templates are skipped by rules, even if the rule is active.

8. **Redis keyPrefix is critical for shared instances.** Without unique prefixes, BullMQ queues and locks collide between projects.

9. **SES webhooks need SNS verification.** Enable `validateSignature: true` in production.

10. **Unsubscribe links use HMAC tokens.** The `unsubscribeSecret` config must be set and kept stable, or existing unsubscribe links break.
