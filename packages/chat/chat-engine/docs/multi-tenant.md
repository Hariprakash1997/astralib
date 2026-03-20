# Multi-Tenant Mode

Multi-tenant mode lets multiple websites or applications share a single MongoDB database while keeping their data completely isolated.

## When to Use

Use multi-tenant mode when:
- You host chat for multiple customers/websites on one infrastructure
- You want a single database but strict data separation per customer
- Each tenant has its own settings, agents, sessions, and webhooks

Do **not** use multi-tenant mode when:
- You run chat for a single website -- just use the default (no `tenantId`)
- Each customer has their own database -- use separate `db.connection` instances instead

## How to Enable

Pass `tenantId` in the `createChatEngine()` config:

```ts
const engine = createChatEngine({
  tenantId: 'tenant-acme',
  db: { connection },
  redis: { connection: redis, keyPrefix: 'acme:chat:' },
  socket: { cors: { origin: ['https://acme.com'] } },
  adapters: { /* ... */ },
});
```

## What Happens

When `tenantId` is set:

- **All queries are auto-scoped** -- every database query adds `{ tenantId: 'tenant-acme' }` to the filter. Sessions, agents, settings, messages, webhooks, and all other documents are isolated.
- **All creates are auto-tagged** -- every new document gets the `tenantId` field set automatically.
- **Settings are per-tenant** -- each tenant gets its own `ChatSettings` document (keyed by `{ key: 'global', tenantId }`).
- **Redis keys are separate** -- use a unique `keyPrefix` per tenant to isolate connection tracking, rate limiting, and AI locks.

## Data Isolation Guarantees

| Resource | Isolation Method |
|----------|-----------------|
| Sessions | `tenantId` filter on all queries |
| Messages | Scoped via session (sessions are tenant-scoped) |
| Agents | `tenantId` filter on all queries |
| Settings | Separate `ChatSettings` document per tenant |
| Webhooks | `tenantId` filter on all queries |
| FAQ / Guided Questions | `tenantId` filter on all queries |
| Redis state | Isolated via unique `keyPrefix` |

## Example: Two Websites Sharing One Database

```ts
import { createChatEngine } from '@astralibx/chat-engine';
import mongoose from 'mongoose';
import Redis from 'ioredis';

// Shared resources
const connection = mongoose.createConnection('mongodb://localhost:27017/chat-shared');
const redis = new Redis();

// Website A
const engineA = createChatEngine({
  tenantId: 'website-a',
  db: { connection },
  redis: { connection: redis, keyPrefix: 'website-a:chat:' },
  socket: {
    cors: { origin: ['https://website-a.com'] },
    namespaces: { visitor: '/chat-a', agent: '/agent-a' },
  },
  adapters: { /* ... */ },
});

// Website B
const engineB = createChatEngine({
  tenantId: 'website-b',
  db: { connection },
  redis: { connection: redis, keyPrefix: 'website-b:chat:' },
  socket: {
    cors: { origin: ['https://website-b.com'] },
    namespaces: { visitor: '/chat-b', agent: '/agent-b' },
  },
  adapters: { /* ... */ },
});

// Mount separate route prefixes
app.use('/api/chat-a', engineA.routes);
app.use('/api/chat-b', engineB.routes);

// Attach both to the same HTTP server
const httpServer = createServer(app);
engineA.attach(httpServer);
engineB.attach(httpServer);
```

**Key points:**
- Use **different socket namespaces** per tenant so WebSocket connections are routed correctly.
- Use **different Redis key prefixes** per tenant to avoid state collisions.
- Use **different route prefixes** per tenant for the REST API.
- The MongoDB connection can be shared -- `tenantId` filters handle isolation at the query level.
