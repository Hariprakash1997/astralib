# Configuration

All `@astralibx/email-ui` components read their API endpoints, auth tokens, and theme from a global singleton. Call `AlxConfig.setup()` once at application startup before any components render.

## AlxConfig.setup()

```typescript
import { AlxConfig } from '@astralibx/email-ui';

AlxConfig.setup({
  accountManagerApi: '/api/email-accounts',
  ruleEngineApi: '/api/email-rules',
  analyticsApi: '/api/analytics',
  authToken: 'Bearer your-jwt-token',
  theme: 'dark',
  locale: 'en-US',
});
```

## AlxConfigOptions

| Field | Type | Default | Description |
|-------|------|---------|-------------|
| `accountManagerApi` | `string` | `''` | Base URL for the `@astralibx/email-account-manager` REST API |
| `ruleEngineApi` | `string` | `''` | Base URL for the `@astralibx/email-rule-engine` REST API |
| `analyticsApi` | `string` | `''` | Base URL for the `@astralibx/email-analytics` REST API |
| `authToken` | `string` | `undefined` | Authorization header value (e.g., `'Bearer xxx'`). Sent with every API request. |
| `theme` | `'dark' \| 'light'` | `undefined` | Theme preference. Components ship with built-in dark and light themes. |
| `locale` | `string` | `undefined` | Locale string for date/number formatting (reserved for future use). |

## Dynamic Auth Token Updates

When your auth token refreshes (e.g., JWT rotation), update it without re-calling `setup()`:

```typescript
AlxConfig.setAuthToken('Bearer new-refreshed-token');
```

All subsequent API calls from any component will use the new token.

## Reading Current Config

```typescript
const config = AlxConfig.get();
console.log(config.accountManagerApi); // '/api/email-accounts'
```

Returns a shallow copy of the current configuration.

## Getting API URLs Programmatically

```typescript
const url = AlxConfig.getApiUrl('accountManager');  // '/api/email-accounts'
const url = AlxConfig.getApiUrl('ruleEngine');       // '/api/email-rules'
const url = AlxConfig.getApiUrl('analytics');         // '/api/analytics'
```

## Getting Headers

```typescript
const headers = AlxConfig.getHeaders();
// { 'Content-Type': 'application/json', 'Authorization': 'Bearer xxx' }
```

Returns the headers object used by all internal HTTP calls. Includes `Content-Type: application/json` always, and `Authorization` if `authToken` is set.

## API URL Patterns

Each API URL should point to the base path of the corresponding backend package's Express router:

```
accountManagerApi: '/api/email-accounts'
  -> GET  /api/email-accounts/accounts
  -> GET  /api/email-accounts/accounts/:id
  -> GET  /api/email-accounts/accounts/:id/health
  -> GET  /api/email-accounts/accounts/:id/warmup
  -> GET  /api/email-accounts/accounts/capacity
  -> GET  /api/email-accounts/settings
  -> GET  /api/email-accounts/drafts
  -> GET  /api/email-accounts/identifiers

ruleEngineApi: '/api/email-rules'
  -> GET  /api/email-rules/templates
  -> GET  /api/email-rules/rules
  -> GET  /api/email-rules/runner/logs
  -> GET  /api/email-rules/throttle

analyticsApi: '/api/analytics'
  -> GET  /api/analytics/overview
  -> GET  /api/analytics/timeline
  -> GET  /api/analytics/accounts
  -> GET  /api/analytics/rules
  -> GET  /api/analytics/templates
```

## Full Example

```typescript
// app-init.ts
import { AlxConfig } from '@astralibx/email-ui';

const API_BASE = import.meta.env.VITE_API_BASE || 'http://localhost:3000';

export function initEmailUI(token: string) {
  AlxConfig.setup({
    accountManagerApi: `${API_BASE}/api/email-accounts`,
    ruleEngineApi: `${API_BASE}/api/email-rules`,
    analyticsApi: `${API_BASE}/api/analytics`,
    authToken: `Bearer ${token}`,
    theme: 'dark',
  });
}

// Later, on token refresh:
export function refreshToken(newToken: string) {
  AlxConfig.setAuthToken(`Bearer ${newToken}`);
}
```
