# @astralibx/email-ui

Lit Web Components for email infrastructure admin UIs. Drop-in components for managing email accounts, automation rules, templates, and analytics -- built on native Custom Elements that work in any framework.

Part of the [@astralibx](https://github.com/astralibx) email ecosystem:
- `@astralibx/email-account-manager` -- account CRUD, health, warmup, SMTP, approval queues
- `@astralibx/email-rule-engine` -- templates, rules, throttling, runner
- `@astralibx/email-analytics` -- event recording, aggregation, time-series

## Install

```bash
npm install @astralibx/email-ui
```

Peer dependency: `lit ^3.0.0` (included automatically).

## Quick Start

```typescript
import { AlxConfig } from '@astralibx/email-ui';

// One-time setup at app bootstrap
AlxConfig.setup({
  accountManagerApi: '/api/email-accounts',
  ruleEngineApi: '/api/email-rules',
  analyticsApi: '/api/analytics',
  authToken: 'Bearer your-token',
  theme: 'dark',
});
```

```html
<!-- Drop components anywhere in your HTML -->
<alx-account-list></alx-account-list>
<alx-analytics-overview date-from="2025-01-01" date-to="2025-01-31"></alx-analytics-overview>
```

## Framework Integration

### Angular

```typescript
import { CUSTOM_ELEMENTS_SCHEMA, Component } from '@angular/core';
import { AlxConfig } from '@astralibx/email-ui';

AlxConfig.setup({ accountManagerApi: '/api/email-accounts', authToken: token, theme: 'dark' });

@Component({
  standalone: true,
  schemas: [CUSTOM_ELEMENTS_SCHEMA],
  template: `<alx-account-list (alx-account-selected)="onSelect($event)"></alx-account-list>`,
})
export class EmailAccountsComponent {
  onSelect(event: CustomEvent) {
    console.log('Selected account:', event.detail);
  }
}
```

### React / Next.js

```tsx
import { AlxConfig } from '@astralibx/email-ui';
import { useEffect, useRef } from 'react';

AlxConfig.setup({ accountManagerApi: '/api/email-accounts', authToken: token, theme: 'dark' });

export default function EmailAccounts() {
  const listRef = useRef<HTMLElement>(null);

  useEffect(() => {
    listRef.current?.addEventListener('alx-account-selected', (e: Event) => {
      console.log('Selected:', (e as CustomEvent).detail);
    });
  }, []);

  return <alx-account-list ref={listRef} />;
}
```

### Plain HTML

```html
<script type="module">
  import { AlxConfig } from 'https://cdn.example.com/@astralibx/email-ui/dist/index.js';

  AlxConfig.setup({
    accountManagerApi: 'https://api.example.com/email-accounts',
    ruleEngineApi: 'https://api.example.com/email-rules',
    analyticsApi: 'https://api.example.com/analytics',
    authToken: 'Bearer your-token',
    theme: 'dark',
  });
</script>

<alx-account-list></alx-account-list>
```

## Components

### Account Management (9)

| Tag | Description |
|-----|-------------|
| `<alx-account-list>` | Paginated table with status, health, capacity, warmup indicators |
| `<alx-account-form>` | Create/edit form with SMTP + IMAP config, provider selection |
| `<alx-account-health>` | Health dashboard with scores, bounce rates, error trends |
| `<alx-account-warmup>` | Warmup progress, day tracking, phase schedule |
| `<alx-account-capacity>` | Aggregate + per-account daily limits and usage bars |
| `<alx-smtp-tester>` | One-click SMTP connection test with result display |
| `<alx-bounce-status>` | IMAP bounce check status, single or multi-account view |
| `<alx-approval-queue>` | Pending drafts with approve/reject/bulk actions |
| `<alx-global-settings>` | Timezone, dev mode, IMAP, approval, queue tuning |

### Rule Engine (7)

| Tag | Description |
|-----|-------------|
| `<alx-template-list>` | Template table with category/audience/platform filters |
| `<alx-template-editor>` | MJML + Handlebars editor with live preview |
| `<alx-rule-list>` | Rules with active toggle, stats, dry-run button |
| `<alx-rule-editor>` | Condition builder, behavior config, template selection |
| `<alx-run-history>` | Execution logs with expandable per-rule breakdown |
| `<alx-throttle-settings>` | Global throttle limits (per-user daily/weekly, gap) |
| `<alx-guide-panel>` | Collapsible built-in documentation panel |

### Analytics (5)

| Tag | Description |
|-----|-------------|
| `<alx-analytics-overview>` | Metric cards: sent, delivered, failed, bounced, opened, clicked |
| `<alx-analytics-timeline>` | Bar chart of send volume (daily/weekly/monthly) |
| `<alx-analytics-accounts>` | Sortable per-account performance table |
| `<alx-analytics-rules>` | Sortable per-rule stats with error rates |
| `<alx-analytics-engagement>` | Open/click/unsubscribe rates (SES tracking note) |

## API-Only Usage

Use the typed API clients without any UI components:

```typescript
import { AccountAPI, RuleAPI, AnalyticsAPI } from '@astralibx/email-ui/api';

const accounts = new AccountAPI('/api/email-accounts');
const list = await accounts.list({ page: 1, limit: 20 });
```

## Theming

Override CSS custom properties on any component or a parent element:

```css
alx-account-list {
  --alx-primary: #d4af37;
  --alx-bg: #111;
  --alx-surface: #1a1a1a;
  --alx-border: #333;
  --alx-text: #ccc;
  --alx-text-muted: #888;
  --alx-radius: 6px;
  --alx-font-family: 'Inter', sans-serif;
}
```

Built-in themes: `alxDarkTheme` and `alxLightTheme` are available as Lit CSS exports.

## Documentation

- [Configuration](docs/configuration.md) -- AlxConfig setup, auth tokens, all options
- [Theming](docs/theming.md) -- CSS custom properties, dark/light themes, customization
- [Account Components](docs/account-components.md) -- All 9 account management components
- [Rule Components](docs/rule-components.md) -- All 7 rule engine components
- [Analytics Components](docs/analytics-components.md) -- All 5 analytics components
- [API Client](docs/api-client.md) -- Using AccountAPI, RuleAPI, AnalyticsAPI directly
- [Framework Integration](docs/framework-integration.md) -- Angular, React, Vue, Next.js, plain HTML
- [Events](docs/events.md) -- All custom events with names, detail types, examples

## License

MIT
