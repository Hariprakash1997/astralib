# Knowledge Base

Store knowledge documents that get injected into AI context during response generation.

## Creating Knowledge Entries

```ts
await ai.knowledge.create({
  title: 'Return Policy',
  content: 'We accept returns within 30 days.',
  category: 'policies',
  priority: 80,
});
```

Entries with higher priority are injected first when there is a token budget constraint.

## Embedding Adapter

Auto-generate embeddings on create and update by providing an embedding adapter:

```ts
const ai = createChatAI({
  db: { connection },
  embedding: {
    generate: async (text) => {
      const res = await openai.embeddings.create({
        input: text,
        model: 'text-embedding-3-small',
      });
      return res.data[0].embedding;
    },
    dimensions: 1536,
  },
});
```

The consumer owns the embedding provider -- OpenAI, Cohere, local models, etc. The library stores the resulting vectors alongside the knowledge entry.

### Embedding Config

| Option | Type | Required | Description |
|--------|------|----------|-------------|
| `generate` | `(text: string) => Promise<number[]>` | Yes | Function that returns an embedding vector |
| `dimensions` | `number` | Yes | Dimensionality of the embedding vector |

## Search

Search the knowledge base via REST or programmatically:

```ts
// REST
POST /knowledge/search

// Programmatic
await ai.knowledge.search({ query: 'return policy', limit: 5 });
```

When embeddings are configured, search can use vector similarity. Without embeddings, search falls back to text-based matching.

## Bulk Operations

| Operation | REST | Description |
|-----------|------|-------------|
| Import | `POST /knowledge/import` | Bulk create entries |
| Export | `GET /knowledge/export` | Export all entries |
| Bulk delete | `DELETE /knowledge/bulk` | Delete multiple entries |

## Categories

Organize knowledge entries by category. List all categories with:

```ts
// REST
GET /knowledge/categories

// Programmatic
await ai.knowledge.categories();
```

## How Knowledge Gets Injected

During response generation, knowledge entries are injected into the prompt via the `knowledge_injection` system section in prompt templates. See [Prompt Templates](https://github.com/Hariprakash1997/astralib/blob/main/packages/chat/chat-ai/docs/prompt-templates.md) for section ordering.
