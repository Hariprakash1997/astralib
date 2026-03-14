# Adapters — Connecting the Engine to Your Project

Adapters are the bridge between the email rule engine and your application. You provide 5 functions (plus 1 optional) that the engine calls during rule execution.

## Overview

| Adapter | Purpose | Required |
|---------|---------|----------|
| `queryUsers` | Find users matching rule conditions | Yes |
| `resolveData` | Transform user into template variables | Yes |
| `sendEmail` | Deliver the rendered email | Yes |
| `selectAgent` | Pick a sending account | Yes |
| `findIdentifier` | Map email to your contact system | Yes |
| `sendTestEmail` | Send test emails for template preview | No |

## queryUsers

**What it does**: Finds users in your database that match a rule's targeting conditions.

**When it's called**: Once per rule execution, at the start of processing each rule.

**Parameters**:

```typescript
(target: RuleTarget, limit: number) => Promise<Record<string, unknown>[]>
```

| Param | Type | Description |
|-------|------|-------------|
| `target` | `RuleTarget` | Contains `role`, `platform`, and `conditions[]` |
| `limit` | `number` | Max users to return (from rule's `maxPerRun` or config `defaultMaxPerRun`) |

**Expected return**: Array of user objects. Each must have `_id` and `email` fields.

**Example — MongoDB with condition mapping**:

```typescript
import { RuleTarget, RuleCondition } from '@astralibx/email-rule-engine';

function buildMongoQuery(conditions: RuleCondition[]): Record<string, unknown> {
  const query: Record<string, unknown> = {};
  for (const c of conditions) {
    switch (c.operator) {
      case 'eq': query[c.field] = c.value; break;
      case 'neq': query[c.field] = { $ne: c.value }; break;
      case 'gt': query[c.field] = { $gt: c.value }; break;
      case 'gte': query[c.field] = { $gte: c.value }; break;
      case 'lt': query[c.field] = { $lt: c.value }; break;
      case 'lte': query[c.field] = { $lte: c.value }; break;
      case 'exists': query[c.field] = { $exists: true }; break;
      case 'not_exists': query[c.field] = { $exists: false }; break;
      case 'in': query[c.field] = { $in: c.value }; break;
      case 'not_in': query[c.field] = { $nin: c.value }; break;
      case 'contains': query[c.field] = { $regex: c.value, $options: 'i' }; break;
    }
  }
  return query;
}

async function queryUsers(target: RuleTarget, limit: number) {
  const baseQuery = {
    role: target.role,
    platform: target.platform,
    ...buildMongoQuery(target.conditions),
  };
  return User.find(baseQuery).limit(limit).lean();
}
```

## resolveData

**What it does**: Transforms a raw user record into the variables available in Handlebars templates.

**When it's called**: Once per user, just before template rendering.

**Parameters**:

```typescript
(user: Record<string, unknown>) => Record<string, unknown>
```

| Param | Type | Description |
|-------|------|-------------|
| `user` | `Record<string, unknown>` | The user object returned by `queryUsers` |

**Expected return**: An object whose keys become Handlebars variables. Nest as needed — `user.name` becomes `{{user.name}}`.

**Example**:

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
      domain: 'example.com',
      supportEmail: 'help@example.com',
      bookingLink: 'https://example.com/book',
    },
    subscription: user.subscription || null,
  };
}
```

## sendEmail

**What it does**: Delivers the rendered email. You can send directly, queue for later, or save as a draft for approval.

**When it's called**: Once per user after template rendering, throttle checks, and agent selection.

**Parameters**:

```typescript
(params: SendEmailParams) => Promise<void>
```

| Field | Type | Description |
|-------|------|-------------|
| `identifierId` | `string` | Your internal email contact ID |
| `contactId` | `string` | Your internal contact ID |
| `accountId` | `string` | Selected sender account ID |
| `subject` | `string` | Rendered subject line |
| `htmlBody` | `string` | Rendered HTML from MJML |
| `textBody` | `string` | Rendered plain text fallback |
| `ruleId` | `string` | Rule that triggered this send |
| `autoApprove` | `boolean` | `true` = send now, `false` = save as draft |

**Example — Nodemailer direct send**:

```typescript
import nodemailer from 'nodemailer';
import { SendEmailParams } from '@astralibx/email-rule-engine';

const transporter = nodemailer.createTransport({
  host: 'smtp.example.com',
  port: 587,
  auth: { user: 'user', pass: 'pass' },
});

async function sendEmail(params: SendEmailParams) {
  await transporter.sendMail({
    from: `Sender <noreply@example.com>`,
    to: params.identifierId,
    subject: params.subject,
    html: params.htmlBody,
    text: params.textBody,
  });
}
```

**Example — AWS SES**:

```typescript
import { SESClient, SendEmailCommand } from '@aws-sdk/client-ses';
import { SendEmailParams } from '@astralibx/email-rule-engine';

const ses = new SESClient({ region: 'ap-south-1' });

async function sendEmail(params: SendEmailParams) {
  await ses.send(new SendEmailCommand({
    Source: 'noreply@example.com',
    Destination: { ToAddresses: [params.identifierId] },
    Message: {
      Subject: { Data: params.subject },
      Body: {
        Html: { Data: params.htmlBody },
        Text: { Data: params.textBody },
      },
    },
  }));
}
```

**Example — BullMQ queue**:

```typescript
import { Queue } from 'bullmq';
import { SendEmailParams } from '@astralibx/email-rule-engine';

const emailQueue = new Queue('email-delivery', { connection: redis });

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

**What it does**: Picks which sending account to use for a given recipient.

**When it's called**: Once per user, after throttle checks pass.

**Parameters**:

```typescript
(identifierId: string) => Promise<{ accountId: string } | null>
```

| Param | Type | Description |
|-------|------|-------------|
| `identifierId` | `string` | The recipient's email contact ID |

**Expected return**: `{ accountId: string }` to proceed, or `null` to skip this recipient.

See [account-rotation.md](account-rotation.md) for rotation and quota patterns.

**Example**:

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

**What it does**: Maps a user's email address to your contact/identifier system. This decouples the engine's send tracking from your user model.

**When it's called**: Once per unique email address per rule execution (batched before the user loop).

**Parameters**:

```typescript
(email: string) => Promise<{ id: string; contactId: string } | null>
```

| Param | Type | Description |
|-------|------|-------------|
| `email` | `string` | Lowercase, trimmed email address |

**Expected return**: `{ id, contactId }` if the email exists in your system, or `null` to skip.

See [email-validation.md](email-validation.md) for adding MX validation in this adapter.

**Example**:

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

**What it does**: Sends a test email for template previewing via the `POST /templates/:id/test-email` endpoint.

**When it's called**: Only when a user triggers a test email from the API.

**Parameters**:

```typescript
(to: string, subject: string, html: string, text: string) => Promise<void>
```

**Example**:

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
