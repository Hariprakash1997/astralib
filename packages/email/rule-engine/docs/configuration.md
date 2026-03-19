# Configuration

## EmailRuleEngineConfig

Extends the core `RuleEngineConfig` but replaces `adapters.send` with `adapters.sendEmail`. All other config sections (`db`, `redis`, `collections`, `platforms`, `audiences`, `categories`, `options`, `hooks`, `logger`) are identical to the core — see the [core adapters doc](https://github.com/Hariprakash1997/astralib/blob/main/packages/rule-engine/core/docs/adapters.md) for full details.

```typescript
interface EmailRuleEngineConfig extends Omit<RuleEngineConfig, 'adapters'> {
  adapters: Omit<RuleEngineConfig['adapters'], 'send' | 'sendTest'> & {
    sendEmail: (params: EmailSendParams) => Promise<void>;
    sendTestEmail?: (to: string, subject: string, html: string, text: string, attachments?: Array<{ filename: string; url: string; contentType: string }>) => Promise<void>;
  };
}
```

The remaining adapters (`queryUsers`, `resolveData`, `selectAgent`, `findIdentifier`) are inherited from the core config unchanged.

## EmailSendParams

Your `sendEmail` adapter receives these fields:

| Field | Type | Description |
|-------|------|-------------|
| `identifierId` | `string` | The recipient's tracked identifier ID |
| `contactId` | `string` | The recipient's contact ID |
| `accountId` | `string` | The sending account ID (from `selectAgent`) |
| `subject` | `string` | Rendered subject line (Handlebars applied) |
| `htmlBody` | `string` | MJML-rendered HTML ready for the email client |
| `textBody` | `string` | Plain text auto-generated from the rendered HTML |
| `ruleId` | `string` | ID of the rule that triggered the send |
| `autoApprove` | `boolean` | Whether to auto-approve or queue for manual approval |
| `attachments` | `Array?` | File attachments from the template (if any) |

## How It Works

The wrapper converts your `sendEmail` adapter into the core's generic `send`:

1. Template body (MJML fragment) is auto-wrapped in a full MJML document structure and compiled to HTML via `mjml`
2. Rendered HTML is converted to plain text via `html-to-text`, producing `textBody`
3. Handlebars is applied to the subject line with `currency` and `formatDate` helpers registered
4. Your `sendEmail` is called with `{ htmlBody, textBody, subject, identifierId, contactId, accountId, ruleId, autoApprove, attachments }`

### Email-Specific Handlebars Helpers

| Helper | Usage | Output |
|--------|-------|--------|
| `currency` | `{{currency amount}}` | `₹1,234` (INR format) |
| `formatDate` | `{{formatDate date}}` | `19 Mar 2026` (en-IN locale) |

All standard Handlebars helpers (`{{#if}}`, `{{#each}}`, `{{var}}`) work as in the core.
