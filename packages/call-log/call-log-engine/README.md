# @astralibx/call-log-engine

[![npm version](https://img.shields.io/npm/v/@astralibx/call-log-engine.svg)](https://www.npmjs.com/package/@astralibx/call-log-engine)
[![License: MIT](https://img.shields.io/badge/License-MIT-blue.svg)](https://opensource.org/licenses/MIT)

Call log engine with pipelines, timeline-based notes, contact adapters, follow-up worker, analytics, export, and shared agent support.

## Install

```bash
npm install @astralibx/call-log-engine
```

### Peer Dependencies

| Package | Required |
|---------|----------|
| `express` | Yes |
| `mongoose` | Yes |

```bash
npm install express mongoose
```

## Requirements

MongoDB is **mandatory** for call-log-engine. It stores pipelines, call logs (with embedded timelines), and settings.

There is no Redis dependency -- the follow-up worker polls MongoDB directly.

## Quick Start

```ts
import { createCallLogEngine } from '@astralibx/call-log-engine';
import mongoose from 'mongoose';
import express from 'express';

const app = express();
app.use(express.json());

const connection = mongoose.createConnection('mongodb://localhost:27017/myapp');

const engine = createCallLogEngine({
  db: { connection, collectionPrefix: '' },
  adapters: {
    lookupContact: async (query) => {
      // Look up contact by phone/email/externalId
      return null;
    },
    authenticateAgent: async (token) => {
      // Verify JWT/session token, return { adminUserId, displayName } or null
      return null;
    },
  },
});

// Mount REST routes
app.use('/api/call-log', engine.routes);

app.listen(3000);

// Graceful shutdown -- stops the follow-up worker
process.on('SIGTERM', async () => {
  await engine.destroy();
});
```

## Full Setup with Agent Sharing

When running alongside `@astralibx/chat-engine`, both engines share the same agent collection by default (`chatagents`). See [Agent Sharing](https://github.com/Hariprakash1997/astralib/blob/main/packages/call-log/call-log-engine/docs/agent-sharing.md).

```ts
const engine = createCallLogEngine({
  db: { connection },
  agents: {
    collectionName: 'chatagents',  // default -- same collection chat-engine uses
    resolveAgent: async (agentId) => {
      const agent = await AgentModel.findById(agentId);
      return agent ? { agentId: agent._id.toString(), displayName: agent.name } : null;
    },
  },
  adapters: {
    lookupContact: async (query) => {
      const contact = await ContactModel.findOne(query);
      return contact
        ? { externalId: contact._id.toString(), displayName: contact.name, phone: contact.phone }
        : null;
    },
    addContact: async (data) => {
      const contact = await ContactModel.create(data);
      return { externalId: contact._id.toString(), displayName: contact.displayName };
    },
    authenticateAgent: async (token) => {
      const user = await verifyJWT(token);
      return user ? { adminUserId: user.id, displayName: user.name } : null;
    },
  },
  hooks: {
    onCallCreated: (callLog) => console.log('New call:', callLog.callLogId),
    onStageChanged: (callLog, from, to) => console.log(`Stage: ${from} -> ${to}`),
    onCallClosed: (callLog) => console.log('Call closed:', callLog.callLogId),
    onFollowUpDue: async (callLog) => notifyAgent(callLog),
    onMetric: (metric) => prometheus.observe(metric.name, metric.value, metric.labels),
  },
  options: {
    maxTimelineEntries: 200,         // default
    followUpCheckIntervalMs: 60_000, // default: 1 minute
  },
});
```

## Features

- **Pipeline management** -- CRUD pipelines with configurable stages, default/terminal flags, and stage reordering. [Details](https://github.com/Hariprakash1997/astralib/blob/main/packages/call-log/call-log-engine/docs/api-routes.md)
- **Call log lifecycle** -- Create, update, change stage, assign, close, reopen calls with automatic timeline tracking. [Details](https://github.com/Hariprakash1997/astralib/blob/main/packages/call-log/call-log-engine/docs/api-routes.md)
- **Timeline** -- Append-only audit trail per call with notes, stage changes, assignments, follow-up events. [Details](https://github.com/Hariprakash1997/astralib/blob/main/packages/call-log/call-log-engine/docs/api-routes.md)
- **Contact timeline** -- Merged cross-call timeline for a contact. [Details](https://github.com/Hariprakash1997/astralib/blob/main/packages/call-log/call-log-engine/docs/api-routes.md)
- **Follow-up worker** -- Background worker polls for due follow-ups and fires `onFollowUpDue` hook. Starts automatically, stops via `engine.destroy()`. [Details](https://github.com/Hariprakash1997/astralib/blob/main/packages/call-log/call-log-engine/docs/hooks.md)
- **Analytics** -- Dashboard stats, agent stats, leaderboard, pipeline stats/funnel, team stats, daily/weekly/overall reports. [Details](https://github.com/Hariprakash1997/astralib/blob/main/packages/call-log/call-log-engine/docs/api-routes.md)
- **Export** -- Bulk call export, single call export, pipeline report export in JSON or CSV. [Details](https://github.com/Hariprakash1997/astralib/blob/main/packages/call-log/call-log-engine/docs/api-routes.md)
- **Settings** -- Runtime-mutable tags, categories, priority levels, follow-up defaults. [Details](https://github.com/Hariprakash1997/astralib/blob/main/packages/call-log/call-log-engine/docs/api-routes.md)
- **Bulk operations** -- Bulk stage change for multiple call logs at once. [Details](https://github.com/Hariprakash1997/astralib/blob/main/packages/call-log/call-log-engine/docs/api-routes.md)
- **Contact adapters** -- Pluggable contact lookup and creation. [Details](https://github.com/Hariprakash1997/astralib/blob/main/packages/call-log/call-log-engine/docs/adapters.md)
- **Agent sharing** -- Reuse chat-engine's agent collection. [Details](https://github.com/Hariprakash1997/astralib/blob/main/packages/call-log/call-log-engine/docs/agent-sharing.md)
- **Lifecycle hooks** -- 6 hooks for call events, follow-ups, and metrics. [Details](https://github.com/Hariprakash1997/astralib/blob/main/packages/call-log/call-log-engine/docs/hooks.md)
- **Error classes** -- Typed errors with codes for every failure scenario.

## Architecture

The library exposes an Express router from a single factory call:

| Export | Purpose | Access |
|--------|---------|--------|
| `engine.routes` | REST API -- pipelines, calls, contacts, analytics, settings, export | Protected (via `authenticateAgent` adapter) |
| `engine.destroy()` | Stops follow-up worker, cleans up resources | Call on shutdown |

All services are also available programmatically via the returned `engine` object: `pipelines`, `callLogs`, `timeline`, `analytics`, `settings`, `export`, `models`.

## Getting Started Guide

1. [Configuration](https://github.com/Hariprakash1997/astralib/blob/main/packages/call-log/call-log-engine/docs/configuration.md) -- Set up database, agents, adapters, and options
2. [Adapters](https://github.com/Hariprakash1997/astralib/blob/main/packages/call-log/call-log-engine/docs/adapters.md) -- Implement contact lookup, authentication, and agent resolution
3. [Hooks](https://github.com/Hariprakash1997/astralib/blob/main/packages/call-log/call-log-engine/docs/hooks.md) -- Wire up notifications, analytics, and monitoring

Guides: [Agent Sharing](https://github.com/Hariprakash1997/astralib/blob/main/packages/call-log/call-log-engine/docs/agent-sharing.md)

Reference: [API Routes](https://github.com/Hariprakash1997/astralib/blob/main/packages/call-log/call-log-engine/docs/api-routes.md)

## Links

- [GitHub](https://github.com/Hariprakash1997/astralib/tree/main/packages/call-log/call-log-engine)
- [call-log-types](https://github.com/Hariprakash1997/astralib/tree/main/packages/call-log/call-log-types)
- [CHANGELOG](https://github.com/Hariprakash1997/astralib/blob/main/packages/call-log/call-log-engine/CHANGELOG.md)

## License

MIT
