# Configuration

`createChatEngine(config)` accepts a `ChatEngineConfig` object. This page documents every option.

## `tenantId` (optional)

| Option | Type | Default | Description |
|--------|------|---------|-------------|
| `tenantId` | `string` | `undefined` | Enables multi-tenant mode -- all data is scoped to this tenant |

See [Multi-Tenant](https://github.com/Hariprakash1997/astralib/blob/main/packages/chat/chat-engine/docs/multi-tenant.md) for details.

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
| `singleSessionPerVisitor` | `boolean` | `true` | Prevent same visitor from having multiple active sessions |
| `trackEventsAsMessages` | `boolean` | `false` | Create system messages for tracked visitor events (page views, clicks) |
| `labelingEnabled` | `boolean` | `false` | Enable message/session labeling for AI training data |
| `maxUploadSizeMb` | `number` | `5` | Max file size for avatar/file uploads in MB |

### AI Simulation Config

Fine-grained control over AI response pacing. Only active when `aiTypingSimulation: true`. Creates a realistic sequence: deliver -> read -> pause -> type -> respond.

```ts
options: {
  aiSimulation: {
    deliveryDelay: { min: 300, max: 1000 },   // ms before marking visitor messages as Delivered
    readDelay: { min: 1000, max: 3000 },       // ms before marking as Read (scales with message length)
    preTypingDelay: { min: 500, max: 1500 },   // ms pause before typing indicator starts
    bubbleDelay: { min: 800, max: 2000 },      // ms between multi-message AI responses
    minTypingDuration: 2000,                    // minimum ms the typing indicator shows
  },
}
```

All values are optional -- unset fields use internal defaults.

## ChatSettings (runtime-mutable via REST API)

Global chat behavior. Change at runtime via `PUT /settings`:

| Field | Type | Default | Description |
|-------|------|---------|-------------|
| `defaultSessionMode` | `'ai' \| 'manual'` | `'ai'` | Global default session mode |
| `aiEnabled` | `boolean` | `true` | Global AI toggle |
| `autoAssignEnabled` | `boolean` | `true` | Auto-assign agents to new sessions |
| `requireAgentForChat` | `boolean` | `false` | `false` = chats work without agents (solo/inbox mode) |
| `visitorAgentSelection` | `boolean` | `false` | `true` = visitors can browse and pick agents |
| `allowPerAgentMode` | `boolean` | `false` | `true` = agents can override global mode |
| `aiMode` | `'manual' \| 'ai' \| 'agent-wise'` | `'agent-wise'` | Two-layer AI control (see below) |
| `chatMode` | `'switchable' \| 'fixed'` | `'switchable'` | `'fixed'` = visitors cannot switch agents mid-chat |
| `autoAwayTimeoutMinutes` | `number` | `15` | Idle timeout before agent auto-set to away (1-480) |
| `autoCloseAfterMinutes` | `number` | `30` | Auto-close idle sessions (1-1440) |
| `availableTags` | `string[]` | `[]` | Tag pool for session tagging |
| `availableUserCategories` | `string[]` | `[]` | User category pool |
| `showAiTag` | `boolean` | `true` | Show AI tag on AI-generated messages |
| `userHistoryEnabled` | `boolean` | `true` | Enable user conversation history lookup |
| `userHistoryLimit` | `number` | `5` | Max past sessions returned (1-5) |

### AI Mode (Two-Layer Control)

The `aiMode` setting provides global AI behavior control via `PUT /settings/ai`:

| Mode | Behavior |
|------|----------|
| `manual` | All agents forced to manual mode |
| `ai` | All agents forced to AI mode (requires `globalCharacter` configured) |
| `agent-wise` | Each agent's `modeOverride` is respected |

### Business Hours

Configurable via `PUT /settings/business-hours`:

| Field | Type | Default | Description |
|-------|------|---------|-------------|
| `enabled` | `boolean` | `false` | Enable business hours checking |
| `timezone` | `string` | `'UTC'` | Timezone for schedule |
| `schedule` | `array` | Mon-Fri 09:00-18:00 | Per-day open/close times |
| `holidayDates` | `string[]` | `[]` | ISO date strings (e.g., `'2026-12-25'`) |
| `outsideHoursMessage` | `string` | Default message | Message shown outside hours |
| `outsideHoursBehavior` | `string` | `'offline-message'` | `'offline-message'`, `'faq-only'`, or `'hide-widget'` |

### File Sharing

Configurable via `PUT /settings` (nested under `fileSharing`):

| Field | Type | Default | Description |
|-------|------|---------|-------------|
| `enabled` | `boolean` | `false` | Enable file sharing |
| `maxFileSizeMb` | `number` | `5` | Max upload size in MB |
| `allowedTypes` | `string[]` | `['image/*', 'application/pdf']` | Allowed MIME patterns |

See [File Uploads](https://github.com/Hariprakash1997/astralib/blob/main/packages/chat/chat-engine/docs/file-uploads.md) for adapter setup.

### Rating Config

Configurable via `PUT /settings/rating`:

| Field | Type | Default | Description |
|-------|------|---------|-------------|
| `enabled` | `boolean` | `false` | Enable rating prompt |
| `ratingType` | `'thumbs' \| 'stars' \| 'emoji'` | `'thumbs'` | Rating input type |
| `followUpOptions` | `Record<string, string[]>` | `{}` | Follow-up options per rating value |

See [Rating & Feedback](https://github.com/Hariprakash1997/astralib/blob/main/packages/chat/chat-engine/docs/rating-feedback.md) for details.

## ChatAgent Fields (per-agent overrides)

Per-agent configuration via `POST /agents` or `PUT /agents/:id`:

| Field | Type | Default | Description |
|-------|------|---------|-------------|
| `name` | `string` | -- | Agent display name |
| `role` | `string` | -- | Agent role label |
| `visibility` | `'public' \| 'internal'` | `'internal'` | `'public'` = visitors can see the agent |
| `isDefault` | `boolean` | `false` | Default AI agent (used when no human assigned) |
| `modeOverride` | `'ai' \| 'manual' \| null` | `null` | Overrides global `defaultSessionMode` |
| `aiEnabled` | `boolean \| null` | `null` | Overrides global `aiEnabled`. `null` = use global |
| `autoAccept` | `boolean` | `false` | Auto-accept incoming chats (skip queue) |
| `isAI` | `boolean` | `false` | AI persona (config record, never connects via socket) |
| `promptTemplateId` | `string \| null` | `null` | Template from `chat-ai` for this agent's AI responses |

When `allowPerAgentMode` is `true`, the agent's `modeOverride` and `aiEnabled` override global settings for sessions they handle.

## Typing Throttle

Typing events are automatically throttled server-side: max 1 typing event per 2 seconds per session. Excess events are silently dropped. No configuration needed.

## Agent Multi-Tab Support

Agent connection count is tracked in Redis. Opening the dashboard in multiple tabs creates multiple socket connections. Events are delivered to all tabs. No deduplication is applied -- agents see the same events in each tab.

## MessagePending

When a message is sent to an offline visitor, it is stored as a pending message. The agent namespace receives a `session_event` with `type: 'message_pending'` so agents know the message is queued and not yet delivered.

## `adapters` (optional)

All adapters are optional. Omit the entire `adapters` object for solo mode (no agents, no AI). See [Adapters](https://github.com/Hariprakash1997/astralib/blob/main/packages/chat/chat-engine/docs/adapters.md) for full details.

```ts
// Solo mode — minimal config, no adapters needed
const engine = createChatEngine({
  db: { connection },
  redis: { connection: redis, keyPrefix: 'myapp:chat:' },
  socket: { cors: { origin: '*' } },
});

// Full mode — all adapters
const engine = createChatEngine({
  db: { connection },
  redis: { connection: redis, keyPrefix: 'myapp:chat:' },
  socket: { cors: { origin: '*' } },
  adapters: {
    assignAgent: async (ctx) => { /* ... */ },
    generateAiResponse: ai.generateResponse,
    authenticateAgent: async (token) => { /* ... */ },
  },
});
```

## `hooks` (optional)

See [Hooks](https://github.com/Hariprakash1997/astralib/blob/main/packages/chat/chat-engine/docs/hooks.md) for full details.

## `logger` (optional)

| Option | Type | Default | Description |
|--------|------|---------|-------------|
| `logger` | `LogAdapter` | console logger | Custom logger implementing `LogAdapter` from `@astralibx/core` |

## Setup Verification

```ts
const engine = createChatEngine(config);

// Attach to Express server
const io = engine.attach(httpServer);

// Mount REST routes
app.use('/api/chat', engine.routes);

// Verify
console.log('Chat engine ready');
console.log('Models:', Object.keys(engine.models));
console.log('Services:', Object.keys(engine.services));
```

### `attach(httpServer)`

Creates the Socket.IO server on the given HTTP server, sets up visitor and agent namespaces, wires gateway event handlers, and starts the session timeout worker. Returns the Socket.IO `Server` instance.

This must be called once after creating the engine. Without it, no WebSocket connections are accepted.

### `destroy()`

Stops the session timeout worker, clears all AI debounce timers and typing simulation timeouts, releases AI locks in Redis, and closes the Socket.IO server. Call this during graceful shutdown.

```ts
process.on('SIGTERM', async () => {
  await engine.destroy();
  process.exit(0);
});
```

## Collection Prefix

```ts
db: {
  connection: mongoose.connection,
  collectionPrefix: 'myapp_',  // collections: myapp_ChatSession, myapp_ChatMessage, etc.
}
```

Useful when sharing a MongoDB database between multiple applications. All model names are prefixed, so collections stay isolated. Default: empty string (no prefix).

## Redis Key Prefix

```ts
redis: {
  connection: redisClient,
  keyPrefix: 'myapp:chat:',  // keys: myapp:chat:visitor:*, myapp:chat:agent:*, etc.
}
```

REQUIRED when sharing Redis with other applications or running multiple chat-engine instances. Without a unique prefix, session state, connection tracking, and AI locks will collide across instances. Default: `'chat:'`.

## Error Handling During Setup

```ts
try {
  const engine = createChatEngine(config);
} catch (error) {
  if (error instanceof InvalidConfigError) {
    // Config validation failed -- check required fields
  }
  // Mongoose/Redis connection errors are NOT caught here -- they're async
  // Monitor your connection event handlers separately
}
```

`createChatEngine` validates the config synchronously and throws `InvalidConfigError` if required fields are missing or invalid. Database and Redis connectivity issues surface asynchronously through their respective connection event handlers -- they are not caught during engine creation.

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
