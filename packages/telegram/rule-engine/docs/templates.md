# Templates

Templates define Telegram messages using [Handlebars](https://handlebarsjs.com/) for dynamic variable insertion, with support for multiple message variants and media attachments.

## Template Fields

| Field | Type | Required | Description |
|-------|------|----------|-------------|
| `name` | `string` | Yes | Display name (e.g., "Welcome Message") |
| `messages` | `string[]` | Yes | Handlebars message text variants (at least one required) |
| `variables` | `string[]` | Auto | Extracted Handlebars variables (computed on save if omitted) |
| `category` | `string` | No | Custom values via `categories` config |
| `platform` | `string` | No | Must match one of the configured `platforms` |
| `audience` | `string` | No | Custom values via `audiences` config |
| `media` | `object` | No | Media attachment (see below) |
| `fields` | `Record<string, string>` | No | Custom placeholder key-value pairs (see below) |

## Message Variants

Templates support multiple messages for content variety. When a template has more than one message, the engine randomly selects one per user using `Math.random()`.

### How it works

- Each template has a `messages[]` array with one or more Handlebars strings
- For each recipient, the engine picks a random `messageIndex`
- The selected index is logged in the send log record for tracking
- Single-element arrays work identically to non-variant templates

### Example

```typescript
{
  name: 'Welcome Message',
  messages: [
    'Hi {{user.name}}, welcome to {{platform.name}}!',
    'Hey {{user.name}}! Glad to have you on {{platform.name}}.',
    '{{user.name}}, your {{platform.name}} account is ready. Let us get started!',
  ],
  category: 'onboarding',
  audience: 'customer',
  platform: 'web',
}
```

Each user receives one of 3 message variants, selected at random. The send log stores the `messageIndex` for analysis.

## Handlebars Variables

Templates use Handlebars syntax (`{{variable}}`) for dynamic content. Variables are resolved from the data returned by your `resolveData` adapter.

```handlebars
Hi {{user.name}}, your subscription to {{subscription.planName}} expires on {{subscription.expiryDate}}.
```

### Variable Auto-Extraction

When `variables` is not provided in the create/update input, the engine automatically extracts variable names from all messages. For example, the message above would produce:

```json
["user.name", "subscription.planName", "subscription.expiryDate"]
```

## Custom Fields

Templates can include a `fields` object -- a key-value dictionary of custom placeholder values that are merged into the render context as defaults.

Merge order:

1. `template.fields` -- base defaults defined on the template
2. `resolveData` result -- candidate-specific data overrides matching keys from step 1
3. `beforeSend` hook -- account-level overrides applied last

On key conflicts, later stages win.

```typescript
{
  name: 'Job Alert',
  messages: ['Hi {{user.name}}, check out the role in {{location}}. Salary: {{salary}}. Contact: {{contact_number}}'],
  fields: {
    contact_number: '+919876543210',
    salary: '12 LPA',
    location: 'Bangalore',
  },
}
```

In this example, `contact_number`, `salary`, and `location` are available as Handlebars variables. If `resolveData` returns a `salary` for a specific candidate, that value takes precedence over the template default.

## Media Attachments

Templates can include a single media attachment sent alongside the message.

| Field | Type | Required | Description |
|-------|------|----------|-------------|
| `media.type` | string | Yes | One of: `'photo'`, `'video'`, `'voice'`, `'audio'`, `'document'` |
| `media.url` | string | Yes | URL of the media file |
| `media.caption` | string | No | Caption text (Handlebars supported) |

```typescript
{
  name: 'Product Launch',
  messages: ['Check out our new product, {{user.name}}!'],
  media: {
    type: 'photo',
    url: 'https://example.com/product-banner.jpg',
    caption: 'New arrivals at {{platform.name}}',
  },
}
```

The media object is passed through to the `sendMessage` adapter, which is responsible for actually sending it via the Telegram API.

## Preview

Preview rendering uses non-strict Handlebars mode -- missing variables render as empty strings instead of throwing errors. When no sample data is provided, the preview auto-generates placeholder values from the template's variables list (e.g., `{{name}}` renders as `[name]`).

```bash
# Via API
POST /templates/:id/preview
{ "sampleData": { "user": { "name": "John" }, "platform": { "name": "MyApp" } } }
```

## Template with Media -- Full Example

```typescript
{
  name: 'Weekly Digest',
  messages: [
    'Hi {{user.name}}, here is your weekly digest for {{platform.name}}:\n\n{{digest_summary}}\n\nTap to view more.',
    '{{user.name}}, your weekly update from {{platform.name}} is ready!\n\n{{digest_summary}}',
  ],
  category: 'engagement',
  audience: 'customer',
  platform: 'mobile',
  media: {
    type: 'photo',
    url: 'https://example.com/digest-header.jpg',
  },
  fields: {
    digest_summary: 'No new updates this week.',
  },
}
```
