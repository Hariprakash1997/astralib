# Memory Management

Three backends, four scopes, three search strategies.

## Backends

### Builtin (default)

Stores memories in MongoDB via the ChatMemory schema. No additional dependencies.

```ts
memoryBackend: { type: 'builtin' }
```

### Mem0

Proxies memory operations to a Mem0 client you provide. You control the API key and scope mapping.

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

The `scopeMapping` object maps each chat-ai scope to the corresponding Mem0 identifier format.

### Custom

Consumer provides all storage functions. Use this to back memories with any storage system (Redis, Postgres, a vector DB, etc.).

```ts
memoryBackend: {
  type: 'custom',
  create,
  update,
  delete,
  list,
  search,
  getByVisitor,
}
```

## Scopes

Memories are scoped so they get injected at the right time:

| Scope | When injected |
|-------|---------------|
| `global` | Every conversation |
| `agent` | When a specific agent is assigned |
| `visitor` | When a specific visitor chats |
| `channel` | When chat is on a specific channel |

## Search Strategies

Control how memories are retrieved during prompt building.

### Priority (no search)

Memories are selected by scope match and priority order. No text search is performed.

```ts
memorySearch: {
  strategy: 'priority',
}
```

### Text (default)

Uses MongoDB `$text` index for keyword search.

```ts
memorySearch: {
  strategy: 'text',
  maxMemories: 10,
  maxTokens: 2000,
}
```

### Custom

Consumer provides a search function. Use this for Atlas Vector Search, Qdrant, Pinecone, or any other search backend.

```ts
memorySearch: {
  strategy: 'custom',
  customSearch: async (query, scope) => {
    // Your vector search implementation
    return results;
  },
  maxMemories: 10,
  maxTokens: 2000,
}
```

## Search Options

| Option | Type | Default | Description |
|--------|------|---------|-------------|
| `strategy` | `'priority' \| 'text' \| 'custom'` | `'text'` | Search strategy |
| `customSearch` | `Function` | -- | Required when strategy is `'custom'` |
| `maxMemories` | `number` | -- | Maximum memories to inject |
| `maxTokens` | `number` | -- | Token budget for injected memories |

## Memory Creation Paths

Memories can be created through three paths:

1. **REST API** -- `POST /memories` (see [API Routes](https://github.com/Hariprakash1997/astralib/blob/main/packages/chat/chat-ai/docs/api-routes.md))
2. **Programmatic** -- `ai.memories.create({ ... })`
3. **Import** -- `POST /memories/import` for bulk creation
