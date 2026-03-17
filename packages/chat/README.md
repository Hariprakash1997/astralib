# @astralibx/chat-*

Production-grade chat infrastructure for Node.js -- real-time messaging engine, AI integration, embeddable visitor widget, and admin dashboard components.

## Packages

| Package | npm | Description |
|---------|-----|-------------|
| [chat-types](https://github.com/Hariprakash1997/astralib/tree/main/packages/chat/chat-types) | `@astralibx/chat-types` | Shared TypeScript types, enums, and socket event contracts |
| [chat-engine](https://github.com/Hariprakash1997/astralib/tree/main/packages/chat/chat-engine) | `@astralibx/chat-engine` | Real-time engine: Socket.IO, sessions, agents, Redis, REST API |
| [chat-ai](https://github.com/Hariprakash1997/astralib/tree/main/packages/chat/chat-ai) | `@astralibx/chat-ai` | AI layer: memory, prompt templates, knowledge base, orchestration |
| [chat-widget](https://github.com/Hariprakash1997/astralib/tree/main/packages/chat/chat-widget) | `@astralibx/chat-widget` | Embeddable Lit visitor widget with pre-chat flows |
| [chat-ui](https://github.com/Hariprakash1997/astralib/tree/main/packages/chat/chat-ui) | `@astralibx/chat-ui` | Admin dashboard Lit components (20 components) |

## Architecture

```
@astralibx/core
     |
     +-- chat-types                (pure TS, no runtime deps)
     |        |
     |        +-- chat-engine      (peer: express, mongoose, socket.io, ioredis)
     |        |        |
     |        |        +-- chat-ai (optional, adapter-based)
     |        |
     |        +-- chat-widget      (peer: socket.io-client)
     |        |
     |        +-- chat-ui          (peer: lit)
```

- **chat-engine** has no dependency on **chat-ai** -- AI is injected via `adapters.generateAiResponse`
- **chat-widget** and **chat-ui** share types via **chat-types** without pulling in server deps
- **chat-ai** is fully optional -- a human-agent-only setup needs only **chat-engine** + **chat-widget**

## End-to-End Setup

### 1. Install packages

```bash
# Server
npm install @astralibx/chat-engine @astralibx/chat-ai
npm install express mongoose socket.io ioredis

# Frontend
npm install @astralibx/chat-widget @astralibx/chat-ui
npm install socket.io-client lit
```

### 2. Create the AI layer (memory + prompts + knowledge)

```ts
import { createChatAI } from '@astralibx/chat-ai';

const ai = createChatAI({
  db: { connection: mongooseConnection },
  chat: {
    generate: async (systemPrompt, userMessage, history) => {
      const res = await groq.chat.completions.create({
        model: 'llama-3.3-70b-versatile',
        messages: [
          { role: 'system', content: systemPrompt },
          ...history,
          { role: 'user', content: userMessage },
        ],
      });
      return { content: res.choices[0].message.content, model: 'llama-3.3-70b' };
    },
  },
});
```

### 3. Create the chat engine (wire AI adapter)

```ts
import { createChatEngine } from '@astralibx/chat-engine';

const engine = createChatEngine({
  db: { connection: mongooseConnection },
  redis: { connection: redis, keyPrefix: 'myapp:chat:' },
  socket: { cors: { origin: ['https://myapp.com'], credentials: true } },
  adapters: {
    assignAgent: async (context) => {
      const agent = await engine.agents.findLeastBusy();
      return agent ? engine.agents.toAgentInfo(agent) : null;
    },
    generateAiResponse: ai.generateResponse,
    authenticateAgent: async (token) => {
      const user = await verifyJWT(token);
      return user ? { adminUserId: user.id, displayName: user.name } : null;
    },
  },
});
```

### 4. Mount routes

```ts
app.use('/api/chat', engine.routes);
app.use('/api/chat-ai', ai.routes);

const httpServer = createServer(app);
engine.attach(httpServer);
httpServer.listen(3000);
```

### 5. Add the widget to your frontend

```html
<script type="module">
  import '@astralibx/chat-widget';
</script>

<alx-chat-widget
  socket-url="https://chat.myapp.com"
  channel="website"
></alx-chat-widget>
```

### 6. Add the admin dashboard

```ts
import { AlxChatConfig } from '@astralibx/chat-ui';

AlxChatConfig.setup({
  chatEngineApi: '/api/chat',
  chatAiApi: '/api/chat-ai',
  socketUrl: 'wss://chat.myapp.com',
  agentNamespace: '/agent',
  authToken: 'Bearer ...',
});

import '@astralibx/chat-ui';
```

```html
<alx-chat-dashboard defaultTab="overview"></alx-chat-dashboard>
```

## Package READMEs

1. [chat-types/README.md](https://github.com/Hariprakash1997/astralib/blob/main/packages/chat/chat-types/README.md) -- Types and enums
2. [chat-engine/README.md](https://github.com/Hariprakash1997/astralib/blob/main/packages/chat/chat-engine/README.md) -- Server engine
3. [chat-ai/README.md](https://github.com/Hariprakash1997/astralib/blob/main/packages/chat/chat-ai/README.md) -- AI integration
4. [chat-widget/README.md](https://github.com/Hariprakash1997/astralib/blob/main/packages/chat/chat-widget/README.md) -- Visitor widget
5. [chat-ui/README.md](https://github.com/Hariprakash1997/astralib/blob/main/packages/chat/chat-ui/README.md) -- Admin dashboard

## License

MIT
