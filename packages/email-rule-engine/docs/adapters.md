# Adapters

Adapters are the bridge between the engine and your application. You provide functions that handle user querying, data resolution, email delivery, account selection, and contact mapping.

## queryUsers

Finds users matching a rule's targeting conditions. Called once per rule at the start of execution.

```typescript
(target: RuleTarget, limit: number) => Promise<Record<string, unknown>[]>
```

- `target` contains `role` (audience), `platform`, and a `conditions[]` array
- `limit` comes from `rule.maxPerRun` or `config.options.defaultMaxPerRun`
- Each returned object **must** have `_id` and `email` fields

```typescript
import { RuleTarget, RuleCondition } from '@astralibx/email-rule-engine';

function buildMongoQuery(conditions: RuleCondition[]): Record<string, unknown> {
  const query: Record<string, unknown> = {};
  for (const c of conditions) {
    switch (c.operator) {
      case 'eq':         query[c.field] = c.value; break;
      case 'neq':        query[c.field] = { $ne: c.value }; break;
      case 'gt':         query[c.field] = { $gt: c.value }; break;
      case 'gte':        query[c.field] = { $gte: c.value }; break;
      case 'lt':         query[c.field] = { $lt: c.value }; break;
      case 'lte':        query[c.field] = { $lte: c.value }; break;
      case 'exists':     query[c.field] = { $exists: true }; break;
      case 'not_exists': query[c.field] = { $exists: false }; break;
      case 'in':         query[c.field] = { $in: c.value }; break;
      case 'not_in':     query[c.field] = { $nin: c.value }; break;
      case 'contains':   query[c.field] = { $regex: c.value, $options: 'i' }; break;
    }
  }
  return query;
}

async function queryUsers(target: RuleTarget, limit: number) {
  return User.find({
    role: target.role,
    platform: target.platform,
    ...buildMongoQuery(target.conditions),
  }).limit(limit).lean();
}
```

## resolveData

Transforms a raw user record into the variables available in Handlebars templates. Called once per user, just before rendering.

```typescript
(user: Record<string, unknown>) => Record<string, unknown>
```

The returned object's keys become template variables. Nested objects work with dot notation -- `{{user.name}}`, `{{platform.bookingLink}}`.

```typescript
function resolveData(user: Record<string, unknown>) {
  return {
    user: {
      name: user.name || 'there',
      email: user.email,
      city: user.city,
    },
    platform: {
      name: 'My Platform',
      supportEmail: 'help@example.com',
      bookingLink: 'https://example.com/book',
    },
    subscription: user.subscription || null,
  };
}
```

## sendEmail

Delivers the rendered email. Called once per user after all checks pass (dedup, throttle, agent selection). You can send directly via SMTP, queue with BullMQ, or save as a draft for approval.

```typescript
(params: SendEmailParams) => Promise<void>
```

| Field | Type | Description |
|-------|------|-------------|
| `identifierId` | `string` | Your internal email contact ID |
| `contactId` | `string` | Your internal contact ID |
| `accountId` | `string` | Selected sender account ID (from `selectAgent`) |
| `subject` | `string` | Rendered subject line |
| `htmlBody` | `string` | Rendered HTML (from MJML compilation) |
| `textBody` | `string` | Rendered plain text fallback |
| `ruleId` | `string` | Rule that triggered this send |
| `autoApprove` | `boolean` | `true` = send immediately, `false` = save as draft |

**Nodemailer example:**

```typescript
async function sendEmail(params: SendEmailParams) {
  await transporter.sendMail({
    from: 'noreply@example.com',
    to: params.identifierId,
    subject: params.subject,
    html: params.htmlBody,
    text: params.textBody,
  });
}
```

**BullMQ queue example:**

```typescript
async function sendEmail(params: SendEmailParams) {
  await emailQueue.add('send', {
    to: params.identifierId,
    subject: params.subject,
    html: params.htmlBody,
    text: params.textBody,
    accountId: params.accountId,
  }, {
    attempts: 3,
    backoff: { type: 'exponential', delay: 5000 },
  });
}
```

## selectAgent

Picks which sending account to use for a given recipient. Return `null` to skip the recipient.

```typescript
(identifierId: string, context?: { ruleId: string; templateId: string }) => Promise<AgentSelection | null>
// AgentSelection = { accountId: string }
```

```typescript
async function selectAgent(identifierId: string) {
  const account = await EmailAccount.findOne({
    isActive: true,
    dailySentCount: { $lt: 450 },
  }).sort({ dailySentCount: 1 });

  return account ? { accountId: account._id.toString() } : null;
}
```

## findIdentifier

Maps an email address to your contact/identifier system. Called once per unique email per rule execution (batched before the user loop). Return `null` to skip.

```typescript
(email: string) => Promise<RecipientIdentifier | null>
// RecipientIdentifier = { id: string; contactId: string }
```

```typescript
async function findIdentifier(email: string) {
  const contact = await Contact.findOne({ email: email.toLowerCase() });
  if (!contact) return null;
  return {
    id: contact.emailIdentifierId.toString(),
    contactId: contact._id.toString(),
  };
}
```

## sendTestEmail (optional)

Sends a test email for template previewing via `POST /templates/:id/test-email`. Only needed if you use that endpoint.

```typescript
(to: string, subject: string, html: string, text: string) => Promise<void>
```

```typescript
async function sendTestEmail(to: string, subject: string, html: string, text: string) {
  await transporter.sendMail({
    from: 'test@example.com',
    to,
    subject: `[TEST] ${subject}`,
    html,
    text,
  });
}
```
