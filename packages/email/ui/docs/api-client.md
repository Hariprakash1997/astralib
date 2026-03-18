# API Client

Use `AccountAPI`, `RuleAPI`, and `AnalyticsAPI` directly to build custom UIs or integrate email management into existing components. No Lit dependency required for API-only usage.

## Import

```typescript
// Via subpath export (tree-shakeable, no component registration)
import { AccountAPI, RuleAPI, AnalyticsAPI } from '@astralibx/email-ui/api';

// Or from main entry (also registers all custom elements)
import { AccountAPI, RuleAPI, AnalyticsAPI } from '@astralibx/email-ui';
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

## RuleAPI

```typescript
const api = new RuleAPI();
```

### Methods

| Method | HTTP | Path | Description |
|--------|------|------|-------------|
| `listTemplates(params?)` | GET | `/templates` | List templates (paginated) |
| `createTemplate(data)` | POST | `/templates` | Create template |
| `updateTemplate(id, data)` | PUT | `/templates/:id` | Update template |
| `deleteTemplate(id)` | DELETE | `/templates/:id` | Delete template |
| `previewTemplate(data)` | POST | `/templates/preview` | Render MJML preview |
| `listRules(params?)` | GET | `/rules` | List rules (paginated) |
| `createRule(data)` | POST | `/rules` | Create rule |
| `updateRule(id, data)` | PUT | `/rules/:id` | Update rule |
| `deleteRule(id)` | DELETE | `/rules/:id` | Delete rule |
| `toggleRule(id)` | POST | `/rules/:id/toggle` | Toggle rule active/inactive |
| `dryRun(id)` | POST | `/rules/:id/dry-run` | Dry run a rule |
| `triggerRun()` | POST | `/runner` | Trigger rule execution |
| `getRunHistory(params?)` | GET | `/runner/logs` | Get run history (paginated) |
| `getThrottleSettings()` | GET | `/throttle` | Get throttle config |
| `updateThrottleSettings(data)` | PUT | `/throttle` | Update throttle config |
| `listCollections()` | GET | `/collections` | List registered collection schemas |
| `getCollectionFields(name)` | GET | `/collections/:name/fields` | Get flattened fields for a collection |

### Example

```typescript
const api = new RuleAPI();

// List templates with filter
const result = await api.listTemplates({ category: 'marketing', page: 1, limit: 10 });
console.log(result.templates); // Template[]

// Create a rule
const rule = await api.createRule({
  name: 'Welcome Email',
  templateId: '64a1b2c3...',
  platform: 'myapp',
  audience: 'clients',
  target: {
    conditions: [
      { field: 'status', operator: 'equals', value: 'active' },
    ],
  },
  behavior: {
    sendOnce: true,
    resendAfterDays: null,
    maxPerRun: 50,
    autoApprove: true,
    emailType: 'marketing',
    bypassThrottle: false,
  },
  isActive: true,
});

// Dry run to see matches
const preview = await api.dryRun(rule._id);
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

// RuleAPI.listTemplates()
// Backend returns:  { success: true, data: { templates: [...] } }
// API client gives: { templates: [...] }
const tpls = await ruleApi.listTemplates();
console.log(tpls.templates); // Template[]

// RuleAPI.listRules()
// Backend returns:  { success: true, data: { rules: [...] } }
// API client gives: { rules: [...] }
const rules = await ruleApi.listRules();
console.log(rules.rules); // Rule[]

// RuleAPI.getRunHistory()
// Backend returns:  { success: true, data: { logs: [...] } }
// API client gives: { logs: [...] }
const history = await ruleApi.getRunHistory();
console.log(history.logs); // RunLog[]

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
