# Quick Start

Get up and running with @astralibx/email-ui in 5 minutes.

> **Shared components:** Rule engine components (templates, rules, run history, throttle settings) come from `@astralibx/rule-engine-ui`. The email dashboard extends the shared rule engine dashboard, adding Accounts and Analytics tabs. See the [rule-engine-ui README](https://github.com/Hariprakash1997/astralib/blob/main/packages/rule-engine/ui/README.md) for shared component setup.

## Install

```bash
npm install @astralibx/email-ui
```

## Configure

```typescript
import { AlxConfig } from '@astralibx/email-ui';

AlxConfig.setup({
  accountManagerApi: 'https://your-api.com/mailer/eam',
  analyticsApi: 'https://your-api.com/mailer/analytics',
  authToken: 'your-auth-token',
});
```

> **Important:** Call `AlxConfig.setup()` before importing any components. Components read the config on registration.

Rule engine components are configured separately via `@astralibx/rule-engine-ui` (see shared package docs for `ruleEngineApi` and `RuleEngineAPI` setup).

## Import Components

```typescript
// Import everything (tree-shakeable)
import '@astralibx/email-ui';

// Or import specific components
import '@astralibx/email-ui/components/account';
```

## The Email Pipeline

@astralibx/email-ui manages a 4-step email automation pipeline:

```
Accounts → Templates → Rules → Runs
```

| Step | What It Does | Component |
|------|-------------|-----------|
| **1. Accounts** | Email sender accounts with SMTP credentials | `<alx-account-list>` + `<alx-account-form>` |
| **2. Templates** | Email content -- subjects, bodies, variables | `<alx-template-list>` + `<alx-template-editor>` (from `@astralibx/rule-engine-ui`, with `<alx-email-body-editor>` for MJML) |
| **3. Rules** | Connect templates to audiences -- who gets what, when | `<alx-rule-list>` + `<alx-rule-editor>` (from `@astralibx/rule-engine-ui`) |
| **4. Runs** | Execute rules, track results | `<alx-run-history>` (from `@astralibx/rule-engine-ui`) |

**Supporting components:** Analytics (overview, timeline, channel breakdown), Settings (throttle, IMAP, approval queue), Health monitoring, Warmup tracking.

## Minimal Setup (Recommended)

Use the all-in-one dashboard component -- zero wiring needed:

```html
<alx-email-dashboard></alx-email-dashboard>
```

This gives you the full email management UI: accounts, templates, rules, run history, analytics, and settings -- with drawer-based editing, tab navigation, and density toggle built in.

The template editor slot is automatically filled with `<alx-email-body-editor>` for MJML + Handlebars editing with live preview.

### Dashboard Attributes

| Attribute | Type | Default | Description |
|-----------|------|---------|-------------|
| `density` | `"default" \| "compact"` | `"default"` | Display density for all child components |
| `default-tab` | String | `"accounts"` | Tab shown on initial load |
| `hide-tabs` | String | `""` | Comma-separated tab IDs to hide (e.g., `"analytics,settings"`) |
| `theme` | `"light" \| "dark"` | `"light"` | Color theme (includes built-in toggle) |

### Hash Routing

The dashboard uses hash-based URLs that don't conflict with your app's router:

```
/your-page#accounts    → Account list
/your-page#templates   → Template list
/your-page#rules       → Rule list
/your-page#runs        → Run history
/your-page#analytics   → Analytics
/your-page#settings    → Settings
```

### Theming

Apply theme variables on the dashboard element:

```css
alx-email-dashboard {
  --alx-primary: #2563eb;
  --alx-bg: #f8fafc;
  --alx-surface: #ffffff;
  --alx-border: #e2e8f0;
  --alx-text: #0f172a;
  --alx-text-muted: #64748b;
}
```

### Full Example

```html
<!DOCTYPE html>
<html>
<head>
  <style>
    alx-email-dashboard {
      --alx-primary: #2563eb;
      --alx-bg: #f8fafc;
      --alx-surface: #ffffff;
    }
  </style>
</head>
<body>
  <alx-email-dashboard density="default" default-tab="accounts" theme="light"></alx-email-dashboard>

  <script type="module">
    import { AlxConfig } from '@astralibx/email-ui';

    AlxConfig.setup({
      accountManagerApi: 'https://your-api.com/mailer/eam',
      analyticsApi: 'https://your-api.com/mailer/analytics',
      authToken: 'your-token',
    });

    import '@astralibx/email-ui';
  </script>
</body>
</html>
```

## Advanced: Custom Layout

If you need a custom layout (different tab arrangement, custom wiring), use individual components instead of the dashboard:

```html
<!-- Account management (email-specific) -->
<alx-account-list></alx-account-list>

<!-- Template management (from @astralibx/rule-engine-ui) -->
<alx-template-list></alx-template-list>

<!-- Rule management (from @astralibx/rule-engine-ui) -->
<alx-rule-list></alx-rule-list>

<!-- Run history (from @astralibx/rule-engine-ui) -->
<alx-run-history></alx-run-history>
```

## Edit Flow: The Drawer Pattern

List components emit events when users click edit. Your app catches these events and opens the editor -- typically in a slide-in drawer:

```html
<alx-drawer id="drawer">
  <alx-account-form id="form" hide-header></alx-account-form>
</alx-drawer>

<script>
  const drawer = document.getElementById('drawer');
  const form = document.getElementById('form');

  // Open drawer on edit click
  document.addEventListener('alx-account-selected', (e) => {
    form.setAttribute('account-id', e.detail._id);
    drawer.heading = 'Edit Account';
    drawer.open = true;
  });

  // Open drawer for create
  document.addEventListener('alx-account-create', () => {
    form.removeAttribute('account-id');
    drawer.heading = 'Create Account';
    drawer.open = true;
  });

  // Close drawer after save/delete
  document.addEventListener('alx-account-saved', () => {
    drawer.open = false;
    document.querySelector('alx-account-list').load();
  });
</script>
```

### Drawer Component

| Attribute | Type | Description |
|-----------|------|-------------|
| `open` | Boolean | Show/hide the drawer |
| `heading` | String | Title shown in the drawer header |

| Event | Description |
|-------|-------------|
| `alx-drawer-closed` | Emitted when drawer is closed (backdrop click, Escape, or close button) |

### Form `hide-header` Attribute

When editors are inside a drawer, add `hide-header` to avoid duplicate headings:

```html
<alx-drawer heading="Edit Account">
  <alx-account-form hide-header account-id="123"></alx-account-form>
</alx-drawer>
```

## Theming

Components ship with light and dark themes. Apply via CSS custom properties:

```css
alx-account-list {
  --alx-primary: #2563eb;
  --alx-bg: #f8fafc;
  --alx-surface: #ffffff;
  --alx-border: #e2e8f0;
  --alx-text: #0f172a;
  --alx-text-muted: #64748b;
}
```

### Density Mode

All components support a compact density mode:

```html
<alx-account-list density="compact"></alx-account-list>
```

## Shared Styles

If building custom components that match the library's design, import shared style modules:

```typescript
import {
  alxButtonStyles, alxInputStyles, alxTableStyles,
  alxCardStyles, alxBadgeStyles, alxToolbarStyles,
  alxToggleStyles, alxProgressBarStyles
} from '@astralibx/email-ui';
```

## Exported Types

TypeScript types for working with the library's data models:

```typescript
import type { TemplateData, RuleData, Condition, Settings } from '@astralibx/email-ui';
```

## Next Steps

- [Configuration](https://github.com/Hariprakash1997/astralib/blob/main/packages/email/ui/docs/configuration.md) -- API setup details
- [Account Components](https://github.com/Hariprakash1997/astralib/blob/main/packages/email/ui/docs/account-components.md) -- Full account component API
- [Rule Engine Components](https://github.com/Hariprakash1997/astralib/blob/main/packages/rule-engine/ui/README.md) -- Shared templates, rules, run history, throttle components
- [Events](https://github.com/Hariprakash1997/astralib/blob/main/packages/email/ui/docs/events.md) -- All events reference
- [Theming](https://github.com/Hariprakash1997/astralib/blob/main/packages/email/ui/docs/theming.md) -- Design tokens and customization
- [Framework Integration](https://github.com/Hariprakash1997/astralib/blob/main/packages/email/ui/docs/framework-integration.md) -- Angular, React, Vue, Next.js examples
