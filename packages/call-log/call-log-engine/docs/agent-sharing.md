# Agent Sharing

call-log-engine and chat-engine can share the same MongoDB agent collection. This means agents set up for live chat are automatically available for call logging -- no duplicate agent management.

## How It Works

Both engines reference the same MongoDB collection for agents. By default, this collection is named `chatagents` (the collection chat-engine creates). call-log-engine does not create or manage agent documents itself -- it reads from the shared collection and optionally resolves agent display names via the `resolveAgent` adapter.

## Configuration

### `agents.collectionName`

| Option | Type | Default |
|--------|------|---------|
| `agents.collectionName` | `string` | `'chatagents'` |

Set this to match whatever collection name your chat-engine uses. If you are not using chat-engine, point it to your own agent collection.

### `resolveAgent`

The `resolveAgent` adapter maps an agent ID to display information. The analytics service calls this when generating leaderboards and reports so that agent names appear instead of raw IDs.

```ts
agents: {
  resolveAgent: async (agentId) => {
    const agent = await AgentModel.findById(agentId);
    return agent ? { agentId: agent._id.toString(), displayName: agent.name } : null;
  },
}
```

## What call-log-engine Uses from Agent Documents

call-log-engine stores `agentId` on call log documents as a string reference. It does not directly query or modify agent documents for normal CRUD operations. The only place it reads agent documents is through the `resolveAgent` adapter.

The `ICallLogSettings.maxConcurrentCalls` field controls agent capacity for call assignments. This is stored in the call-log settings, not on agent documents.

## Setup Example: Both Engines on Same Connection

```ts
import mongoose from 'mongoose';
import { createChatEngine } from '@astralibx/chat-engine';
import { createCallLogEngine } from '@astralibx/call-log-engine';

const connection = mongoose.createConnection('mongodb://localhost:27017/myapp');

// Chat engine -- creates and manages agent documents in 'chatagents'
const chatEngine = createChatEngine({
  db: { connection },
  redis: { connection: redis, keyPrefix: 'chat:' },
  socket: { cors: { origin: ['https://myapp.com'], credentials: true } },
  adapters: {
    assignAgent: async (context) => {
      const agent = await chatEngine.agents.findLeastBusy();
      return agent ? chatEngine.agents.toAgentInfo(agent) : null;
    },
    authenticateAgent: async (token) => {
      const user = await verifyJWT(token);
      return user ? { adminUserId: user.id, displayName: user.name } : null;
    },
  },
});

// Call-log engine -- reads from the same 'chatagents' collection
const callLogEngine = createCallLogEngine({
  db: { connection },
  agents: {
    collectionName: 'chatagents',  // same as chat-engine (this is the default)
    resolveAgent: async (agentId) => {
      // Use chat-engine's agent service to resolve names
      const agents = await chatEngine.agents.list();
      const agent = agents.find(a => a._id.toString() === agentId);
      return agent ? { agentId: agent._id.toString(), displayName: agent.name } : null;
    },
  },
  adapters: {
    lookupContact: async (query) => { /* ... */ },
    authenticateAgent: async (token) => {
      // Reuse the same auth logic
      const user = await verifyJWT(token);
      return user ? { adminUserId: user.id, displayName: user.name } : null;
    },
  },
});

// Mount both on the same Express app
app.use('/api/chat', chatEngine.routes);
app.use('/api/call-log', callLogEngine.routes);
```

## Without chat-engine

If you are not using chat-engine, you can point `agents.collectionName` to any collection that has agent-like documents, or simply store agent IDs as plain strings and use `resolveAgent` to map them to names from any source:

```ts
const engine = createCallLogEngine({
  db: { connection },
  agents: {
    resolveAgent: async (agentId) => {
      // Resolve from your own user/agent store
      const user = await UserModel.findById(agentId);
      return user ? { agentId: user._id.toString(), displayName: user.name } : null;
    },
  },
  adapters: { /* ... */ },
});
```
