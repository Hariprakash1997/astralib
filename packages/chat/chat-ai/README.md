# @astralibx/chat-ai

[![npm version](https://img.shields.io/npm/v/@astralibx/chat-ai.svg)](https://www.npmjs.com/package/@astralibx/chat-ai)
[![License: MIT](https://img.shields.io/badge/License-MIT-blue.svg)](https://opensource.org/licenses/MIT)

Optional AI layer for `@astralibx/chat-engine` -- memory management, prompt templates, knowledge base, and AI call orchestration. Consumers own everything: which AI to call, what prompts to write, what to remember. This package provides the infrastructure.

## Install

```bash
npm install @astralibx/chat-ai
```

### Peer Dependencies

| Package | Required |
|---------|----------|
| `express` | Yes |
| `mongoose` | Yes |

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

## Memory Examples

```ts
// Admin creates global business knowledge
await ai.memories.create({
  scope: 'global',
  key: 'return_policy',
  content: 'We offer 30-day returns for unused items with receipt.',
  category: 'policies',
  priority: 80,
  source: 'admin',
});

// Agent saves note about visitor during chat
await ai.memories.create({
  scope: 'visitor',
  scopeId: 'visitor_abc123',
  key: 'preference',
  content: 'Prefers email follow-up over phone calls.',
  category: 'agent_notes',
  source: 'agent',
});

// AI context building fetches relevant memories automatically
const response = await ai.generateResponse({
  sessionId: 'sess_1',
  visitorId: 'visitor_abc123',
  messages: [...recentMessages],
  agent: currentAgent,
  visitorContext: { visitorId: 'visitor_abc123', channel: 'website' },
});
```

## Mem0 Backend

```ts
const ai = createChatAI({
  db: { connection },
  memoryBackend: {
    type: 'mem0',
    client: new MemClient({ apiKey: process.env.MEM0_KEY }),
    scopeMapping: {
      visitor: (id) => ({ user_id: id }),
      agent: (id) => ({ agent_id: id }),
      global: () => ({ user_id: 'global' }),
      channel: (id) => ({ metadata: { channel: id } }),
    },
  },
  chat: {
    generate: async (systemPrompt, userMessage, history) => {
      const key = groqKeys[callCount++ % groqKeys.length]; // key rotation
      const client = new Groq({ apiKey: key });
      const res = await client.chat.completions.create({
        model: 'llama-3.3-70b-versatile',
        messages: [
          { role: 'system', content: systemPrompt },
          ...history,
          { role: 'user', content: userMessage },
        ],
      });
      return { content: res.choices[0].message.content, model: 'llama-3.3-70b', tokensUsed: 0 };
    },
  },
});
```

## Prompt Template

```ts
await ai.prompts.create({
  name: 'Support Agent',
  isDefault: true,
  sections: [
    { key: 'identity', label: 'Identity', content: 'You are {{agentName}}, a support agent at {{companyName}}.', position: 1, isEnabled: true, isSystem: false },
    { key: 'rules', label: 'Rules', content: 'Be friendly. Never share internal pricing. Ask for email before ending chat.', position: 2, isEnabled: true, isSystem: false },
    { key: 'memory_injection', label: 'Memories', content: '', position: 3, isEnabled: true, isSystem: true },
    { key: 'knowledge_injection', label: 'Knowledge', content: '', position: 4, isEnabled: true, isSystem: true },
    { key: 'conversation_history', label: 'History', content: '', position: 5, isEnabled: true, isSystem: true },
  ],
});
```

## Features

- **Memory management** -- Three backends (builtin, Mem0, custom), four scopes, three search strategies. [Details](https://github.com/Hariprakash1997/astralib/blob/main/packages/chat/chat-ai/docs/memory-management.md)
- **Prompt templates** -- Ordered sections with Handlebars variables, system-injected memory/knowledge/history. [Details](https://github.com/Hariprakash1997/astralib/blob/main/packages/chat/chat-ai/docs/prompt-templates.md)
- **Knowledge base** -- Store documents with optional embeddings for vector search injection. [Details](https://github.com/Hariprakash1997/astralib/blob/main/packages/chat/chat-ai/docs/knowledge-base.md)
- **No provider mode** -- Use memory, prompts, and knowledge without wiring up AI generation. [Details](https://github.com/Hariprakash1997/astralib/blob/main/packages/chat/chat-ai/docs/configuration.md)
- **Error classes** -- Typed errors with codes for every failure scenario. [Details](https://github.com/Hariprakash1997/astralib/blob/main/packages/chat/chat-ai/docs/error-handling.md)

## Architecture

The library exposes a single Express router and programmatic services from a single factory call:

| Access | Description |
|--------|-------------|
| `ai.routes` | REST API -- memories, prompts, knowledge (protect with your own auth middleware) |
| `ai.memories` | Memory CRUD and search |
| `ai.prompts` | Prompt template CRUD and preview |
| `ai.knowledge` | Knowledge base CRUD and search |
| `ai.generateResponse` | AI response generation (requires `chat.generate` config) |

## Getting Started Guide

1. [Configuration](https://github.com/Hariprakash1997/astralib/blob/main/packages/chat/chat-ai/docs/configuration.md) -- Set up database, AI provider, memory backend, and embeddings
2. [Memory Management](https://github.com/Hariprakash1997/astralib/blob/main/packages/chat/chat-ai/docs/memory-management.md) -- Backends, scopes, and search strategies
3. [Prompt Templates](https://github.com/Hariprakash1997/astralib/blob/main/packages/chat/chat-ai/docs/prompt-templates.md) -- System and user sections, variables, preview
4. [Knowledge Base](https://github.com/Hariprakash1997/astralib/blob/main/packages/chat/chat-ai/docs/knowledge-base.md) -- Documents, embeddings, and search

Reference: [API Routes](https://github.com/Hariprakash1997/astralib/blob/main/packages/chat/chat-ai/docs/api-routes.md) | [Error Handling](https://github.com/Hariprakash1997/astralib/blob/main/packages/chat/chat-ai/docs/error-handling.md)

## License

MIT
