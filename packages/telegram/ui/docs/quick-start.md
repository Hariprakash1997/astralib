# Quick Start

Get up and running with @astralibx/telegram-ui in 5 minutes.

## Install

```bash
npm install @astralibx/telegram-ui
```

## Configure

```typescript
import { AlxTelegramConfig } from '@astralibx/telegram-ui';

AlxTelegramConfig.setup({
  accountManagerApi: 'https://your-api.com/telegram/accounts',
  ruleEngineApi: 'https://your-api.com/telegram/rules',
  inboxApi: 'https://your-api.com/telegram/inbox',
  botApi: 'https://your-api.com/telegram/bot',
  authToken: 'your-auth-token',
});
```

> **Important:** Call `AlxTelegramConfig.setup()` before importing any components. Components read the config on registration.

## Import Components

```typescript
// Import everything (tree-shakeable)
import '@astralibx/telegram-ui';

// Or import specific components
import { AlxTgAccountList } from '@astralibx/telegram-ui';
import { AlxTgInbox } from '@astralibx/telegram-ui';
```

## The Telegram Pipeline

@astralibx/telegram-ui manages a campaign automation pipeline plus inbox and bot monitoring:

```
Accounts --> Templates --> Rules --> Runs  (+ Inbox + Bot Stats)
```

| Step | What It Does | Component |
|------|-------------|-----------|
| **1. Accounts** | Telegram sender accounts with phone, session string, capacity | `<alx-tg-account-list>` + `<alx-tg-account-form>` |
| **2. Templates** | Message content with variants, variables, media attachments | `<alx-tg-template-list>` + `<alx-tg-template-editor>` |
| **3. Rules** | Connect templates to audiences -- query conditions or identifier lists | `<alx-tg-rule-list>` + `<alx-tg-rule-editor>` |
| **4. Runs** | Execute rules, track sent/failed/skipped results | `<alx-tg-run-history>` |

**Supporting components:** Inbox (conversations + messages), Bot Stats (status, user analytics), Analytics (send logs, error logs, aggregate stats).

## Minimal Setup (Recommended)

Use the all-in-one dashboard component -- zero wiring needed:

```html
<alx-telegram-dashboard></alx-telegram-dashboard>
```

This gives you the full Telegram management UI: accounts, templates, rules, run history, inbox, bot stats, and analytics -- with drawer-based editing, tab navigation, density toggle, and theme switcher built in.

### Dashboard Attributes

| Attribute | Type | Default | Description |
|-----------|------|---------|-------------|
| `density` | `"default" \| "compact"` | `"default"` | Display density for all child components |
| `default-tab` | String | `"accounts"` | Tab shown on initial load |
| `theme` | `"light" \| "dark"` | `"light"` | Color theme (includes built-in toggle) |

### Hash Routing

The dashboard uses hash-based URLs that don't conflict with your app's router:

```
/your-page#accounts    --> Account list
/your-page#templates   --> Template list
/your-page#rules       --> Rule list
/your-page#runs        --> Run history
/your-page#inbox       --> Inbox
/your-page#bot-stats   --> Bot stats
/your-page#analytics   --> Analytics
```

### Theming

Apply theme variables on the dashboard element:

```css
alx-telegram-dashboard {
  --alx-primary: #d4af37;
  --alx-bg: #111;
  --alx-surface: #1a1a1a;
  --alx-border: #333;
  --alx-text: #ccc;
  --alx-text-muted: #888;
}
```

### Full Example

```html
<!DOCTYPE html>
<html>
<head>
  <style>
    alx-telegram-dashboard {
      --alx-primary: #d4af37;
      --alx-bg: #111;
      --alx-surface: #1a1a1a;
    }
  </style>
</head>
<body>
  <alx-telegram-dashboard density="default" default-tab="accounts" theme="dark"></alx-telegram-dashboard>

  <script type="module">
    import { AlxTelegramConfig } from '@astralibx/telegram-ui';

    AlxTelegramConfig.setup({
      accountManagerApi: 'https://your-api.com/telegram/accounts',
      ruleEngineApi: 'https://your-api.com/telegram/rules',
      inboxApi: 'https://your-api.com/telegram/inbox',
      botApi: 'https://your-api.com/telegram/bot',
      authToken: 'your-token',
    });

    import '@astralibx/telegram-ui';
  </script>
</body>
</html>
```

## Advanced: Custom Layout

If you need a custom layout, use individual components instead of the dashboard:

```html
<!-- Account management -->
<alx-tg-account-list></alx-tg-account-list>

<!-- Template management -->
<alx-tg-template-list></alx-tg-template-list>

<!-- Rule management -->
<alx-tg-rule-list></alx-tg-rule-list>

<!-- Run history -->
<alx-tg-run-history></alx-tg-run-history>

<!-- Inbox -->
<alx-tg-inbox></alx-tg-inbox>
```

## Edit Flow: The Drawer Pattern

List components emit events when users click edit. Catch these events and open the editor in a drawer:

```html
<alx-tg-drawer id="drawer">
  <alx-tg-account-form id="form" hide-header></alx-tg-account-form>
</alx-tg-drawer>

<script>
  const drawer = document.getElementById('drawer');
  const form = document.getElementById('form');

  document.addEventListener('alx-account-selected', (e) => {
    form.setAttribute('account-id', e.detail._id);
    drawer.heading = 'Edit Account';
    drawer.open = true;
  });

  document.addEventListener('alx-account-create', () => {
    form.removeAttribute('account-id');
    drawer.heading = 'Add Account';
    drawer.open = true;
  });

  document.addEventListener('alx-saved', () => {
    drawer.open = false;
    document.querySelector('alx-tg-account-list').load();
  });
</script>
```

## Shared Styles

Import shared style modules for custom components:

```typescript
import {
  alxButtonStyles, alxInputStyles, alxTableStyles,
  alxCardStyles, alxBadgeStyles, alxToolbarStyles,
  alxToggleStyles, alxProgressBarStyles
} from '@astralibx/telegram-ui';
```

## Next Steps

- [Configuration](./configuration.md) -- API setup details
- [Components](./components.md) -- Full component API reference
- [Types](./types.md) -- Exported types, APIs, styles
