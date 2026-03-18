# Adapters

Adapters are the bridge between the engine and your application. You provide functions that handle user querying, data resolution, email delivery, account selection, and contact mapping.

## queryUsers

Finds users matching a rule's targeting conditions. Called once per rule at the start of execution.

```typescript
(target: RuleTarget, limit: number, context?: { collectionSchema?: CollectionSchema }) => Promise<Record<string, unknown>[]>
```

- `target` contains `role` (audience), `platform`, `conditions[]` array, and optionally `collectionName` (the selected collection name)
- `limit` comes from `rule.maxPerRun` or `config.options.defaultMaxPerRun`
- Each returned object **must** have `_id` and `email` fields

> **Important: Your adapter is responsible for applying ALL conditions.** The engine passes the full `target` object — including `role`, `platform`, and every condition in `conditions[]` — but does NOT filter recipients itself. If your adapter ignores conditions, rule authors can add conditions in the UI that silently do nothing. Always apply `target.conditions` to your database query using the operator mapping below.

### How conditions work

Each condition has three fields:

| Field | Type | Example |
|-------|------|---------|
| `field` | string | `"city"`, `"age"`, `"registeredAt"`, `"subscription.plan"` |
| `operator` | string | `"eq"`, `"neq"`, `"gt"`, `"contains"`, `"in"`, etc. |
| `value` | unknown | `"Mumbai"`, `25`, `["gold","silver"]` |

The `field` is a property name on your user/contact documents. It can be any field — the engine imposes no restrictions. The operator must be one of the supported values (see constants). Your adapter maps these to your database's query language.

### Supported operators

| Operator | Meaning | MongoDB equivalent |
|----------|---------|-------------------|
| `eq` | Equals | `{ field: value }` |
| `neq` | Not equals | `{ field: { $ne: value } }` |
| `gt` | Greater than | `{ field: { $gt: value } }` |
| `gte` | Greater than or equal | `{ field: { $gte: value } }` |
| `lt` | Less than | `{ field: { $lt: value } }` |
| `lte` | Less than or equal | `{ field: { $lte: value } }` |
| `contains` | String contains (case-insensitive) | `{ field: { $regex: value, $options: 'i' } }` |
| `in` | Value in array | `{ field: { $in: value } }` |
| `not_in` | Value not in array | `{ field: { $nin: value } }` |
| `exists` | Field exists | `{ field: { $exists: true } }` |
| `not_exists` | Field does not exist | `{ field: { $exists: false } }` |

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

async function queryUsers(target: RuleTarget, limit: number, context?: { collectionSchema?: CollectionSchema }) {
  // context.collectionSchema is available when the rule targets a registered collection
  return User.find({
    role: target.role,
    platform: target.platform,
    ...buildMongoQuery(target.conditions),
  }).limit(limit).lean();
}
```

### Collection context

When a rule has a `collectionName` selected, the third argument contains the full `CollectionSchema` object. You can use this to auto-cast values (e.g., parse date strings), validate field paths, or build more intelligent queries. Existing adapters that ignore the third argument continue to work unchanged.

### Common mistakes

1. **Ignoring conditions** — If your adapter only reads `target.role` and `target.platform` but doesn't apply `target.conditions`, any conditions added in the rule editor UI will be silently ignored. Always spread conditions into your query.

2. **Hardcoding field names** — Conditions use the field names from your user documents. If your schema has `location.city` but a rule condition has `city`, it won't match. Document your available fields for rule authors or validate field names in the adapter.

3. **Not handling list mode** — When `target.mode === 'list'`, there are no conditions. Instead `target.identifiers` contains email addresses. Your adapter should handle both modes:

```typescript
async function queryUsers(target: RuleTarget, limit: number) {
  if ('identifiers' in target && target.identifiers) {
    // List mode — return users matching these emails
    return User.find({ email: { $in: target.identifiers } }).limit(limit).lean();
  }
  // Query mode — apply role + platform + conditions
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
| `attachments` | `Array<{ filename, url, contentType }>` | Optional. URL-based file attachments from the template. |

Attachments are URL references -- the sending service fetches the file at send time. Add attachment URLs in the template editor (filename + public/signed URL + MIME type). If a template has no attachments, this field is an empty array.

**Nodemailer example:**

```typescript
async function sendEmail(params: SendEmailParams) {
  await transporter.sendMail({
    from: 'noreply@example.com',
    to: params.identifierId,
    subject: params.subject,
    html: params.htmlBody,
    text: params.textBody,
    attachments: (params.attachments || []).map(a => ({
      filename: a.filename,
      path: a.url,
      contentType: a.contentType,
    })),
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
    attachments: params.attachments || [],
    accountId: params.accountId,
  }, {
    attempts: 3,
    backoff: { type: 'exponential', delay: 5000 },
  });
}
```

## selectAgent

Picks which sending account to use for a given recipient. Return `null` to skip the recipient. The returned object must include `accountId`, `email`, and `metadata` -- these are used for sender identification and are available in the `beforeSend` hook.

```typescript
(identifierId: string, context?: { ruleId: string; templateId: string }) => Promise<AgentSelection | null>
// AgentSelection = { accountId: string; email: string; metadata: Record<string, unknown> }
```

The optional `context` parameter provides `ruleId` and `templateId` for the current send. This is useful for account-to-template mapping -- for example, sending job-related templates from a recruitment account and marketing templates from a different sender.

**Basic example (round-robin by send count):**

```typescript
async function selectAgent(identifierId: string) {
  const account = await EmailAccount.findOne({
    isActive: true,
    dailySentCount: { $lt: 450 },
  }).sort({ dailySentCount: 1 });

  if (!account) return null;
  return {
    accountId: account._id.toString(),
    email: account.email,
    metadata: account.metadata || {},
  };
}
```

**Template-aware example (using `context.templateId`):**

```typescript
async function selectAgent(identifierId: string, context?: { ruleId: string; templateId: string }) {
  // Use templateId to pick the right account for this template
  const mapping = await AccountTemplateMapping.findOne({ templateId: context?.templateId });
  const account = mapping
    ? await EmailAccount.findById(mapping.accountId)
    : await EmailAccount.findOne({ status: 'active' });

  if (!account) return null;
  return {
    accountId: account._id.toString(),
    email: account.email,
    metadata: account.metadata || {},
  };
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
