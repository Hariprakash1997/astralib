# Configuration

`createChatEngine(config)` accepts a `ChatEngineConfig` object. This page documents every option.

## `db` (required)

| Option | Type | Default | Description |
|--------|------|---------|-------------|
| `db.connection` | `mongoose.Connection` | **required** | Mongoose connection instance |
| `db.collectionPrefix` | `string` | `''` | Prefix for all collection names |

## `redis` (required)

| Option | Type | Default | Description |
|--------|------|---------|-------------|
| `redis.connection` | `ioredis.Redis` | **required** | Redis connection instance |
| `redis.keyPrefix` | `string` | `'chat:'` | Prefix for all Redis keys |

> **WARNING:** If multiple projects share the same Redis server, you MUST set a unique `keyPrefix` per project. Without this, sessions and connection state will collide across projects.

## `socket`

| Option | Type | Default | Description |
|--------|------|---------|-------------|
| `socket.pingIntervalMs` | `number` | Socket.IO default | Ping interval for keep-alive |
| `socket.pingTimeoutMs` | `number` | Socket.IO default | Ping timeout before disconnect |
| `socket.cors` | `object` | `undefined` | CORS config passed to Socket.IO server |
| `socket.cors.origin` | `string \| string[]` | -- | Allowed origins |
| `socket.cors.credentials` | `boolean` | -- | Whether to allow credentials |
| `socket.namespaces.visitor` | `string` | `'/chat'` | Visitor namespace path |
| `socket.namespaces.agent` | `string` | `'/agent'` | Agent namespace path |

## `options`

All options have sensible defaults and are optional.

| Option | Type | Default | Description |
|--------|------|---------|-------------|
| `maxMessageLength` | `number` | `5000` | Max message content length |
| `rateLimitPerMinute` | `number` | `30` | Rate limit per session per minute |
| `sessionVisibilityMs` | `number` | `86400000` (24hr) | Session visibility window |
| `sessionResumptionMs` | `number` | `86400000` (24hr) | Session resumption window |
| `maxSessionHistory` | `number` | `50` | Max messages loaded on reconnect |
| `idleTimeoutMs` | `number` | `300000` (5min) | Idle timeout before session is abandoned |
| `maxConcurrentChatsPerAgent` | `number` | `5` | Max concurrent chats per agent |
| `aiDebounceMs` | `number` | `15000` | AI debounce delay before generating response |
| `aiTypingSimulation` | `boolean` | `true` | Simulate typing indicator before AI response |
| `aiTypingSpeedCpm` | `number` | `600` | AI typing simulation speed (chars/min) |
| `sessionTimeoutCheckMs` | `number` | `30000` | Session timeout worker check interval |
| `reconnectWindowMs` | `number` | `300000` (5min) | Disconnect grace period before session is abandoned |
| `pendingMessageTTLMs` | `number` | `86400000` (24hr) | Pending message TTL for offline delivery |

## `adapters` (required)

See [Adapters](https://github.com/Hariprakash1997/astralib/blob/main/packages/chat/chat-engine/docs/adapters.md) for full details.

## `hooks` (optional)

See [Hooks](https://github.com/Hariprakash1997/astralib/blob/main/packages/chat/chat-engine/docs/hooks.md) for full details.

## `logger` (optional)

| Option | Type | Default | Description |
|--------|------|---------|-------------|
| `logger` | `LogAdapter` | console logger | Custom logger implementing `LogAdapter` from `@astralibx/core` |

## Example

```ts
const engine = createChatEngine({
  db: { connection, collectionPrefix: 'myapp_' },
  redis: { connection: redis, keyPrefix: 'myapp-chat:' },
  socket: {
    cors: { origin: ['https://example.com'], credentials: true },
    namespaces: { visitor: '/chat', agent: '/agent' },
  },
  options: {
    maxMessageLength: 10000,
    rateLimitPerMinute: 60,
    idleTimeoutMs: 600_000,
    maxConcurrentChatsPerAgent: 10,
  },
  adapters: {
    assignAgent: async (context) => null,
  },
  hooks: {
    onSessionCreated: (session) => console.log('New session', session.sessionId),
    onError: (err, ctx) => console.error(err),
  },
});
```
