# Email Dashboard

The `<alx-email-dashboard>` component provides a complete email management interface with zero configuration. It extends the shared rule engine dashboard from `@astralibx/rule-engine-ui`, adding email-specific tabs (Accounts, Analytics) and wiring the MJML body editor into the template editor slot.

## How It Extends the Shared Dashboard

The rule engine dashboard (from `@astralibx/rule-engine-ui`) provides these tabs out of the box:
- **Templates** -- template list and editor (`<alx-template-list>`, `<alx-template-editor>`)
- **Rules** -- rule list and editor (`<alx-rule-list>`, `<alx-rule-editor>`)
- **Run History** -- execution logs and send log (`<alx-run-history>`, `<alx-send-log>`)
- **Settings** -- throttle settings and guide panel (`<alx-throttle-settings>`, `<alx-guide-panel>`)

`<alx-email-dashboard>` extends this with:
- **Accounts tab** -- account management (`<alx-account-list>`, `<alx-account-form>`, `<alx-account-health>`, `<alx-account-warmup>`, `<alx-smtp-tester>`, `<alx-approval-queue>`, `<alx-global-settings>`)
- **Analytics tab** -- email analytics (`<alx-analytics-overview>`, `<alx-analytics-timeline>`, `<alx-analytics-channels>`, `<alx-analytics-variants>`)
- **MJML editor slot** -- the template editor body slot is filled with `<alx-email-body-editor>` for MJML + Handlebars editing with live preview

## Usage

```html
<alx-email-dashboard></alx-email-dashboard>
```

That's it. The dashboard includes:
- **Tab navigation** between Accounts, Templates, Rules, Run History, Analytics, Settings
- **Drawer-based editing** for accounts, templates, and rules
- **Density toggle** (Default / Compact)
- **Hash routing** for bookmarkable URLs
- **All event wiring** -- save, delete, cancel, create flows handled internally

## Attributes

| Attribute | Type | Default | Description |
|-----------|------|---------|-------------|
| `density` | `"default" \| "compact"` | `"default"` | Display density |
| `default-tab` | String | `"accounts"` | Initial tab |
| `hide-tabs` | String | `""` | Comma-separated tabs to hide: `accounts`, `templates`, `rules`, `runs`, `analytics`, `settings` |
| `theme` | `"light" \| "dark"` | `"light"` | Color theme |

### Built-in Theme Toggle

The dashboard includes Light/Dark toggle buttons in the header controls. Users can switch at runtime. To set the default:

```html
<!-- Start in dark mode -->
<alx-email-dashboard theme="dark"></alx-email-dashboard>

<!-- Dark + compact -->
<alx-email-dashboard theme="dark" density="compact"></alx-email-dashboard>
```

Programmatic toggle:
```javascript
document.querySelector('alx-email-dashboard').theme = 'dark';
```

## Hash Routing

The dashboard updates `window.location.hash` when tabs change:

| Hash | View |
|------|------|
| `#accounts` | Account list |
| `#templates` | Template list |
| `#rules` | Rule list |
| `#runs` | Run history |
| `#analytics` | Overview + Timeline + Channel breakdown + Variant performance |
| `#settings` | Throttle + General settings side by side |

This enables:
- Browser back/forward navigation between tabs
- Bookmarkable tab URLs
- No conflict with host app's router (hash-only, no path changes)

## Theming

Apply CSS custom properties on the element:

```css
alx-email-dashboard {
  --alx-primary: #2563eb;
  --alx-danger: #dc2626;
  --alx-success: #16a34a;
  --alx-warning: #d97706;
  --alx-info: #0ea5e9;
  --alx-bg: #f8fafc;
  --alx-surface: #ffffff;
  --alx-border: #e2e8f0;
  --alx-text: #0f172a;
  --alx-text-muted: #64748b;
}
```

The dashboard handles theme switching internally — consumers only need to set the initial theme via the `theme` attribute. The CSS variables on the element serve as the light theme defaults; the dashboard overrides them inline when dark mode is active.

See [Theming](https://github.com/Hariprakash1997/astralib/blob/main/packages/email/ui/docs/theming.md) for the full list of CSS custom properties.

## Examples

### Hide certain tabs

```html
<alx-email-dashboard hide-tabs="analytics,settings"></alx-email-dashboard>
```

### Start on rules tab in compact mode

```html
<alx-email-dashboard default-tab="rules" density="compact"></alx-email-dashboard>
```

### Framework integration

**React:**
```jsx
function EmailAdmin() {
  return <alx-email-dashboard density="compact" />;
}
```

**Vue:**
```vue
<template>
  <alx-email-dashboard density="compact" />
</template>
```

**Angular:**
```html
<alx-email-dashboard [attr.density]="'compact'"></alx-email-dashboard>
```

## Internal Architecture

The dashboard internally renders and wires:

**From `@astralibx/rule-engine-ui` (shared):**
- `<alx-template-list>` + `<alx-template-editor>` with `<alx-email-body-editor>` in the body slot
- `<alx-rule-list>` + `<alx-rule-editor>` (in drawer)
- `<alx-run-history>` + `<alx-send-log>` (send logs appear under Run History tab)
- `<alx-throttle-settings>` + `<alx-guide-panel>`

**Email-specific (this package):**
- `<alx-account-list>` + `<alx-account-form>` (in drawer)
- `<alx-analytics-overview>` + `<alx-analytics-timeline>` + `<alx-analytics-channels>` + `<alx-analytics-variants>`
- `<alx-global-settings>`
- `<alx-drawer>` for edit flows

The `<alx-email-body-editor>` component fills the template editor's body slot, providing MJML + Handlebars editing with live preview. This is the primary email-specific extension point over the shared rule engine dashboard.

All events (selected, create, saved, deleted, cancelled) are handled internally. The dashboard refreshes the relevant list after save/delete operations.

## When NOT to Use

Use individual components instead when you need:
- Custom tab order or layout
- Different components per view (e.g., only accounts + rules, no analytics)
- Integration with your own drawer/modal system
- Custom event handling beyond the standard flows

See [Quick Start -- Advanced: Custom Layout](https://github.com/Hariprakash1997/astralib/blob/main/packages/email/ui/docs/quick-start.md) for individual component usage.
