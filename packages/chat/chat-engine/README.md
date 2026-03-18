# @astralibx/chat-engine

[![npm version](https://img.shields.io/npm/v/@astralibx/chat-engine.svg)](https://www.npmjs.com/package/@astralibx/chat-engine)
[![License: MIT](https://img.shields.io/badge/License-MIT-blue.svg)](https://opensource.org/licenses/MIT)

Real-time chat engine with Socket.IO gateway, session lifecycle, message routing, agent management, Redis caching, rate limiting, FAQ/guided questions management, and REST admin API.

## Install

```bash
npm install @astralibx/chat-engine
```

### Peer Dependencies

| Package | Required |
|---------|----------|
| `express` | Yes |
| `mongoose` | Yes |
| `socket.io` | Yes |
| `ioredis` | Yes |

```bash
npm install express mongoose socket.io ioredis
```

## Requirements

Redis is **mandatory** for chat-engine. It handles:
- Visitor/agent connection tracking
- Rate limiting
- Session activity tracking
- AI response locking
- Pending message storage
- Typing indicator debounce

There is no in-memory fallback. Provide a Redis connection via `redis.connection`.

## Quick Start

```ts
import { createChatEngine } from '@astralibx/chat-engine';
import mongoose from 'mongoose';
import Redis from 'ioredis';
import express from 'express';
import { createServer } from 'http';

const app = express();
app.use(express.json());

const connection = mongoose.createConnection('mongodb://localhost:27017/chat');
const redis = new Redis();

const engine = createChatEngine({
  db: { connection, collectionPrefix: '' },
  redis: { connection: redis, keyPrefix: 'chat:' },
  socket: {
    cors: { origin: ['https://example.com'], credentials: true },
    namespaces: { visitor: '/chat', agent: '/agent' },
  },
  adapters: {
    assignAgent: async (context) => {
      // Return an available agent or null for queue
      return null;
    },
  },
});

// Mount REST routes
app.use('/api/chat', engine.routes);

// Attach Socket.IO gateway
const httpServer = createServer(app);
engine.attach(httpServer);
httpServer.listen(3000);
```

## Full Setup with AI

```ts
const engine = createChatEngine({
  db: { connection },
  redis: { connection: redis, keyPrefix: 'myapp:chat:' },
  socket: {
    cors: { origin: ['https://myapp.com'], credentials: true },
  },
  adapters: {
    assignAgent: async (context) => {
      // Find least busy online agent
      const agent = await engine.agents.findLeastBusy();
      return agent ? engine.agents.toAgentInfo(agent) : null;
    },
    generateAiResponse: ai.generateResponse,  // from @astralibx/chat-ai
    authenticateAgent: async (token) => {
      const user = await verifyJWT(token);
      return user ? { adminUserId: user.id, displayName: user.name } : null;
    },
  },
  hooks: {
    onSessionCreated: (session) => console.log('New chat:', session.sessionId),
    onEscalation: (sessionId) => notifySlack(`Chat ${sessionId} needs human agent`),
    onMetric: (metric) => prometheus.observe(metric.name, metric.value, metric.labels),
  },
});
```

## Features

- **Real-time messaging** -- Socket.IO gateway with visitor and agent namespaces, typing indicators, read receipts, and pending message delivery. [Details](https://github.com/Hariprakash1997/astralib/blob/main/packages/chat/chat-engine/docs/socket-events.md)
- **Session lifecycle** -- Create, resume, resolve, abandon sessions with idle timeout, reconnect window, and feedback collection. [Details](https://github.com/Hariprakash1997/astralib/blob/main/packages/chat/chat-engine/docs/api-routes.md)
- **Agent management** -- CRUD agents, online/offline tracking, concurrent chat limits, chat transfer between agents. [Details](https://github.com/Hariprakash1997/astralib/blob/main/packages/chat/chat-engine/docs/api-routes.md)
- **AI mode** -- Pluggable AI response generation with automatic debouncing and typing simulation. [Details](https://github.com/Hariprakash1997/astralib/blob/main/packages/chat/chat-engine/docs/adapters.md)
- **Escalation** -- Visitor-initiated escalation from AI to human agent with auto-assignment. [Details](https://github.com/Hariprakash1997/astralib/blob/main/packages/chat/chat-engine/docs/socket-events.md)
- **FAQ and guided questions** -- CRUD, reorder, import, category filtering. [Details](https://github.com/Hariprakash1997/astralib/blob/main/packages/chat/chat-engine/docs/api-routes.md)
- **Canned responses** -- Pre-built agent replies with category and search support. [Details](https://github.com/Hariprakash1997/astralib/blob/main/packages/chat/chat-engine/docs/api-routes.md)
- **Widget config** -- Public endpoint for client widget configuration. [Details](https://github.com/Hariprakash1997/astralib/blob/main/packages/chat/chat-engine/docs/api-routes.md)
- **Rate limiting** -- Per-session message rate limiting via Redis. [Details](https://github.com/Hariprakash1997/astralib/blob/main/packages/chat/chat-engine/docs/configuration.md)
- **Lifecycle hooks** -- 16 hooks for session events, messages, escalation, metrics, and errors. [Details](https://github.com/Hariprakash1997/astralib/blob/main/packages/chat/chat-engine/docs/hooks.md)
- **Pluggable adapters** -- Authentication, agent assignment, AI generation, visitor identification, event tracking. [Details](https://github.com/Hariprakash1997/astralib/blob/main/packages/chat/chat-engine/docs/adapters.md)
- **Error classes** -- Typed errors with codes for every failure scenario. [Details](https://github.com/Hariprakash1997/astralib/blob/main/packages/chat/chat-engine/docs/error-handling.md)

## Architecture

The library exposes an Express router and a Socket.IO gateway from a single factory call:

| Export | Purpose | Access |
|--------|---------|--------|
| `engine.routes` | REST admin API -- sessions, agents, FAQ, settings, stats | Protected (add your auth middleware) |
| `engine.attach(httpServer)` | Socket.IO gateway -- visitor and agent namespaces | WebSocket (adapter-authenticated) |

All services are also available programmatically via the returned `engine` object.

## Getting Started Guide

1. [Configuration](https://github.com/Hariprakash1997/astralib/blob/main/packages/chat/chat-engine/docs/configuration.md) -- Set up database, Redis, socket, and options
2. [Adapters](https://github.com/Hariprakash1997/astralib/blob/main/packages/chat/chat-engine/docs/adapters.md) -- Implement agent assignment, AI, and authentication
3. [Hooks](https://github.com/Hariprakash1997/astralib/blob/main/packages/chat/chat-engine/docs/hooks.md) -- Wire up analytics, logging, and monitoring

Reference: [API Routes](https://github.com/Hariprakash1997/astralib/blob/main/packages/chat/chat-engine/docs/api-routes.md) | [Socket Events](https://github.com/Hariprakash1997/astralib/blob/main/packages/chat/chat-engine/docs/socket-events.md) | [Error Handling](https://github.com/Hariprakash1997/astralib/blob/main/packages/chat/chat-engine/docs/error-handling.md)

### Redis Key Prefix (Required for Multi-Project Deployments)

> **WARNING:** If multiple projects share the same Redis server, you MUST set a unique `keyPrefix` per project. Without this, sessions and connection state will collide across projects.

```ts
const engine = createChatEngine({
  redis: {
    connection: redis,
    keyPrefix: 'myproject-chat:', // REQUIRED if sharing Redis
  },
  // ...
});
```

## Links

- [GitHub](https://github.com/Hariprakash1997/astralib/tree/main/packages/chat/chat-engine)
- [chat-types](https://github.com/Hariprakash1997/astralib/tree/main/packages/chat/chat-types)

## License

MIT
