# Configuration

## Setup

Call `AlxChatConfig.setup()` once at application startup, before importing or rendering any components:

```typescript
import { AlxChatConfig } from '@astralibx/chat-ui';

// MUST be called before importing any chat-ui components
AlxChatConfig.setup({
  chatEngineApi: '/api/chat',      // base URL for chat-engine REST routes
  chatAiApi: '/api/chat-ai',       // base URL for chat-ai REST routes (optional)
  socketUrl: 'wss://chat.example.com',  // Socket.IO server URL
  agentNamespace: '/agent',        // agent namespace (must match engine config)
  authToken: 'Bearer eyJ...',      // auth token for API requests
  theme: 'dark',                   // 'dark' | 'light'
});

// Then import/use components
import '@astralibx/chat-ui';
```

## Config Options

| Option | Type | Default | Description |
|--------|------|---------|-------------|
| `chatEngineApi` | `string` | `''` | Base URL for the chat engine REST API |
| `chatAiApi` | `string` | `''` | Base URL for the chat AI REST API |
| `socketUrl` | `string` | `''` | Socket.IO server URL (required for agent dashboard) |
| `agentNamespace` | `string` | `'/agent'` | Socket.IO namespace for agent connections |
| `authToken` | `string` | `undefined` | Authorization header value (e.g. `'Bearer xxx'`) |
| `theme` | `'dark' \| 'light'` | `undefined` | Theme preference |
| `locale` | `string` | `undefined` | Locale string for i18n |

## Peer Dependencies

| Package | Required |
|---------|----------|
| `lit` | Yes |
| `socket.io-client` | Optional (needed for agent dashboard) |

```bash
npm install @astralibx/chat-ui
# Optional: npm install socket.io-client
```

## Runtime Token Update

You can update the auth token at runtime without calling `setup()` again:

```typescript
// When auth token expires and is refreshed
AlxChatConfig.setAuthToken('Bearer newToken...');
```

This updates the token in the config singleton. All subsequent API requests made by any component will use the new token. There is no need to re-render or re-initialize components.

## Auth Error Handling

All components emit an `alx-auth-error` event on the window when an API request returns a 401 status. Listen for this event to handle session expiry:

```typescript
window.addEventListener('alx-auth-error', () => {
  // Redirect to login, refresh token, etc.
});
```

## API URL Resolution

The config singleton provides typed accessor methods used internally by the HTTP client:

| Method | Returns |
|--------|---------|
| `AlxChatConfig.getApiUrl('chatEngine')` | Value of `chatEngineApi` |
| `AlxChatConfig.getApiUrl('chatAi')` | Value of `chatAiApi` |
| `AlxChatConfig.getSocketUrl()` | Value of `socketUrl` |
| `AlxChatConfig.getAgentNamespace()` | Value of `agentNamespace` (defaults to `'/agent'`) |
| `AlxChatConfig.getHeaders()` | `{ 'Content-Type': 'application/json', Authorization?: '...' }` |

## AlxChatConfigOptions Interface

```typescript
export interface AlxChatConfigOptions {
  chatEngineApi?: string;
  chatAiApi?: string;
  socketUrl?: string;
  agentNamespace?: string;
  authToken?: string;
  theme?: 'dark' | 'light';
  locale?: string;
}
```
