# @astralibx/email-ui

Lit Web Components for email infrastructure admin UIs. Drop-in components for managing email accounts, analytics, and MJML template editing — built on native Custom Elements that work in any framework.

Rule engine components (templates, rules, run history, throttle settings) come from the shared `@astralibx/rule-engine-ui` package, which `@astralibx/email-ui` depends on. The email dashboard extends the shared rule engine dashboard by adding Accounts and Analytics tabs, and wires the MJML body editor (`<alx-email-body-editor>`) into the template editor slot.

Part of the [@astralibx](https://github.com/astralibx) ecosystem:
- `@astralibx/email-account-manager` -- account CRUD, health, warmup, SMTP, approval queues
- `@astralibx/email-analytics` -- event recording, aggregation, time-series
- `@astralibx/rule-engine` -- shared rule engine core (templates, rules, throttling, runner)
- `@astralibx/rule-engine-ui` -- shared rule engine UI components (template/rule editor, run history, throttle settings)

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
  analyticsApi: '/api/analytics',
  authToken: 'Bearer your-token',
  theme: 'dark',
});
```

Rule engine components (`<alx-template-list>`, `<alx-rule-list>`, etc.) are configured separately via `@astralibx/rule-engine-ui`. See the [rule-engine-ui README](https://github.com/Hariprakash1997/astralib/blob/main/packages/rule-engine/ui/README.md) for shared component setup.

```html
<!-- Email-specific components -->
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

### Rule Engine Components (from `@astralibx/rule-engine-ui`)

Rule engine components are provided by the shared `@astralibx/rule-engine-ui` package. See the [rule-engine-ui README](https://github.com/Hariprakash1997/astralib/blob/main/packages/rule-engine/ui/README.md) for the full component list (`<alx-template-list>`, `<alx-template-editor>`, `<alx-rule-list>`, `<alx-rule-editor>`, `<alx-run-history>`, `<alx-throttle-settings>`, `<alx-guide-panel>`).

### Email Body Editor (1)

| Tag | Description |
|-----|-------------|
| `<alx-email-body-editor>` | MJML + Handlebars editor with live preview, fills the template editor slot |

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
import { AccountAPI, AnalyticsAPI } from '@astralibx/email-ui/api';

const accounts = new AccountAPI('/api/email-accounts');
const list = await accounts.list({ page: 1, limit: 20 });
```

For rule engine API access (`RuleEngineAPI`), see [@astralibx/rule-engine-ui](https://github.com/Hariprakash1997/astralib/blob/main/packages/rule-engine/ui/README.md).

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

- [Dashboard](https://github.com/Hariprakash1997/astralib/blob/main/packages/email/ui/docs/dashboard.md) -- One-component setup (recommended)
- [Configuration](https://github.com/Hariprakash1997/astralib/blob/main/packages/email/ui/docs/configuration.md) -- AlxConfig setup, auth tokens, all options
- [Theming](https://github.com/Hariprakash1997/astralib/blob/main/packages/email/ui/docs/theming.md) -- CSS custom properties, dark/light themes, customization
- [Account Components](https://github.com/Hariprakash1997/astralib/blob/main/packages/email/ui/docs/account-components.md) -- All 9 account management components
- [Analytics Components](https://github.com/Hariprakash1997/astralib/blob/main/packages/email/ui/docs/analytics-components.md) -- All 5 analytics components
- [Rule Engine Components](https://github.com/Hariprakash1997/astralib/blob/main/packages/rule-engine/ui/README.md) -- Shared rule engine components (templates, rules, run history, throttle)
- [API Client](https://github.com/Hariprakash1997/astralib/blob/main/packages/email/ui/docs/api-client.md) -- Using AccountAPI, AnalyticsAPI directly
- [Framework Integration](https://github.com/Hariprakash1997/astralib/blob/main/packages/email/ui/docs/framework-integration.md) -- Angular, React, Vue, Next.js, plain HTML
- [Events](https://github.com/Hariprakash1997/astralib/blob/main/packages/email/ui/docs/events.md) -- All custom events with names, detail types, examples
- [API Contract](https://github.com/Hariprakash1997/astralib/blob/main/packages/email/ui/docs/api-contract.md) -- Expected backend response shapes for account and analytics endpoints
- [Changelog](https://github.com/Hariprakash1997/astralib/blob/main/packages/email/ui/CHANGELOG.md)

## License

MIT
