# Full-Stack Example

Complete working example: Express server with `createCallLogEngine`, mounted routes, adapter implementations, and UI setup.

## Server

```ts
import express from 'express';
import mongoose from 'mongoose';
import jwt from 'jsonwebtoken';
import { createCallLogEngine } from '@astralibx/call-log-engine';

// ── MongoDB ─────────────────────────────────────────────────────────────────

const connection = mongoose.createConnection('mongodb://localhost:27017/myapp');

// ── Mock contact store ──────────────────────────────────────────────────────

const contacts = new Map<string, { _id: string; name: string; phone?: string; email?: string }>([
  ['c1', { _id: 'c1', name: 'Alice Smith', phone: '+1234567890', email: 'alice@example.com' }],
  ['c2', { _id: 'c2', name: 'Bob Johnson', phone: '+0987654321' }],
]);

// ── Create engine ───────────────────────────────────────────────────────────

const engine = createCallLogEngine({
  db: { connection, collectionPrefix: '' },

  agents: {
    collectionName: 'chatagents',
    resolveAgent: async (agentId) => {
      // In production, query your agent/user store
      return { agentId, displayName: `Agent ${agentId}` };
    },
  },

  adapters: {
    lookupContact: async (query) => {
      // Search by externalId, phone, or email
      for (const c of contacts.values()) {
        if (query.externalId && c._id === query.externalId) {
          return { externalId: c._id, displayName: c.name, phone: c.phone, email: c.email };
        }
        if (query.phone && c.phone === query.phone) {
          return { externalId: c._id, displayName: c.name, phone: c.phone, email: c.email };
        }
        if (query.email && c.email === query.email) {
          return { externalId: c._id, displayName: c.name, phone: c.phone, email: c.email };
        }
      }
      return null;
    },

    addContact: async (data) => {
      const id = `c${contacts.size + 1}`;
      const contact = { _id: id, name: data.displayName, phone: data.phone, email: data.email };
      contacts.set(id, contact);
      return { externalId: id, displayName: data.displayName, phone: data.phone, email: data.email };
    },

    authenticateAgent: async (token) => {
      try {
        const decoded = jwt.verify(token, process.env.JWT_SECRET || 'secret') as { sub: string; name: string };
        return { adminUserId: decoded.sub, displayName: decoded.name };
      } catch {
        return null;
      }
    },
  },

  hooks: {
    onCallCreated: (callLog) => {
      console.log(`[call-log] Created: ${callLog.callLogId} for ${callLog.contactRef.displayName}`);
    },
    onStageChanged: (callLog, from, to) => {
      console.log(`[call-log] Stage: ${from} -> ${to} (${callLog.callLogId})`);
    },
    onCallClosed: (callLog) => {
      console.log(`[call-log] Closed: ${callLog.callLogId}`);
    },
    onFollowUpDue: async (callLog) => {
      console.log(`[call-log] Follow-up due: ${callLog.contactRef.displayName}`);
      // In production: send email, Slack notification, push notification, etc.
    },
    onMetric: (metric) => {
      console.log(`[metric] ${metric.name}`, metric.labels);
    },
  },

  options: {
    maxTimelineEntries: 200,
    followUpCheckIntervalMs: 60_000,
  },
});

// ── Express app ─────────────────────────────────────────────────────────────

const app = express();
app.use(express.json());

// Mount call-log routes
app.use('/api/call-log', engine.routes);

// Start server
app.listen(3000, () => {
  console.log('Server running on http://localhost:3000');
});

// Graceful shutdown
process.on('SIGTERM', async () => {
  await engine.destroy();
  await connection.close();
  process.exit(0);
});
```

## With chat-engine (agent sharing)

```ts
import { createChatEngine } from '@astralibx/chat-engine';
import { createCallLogEngine } from '@astralibx/call-log-engine';
import Redis from 'ioredis';

const connection = mongoose.createConnection('mongodb://localhost:27017/myapp');
const redis = new Redis();

// Chat engine manages agents
const chatEngine = createChatEngine({
  db: { connection },
  redis: { connection: redis, keyPrefix: 'chat:' },
  socket: { cors: { origin: ['http://localhost:5173'], credentials: true } },
  adapters: {
    assignAgent: async () => null,
    authenticateAgent: async (token) => {
      const user = await verifyJWT(token);
      return user ? { adminUserId: user.id, displayName: user.name } : null;
    },
  },
});

// Call-log engine shares agents
const callLogEngine = createCallLogEngine({
  db: { connection },
  agents: {
    collectionName: 'chatagents',
    resolveAgent: async (agentId) => {
      const agents = await chatEngine.agents.list();
      const agent = agents.find(a => a._id.toString() === agentId);
      return agent ? { agentId: agent._id.toString(), displayName: agent.name } : null;
    },
  },
  adapters: {
    lookupContact: async (query) => { /* ... */ },
    authenticateAgent: async (token) => {
      const user = await verifyJWT(token);
      return user ? { adminUserId: user.id, displayName: user.name } : null;
    },
  },
});

app.use('/api/chat', chatEngine.routes);
app.use('/api/call-log', callLogEngine.routes);

const httpServer = createServer(app);
chatEngine.attach(httpServer);
httpServer.listen(3000);
```

## Frontend (UI Setup)

```ts
// main.ts
import { CallLogUIConfig } from '@astralibx/call-log-ui';

CallLogUIConfig.setup({
  callLogApi: '/api/call-log',
  authToken: `Bearer ${localStorage.getItem('token')}`,
  theme: 'dark',
});

// Import registers all custom elements
import '@astralibx/call-log-ui';
```

```html
<!-- index.html -->
<!DOCTYPE html>
<html>
<head>
  <title>Call Log Dashboard</title>
  <script type="module" src="/main.ts"></script>
  <style>
    body { margin: 0; height: 100vh; }
    alx-call-log-dashboard { height: 100vh; }
  </style>
</head>
<body>
  <alx-call-log-dashboard
    defaultTab="mycalls"
    agentId="current-agent-id"
    theme="dark"
  ></alx-call-log-dashboard>
</body>
</html>
```

### Using individual components

```html
<!-- Pipeline Kanban board -->
<alx-pipeline-board pipelineId="pipeline-abc"></alx-pipeline-board>

<!-- Call log list + detail side-by-side -->
<div style="display: grid; grid-template-columns: 1fr 1fr; gap: 1rem;">
  <alx-call-log-list></alx-call-log-list>
  <alx-call-log-detail callLogId="call-xyz"></alx-call-log-detail>
</div>

<!-- Analytics -->
<alx-call-analytics-dashboard></alx-call-analytics-dashboard>
<alx-pipeline-funnel></alx-pipeline-funnel>
<alx-agent-leaderboard></alx-agent-leaderboard>
```

### Updating auth token at runtime

```ts
import { CallLogUIConfig } from '@astralibx/call-log-ui';

// After token refresh
CallLogUIConfig.setAuthToken(`Bearer ${newToken}`);
```
