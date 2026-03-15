# Templates

Templates combine [MJML](https://mjml.io/) for responsive HTML email rendering with [Handlebars](https://handlebarsjs.com/) for dynamic variable insertion.

## Template Fields

| Field | Type | Required | Description |
|-------|------|----------|-------------|
| `name` | `string` | Yes | Display name (e.g., "Welcome Email") |
| `slug` | `string` | Yes | Unique identifier (auto-generated from name if omitted) |
| `description` | `string` | No | Internal notes |
| `category` | `TemplateCategory` | Yes | `'onboarding'`, `'engagement'`, `'transactional'`, `'re-engagement'`, `'announcement'` |
| `audience` | `TemplateAudience` | Yes | `'customer'`, `'provider'`, `'all'` |
| `platform` | `string` | Yes | Must match one of the configured `platforms` |
| `subjects` | `string[]` | Yes | Handlebars subject lines (supports multiple for A/B variants) |
| `bodies` | `string[]` | Yes | MJML + Handlebars bodies (supports multiple for A/B variants) |
| `textBody` | `string` | No | Plain text override (auto-generated from HTML if omitted) |
| `variables` | `string[]` | Auto | Extracted Handlebars variables (computed on save) |
| `version` | `number` | Auto | Increments on content updates |
| `preheaders` | `string[]` | No | Preheader text variants (supports multiple for A/B variants, Handlebars variables) |
| `fields` | `Record<string, string>` | No | Custom placeholder key-value pairs (see below) |
| `isActive` | `boolean` | Auto | Defaults to `true` |

## Custom Fields

Templates can include a `fields` object -- a key-value dictionary of custom placeholder values that are merged into the render context as defaults.

Merge order:

1. `template.fields` -- base defaults defined on the template
2. `resolveData` result -- candidate-specific data overrides matching keys from step 1
3. `beforeSend` hook -- account-level overrides applied last

On key conflicts, later stages win. This lets you set template-wide defaults that individual candidates or accounts can override.

```typescript
{
  name: 'Job Offer',
  slug: 'job-offer',
  category: 'engagement',
  audience: 'customer',
  platform: 'web',
  subjects: ['Exciting opportunity at {{company}}'],
  bodies: ['<mj-text>Hi {{user.name}}, check out the role in {{location}}. Salary: {{salary}}. Chat: {{whatsapp_link}}</mj-text>'],
  fields: {
    whatsapp_link: 'https://wa.me/919876543210',
    salary: '12 LPA',
    location: 'Bangalore',
  },
}
```

In this example, `whatsapp_link`, `salary`, and `location` are available as Handlebars variables. If `resolveData` returns a `salary` for a specific candidate, that value takes precedence over the template default.

## MJML + Handlebars

Templates use MJML for responsive layout and Handlebars for dynamic content. If the body does **not** start with `<mjml`, the engine wraps it in a default MJML structure automatically -- convenient for simple text-only emails.

```handlebars
<mjml>
  <mj-body>
    <mj-section>
      <mj-column>
        <mj-text font-size="20px">Hi {{user.name}},</mj-text>
        <mj-text>
          Your <strong>{{subscription.planName}}</strong> plan renews on
          {{formatDate subscription.renewalDate}}.
          Amount: {{currency subscription.amount}}
        </mj-text>
        {{#if subscription.sessionsRemaining}}
        <mj-text>
          You have {{subscription.sessionsRemaining}}
          {{pluralize subscription.sessionsRemaining "session" "sessions"}} remaining.
        </mj-text>
        {{/if}}
        <mj-button href="{{platform.accountLink}}">Manage Subscription</mj-button>
      </mj-column>
    </mj-section>
  </mj-body>
</mjml>
```

## Built-in Handlebars Helpers

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
| `gt` / `lt` | `{{#if (gt count 5)}}` | Greater / less than |
| `gte` / `lte` | `{{#if (gte score 80)}}` | Greater / less than or equal |
| `not` | `{{#if (not isBlocked)}}` | Boolean negation |

## Template Validation

The engine validates both Handlebars syntax and MJML structure. Use the validate endpoint or `TemplateRenderService.validateTemplate()` to check before saving.

Validation endpoint:

```
POST /templates/validate
```

Programmatic validation:

```typescript
const result = await engine.templateService.validate('<mj-text>{{user.name}}</mj-text>');
// { valid: true, errors: [], variables: ['user.name'] }
```

## A/B Variants

Templates support multiple subjects and bodies for content variety. When a template has more than one subject or body, the engine randomly selects one per user using `Math.random()`.

### How it works

- Each template has `subjects[]` and `bodies[]` arrays
- For each recipient, the engine picks a random `subjectIndex` and `bodyIndex`
- The selected indices are logged in the `EmailRuleSend` record for tracking and analysis
- Single-element arrays work identically to non-variant templates -- no special handling needed

### Example

```typescript
{
  name: 'Welcome Email',
  slug: 'welcome-email',
  category: 'onboarding',
  audience: 'customer',
  platform: 'web',
  subjects: [
    'Welcome to {{platform.name}}, {{user.name}}!',
    'Hey {{user.name}}, glad to have you on {{platform.name}}!',
    '{{user.name}}, your {{platform.name}} account is ready',
  ],
  bodies: [
    '<mj-text>Hi {{user.name}}, welcome aboard!</mj-text>',
    '<mj-text>Great to see you here, {{user.name}}. Let us get started.</mj-text>',
  ],
}
```

In this example, each user receives one of 3 subject lines and one of 2 body variants, selected independently at random. The `EmailRuleSend` record stores:

- `subjectIndex` -- which subject was used (0, 1, or 2)
- `bodyIndex` -- which body was used (0 or 1)

This data can be queried to compare open/click rates across variants.

## Preheader Text

Preheaders are the short summary text that appears after the subject line in email inbox listings. They give recipients a preview of the email content before opening.

### How to use

Add a `preheaders` array to your template. Like subjects and bodies, preheaders support multiple variants -- the engine randomly selects one per user using `Math.random()`.

- Each entry is a Handlebars string, so dynamic variables like `{{user.name}}` work
- For each recipient, the engine picks a random `preheaderIndex`
- The selected preheader is injected as a hidden `<div>` at the beginning of the HTML body:
  ```html
  <div style="display:none;font-size:1px;color:#ffffff;line-height:1px;max-height:0px;max-width:0px;opacity:0;overflow:hidden;">Your preheader text</div>
  ```
- The `preheaderIndex` is logged in the `EmailRuleSend` record alongside `subjectIndex` and `bodyIndex`
- Preheaders are entirely optional -- templates without a `preheaders` field (or with an empty array) work as before, with no hidden div injected

### Example

```typescript
{
  name: 'Welcome Email',
  slug: 'welcome-email',
  category: 'onboarding',
  audience: 'customer',
  platform: 'web',
  subjects: [
    'Welcome to {{platform.name}}, {{user.name}}!',
    'Hey {{user.name}}, glad to have you on {{platform.name}}!',
  ],
  bodies: [
    '<mj-text>Hi {{user.name}}, welcome aboard!</mj-text>',
  ],
  preheaders: [
    'Your account is ready -- let us get started!',
    'Welcome aboard, {{user.name}}. Here is what to do next.',
    'You are all set on {{platform.name}}!',
  ],
}
```

In this example, each user receives one of 2 subject lines, 1 body, and one of 3 preheader variants, all selected independently at random.
