# Templates — MJML + Handlebars Email Design

Templates define the content and layout of your automated emails. They combine [MJML](https://mjml.io/) for responsive HTML rendering with [Handlebars](https://handlebarsjs.com/) for dynamic variable insertion.

## What Templates Are

A template is a reusable email design stored in MongoDB. Each template has:

- A **subject line** (Handlebars only)
- A **body** (MJML + Handlebars)
- An optional **text body** (Handlebars only, auto-generated from HTML if omitted)
- Metadata: name, slug, category, audience, platform

Templates are linked to [rules](rules.md) which determine who receives them and when.

## MJML Basics

MJML is a markup language that compiles to responsive HTML email. It handles the notoriously difficult cross-client email rendering (Outlook, Gmail, Apple Mail, etc.).

**Basic structure**:

```html
<mjml>
  <mj-head>
    <mj-attributes>
      <mj-all font-family="Arial, sans-serif" />
    </mj-attributes>
  </mj-head>
  <mj-body background-color="#ffffff">
    <mj-section>
      <mj-column>
        <mj-text>Your content here</mj-text>
        <mj-button href="https://example.com">Click Me</mj-button>
        <mj-image src="https://example.com/logo.png" width="200px" />
      </mj-column>
    </mj-section>
  </mj-body>
</mjml>
```

If your body does **not** start with `<mjml`, the engine wraps it in a default MJML structure automatically. This is convenient for simple text-only emails.

## Handlebars Variable Syntax

Variables come from your `resolveData` adapter (see [adapters.md](adapters.md)).

```handlebars
Hello {{user.name}},

{{#if subscription}}
  Your {{subscription.planName}} plan includes {{subscription.sessions}} sessions.
{{else}}
  You're on the free plan.
{{/if}}

{{#each services}}
  - {{this.name}}: {{currency this.price}}
{{/each}}
```

## Built-in Helpers

| Helper | Usage | Output |
|--------|-------|--------|
| `currency` | `{{currency 1500}}` | `₹1,500` |
| `formatDate` | `{{formatDate date}}` | `13 Mar 2026` |
| `capitalize` | `{{capitalize "hello"}}` | `Hello` |
| `lowercase` | `{{lowercase "HELLO"}}` | `hello` |
| `uppercase` | `{{uppercase "hello"}}` | `HELLO` |
| `join` | `{{join items ", "}}` | `a, b, c` |
| `pluralize` | `{{pluralize count "item" "items"}}` | `items` (if count != 1) |
| `eq` | `{{#if (eq status "active")}}` | Equality check |
| `neq` | `{{#if (neq role "admin")}}` | Inequality check |
| `gt` / `lt` | `{{#if (gt count 5)}}` | Greater/less than |
| `gte` / `lte` | `{{#if (gte score 80)}}` | Greater/less than or equal |
| `not` | `{{#if (not isBlocked)}}` | Boolean negation |

## Template Fields

| Field | Type | Required | Description |
|-------|------|----------|-------------|
| `name` | `string` | Yes | Display name (e.g., "Welcome Email") |
| `slug` | `string` | Yes | Unique identifier (auto-generated if not provided) |
| `description` | `string` | No | Internal notes |
| `category` | `TemplateCategory` | Yes | `onboarding`, `engagement`, `transactional`, `re-engagement`, `announcement` |
| `audience` | `TemplateAudience` | Yes | `customer`, `provider`, `all` |
| `platform` | `string` | Yes | Must match one of configured `platforms` |
| `subject` | `string` | Yes | Handlebars subject line |
| `body` | `string` | Yes | MJML + Handlebars body |
| `textBody` | `string` | No | Plain text override (auto-generated from HTML if omitted) |
| `variables` | `string[]` | Auto | Extracted Handlebars variables |
| `version` | `number` | Auto | Increments on update |
| `isActive` | `boolean` | Auto | Default `true` |

## API Endpoints

| Method | Path | Description |
|--------|------|-------------|
| `GET` | `/templates` | List all (filter by `category`, `audience`, `platform`, `isActive`) |
| `POST` | `/templates` | Create new template |
| `GET` | `/templates/:id` | Get by ID |
| `PUT` | `/templates/:id` | Update template |
| `DELETE` | `/templates/:id` | Delete template |
| `PATCH` | `/templates/:id/toggle` | Toggle active/inactive |
| `POST` | `/templates/:id/preview` | Render with sample data |
| `POST` | `/templates/:id/test-email` | Send test email |
| `POST` | `/templates/validate` | Validate MJML + Handlebars syntax |
| `POST` | `/templates/preview` | Preview raw template without saving |

**Create example**:

```bash
curl -X POST http://localhost:3000/api/email-rules/templates \
  -H "Content-Type: application/json" \
  -d '{
    "name": "Welcome Email",
    "slug": "welcome-email",
    "category": "onboarding",
    "audience": "customer",
    "platform": "web",
    "subject": "Welcome to {{platform.name}}, {{user.name}}!",
    "body": "<mjml><mj-body><mj-section><mj-column><mj-text>Hi {{user.name}}, welcome aboard!</mj-text><mj-button href=\"{{platform.bookingLink}}\">Get Started</mj-button></mj-column></mj-section></mj-body></mjml>"
  }'
```

**Preview example**:

```bash
curl -X POST http://localhost:3000/api/email-rules/templates/preview \
  -H "Content-Type: application/json" \
  -d '{
    "subject": "Hello {{user.name}}",
    "body": "<mj-text>Welcome, {{user.name}}!</mj-text>",
    "sampleData": {
      "user": { "name": "John" }
    }
  }'
```

## Example Template

```typescript
{
  name: "Subscription Renewal Reminder",
  slug: "subscription-renewal-reminder",
  category: "engagement",
  audience: "customer",
  platform: "web",
  subject: "{{user.name}}, your {{subscription.planName}} plan renews in {{subscription.daysLeft}} days",
  body: `<mjml>
  <mj-body>
    <mj-section background-color="#f8f9fa">
      <mj-column>
        <mj-image src="{{platform.logoUrl}}" width="150px" />
      </mj-column>
    </mj-section>
    <mj-section>
      <mj-column>
        <mj-text font-size="20px" font-weight="bold">
          Hi {{user.name}},
        </mj-text>
        <mj-text>
          Your <strong>{{subscription.planName}}</strong> plan renews on
          {{formatDate subscription.renewalDate}}.
        </mj-text>
        <mj-text>
          Amount: {{currency subscription.amount}}
        </mj-text>
        {{#if subscription.sessionsRemaining}}
        <mj-text>
          You have {{subscription.sessionsRemaining}}
          {{pluralize subscription.sessionsRemaining "session" "sessions"}} remaining.
        </mj-text>
        {{/if}}
        <mj-button href="{{platform.accountLink}}">
          Manage Subscription
        </mj-button>
      </mj-column>
    </mj-section>
  </mj-body>
</mjml>`
}
```
