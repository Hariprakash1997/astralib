# API Routes

Mount all routes with:

```ts
app.use('/api/chat-ai', ai.routes);
```

## Memory Routes

| Method | Path | Description |
|--------|------|-------------|
| `GET` | `/memories` | List memories (with filtering) |
| `POST` | `/memories` | Create a memory |
| `GET` | `/memories/:memoryId` | Get a single memory |
| `PUT` | `/memories/:memoryId` | Update a memory |
| `DELETE` | `/memories/:memoryId` | Delete a memory |
| `DELETE` | `/memories/bulk` | Bulk delete memories |
| `POST` | `/memories/import` | Import memories |
| `GET` | `/memories/export` | Export memories |
| `GET` | `/memories/categories` | List memory categories |
| `GET` | `/memories/visitor/:visitorId` | Get memories for a visitor |

## Prompt Template Routes

| Method | Path | Description |
|--------|------|-------------|
| `GET` | `/prompts` | List prompt templates |
| `POST` | `/prompts` | Create a prompt template |
| `GET` | `/prompts/:templateId` | Get a single template |
| `PUT` | `/prompts/:templateId` | Update a template |
| `DELETE` | `/prompts/:templateId` | Delete a template |
| `POST` | `/prompts/:templateId/default` | Set template as default |
| `POST` | `/prompts/preview` | Preview a rendered prompt |

## Knowledge Base Routes

| Method | Path | Description |
|--------|------|-------------|
| `GET` | `/knowledge` | List knowledge entries |
| `POST` | `/knowledge` | Create a knowledge entry |
| `GET` | `/knowledge/:entryId` | Get a single entry |
| `PUT` | `/knowledge/:entryId` | Update an entry |
| `DELETE` | `/knowledge/:entryId` | Delete an entry |
| `DELETE` | `/knowledge/bulk` | Bulk delete entries |
| `POST` | `/knowledge/import` | Import entries |
| `GET` | `/knowledge/export` | Export entries |
| `GET` | `/knowledge/categories` | List knowledge categories |
| `POST` | `/knowledge/search` | Search knowledge base |

## Programmatic Access

All routes correspond to service methods on the `ai` object:

- `ai.memories` -- memory CRUD and search
- `ai.prompts` -- prompt template CRUD and preview
- `ai.knowledge` -- knowledge base CRUD and search
- `ai.generateResponse` -- AI response generation (requires `chat.generate` config)
