# @astralibx/chat-ai

Optional AI layer for `@astralibx/chat-engine` -- memory management, prompt templates, knowledge base, and AI call orchestration.

Consumers own everything: which AI to call, what prompts to write, what to remember. This package provides the infrastructure.

**GitHub**: [packages/chat/chat-ai](https://github.com/Hariprakash1997/astralib/tree/main/packages/chat/chat-ai)

## Installation

```bash
npm install @astralibx/chat-ai @astralibx/chat-types @astralibx/core
```

Peer dependencies: `express`, `mongoose`

## Quick Start

```ts
import { createChatAI } from '@astralibx/chat-ai';
import { createChatEngine } from '@astralibx/chat-engine';

const ai = createChatAI({
  db: { connection: mongooseConnection },

  // Consumer provides AI call function -- manages own keys/rotation/fallback
  chat: {
    generate: async (systemPrompt, userMessage, history, options) => {
      const res = await groq.chat.completions.create({ /* ... */ });
      return { content: res.choices[0].message.content, model: 'llama-3.3-70b' };
    },
  },
});

// Use as chat-engine adapter
const engine = createChatEngine({
  adapters: {
    generateAiResponse: ai.generateResponse,
  },
});

// Mount REST routes
app.use('/api/chat-ai', ai.routes);
```

## No Provider Mode

If you only need memory/prompt/knowledge management without AI generation:

```ts
const ai = createChatAI({
  db: { connection },
});
// ai.generateResponse() will throw NoProviderConfiguredError
// ai.memories, ai.prompts, ai.knowledge all work normally
```

## Memory Management

Three backends, four scopes, three creation paths.

### Backends

**Builtin** (default) -- stores in MongoDB via ChatMemory schema:
```ts
memoryBackend: { type: 'builtin' }
```

**Mem0** -- proxies to a Mem0 client you provide:
```ts
memoryBackend: {
  type: 'mem0',
  client: new MemClient({ apiKey: process.env.MEM0_KEY }),
  scopeMapping: {
    visitor: (scopeId) => ({ user_id: scopeId }),
    agent: (scopeId) => ({ agent_id: scopeId }),
    global: () => ({ user_id: 'global' }),
  },
}
```

**Custom** -- consumer provides all functions:
```ts
memoryBackend: {
  type: 'custom',
  create, update, delete, list, search, getByVisitor,
}
```

### Scopes

| Scope | When injected |
|---|---|
| `global` | Every conversation |
| `agent` | When a specific agent is assigned |
| `visitor` | When a specific visitor chats |
| `channel` | When chat is on a specific channel |

### Search Strategies

- `priority` -- no search, just scope + priority order
- `text` -- MongoDB $text index (default)
- `custom` -- consumer provides `customSearch` function (Atlas Vector Search, Qdrant, etc.)

```ts
memorySearch: {
  strategy: 'custom',
  customSearch: async (query, scope) => { /* your vector search */ },
  maxMemories: 10,
  maxTokens: 2000,
}
```

## Prompt Templates

Templates are composed of ordered sections. System sections (`memory_injection`, `knowledge_injection`, `conversation_history`) are auto-populated. User sections support Handlebars variables.

```ts
await ai.prompts.create({
  name: 'Sales Agent',
  isDefault: true,
  sections: [
    { key: 'identity', label: 'Identity', content: 'You are {{agentName}}.', position: 1, isEnabled: true, isSystem: false, variables: ['agentName'] },
    { key: 'memory_injection', label: 'Memories', content: '', position: 2, isEnabled: true, isSystem: true },
    { key: 'knowledge_injection', label: 'Knowledge', content: '', position: 3, isEnabled: true, isSystem: true },
    { key: 'conversation_history', label: 'History', content: '', position: 4, isEnabled: true, isSystem: true },
    { key: 'rules', label: 'Rules', content: 'Never discuss pricing.', position: 5, isEnabled: true, isSystem: false },
  ],
});
```

## Knowledge Base

Store knowledge documents that get injected into AI context:

```ts
await ai.knowledge.create({
  title: 'Return Policy',
  content: 'We accept returns within 30 days.',
  category: 'policies',
  priority: 80,
});
```

## Embedding Adapter

Auto-generate embeddings on create/update:

```ts
embedding: {
  generate: async (text) => {
    const res = await openai.embeddings.create({ input: text, model: 'text-embedding-3-small' });
    return res.data[0].embedding;
  },
  dimensions: 1536,
}
```

## REST Routes

Mount with `app.use('/api/chat-ai', ai.routes)`:

**Memory**: `GET/POST /memories`, `GET/PUT/DELETE /memories/:memoryId`, `DELETE /memories/bulk`, `POST /memories/import`, `GET /memories/export`, `GET /memories/categories`, `GET /memories/visitor/:visitorId`

**Prompts**: `GET/POST /prompts`, `GET/PUT/DELETE /prompts/:templateId`, `POST /prompts/:templateId/default`, `POST /prompts/preview`

**Knowledge**: `GET/POST /knowledge`, `GET/PUT/DELETE /knowledge/:entryId`, `DELETE /knowledge/bulk`, `POST /knowledge/import`, `GET /knowledge/export`, `GET /knowledge/categories`, `POST /knowledge/search`

## Integration with chat-engine

```ts
const ai = createChatAI({ db: { connection }, chat: { generate: myGenerateFn } });
const engine = createChatEngine({
  adapters: { generateAiResponse: ai.generateResponse },
});
```

The engine calls `generateAiResponse` with session context. chat-ai builds the prompt (injecting memories + knowledge), calls your generate function, parses the response, and returns the output.

## License

MIT
