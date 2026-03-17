# @astralibx/chat-engine

Real-time chat engine with Socket.IO gateway, session lifecycle, message routing, agent management, Redis caching, rate limiting, FAQ/guided questions management, and REST admin API.

## Installation

```bash
npm install @astralibx/chat-engine
```

### Peer Dependencies

```bash
npm install express mongoose socket.io ioredis
```

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

## Configuration Reference

| Option | Type | Default | Description |
|---|---|---|---|
| `db.connection` | `mongoose.Connection` | **required** | Mongoose connection instance |
| `db.collectionPrefix` | `string` | `''` | Prefix for all collection names |
| `redis.connection` | `ioredis.Redis` | **required** | Redis connection instance |
| `redis.keyPrefix` | `string` | `'chat:'` | Prefix for all Redis keys |
| `socket.cors` | `object` | `undefined` | CORS config for Socket.IO |
| `socket.namespaces.visitor` | `string` | `'/chat'` | Visitor namespace path |
| `socket.namespaces.agent` | `string` | `'/agent'` | Agent namespace path |
| `options.maxMessageLength` | `number` | `5000` | Max message content length |
| `options.rateLimitPerMinute` | `number` | `30` | Rate limit per session per minute |
| `options.sessionVisibilityMs` | `number` | `86400000` | Session visibility window (24hr) |
| `options.sessionResumptionMs` | `number` | `86400000` | Session resumption window (24hr) |
| `options.maxSessionHistory` | `number` | `50` | Max messages loaded on reconnect |
| `options.idleTimeoutMs` | `number` | `300000` | Idle timeout (5min) |
| `options.maxConcurrentChatsPerAgent` | `number` | `5` | Max concurrent chats per agent |
| `options.aiDebounceMs` | `number` | `15000` | AI debounce delay |
| `options.aiTypingSimulation` | `boolean` | `true` | Simulate typing before AI response |
| `options.aiTypingSpeedCpm` | `number` | `600` | AI typing simulation speed (chars/min) |
| `options.sessionTimeoutCheckMs` | `number` | `30000` | Session timeout worker check interval |
| `options.reconnectWindowMs` | `number` | `300000` | Disconnect grace period (5min) |
| `options.pendingMessageTTLMs` | `number` | `86400000` | Pending message TTL (24hr) |

## REST API Reference

All responses use the envelope format `{ success: true, data: ... }` or `{ success: false, error: "message" }`.

### Sessions

| Method | Path | Description |
|---|---|---|
| `GET` | `/sessions` | Paginated list (query: status, channel, mode, search, dateFrom, dateTo, page, limit) |
| `GET` | `/sessions/:sessionId` | Single session |
| `GET` | `/sessions/:sessionId/messages` | Message history (query: before, limit) |
| `POST` | `/sessions/:sessionId/resolve` | End session |
| `POST` | `/sessions/:sessionId/feedback` | Submit feedback (body: { rating?, survey? }) |
| `GET` | `/sessions/feedback-stats` | Aggregate feedback ratings |

### Offline Messages

| Method | Path | Description |
|---|---|---|
| `POST` | `/offline-messages` | Submit offline message (public, body: { visitorId, formData }) |
| `GET` | `/offline-messages` | List offline messages (protected, query: dateFrom, dateTo, page, limit) |

### Agents

| Method | Path | Description |
|---|---|---|
| `GET` | `/agents` | List all agents |
| `GET` | `/agents/:agentId` | Single agent |
| `POST` | `/agents` | Create agent |
| `PUT` | `/agents/:agentId` | Update agent |
| `DELETE` | `/agents/:agentId` | Delete agent |
| `POST` | `/agents/:agentId/toggle-active` | Toggle active status |

### Settings

| Method | Path | Description |
|---|---|---|
| `GET` | `/settings` | Get global settings |
| `PUT` | `/settings` | Update settings |

### FAQ

| Method | Path | Description |
|---|---|---|
| `GET` | `/faq` | List items (query: category, search) |
| `GET` | `/faq/categories` | List distinct categories |
| `POST` | `/faq` | Create item |
| `PUT` | `/faq/:itemId` | Update item |
| `DELETE` | `/faq/:itemId` | Delete item |
| `PUT` | `/faq/reorder` | Reorder items (body: { items: [{ itemId, order }] }) |
| `POST` | `/faq/import` | Bulk import (body: { items: [...] }) |

### Guided Questions

| Method | Path | Description |
|---|---|---|
| `GET` | `/guided-questions` | List all questions |
| `POST` | `/guided-questions` | Create question |
| `PUT` | `/guided-questions/:questionId` | Update question |
| `DELETE` | `/guided-questions/:questionId` | Delete question |
| `PUT` | `/guided-questions/reorder` | Reorder questions |

### Canned Responses

| Method | Path | Description |
|---|---|---|
| `GET` | `/canned-responses` | List (query: category, search) |
| `POST` | `/canned-responses` | Create |
| `PUT` | `/canned-responses/:id` | Update |
| `DELETE` | `/canned-responses/:id` | Delete |

### Widget Config

| Method | Path | Description |
|---|---|---|
| `GET` | `/widget-config` | Get config (public, no auth) |
| `PUT` | `/widget-config` | Update config (protected) |

### Stats

| Method | Path | Description |
|---|---|---|
| `GET` | `/stats` | Dashboard stats |

## Socket Events Reference

See [@astralibx/chat-types](https://github.com/Hariprakash1997/astralib/tree/main/packages/chat/chat-types) for event definitions.

## Adapters

| Adapter | Required | Description |
|---|---|---|
| `assignAgent` | Yes | Returns an available agent or null to queue |
| `generateAiResponse` | No | AI response generation (opt-in) |
| `identifyVisitor` | No | Identify visitor from context data |
| `authenticateAgent` | No | Authenticate agent WebSocket connections |
| `authenticateVisitor` | No | Authenticate visitor connections |
| `authenticateRequest` | No | Protect REST admin routes (wraps all except `GET /widget-config`) |
| `trackEvent` | No | Track chat events for analytics |

## Hooks

| Hook | Trigger |
|---|---|
| `onSessionCreated` | New session created |
| `onSessionResolved` | Session resolved |
| `onSessionAbandoned` | Session abandoned (timeout) |
| `onMessageSent` | Message sent |
| `onAgentTakeOver` | Agent takes over AI session |
| `onAgentHandBack` | Agent hands back to AI |
| `onEscalation` | Session escalated to human |
| `onQueueJoin` | Visitor joins agent queue |
| `onQueuePositionChanged` | Queue position updated |
| `onVisitorConnected` | Visitor WebSocket connected |
| `onVisitorDisconnected` | Visitor WebSocket disconnected |
| `onAgentTransfer` | Session transferred between agents |
| `onFeedbackReceived` | Visitor submits feedback |
| `onOfflineMessage` | Offline message received |
| `onMetric` | Metric event emitted |
| `onError` | Error occurred |

## Links

- [GitHub](https://github.com/Hariprakash1997/astralib/tree/main/packages/chat/chat-engine)
- [chat-types](https://github.com/Hariprakash1997/astralib/tree/main/packages/chat/chat-types)
