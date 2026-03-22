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

### Messaging & Real-time

- **Real-time messaging** -- Socket.IO gateway with visitor and agent namespaces, typing indicators, read receipts, and pending message delivery for offline visitors. [Details](https://github.com/Hariprakash1997/astralib/blob/main/packages/chat/chat-engine/docs/socket-events.md)
- **Typing throttle** -- Visitor typing events are automatically throttled server-side (max 1 per 2s) with 30-second auto-timeout to prevent flooding.
- **Pending message queue** -- Messages sent while a visitor is disconnected are stored in Redis and delivered automatically on reconnect.
- **Rate limiting** -- Per-session message rate limiting via Redis (default: 30/min). Rejects excess messages with `RATE_LIMIT_EXCEEDED` error code. [Details](https://github.com/Hariprakash1997/astralib/blob/main/packages/chat/chat-engine/docs/configuration.md)
- **File sharing validation** -- Per-message file type and size validation against configurable allowed MIME types and max file size before upload. [Details](https://github.com/Hariprakash1997/astralib/blob/main/packages/chat/chat-engine/docs/file-uploads.md)

### Sessions

- **Session lifecycle** -- Create, resume, resolve, abandon sessions with idle timeout, reconnect window, and feedback collection. [Details](https://github.com/Hariprakash1997/astralib/blob/main/packages/chat/chat-engine/docs/api-routes.md)
- **Session resumption window** -- Abandoned sessions can be resumed within a configurable time window (`sessionResumptionMs`, default 24h). Resolved/closed sessions never resume.
- **Single session per visitor** -- When enabled (default), reuses the most recent active session for the same visitor across tabs/devices instead of creating duplicates.
- **Session visibility window** -- Sessions auto-extend their `visibleUntil` timestamp on every visitor message. Expired sessions are hidden from the dashboard. Configurable via `sessionVisibilityMs`.
- **Session tags** -- Add/remove tags on sessions from a configurable pool (`availableTags`). Available via REST API and socket events.
- **Session notes** -- Agents can write and delete notes on any session. Notes persist across agent transfers.
- **Session context export** -- Programmatic `getSessionContext(sessionId)` returns full snapshot: session summary, all messages, preferences, conversation summary, feedback, and metadata. Useful for AI input and handoff.

### AI Engine

- **Two-layer AI mode** -- Global AI mode (`manual`, `ai`, `agent-wise`) with per-agent overrides. Resolution: agent-level `modeOverride`/`aiEnabled` takes precedence over global mode when `allowPerAgentMode` is enabled. [Details](https://github.com/Hariprakash1997/astralib/blob/main/packages/chat/chat-engine/docs/adapters.md)
- **AI message debouncing** -- When a visitor sends rapid messages, the engine accumulates them and sends a single AI response after a configurable delay (`aiDebounceMs`, default 15s). Prevents AI flooding.
- **Multi-bubble AI responses** -- AI adapter can return an array of messages. Engine delivers them sequentially with configurable inter-bubble delays, typing indicators, and realistic timing simulation.
- **Realistic typing simulation** -- Full delivery lifecycle: delivery delay (300-1000ms) → read delay (scales with message length) → pre-typing pause (500-1500ms) → typing indicator (based on message length) → message sent. All delays configurable via `aiSimulation` config.
- **AI character profiles** -- Configure AI personality per-agent or globally: name, tone, personality (required), plus optional responseStyle, rules, formality, emojiUsage, expertise, bio. Agent-level character overrides global. [Details](https://github.com/Hariprakash1997/astralib/blob/main/packages/chat/chat-engine/docs/configuration.md)
- **Conversation summarization** -- AI adapter can return a `conversationSummary` string alongside messages. Engine stores it on the session and passes it to subsequent AI calls for long-term context.
- **AI auto-escalation** -- AI adapter can return `shouldEscalate: true` with an optional `escalationReason`. Engine automatically escalates to human agent, creates a system message, notifies all agents, and fires the `onEscalation` hook.
- **Agent-initiated AI messages** -- Agents can trigger AI responses on-demand via the `SendAiMessage` socket event. Engine resolves the AI character, generates the response, delivers multi-bubble messages, and broadcasts to all connected agents.
- **AI request lifecycle** -- `onAiRequest` hook fires at `received`, `completed`, and `failed` stages with `durationMs` tracking. 30-second timeout on AI generation. AI lock prevents concurrent responses per session.
- **Training quality labels** -- Agents can label individual messages and sessions as `good`, `bad`, or `needs_review` for ML training data. Gated by `labelingEnabled` config (default: off). [Details](https://github.com/Hariprakash1997/astralib/blob/main/packages/chat/chat-engine/docs/socket-events.md)

### Agents & Teams

- **Agent management** -- CRUD agents, online/offline tracking, concurrent chat limits, chat transfer between agents. [Details](https://github.com/Hariprakash1997/astralib/blob/main/packages/chat/chat-engine/docs/api-routes.md)
- **Team hierarchy & escalation** -- Multi-level agent hierarchy with teams, direct reports, and tree views for structured escalation paths. [Details](https://github.com/Hariprakash1997/astralib/blob/main/packages/chat/chat-engine/docs/api-routes.md)
- **Escalation** -- Visitor-initiated escalation from AI to human agent with auto-assignment and queue management. [Details](https://github.com/Hariprakash1997/astralib/blob/main/packages/chat/chat-engine/docs/socket-events.md)
- **Agent activity tracking** -- Per-agent activity timestamps stored in Redis on every significant action (connect, accept, send, resolve, transfer). Used for "last seen" tracking.
- **Agent multi-tab support** -- Per-agent connection count tracking in Redis. Agents can open the dashboard in multiple tabs; each connection is tracked separately.
- **Manager chat watching** -- Managers (agents with `isManager` flag) can subscribe to any active session via `WatchChat` event. Read-only observation with real-time message sync. Managers see all active sessions on connect.
- **Support person discovery** -- Visitors can fetch a list of available public agents (`FetchSupportPersons`) and select a preferred agent (`SetPreferredAgent`). Gated by `visitorAgentSelection` setting. In fixed chat mode, agent switching is only allowed if the current agent is offline.

### Visitor Identity

- **User identity resolution** -- `resolveUserIdentity` adapter called on visitor connect. Can return `userId` or `{ userId, userCategory }` for priority routing. If resolved userId differs from current visitorId, all anonymous sessions are automatically merged to the authenticated identity.
- **User conversation history** -- `getUserHistory(visitorId)` returns up to N past sessions (configurable via `userHistoryLimit`, default 5). Gated by `userHistoryEnabled` setting.
- **User info storage** -- Store visitor name, email, mobile on sessions via `updateUserInfo()`. Populated via identify event, REST API, or data extraction adapters.

### Queue & Assignment

- **Queue position tracking** -- Dynamic queue position recalculation when agents accept or resolve chats. Wait time estimation based on last 50 resolved sessions' average duration, number of online agents, and queue position.

### Analytics & Monitoring

- **Dashboard real-time stats** -- `getDashboardStats()` returns active sessions, waiting sessions, resolved today, total agents, active agents. Automatically broadcast to all connected agents via `agent:stats_update` after every significant event (connect, accept, resolve, status change). Also available via `GET /stats` REST endpoint. [Details](https://github.com/Hariprakash1997/astralib/blob/main/packages/chat/chat-engine/docs/api-routes.md)
- **Analytics & reports** -- Agent performance reports, overall chat reports, session export (JSON/CSV), and visitor analytics collection with per-field privacy controls (`collectIp`, `collectBrowser`, `collectLocation`, etc.). [Details](https://github.com/Hariprakash1997/astralib/blob/main/packages/chat/chat-engine/docs/api-routes.md)
- **Webhooks** -- 8 event types with HMAC signature verification, retry logic, and REST management API. [Details](https://github.com/Hariprakash1997/astralib/blob/main/packages/chat/chat-engine/docs/webhooks.md)
- **Lifecycle hooks** -- 20+ hooks for session events, messages, escalation, AI lifecycle, memory, metrics, and errors. [Details](https://github.com/Hariprakash1997/astralib/blob/main/packages/chat/chat-engine/docs/hooks.md)

### Configuration & Admin

- **Multi-tenant** -- Shared database with automatic tenant scoping on all queries and creates. [Details](https://github.com/Hariprakash1997/astralib/blob/main/packages/chat/chat-engine/docs/multi-tenant.md)
- **File uploads** -- Pluggable file storage adapter (S3, GCS, local disk) with admin controls for size/type restrictions and MIME validation. [Details](https://github.com/Hariprakash1997/astralib/blob/main/packages/chat/chat-engine/docs/file-uploads.md)
- **Rating & feedback** -- Configurable rating types (thumbs/stars/emoji) with two-step follow-up flow. Supports both new (typed rating + follow-up) and legacy (1-5 numeric) submission paths. [Details](https://github.com/Hariprakash1997/astralib/blob/main/packages/chat/chat-engine/docs/rating-feedback.md)
- **Business hours** -- Per-day schedule with timezone support, holiday dates, and configurable outside-hours behavior. [Details](https://github.com/Hariprakash1997/astralib/blob/main/packages/chat/chat-engine/docs/configuration.md)
- **FAQ and guided questions** -- CRUD, reorder, import, category filtering. [Details](https://github.com/Hariprakash1997/astralib/blob/main/packages/chat/chat-engine/docs/api-routes.md)
- **Canned responses** -- Pre-built agent replies with category and search support. [Details](https://github.com/Hariprakash1997/astralib/blob/main/packages/chat/chat-engine/docs/api-routes.md)
- **Widget config** -- Public endpoint for client widget configuration. [Details](https://github.com/Hariprakash1997/astralib/blob/main/packages/chat/chat-engine/docs/api-routes.md)
- **Pluggable adapters** -- Authentication, agent assignment, AI generation, visitor identification, file storage, event tracking. [Details](https://github.com/Hariprakash1997/astralib/blob/main/packages/chat/chat-engine/docs/adapters.md)
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
2. [Adapters](https://github.com/Hariprakash1997/astralib/blob/main/packages/chat/chat-engine/docs/adapters.md) -- Implement agent assignment, AI, authentication, and file storage
3. [Hooks](https://github.com/Hariprakash1997/astralib/blob/main/packages/chat/chat-engine/docs/hooks.md) -- Wire up analytics, logging, and monitoring

Guides: [Webhooks](https://github.com/Hariprakash1997/astralib/blob/main/packages/chat/chat-engine/docs/webhooks.md) | [Multi-Tenant](https://github.com/Hariprakash1997/astralib/blob/main/packages/chat/chat-engine/docs/multi-tenant.md) | [File Uploads](https://github.com/Hariprakash1997/astralib/blob/main/packages/chat/chat-engine/docs/file-uploads.md) | [Rating & Feedback](https://github.com/Hariprakash1997/astralib/blob/main/packages/chat/chat-engine/docs/rating-feedback.md)

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
