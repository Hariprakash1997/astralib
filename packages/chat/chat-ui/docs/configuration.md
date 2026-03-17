# Configuration

## Setup

Call `AlxChatConfig.setup()` once at application startup, before importing or rendering any components:

```typescript
import { AlxChatConfig } from '@astralibx/chat-ui';

AlxChatConfig.setup({
  chatEngineApi: '/api/chat',
  chatAiApi: '/api/chat-ai',
  socketUrl: 'wss://chat.example.com',
  agentNamespace: '/agent',
  authToken: 'Bearer ...',
  theme: 'dark',
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
AlxChatConfig.setAuthToken('Bearer new-token');
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
