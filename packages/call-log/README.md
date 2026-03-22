# @astralibx/call-log-*

Production-grade call-log infrastructure for Node.js -- pipeline management, timeline tracking, follow-up scheduling, analytics, and admin dashboard components.

## Features

- **Pipeline-based workflow** -- multi-pipeline support with configurable stages, default/terminal stage flags, and drag-drop Kanban board
- **Call log tracking** -- inbound/outbound calls with contact references, priority levels, tags, categories, and follow-up dates
- **Timeline entries** -- append-only audit trail per call: notes, stage changes, assignments, follow-up events, system events
- **Cross-call contact timeline** -- merged chronological view of all events across all calls for a contact
- **Follow-up scheduler** -- background worker starts automatically inside the factory, polls MongoDB for due follow-ups, fires `onFollowUpDue` hook
- **Analytics** -- dashboard stats, agent leaderboards, pipeline funnels, daily/weekly trends, overall summary, peak-hour analysis, team stats
- **Export** -- bulk or per-call export in JSON or CSV format, plus pipeline report export
- **Settings** -- tenant-scoped available tags, categories, priority levels, follow-up defaults, timeline page size, concurrent call limits
- **Agent sharing** -- reuses the same MongoDB agent collection as chat-engine (`chatagents` by default)
- **Admin dashboard** -- 14 Lit components for pipeline management, call log views, timelines, analytics, agent dashboard, settings

## Packages

| Package | npm | Description |
|---------|-----|-------------|
| [call-log-types](https://github.com/Hariprakash1997/astralib/tree/main/packages/call-log/call-log-types) | `@astralibx/call-log-types` | Shared TypeScript types, enums, and interfaces |
| [call-log-engine](https://github.com/Hariprakash1997/astralib/tree/main/packages/call-log/call-log-engine) | `@astralibx/call-log-engine` | Server engine: services, REST routes, follow-up worker, analytics, export |
| [call-log-ui](https://github.com/Hariprakash1997/astralib/tree/main/packages/call-log/call-log-ui) | `@astralibx/call-log-ui` | Admin dashboard Lit components (14 components) |

## Architecture

```
@astralibx/core
     |
     +-- call-log-types              (pure TS, no runtime deps)
              |
              +-- call-log-engine    (peer: express, mongoose)
              |
              +-- call-log-ui        (dep: lit)
```

- **call-log-engine** has no dependency on **call-log-ui** -- UI is completely optional
- **call-log-ui** shares types via **call-log-types** without pulling in server deps
- The follow-up worker starts automatically when `createCallLogEngine()` is called -- stop it via `engine.destroy()`

## Design Principles

1. **Pipeline agnostic** -- pipelines and stages are fully user-defined. No hardcoded workflow steps.

2. **Adapter-based dependency injection** -- consumers provide `lookupContact`, `addContact`, and `authenticateAgent` adapters. The engine calls them; consumers decide the implementation.

3. **Factory pattern** -- `createCallLogEngine(config)` validates config with Zod, registers Mongoose models, creates services, starts the follow-up worker, and returns routes + services. One function, one clean object.

4. **Append-only timeline** -- timeline entries are never mutated or deleted, ensuring a complete audit trail.

5. **Zero hardcoded business logic** -- no opinionated stage names, priority schemes, or follow-up policies. All naming and config is consumer-controlled via settings.

6. **Shared agent collection** -- call-log-engine and chat-engine share the same MongoDB agent collection, so agents set up for chat are available for call logging without duplication.

## Documentation

| Guide | Description |
|-------|-------------|
| [Full-Stack Example](https://github.com/Hariprakash1997/astralib/blob/main/packages/call-log/docs/full-stack-example.md) | Complete working example with Express, adapters, and UI setup |

**Per-package docs:**

| Package | Docs |
|---------|------|
| call-log-engine | [Configuration](https://github.com/Hariprakash1997/astralib/blob/main/packages/call-log/call-log-engine/docs/configuration.md), [Adapters](https://github.com/Hariprakash1997/astralib/blob/main/packages/call-log/call-log-engine/docs/adapters.md), [Hooks](https://github.com/Hariprakash1997/astralib/blob/main/packages/call-log/call-log-engine/docs/hooks.md), [API Routes](https://github.com/Hariprakash1997/astralib/blob/main/packages/call-log/call-log-engine/docs/api-routes.md), [Agent Sharing](https://github.com/Hariprakash1997/astralib/blob/main/packages/call-log/call-log-engine/docs/agent-sharing.md) |

## End-to-End Setup

### 1. Install packages

```bash
# Server
npm install @astralibx/call-log-engine
npm install express mongoose

# Frontend
npm install @astralibx/call-log-ui
```

### 2. Create the engine

```ts
import { createCallLogEngine } from '@astralibx/call-log-engine';
import mongoose from 'mongoose';

const connection = mongoose.createConnection('mongodb://localhost:27017/myapp');

const engine = createCallLogEngine({
  db: { connection, collectionPrefix: '' },
  agents: {
    collectionName: 'chatagents',
    resolveAgent: async (agentId) => {
      const agent = await AgentModel.findById(agentId);
      return agent ? { agentId: agent._id.toString(), displayName: agent.name } : null;
    },
  },
  adapters: {
    lookupContact: async (query) => {
      const contact = await ContactModel.findOne(query);
      return contact
        ? { externalId: contact._id.toString(), displayName: contact.name, phone: contact.phone, email: contact.email }
        : null;
    },
    authenticateAgent: async (token) => {
      const user = await verifyJWT(token);
      return user ? { adminUserId: user.id, displayName: user.name } : null;
    },
  },
  hooks: {
    onFollowUpDue: async (callLog) => {
      console.log(`Follow-up due for ${callLog.contactRef.displayName}`);
    },
    onMetric: (metric) => {
      prometheus.counter(metric.name, metric.labels).inc(metric.value ?? 1);
    },
  },
});
```

### 3. Mount routes

```ts
import express from 'express';

const app = express();
app.use(express.json());
app.use('/api/call-log', engine.routes);

app.listen(3000);

// Graceful shutdown
process.on('SIGTERM', async () => {
  await engine.destroy();
});
```

### 4. Add the admin dashboard

```ts
import { CallLogUIConfig } from '@astralibx/call-log-ui';

CallLogUIConfig.setup({
  callLogApi: '/api/call-log',
  authToken: 'Bearer ...',
  theme: 'dark',
});

import '@astralibx/call-log-ui';
```

```html
<alx-call-log-dashboard defaultTab="pipelines" theme="dark"></alx-call-log-dashboard>
```

## Package READMEs

1. [call-log-types/README.md](https://github.com/Hariprakash1997/astralib/blob/main/packages/call-log/call-log-types/README.md) -- Types and enums
2. [call-log-engine/README.md](https://github.com/Hariprakash1997/astralib/blob/main/packages/call-log/call-log-engine/README.md) -- Server engine
3. [call-log-ui/README.md](https://github.com/Hariprakash1997/astralib/blob/main/packages/call-log/call-log-ui/README.md) -- Admin dashboard

## License

MIT
