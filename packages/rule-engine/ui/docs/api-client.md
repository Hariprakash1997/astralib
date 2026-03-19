# RuleEngineAPI Client

The `RuleEngineAPI` client connects UI components to the `@astralibx/rule-engine` backend. Components accept a `baseUrl` prop and create the client automatically, or you can construct a custom instance and pass it directly when you need control over authentication headers, base paths, or other request options.

Source files:
- [`packages/rule-engine/ui/src/api/rule-engine.api.ts`](https://github.com/Hariprakash1997/astralib/blob/main/packages/rule-engine/ui/src/api/rule-engine.api.ts)
- [`packages/rule-engine/ui/src/api/http-client.ts`](https://github.com/Hariprakash1997/astralib/blob/main/packages/rule-engine/ui/src/api/http-client.ts)

---

## Setup

### Pattern 1 — `baseUrl` prop (auto-creates client)

Pass `baseUrl` directly to any component. The component constructs a `RuleEngineAPI` instance internally.

```html
<alx-rule-engine-dashboard baseUrl="/api/rules"></alx-rule-engine-dashboard>
```

### Pattern 2 — Manual creation (custom auth / headers)

Construct the client yourself when you need to inject headers or share an instance across components.

```typescript
import { RuleEngineAPI, HttpClient } from '@astralibx/rule-engine-ui/api';

const api = new RuleEngineAPI(new HttpClient('/api/rules'));
```

---

## Static Factory

`RuleEngineAPI.create` is a convenience factory. When `baseUrl` is omitted it falls back to the value returned by `AlxConfig.getApiUrl()`.

```typescript
const api = RuleEngineAPI.create('/api/rules');

// Falls back to AlxConfig.getApiUrl()
const api = RuleEngineAPI.create();
```

---

## Method Reference

All methods return `Promise<any>`. Query parameters are passed as `Record<string, unknown>` objects and are serialised into the URL automatically, skipping `null` and `undefined` values.

### Templates

| Method | Params | HTTP | Path | Description |
|---|---|---|---|---|
| `listTemplates` | `params?: Record<string, unknown>` | GET | `/templates` | List all templates with optional filtering/pagination. |
| `createTemplate` | `data: Record<string, unknown>` | POST | `/templates` | Create a new template. |
| `getTemplate` | `id: string` | GET | `/templates/:id` | Fetch a single template by ID. |
| `updateTemplate` | `id: string, data: Record<string, unknown>` | PUT | `/templates/:id` | Replace a template's fields. |
| `deleteTemplate` | `id: string` | DELETE | `/templates/:id` | Permanently delete a template. |
| `toggleTemplate` | `id: string` | PATCH | `/templates/:id/toggle` | Enable or disable a template. |
| `previewTemplate` | `id: string, data: Record<string, unknown>` | POST | `/templates/:id/preview` | Render a saved template with supplied variables. |
| `previewTemplateRaw` | `data: Record<string, unknown>` | POST | `/templates/preview` | Render an unsaved template body inline. |
| `validateTemplate` | `data: Record<string, unknown>` | POST | `/templates/validate` | Validate template syntax without saving. |
| `cloneTemplate` | `id: string` | POST | `/templates/:id/clone` | Duplicate an existing template. |
| `sendTest` | `id: string, data: Record<string, unknown>` | POST | `/templates/:id/test-send` | Send a test message using a template. |
| `previewWithRecipient` | `id: string, data: Record<string, unknown>` | POST | `/templates/:id/preview-with-data` | Render a template merged with recipient-specific data. |

### Rules

| Method | Params | HTTP | Path | Description |
|---|---|---|---|---|
| `listRules` | `params?: Record<string, unknown>` | GET | `/rules` | List all rules with optional filtering/pagination. |
| `createRule` | `data: Record<string, unknown>` | POST | `/rules` | Create a new rule. |
| `getRule` | `id: string` | GET | `/rules/:id` | Fetch a single rule by ID. |
| `updateRule` | `id: string, data: Record<string, unknown>` | PATCH | `/rules/:id` | Partially update a rule's fields. |
| `deleteRule` | `id: string` | DELETE | `/rules/:id` | Permanently delete a rule. |
| `toggleRule` | `id: string` | POST | `/rules/:id/toggle` | Enable or disable a rule. |
| `dryRun` | `id: string` | POST | `/rules/:id/dry-run` | Execute a rule in dry-run mode without side effects. |
| `cloneRule` | `id: string` | POST | `/rules/:id/clone` | Duplicate an existing rule. |
| `previewConditions` | `data: Record<string, unknown>` | POST | `/rules/preview-conditions` | Evaluate rule conditions against sample data. |

### Collections

| Method | Params | HTTP | Path | Description |
|---|---|---|---|---|
| `listCollections` | — | GET | `/collections` | List all available collections. |
| `getCollectionFields` | `name: string, joins?: string[]` | GET | `/collections/:name/fields[?joins=...]` | Fetch fields for a collection; pass `joins` to include joined collection fields. |

### Runner

| Method | Params | HTTP | Path | Description |
|---|---|---|---|---|
| `triggerRun` | — | POST | `/runner` | Manually trigger a rule engine run. |
| `getRunStatus` | `runId: string` | GET | `/runner/status/:runId` | Fetch the status of a specific run. |
| `getLatestRunStatus` | — | GET | `/runner/status` | Fetch the status of the most recent run. |
| `cancelRun` | `runId: string` | POST | `/runner/cancel/:runId` | Request cancellation of an in-progress run. |
| `getRunHistory` | `params?: Record<string, unknown>` | GET | `/runner/logs` | List run history with optional filtering/pagination. |

### Settings

| Method | Params | HTTP | Path | Description |
|---|---|---|---|---|
| `getThrottleConfig` | — | GET | `/throttle` | Retrieve the current throttle configuration. |
| `updateThrottleConfig` | `data: Record<string, unknown>` | PUT | `/throttle` | Replace the throttle configuration. |

### Send Logs

| Method | Params | HTTP | Path | Description |
|---|---|---|---|---|
| `listSendLogs` | `params?: Record<string, unknown>` | GET | `/sends` | List send log entries with optional filtering/pagination. |

---

## AlxConfig

`AlxConfig` is a global configuration singleton. Call `AlxConfig.setup()` once at application startup — before any component mounts — to set the API base URL, auth token, and theme.

**Source:** [`packages/rule-engine/ui/src/config.ts`](https://github.com/Hariprakash1997/astralib/blob/main/packages/rule-engine/ui/src/config.ts)

```typescript
import { AlxConfig } from '@astralibx/rule-engine-ui/config';

AlxConfig.setup({
  apiUrl: '/api/rules',
  authToken: 'Bearer xxx',
  theme: 'dark',
});
```

### Method Reference

| Method | Signature | Description |
|---|---|---|
| `setup` | `(options: AlxConfigOptions): void` | Initialise or replace the global config. Call once at app startup. |
| `get` | `(): AlxConfigOptions` | Return a shallow copy of the current config object. |
| `getApiUrl` | `(): string` | Return the configured `apiUrl`, or `''` if not set. Used as the fallback base URL by `RuleEngineAPI.create()`. |
| `getHeaders` | `(): Record<string, string>` | Return `{ 'Content-Type': 'application/json' }` plus `Authorization` if an `authToken` is set. Called per-request by `HttpClient`. |
| `setAuthToken` | `(token: string): void` | Update the auth token at runtime without re-calling `setup()`. Useful for token rotation. |

```typescript
AlxConfig.getApiUrl();
// → '/api/rules'

AlxConfig.getHeaders();
// → { 'Content-Type': 'application/json', 'Authorization': 'Bearer xxx' }

AlxConfig.setAuthToken('Bearer newtoken');
// Auth header updated for all subsequent requests
```

### `AlxConfigOptions`

| Field | Type | Description |
|---|---|---|
| `apiUrl` | `string` | Base URL for the rule-engine API. |
| `authToken` | `string` | Full `Authorization` header value, e.g. `'Bearer xxx'`. |
| `theme` | `'dark' \| 'light'` | UI theme preference. |
| `locale` | `string` | Locale string (reserved for future use). |

---

## Response Handling

`HttpClient` expects the backend to return a standard JSON envelope and handles unwrapping automatically.

**Source:** [`packages/rule-engine/ui/src/api/http-client.ts`](https://github.com/Hariprakash1997/astralib/blob/main/packages/rule-engine/ui/src/api/http-client.ts)

### Success envelope

The backend should wrap responses as:

```json
{ "success": true, "data": { ... } }
```

`HttpClient` detects the `success` field and unwraps `data` before returning it to callers. If the response has no `success` field the raw JSON is returned as-is.

### Single-item unwrap

After unwrapping `data`, if the result is an object with exactly one key whose value is also a non-array object, `HttpClient` unwraps one level further:

```json
{ "success": true, "data": { "template": { "_id": "abc", "name": "Welcome" } } }
// → caller receives: { "_id": "abc", "name": "Welcome" }
```

Multi-key objects and arrays are returned as-is after the `data` unwrap.

### Error envelope

When `success` is `false`, `HttpClient` throws `HttpClientError` using `error` or `message` from the response body:

```json
{ "success": false, "error": "Template not found" }
// → throws HttpClientError("Template not found", status, body)
```

### 401 / 403 handling

On a `401` or `403` response, `HttpClient` dispatches an `alx-auth-error` event on `window` before throwing, so a top-level handler can redirect to login without every caller needing to handle auth explicitly:

```typescript
window.addEventListener('alx-auth-error', (e) => {
  console.log(e.detail.status); // 401 or 403
  console.log(e.detail.url);    // URL that triggered the error
  window.location.href = '/login';
});
```

---

## Custom HTTP Client

Pass custom headers — such as an authorization token — by configuring `AlxConfig` before constructing the client. `AlxConfig.getHeaders()` is called per-request, so calling `AlxConfig.setAuthToken()` before each request is sufficient for token rotation:

```typescript
import { AlxConfig } from '@astralibx/rule-engine-ui/config';
import { RuleEngineAPI } from '@astralibx/rule-engine-ui/api';

AlxConfig.setup({ apiUrl: '/api/rules', authToken: 'Bearer mytoken' });
const api = RuleEngineAPI.create();
```

To use completely custom fetch logic, pass your own `HttpClient` instance:

```typescript
import { RuleEngineAPI, HttpClient } from '@astralibx/rule-engine-ui/api';

const http = new HttpClient('https://internal.example.com/rule-engine');
const api = new RuleEngineAPI(http);
```

All requests have a built-in 15-second timeout enforced via `AbortController`. If the request exceeds this limit, an `HttpClientError` is thrown with `status: 0`.

---

## Error Handling

All methods throw `HttpClientError` on non-2xx responses or network failures.

```typescript
import { HttpClientError } from '@astralibx/rule-engine-ui/api';

try {
  const template = await api.getTemplate('abc123');
} catch (err) {
  if (err instanceof HttpClientError) {
    console.error(err.status);   // HTTP status code (0 for timeout)
    console.error(err.message);  // e.g. "HTTP 404: Not Found"
    console.error(err.body);     // Parsed response body, if available
  }
}
```

`HttpClientError` properties:

| Property | Type | Description |
|---|---|---|
| `message` | `string` | Human-readable error string, e.g. `"HTTP 422: Unprocessable Entity"`. |
| `status` | `number` | HTTP status code. `0` indicates a timeout or network-level failure. |
| `body` | `unknown` | Parsed JSON body from the response, or the raw text if JSON parsing fails. `undefined` when no body is present. |

When the server returns `401` or `403`, the client additionally dispatches a `CustomEvent` named `alx-auth-error` on `window`, allowing a top-level handler to redirect to a login page without every caller needing to handle it explicitly.

```typescript
window.addEventListener('alx-auth-error', (e) => {
  console.log(e.detail.status); // 401 or 403
  console.log(e.detail.url);    // URL that triggered the error
  window.location.href = '/login';
});
```
