# API Client

> **Note:** For rule engine API (templates, rules, collections, runner), see [@astralibx/rule-engine-ui](https://github.com/Hariprakash1997/astralib/blob/main/packages/rule-engine/ui/README.md). The `RuleEngineAPI` class is exported from that package.

Use `AccountAPI` and `AnalyticsAPI` directly to build custom UIs or integrate email management into existing components. No Lit dependency required for API-only usage.

## Import

```typescript
// Via subpath export (tree-shakeable, no component registration)
import { AccountAPI, AnalyticsAPI } from '@astralibx/email-ui/api';

// Or from main entry (also registers all custom elements)
import { AccountAPI, AnalyticsAPI } from '@astralibx/email-ui';
```

## Setup

API clients read their base URL from `AlxConfig` by default, or accept an explicit base URL:

```typescript
import { AlxConfig, AccountAPI } from '@astralibx/email-ui';

// Option A: Global config (all clients use it)
AlxConfig.setup({
  accountManagerApi: '/api/email-accounts',
  authToken: 'Bearer xxx',
});
const api = new AccountAPI(); // reads from AlxConfig

// Option B: Explicit base URL
const api = new AccountAPI('/api/email-accounts');
```

Auth headers are always read from `AlxConfig.getHeaders()`.

---

## AccountAPI

```typescript
const api = new AccountAPI();
```

### Methods

| Method | HTTP | Path | Description |
|--------|------|------|-------------|
| `list(params?)` | GET | `/accounts` | List accounts (paginated) |
| `getById(id)` | GET | `/accounts/:id` | Get single account |
| `create(data)` | POST | `/accounts` | Create new account |
| `update(id, data)` | PUT | `/accounts/:id` | Update account |
| `remove(id)` | DELETE | `/accounts/:id` | Delete account |
| `testConnection(id)` | POST | `/accounts/:id/test` | Test SMTP connection |
| `getHealth(id)` | GET | `/accounts/:id/health` | Get account health |
| `getAllHealth()` | GET | `/accounts/health` | Get all accounts' health |
| `getCapacity()` | GET | `/accounts/capacity` | Get sending capacity overview |
| `getWarmupStatus(id)` | GET | `/accounts/:id/warmup` | Get warmup status |
| `startWarmup(id)` | POST | `/accounts/:id/warmup/start` | Start warmup |
| `getSettings()` | GET | `/settings` | Get global settings |
| `updateSettings(data)` | PATCH | `/settings` | Update global settings |
| `listIdentifiers(params?)` | GET | `/identifiers` | List email identifiers |
| `listDrafts(params?)` | GET | `/drafts` | List drafts |
| `approveDraft(id)` | POST | `/drafts/:id/approve` | Approve a draft |
| `rejectDraft(id)` | POST | `/drafts/:id/reject` | Reject a draft |
| `bulkApprove(ids)` | POST | `/drafts/bulk-approve` | Bulk approve drafts |

### Example

```typescript
const api = new AccountAPI();

// List active accounts
const result = await api.list({ page: 1, limit: 20, status: 'active' });
console.log(result.accounts);  // Account[]
console.log(result.total);     // number

// Create account
const account = await api.create({
  email: 'sender@example.com',
  senderName: 'My App',
  provider: 'gmail',
  smtpConfig: { host: 'smtp.gmail.com', port: 587, user: 'x', pass: 'y' },
});

// Test connection
const test = await api.testConnection(account._id);
console.log(test.success, test.message);
```

---

## AnalyticsAPI

```typescript
const api = new AnalyticsAPI();
```

### Methods

| Method | HTTP | Path | Description |
|--------|------|------|-------------|
| `getOverview(params?)` | GET | `/overview` | Aggregate metrics (sent, delivered, etc.) |
| `getTimeline(params?)` | GET | `/timeline` | Time-series send volume |
| `getAccountStats(params?)` | GET | `/accounts` | Per-account stats |
| `getRuleStats(params?)` | GET | `/rules` | Per-rule stats |
| `getTemplateStats(params?)` | GET | `/templates` | Per-template stats |
| `triggerAggregation(data?)` | POST | `/aggregate` | Trigger stats aggregation |

### Example

```typescript
const api = new AnalyticsAPI();

// Get overview for January
const overview = await api.getOverview({ from: '2025-01-01', to: '2025-01-31' });
console.log(overview.sent, overview.delivered, overview.bounced);

// Get daily timeline
const timeline = await api.getTimeline({
  from: '2025-01-01',
  to: '2025-01-31',
  interval: 'daily',
});
// [{ date: '2025-01-01', count: 150 }, ...]
```

---

## Response Envelope Handling

The backend packages return responses wrapped in `{ success: true, data: { ... } }`. The API client automatically unwraps this envelope — you always receive the inner `data` object directly.

Each list endpoint uses an entity-specific key for its array:

```typescript
// AccountAPI.list()
// Backend returns:  { success: true, data: { accounts: [...] } }
// API client gives: { accounts: [...] }
const result = await accountApi.list();
console.log(result.accounts); // Account[]

// AccountAPI.listDrafts()
// Backend returns:  { success: true, data: { items: [...], total: 5 } }
// API client gives: { items: [...], total: 5 }
const drafts = await accountApi.listDrafts({ status: 'pending' });
console.log(drafts.items);  // Draft[]
console.log(drafts.total);  // 5

// AccountAPI.listIdentifiers()
// Same shape: { items: [...], total: N }

// AccountAPI.getAllHealth()
// Backend returns:  { success: true, data: { accounts: [...] } }
// API client gives: { accounts: [...] }
const health = await accountApi.getAllHealth();
console.log(health.accounts); // AccountHealth[]
```

If the backend returns `{ success: false, error: "..." }`, the client throws an `HttpClientError` with the error message.

---

## HttpClient and Error Handling

All API clients use an internal `HttpClient` that wraps `fetch`. Errors throw `HttpClientError`:

```typescript
import { HttpClientError } from '@astralibx/email-ui';

try {
  await api.getById('invalid-id');
} catch (err) {
  if (err instanceof HttpClientError) {
    console.log(err.status);   // 404
    console.log(err.message);  // 'HTTP 404: Not Found'
    console.log(err.body);     // parsed JSON error body, if any
  }
}
```

## Types

```typescript
import type { PaginationParams, ApiResponse, PaginatedResponse } from '@astralibx/email-ui';

// PaginationParams: { page?: number; limit?: number }
// ApiResponse<T>: { data: T; status: number }
// PaginatedResponse<T>: { data: T[]; total: number; page: number; limit: number; totalPages: number }
```
