# @astralibx/telegram-ui

Lit Web Components for Telegram account management, campaigns, inbox, and bot analytics -- built on native Custom Elements that work in any framework.

Part of the [@astralibx](https://github.com/astralibx) telegram ecosystem:
- `@astralibx/telegram-account-manager` -- account CRUD, sessions, health, capacity
- `@astralibx/telegram-rule-engine` -- templates, rules, throttling, runner
- `@astralibx/telegram-inbox` -- conversations, messages, sessions
- `@astralibx/telegram-bot` -- bot status, user analytics

## Install

```bash
npm install @astralibx/telegram-ui
```

Peer dependency: `lit ^3.0.0` (included automatically).

## Quick Start

```typescript
import { AlxTelegramConfig } from '@astralibx/telegram-ui';

// One-time setup at app bootstrap
AlxTelegramConfig.setup({
  accountManagerApi: '/api/telegram-accounts',
  ruleEngineApi: '/api/telegram-rules',
  inboxApi: '/api/telegram-inbox',
  botApi: '/api/telegram-bot',
  authToken: 'Bearer your-token',
  theme: 'dark',
});
```

```html
<!-- Drop the all-in-one dashboard anywhere -->
<alx-telegram-dashboard theme="dark"></alx-telegram-dashboard>
```

## Components

### Shared (2)

| Tag | Description |
|-----|-------------|
| `<alx-telegram-dashboard>` | All-in-one dashboard with tabs, drawer editing, density/theme toggle |
| `<alx-tg-drawer>` | Slide-in drawer panel for editing forms |

### Account Management (2)

| Tag | Description |
|-----|-------------|
| `<alx-tg-account-list>` | Paginated table with status, health score, capacity usage |
| `<alx-tg-account-form>` | Create/edit form with phone, session string, send limits |

### Rule Engine (5)

| Tag | Description |
|-----|-------------|
| `<alx-tg-template-list>` | Template table with message count, variables, category |
| `<alx-tg-template-editor>` | Multi-variant message editor with preview and custom fields |
| `<alx-tg-rule-list>` | Rules with active toggle, mode badge, last run date |
| `<alx-tg-rule-editor>` | Condition builder, identifier list, template selection |
| `<alx-tg-run-history>` | Execution logs with sent/failed/skipped stats and duration |

### Inbox (1)

| Tag | Description |
|-----|-------------|
| `<alx-tg-inbox>` | Split-pane conversation list + message thread with send support |

### Bot (1)

| Tag | Description |
|-----|-------------|
| `<alx-tg-bot-stats>` | Bot status, user stats cards, paginated user table |

### Analytics (1)

| Tag | Description |
|-----|-------------|
| `<alx-tg-analytics>` | Send/fail/skip stats, send logs, error logs with date filters |

## API-Only Usage

Use the typed API clients without any UI components:

```typescript
import { TelegramAccountAPI, TelegramRuleAPI, TelegramInboxAPI, TelegramBotAPI } from '@astralibx/telegram-ui/api';

const accounts = new TelegramAccountAPI('/api/telegram-accounts');
const list = await accounts.listAccounts({ page: 1, limit: 20 });
```

## Theming

Override CSS custom properties on any component or a parent element:

```css
alx-telegram-dashboard {
  --alx-primary: #d4af37;
  --alx-bg: #111;
  --alx-surface: #1a1a1a;
  --alx-border: #333;
  --alx-text: #ccc;
  --alx-text-muted: #888;
  --alx-radius: 4px;
  --alx-font-family: 'Inter', sans-serif;
}
```

Built-in themes: `alxDarkTheme` and `alxLightTheme` are available as Lit CSS exports.

## Documentation

- [Quick Start](https://github.com/Hariprakash1997/astralib/blob/main/packages/telegram/ui/docs/quick-start.md) -- Pipeline overview, dashboard setup
- [Configuration](https://github.com/Hariprakash1997/astralib/blob/main/packages/telegram/ui/docs/configuration.md) -- AlxTelegramConfig setup, auth tokens, all options
- [Components](https://github.com/Hariprakash1997/astralib/blob/main/packages/telegram/ui/docs/components.md) -- All 12 components with properties and events
- [Types](https://github.com/Hariprakash1997/astralib/blob/main/packages/telegram/ui/docs/types.md) -- Exported types, APIs, styles, utilities

## License

MIT
