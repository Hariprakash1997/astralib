# Production Checklist

Actionable items for deploying `@astralibx/chat-*` to production.

---

## 1. MongoDB

- [ ] **Indexes are auto-created** by Mongoose schemas (`sessions`, `messages`, `webhooks`, `pending-messages`). Verify they exist after first deploy with `db.collection.getIndexes()`.
- [ ] **Connection pooling** -- Mongoose defaults to `maxPoolSize: 100`. Tune based on your server count: `mongoose.createConnection(uri, { maxPoolSize: 50 })`.
- [ ] **Replica set** -- Required for HA. Use `mongodb+srv://` or `replicaSet=` connection string. Enables read preference and automatic failover.
- [ ] **Collection prefix** -- If sharing a database with other apps, set `db.collectionPrefix` to isolate collections.

## 2. Redis

- [ ] **Key prefix** -- Set `redis.keyPrefix` to a unique value per project/environment (e.g., `'prod:chat:'`). Without this, multiple instances collide on session state, connection tracking, and AI locks.
- [ ] **Memory policy** -- Set `maxmemory-policy` to `allkeys-lru` or `volatile-lru`. Chat keys use TTLs, but connection tracking keys are persistent.
- [ ] **Persistence** -- Enable AOF (`appendonly yes`) for durability. RDB alone risks losing recent connection state on crash.
- [ ] **Sentinel / Cluster** -- For HA, use Redis Sentinel (automatic failover) or Redis Cluster (horizontal scaling). Pass the Sentinel/Cluster `ioredis` instance to `redis.connection`.

## 3. Socket.IO Scaling

- [ ] **Sticky sessions** -- Required when running multiple servers behind a load balancer. Configure your LB to route by `sid` cookie or IP hash.
- [ ] **Redis adapter** -- Install `@socket.io/redis-adapter` for multi-server broadcasting:
  ```ts
  import { createAdapter } from '@socket.io/redis-adapter';
  const io = engine.attach(httpServer);
  io.adapter(createAdapter(pubClient, subClient));
  ```
- [ ] **CORS** -- Set `socket.cors.origin` to your exact frontend domains. Never use `'*'` in production.
- [ ] **Transport** -- Socket.IO defaults to polling then upgrades to WebSocket. If your LB supports WebSocket, force it: configure `transports: ['websocket']` on the client.

## 4. Rate Limiting

- [ ] **Default** -- 30 messages per session per minute (`options.rateLimitPerMinute`).
- [ ] **Tuning** -- Increase for high-throughput scenarios (e.g., `60` for agent-heavy workflows). Decrease for public-facing widgets exposed to abuse.
- [ ] **Typing throttle** -- Built-in at 1 event per 2 seconds per session. No configuration needed.

## 5. Session Management

- [ ] **Idle timeout** -- Default 5 minutes (`options.idleTimeoutMs`). Increase for complex support scenarios.
- [ ] **Reconnect window** -- Default 5 minutes (`options.reconnectWindowMs`). Visitors who reconnect within this window resume their session.
- [ ] **Session resumption** -- Default 24 hours (`options.sessionResumptionMs`). Controls how long a resolved session can be resumed.
- [ ] **Cleanup** -- Sessions transition to `Abandoned` automatically via the timeout worker (`options.sessionTimeoutCheckMs`, default 30s check interval). No cron job needed.
- [ ] **Single session** -- `options.singleSessionPerVisitor` (default `true`) prevents duplicate active sessions per visitor.

## 6. Security

- [ ] **Agent authentication** -- Implement `adapters.authenticateAgent` to validate JWT/session tokens. Without it, anyone can connect to the agent namespace.
- [ ] **Request authentication** -- Implement `adapters.authenticateRequest` to protect REST admin routes. Mount your own auth middleware before `engine.routes`.
- [ ] **CORS** -- Restrict `socket.cors.origin` to known domains. Enable `credentials: true` only if needed.
- [ ] **Input validation** -- Built-in via Zod schemas. Message length is capped at `options.maxMessageLength` (default 5000).
- [ ] **Webhooks** -- If using webhook integration, validate HMAC signatures on incoming webhook payloads.
- [ ] **File uploads** -- Size limit enforced at `options.maxUploadSizeMb` (default 5 MB). Implement `adapters.fileStorage` for controlled storage.

## 7. Monitoring

Key metrics to track via the `onMetric` hook:

| Metric | What It Tells You |
|--------|-------------------|
| Session creation rate | Traffic volume |
| Escalation rate | AI effectiveness (high = AI needs tuning) |
| Queue depth | Agent capacity -- growing queue = understaffed |
| AI response time | Provider performance (via `onAiRequest` hook) |
| Agent concurrent chats | Load per agent |
| Abandoned session rate | UX issues or long wait times |
| Feedback ratings | Overall satisfaction |

**Prometheus example:**

```ts
import { Counter, Histogram } from 'prom-client';

const chatMetrics = new Counter({ name: 'chat_events', help: 'Chat events', labelNames: ['name'] });
const aiDuration = new Histogram({ name: 'chat_ai_duration_ms', help: 'AI response duration' });

const engine = createChatEngine({
  // ...config
  hooks: {
    onMetric: (metric) => {
      chatMetrics.inc({ name: metric.name }, metric.value);
    },
    onAiRequest: async (payload) => {
      if (payload.stage === 'completed' && payload.durationMs) {
        aiDuration.observe(payload.durationMs);
      }
    },
    onError: (error, context) => {
      sentry.captureException(error, { extra: context });
    },
  },
});
```

## 8. AI Provider

- [ ] **Error handling** -- If `generateAiResponse` throws, the engine catches it and emits an `onError` hook. The session stays active -- the visitor sees no response but can still type.
- [ ] **Fallback to manual** -- On repeated AI failures, consider escalating to a human agent in your `generateAiResponse` adapter.
- [ ] **Token budget** -- Manage token limits in your `chat.generate` function (chat-ai). The engine does not enforce token budgets -- that is your adapter's responsibility.
- [ ] **Key rotation** -- Rotate API keys in your generate function to avoid rate limits from a single key (see chat-ai README for key rotation example).
- [ ] **AI debounce** -- Default 15 seconds (`options.aiDebounceMs`). If a visitor sends multiple messages quickly, AI waits until they stop typing. Increase for verbose visitors, decrease for fast interactions.

## 9. File Storage

- [ ] **Implement `adapters.fileStorage`** -- Provides `upload`, `delete`, and optional `getSignedUrl` methods. Without it, file uploads are disabled.
- [ ] **CDN** -- Return CDN URLs from your `upload` method for faster delivery.
- [ ] **Virus scanning** -- Scan uploaded files before storing. Run antivirus in your `upload` adapter before persisting to S3/GCS.
- [ ] **Size limits** -- Enforced at `options.maxUploadSizeMb` (default 5 MB). Adjust based on your storage budget.
- [ ] **Signed URLs** -- Implement `getSignedUrl` for private file access with expiring links.

## 10. Business Hours

- [ ] **Configure via REST API** -- Business hours are managed through `PUT /settings` with schedule and timezone.
- [ ] **Timezone** -- Store as IANA timezone string (e.g., `'America/New_York'`). The widget uses this to show offline state outside business hours.
- [ ] **Holidays** -- Add holiday dates to the business hours config. The widget respects these alongside the weekly schedule.
- [ ] **Offline behavior** -- Configure the widget's `offlineConfig` to show a form, message, or auto-hide when outside business hours.

## 11. Graceful Shutdown

```ts
process.on('SIGTERM', async () => {
  await engine.destroy();  // stops timeout worker, clears timers, releases Redis locks, closes Socket.IO
  await mongoose.connection.close();
  process.exit(0);
});
```

## 12. Multi-Tenant

- [ ] **Tenant isolation** -- Set `tenantId` in `createChatEngine()` config to scope all data to a tenant.
- [ ] **Collection prefix** -- Use `db.collectionPrefix` to isolate MongoDB collections per tenant.
- [ ] **Redis prefix** -- Use `redis.keyPrefix` with tenant identifier (e.g., `'tenant1:chat:'`).
