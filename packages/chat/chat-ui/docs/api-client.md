# API Client

The package includes a built-in HTTP client used internally by all components. It is also exported for use in custom components or application code.

## HttpClient

A lightweight fetch wrapper with timeout, auth headers, query string building, and standardized error handling.

```typescript
import { HttpClient } from '@astralibx/chat-ui';

const client = new HttpClient('/api/chat');

// GET with query params
const sessions = await client.get('/sessions', { page: 1, limit: 20 });

// POST
const agent = await client.post('/agents', { name: 'Support', email: 'support@example.com' });

// PUT
await client.put('/agents/123', { name: 'Updated' });

// PATCH
await client.patch('/agents/123', { status: 'active' });

// DELETE
await client.delete('/agents/123');
```

### Methods

| Method | Signature | Description |
|--------|-----------|-------------|
| `get` | `get<T>(path, params?)` | GET request with optional query parameters |
| `post` | `post<T>(path, body?)` | POST request with optional JSON body |
| `put` | `put<T>(path, body?)` | PUT request with optional JSON body |
| `patch` | `patch<T>(path, body?)` | PATCH request with optional JSON body |
| `delete` | `delete<T>(path)` | DELETE request |

All methods automatically:
- Prepend the base URL
- Include auth headers from `AlxChatConfig`
- Apply a 15-second timeout (aborts via `AbortController`)
- Parse JSON responses
- Unwrap `{ success: true, data: ... }` response envelopes

### Auth Header Injection

The HTTP client reads headers from `AlxChatConfig.getHeaders()` on every request. This always includes `Content-Type: application/json` and conditionally includes `Authorization` if an `authToken` is configured.

## HttpClientError

Thrown on non-2xx responses or timeouts.

```typescript
import { HttpClientError } from '@astralibx/chat-ui';

try {
  await client.get('/sessions');
} catch (err) {
  if (err instanceof HttpClientError) {
    console.log(err.status);  // HTTP status code (0 for timeout)
    console.log(err.body);    // Parsed response body, if available
    console.log(err.message); // e.g. "HTTP 404: Not Found"
  }
}
```

## Auth Error Event

On 401 or 403 responses, the client dispatches a `CustomEvent` on `window`:

```typescript
window.addEventListener('alx-auth-error', (e: CustomEvent) => {
  console.log(e.detail.status); // 401 or 403
  console.log(e.detail.url);    // The request URL that failed
  // Redirect to login, refresh token, etc.
});
```

## Exported Types

```typescript
export interface PaginationParams {
  page?: number;
  limit?: number;
}

export interface ApiResponse<T> {
  data: T;
  status: number;
}

export interface PaginatedResponse<T> {
  data: T[];
  total: number;
  page: number;
  limit: number;
  totalPages: number;
}

export interface CursorPaginatedResponse<T> {
  data: T[];
  nextCursor?: string;
  hasMore: boolean;
}
```
