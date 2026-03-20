# @astralibx/rule-engine-ui

Shared Lit Web Components for rule engine admin interfaces. Platform-agnostic — works with email, telegram, whatsapp, or any channel.

## Install

```bash
npm install @astralibx/rule-engine-ui
```

Peer dependency: `lit ^3.0.0`

## Components

| Component | Description |
|-----------|-------------|
| `<alx-rule-engine-dashboard>` | Pre-built tabbed dashboard with all components |
| `<alx-template-editor>` | Template CRUD with slot-based content editor |
| `<alx-rule-editor>` | Rule CRUD with condition builder and preview |
| `<alx-template-list>` | Templates table with filters and actions |
| `<alx-rule-list>` | Rules table with dry run and actions |
| `<alx-run-history>` | Run history with real-time progress |
| `<alx-throttle-settings>` | Throttle and send window configuration |
| `<alx-send-log>` | Send log viewer with filters |
| `<alx-drawer>` | Right-side drawer for forms |

## Quick Start

### Full Dashboard

```html
<script type="module">
  import '@astralibx/rule-engine-ui';
</script>

<alx-rule-engine-dashboard
  baseUrl="/api/rules"
  .platforms=${['email', 'telegram']}
  .audiences=${['customer', 'provider']}
  .categories=${['onboarding', 'engagement']}
></alx-rule-engine-dashboard>
```

### Individual Components

```html
<alx-rule-editor baseUrl="/api/rules" ruleId="abc123"></alx-rule-editor>
<alx-template-list baseUrl="/api/rules" .platforms=${['email']}></alx-template-list>
```

### Slot-Based Template Editor

```html
<alx-template-editor baseUrl="/api/rules">
  <!-- Your platform-specific editor fills this slot -->
  <my-mjml-editor slot="content"
    .bodies=${bodies}
    .subjects=${subjects}
    @content-changed=${handleChange}>
  </my-mjml-editor>
</alx-template-editor>
```

## Theming

Override CSS custom properties:

```css
alx-rule-engine-dashboard {
  --alx-primary: #0ea5e9;
  --alx-radius: 8px;
  --alx-bg: #ffffff;
  --alx-text: #1f2937;
  --alx-border: #e5e7eb;
}
```

## API Connection

Components connect via `baseUrl` prop (built-in HTTP client) or custom API instance:

```typescript
import { RuleEngineAPI, HttpClient } from '@astralibx/rule-engine-ui';

const api = new RuleEngineAPI(new HttpClient('/api/rules'));
// Pass to any component:
document.querySelector('alx-rule-editor').api = api;
```

## Core Documentation

For backend setup, adapters, collections, templates, rules, throttling, and hooks, see the core package documentation:

- [Quick Start Tutorial](https://github.com/Hariprakash1997/astralib/blob/main/packages/rule-engine/core/docs/quick-start-tutorial.md)
- [Adapters Guide](https://github.com/Hariprakash1997/astralib/blob/main/packages/rule-engine/core/docs/adapters.md)
- [Collections & Joins](https://github.com/Hariprakash1997/astralib/blob/main/packages/rule-engine/core/docs/collections-and-joins.md)
- [Templates & Rules](https://github.com/Hariprakash1997/astralib/blob/main/packages/rule-engine/core/docs/templates-and-rules.md)
- [Throttling & Hooks](https://github.com/Hariprakash1997/astralib/blob/main/packages/rule-engine/core/docs/throttling-and-hooks.md)

## Plain HTML / No Framework

Components are standard custom elements and work without any framework. Import the module once — it self-registers all `alx-*` elements.

```html
<!-- Just import the module — components auto-register -->
<script type="module">
  import 'https://unpkg.com/@astralibx/rule-engine-ui';
</script>

<!-- Use as standard HTML elements -->
<alx-rule-engine-dashboard
  baseUrl="/api/rules"
  platforms='["email","telegram"]'
  audiences='["customer","provider"]'
  categories='["onboarding","engagement"]'
></alx-rule-engine-dashboard>
```

Note: array props must be JSON strings when used as HTML attributes.

Vanilla JS alternative — create elements programmatically:

```javascript
const dashboard = document.createElement('alx-rule-engine-dashboard');
dashboard.baseUrl = '/api/rules';
dashboard.platforms = ['email', 'telegram'];
document.body.appendChild(dashboard);
```

- [Changelog](https://github.com/Hariprakash1997/astralib/blob/main/packages/rule-engine/ui/CHANGELOG.md)

## License

MIT
