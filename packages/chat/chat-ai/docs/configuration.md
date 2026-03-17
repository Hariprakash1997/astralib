# Configuration

`createChatAI` accepts a single config object. Only `db.connection` is required -- everything else is optional.

## Minimal Config

```ts
import { createChatAI } from '@astralibx/chat-ai';

const ai = createChatAI({
  db: { connection: mongooseConnection },
});
```

This gives you memory, prompt, and knowledge management with no AI generation. Calling `ai.generateResponse()` in this mode throws `NoProviderConfiguredError`.

## Full Config

```ts
const ai = createChatAI({
  // Required -- Mongoose connection
  db: { connection: mongooseConnection },

  // AI generation function -- consumer owns keys, rotation, fallback
  chat: {
    generate: async (systemPrompt, userMessage, history, options) => {
      const res = await groq.chat.completions.create({ /* ... */ });
      return { content: res.choices[0].message.content, model: 'llama-3.3-70b' };
    },
  },

  // Memory backend -- 'builtin' (default), 'mem0', or 'custom'
  memoryBackend: { type: 'builtin' },

  // Memory search strategy -- 'text' (default), 'priority', or 'custom'
  memorySearch: {
    strategy: 'text',
    maxMemories: 10,
    maxTokens: 2000,
  },

  // Embedding adapter for knowledge base
  embedding: {
    generate: async (text) => {
      const res = await openai.embeddings.create({ input: text, model: 'text-embedding-3-small' });
      return res.data[0].embedding;
    },
    dimensions: 1536,
  },
});
```

## Config Reference

| Key | Type | Required | Default | Description |
|-----|------|----------|---------|-------------|
| `db.connection` | `mongoose.Connection` | Yes | -- | Mongoose connection for schemas |
| `chat.generate` | `Function` | No | -- | AI generation function |
| `memoryBackend` | `object` | No | `{ type: 'builtin' }` | Memory storage backend |
| `memorySearch` | `object` | No | `{ strategy: 'text' }` | Memory search strategy |
| `embedding` | `object` | No | -- | Embedding adapter for knowledge |

## No Provider Mode

When `chat` is omitted, all services (memories, prompts, knowledge) work normally. Only `ai.generateResponse()` throws. This is useful when you want to manage AI context without wiring up generation.

## Memory Backend Config

See [Memory Management](https://github.com/Hariprakash1997/astralib/blob/main/packages/chat/chat-ai/docs/memory-management.md) for backend-specific configuration (builtin, mem0, custom).

## Embedding Config

See [Knowledge Base](https://github.com/Hariprakash1997/astralib/blob/main/packages/chat/chat-ai/docs/knowledge-base.md) for embedding adapter setup.

## Integration with chat-engine

```ts
const ai = createChatAI({ db: { connection }, chat: { generate: myGenerateFn } });
const engine = createChatEngine({
  adapters: { generateAiResponse: ai.generateResponse },
});
```

The engine calls `generateAiResponse` with session context. chat-ai builds the prompt (injecting memories + knowledge), calls your generate function, parses the response, and returns the output.

## Routes

Mount REST routes on any Express app:

```ts
app.use('/api/chat-ai', ai.routes);
```

See [API Routes](https://github.com/Hariprakash1997/astralib/blob/main/packages/chat/chat-ai/docs/api-routes.md) for the full endpoint list.
