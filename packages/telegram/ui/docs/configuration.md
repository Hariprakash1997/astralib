# Configuration

All `@astralibx/telegram-ui` components read their API endpoints, auth tokens, and theme from a global singleton. Call `AlxTelegramConfig.setup()` once at application startup before any components render.

## AlxTelegramConfig.setup()

```typescript
import { AlxTelegramConfig } from '@astralibx/telegram-ui';

AlxTelegramConfig.setup({
  accountManagerApi: '/api/telegram-accounts',
  ruleEngineApi: '/api/telegram-rules',
  inboxApi: '/api/telegram-inbox',
  botApi: '/api/telegram-bot',
  authToken: 'Bearer your-jwt-token',
  theme: 'dark',
  locale: 'en-US',
});
```

## AlxTelegramConfigOptions

| Field | Type | Default | Description |
|-------|------|---------|-------------|
| `accountManagerApi` | `string` | `''` | Base URL for the telegram account manager REST API |
| `ruleEngineApi` | `string` | `''` | Base URL for the telegram rule engine REST API |
| `inboxApi` | `string` | `''` | Base URL for the telegram inbox REST API |
| `botApi` | `string` | `''` | Base URL for the telegram bot REST API |
| `authToken` | `string` | `undefined` | Authorization header value (e.g., `'Bearer xxx'`). Sent with every API request. |
| `theme` | `'dark' \| 'light'` | `undefined` | Theme preference. Components ship with built-in dark and light themes. |
| `locale` | `string` | `undefined` | Locale string for date/number formatting (reserved for future use). |

## API Endpoint Mapping

Each config field maps to an API client and its corresponding components:

| Config Field | API Client | Components |
|--------------|-----------|------------|
| `accountManagerApi` | `TelegramAccountAPI` | `<alx-tg-account-list>`, `<alx-tg-account-form>` |
| `ruleEngineApi` | `TelegramRuleAPI` | `<alx-tg-template-list>`, `<alx-tg-template-editor>`, `<alx-tg-rule-list>`, `<alx-tg-rule-editor>`, `<alx-tg-run-history>`, `<alx-tg-analytics>` |
| `inboxApi` | `TelegramInboxAPI` | `<alx-tg-inbox>` |
| `botApi` | `TelegramBotAPI` | `<alx-tg-bot-stats>` |

## Dynamic Auth Token Updates

When your auth token refreshes (e.g., JWT rotation), update it without re-calling `setup()`:

```typescript
AlxTelegramConfig.setAuthToken('Bearer new-refreshed-token');
```

All subsequent API calls from any component will use the new token.

## Reading Current Config

```typescript
const config = AlxTelegramConfig.get();
console.log(config.accountManagerApi); // '/api/telegram-accounts'
```

Returns a shallow copy of the current configuration.

## Getting API URLs Programmatically

```typescript
const url = AlxTelegramConfig.getApiUrl('accountManager');
// Returns the value of accountManagerApi

const headers = AlxTelegramConfig.getHeaders();
// Returns { 'Content-Type': 'application/json', 'Authorization': '...' }
```

Valid keys for `getApiUrl()`: `'accountManager'`, `'ruleEngine'`, `'inbox'`, `'bot'`.

## Auth Error Handling

When any API call returns a 401 or 403 status, the HTTP client dispatches a `alx-auth-error` event on `window`:

```typescript
window.addEventListener('alx-auth-error', (e: CustomEvent) => {
  console.log('Auth error:', e.detail.status, e.detail.url);
  // Redirect to login, refresh token, etc.
});
```

## Theme Configuration

The `theme` field in config is used by the `<alx-telegram-dashboard>` component for its built-in dark/light toggle. Individual components do not read the theme from config -- they inherit CSS custom properties from their parent.

To apply a dark theme globally:

```css
alx-telegram-dashboard {
  --alx-primary: #d4af37;
  --alx-danger: #ef4444;
  --alx-success: #22c55e;
  --alx-warning: #f59e0b;
  --alx-info: #3b82f6;
  --alx-bg: #111;
  --alx-surface: #1a1a1a;
  --alx-border: #333;
  --alx-text: #ccc;
  --alx-text-muted: #888;
  --alx-shadow: 0 1px 3px rgba(0,0,0,0.3), 0 1px 2px rgba(0,0,0,0.2);
  --alx-shadow-sm: 0 1px 2px rgba(0,0,0,0.2);
}
```

The dashboard component applies these variables automatically when `theme="dark"` is set.
