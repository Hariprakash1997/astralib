# REST API Routes

All routes are mounted on the router returned by `engine.routes`. All responses use the envelope format:

```json
{ "success": true, "data": ... }
```

```json
{ "success": false, "error": "message" }
```

## Sessions

| Method | Path | Description |
|--------|------|-------------|
| `GET` | `/sessions` | Paginated list (query: `status`, `channel`, `mode`, `tag`, `userCategory`, `search`, `dateFrom`, `dateTo`, `page`, `limit`) |
| `GET` | `/sessions/:sessionId` | Single session |
| `GET` | `/sessions/:sessionId/messages` | Message history (query: `before`, `limit`) |
| `GET` | `/sessions/:sessionId/context` | Rich session context (runs `enrichSessionContext` adapter if provided) |
| `GET` | `/sessions/:sessionId/export` | Export single session transcript (query: `format=json\|csv`) |
| `POST` | `/sessions/:sessionId/resolve` | End session |
| `POST` | `/sessions/:sessionId/feedback` | Submit feedback (two-step or legacy format) |
| `POST` | `/sessions/:sessionId/upload` | Upload file via multipart/form-data (requires `fileStorage` adapter) |
| `POST` | `/sessions/export` | Bulk export sessions (body: `{ dateFrom?, dateTo?, agentId?, tags?, status? }`, query: `format`) |

### Session Tags

| Method | Path | Description |
|--------|------|-------------|
| `GET` | `/sessions/:sessionId/tags` | Get session tags |
| `POST` | `/sessions/:sessionId/tags` | Add a tag (body: `{ tag }`) |
| `DELETE` | `/sessions/:sessionId/tags/:tag` | Remove a tag |

### Session User Info

| Method | Path | Description |
|--------|------|-------------|
| `PUT` | `/sessions/:sessionId/user-info` | Update user info (body: `{ name?, email?, mobile? }`) |
| `PUT` | `/sessions/:sessionId/user-category` | Set user category (body: `{ category }`) |

### Session Notes

| Method | Path | Description |
|--------|------|-------------|
| `POST` | `/sessions/:sessionId/notes` | Add a note (body: `{ note }`) |
| `DELETE` | `/sessions/:sessionId/notes/:index` | Remove a note by index |

### User History

| Method | Path | Description |
|--------|------|-------------|
| `GET` | `/sessions/user-history/:visitorId` | Conversation history for a visitor (query: `limit`) |

### Feedback Stats

| Method | Path | Description |
|--------|------|-------------|
| `GET` | `/sessions/feedback-stats` | Aggregate feedback ratings |

## Agents

| Method | Path | Description |
|--------|------|-------------|
| `GET` | `/agents` | List all agents |
| `GET` | `/agents/:agentId` | Single agent |
| `POST` | `/agents` | Create agent (body includes optional `level`, `parentId`, `teamId`) |
| `PUT` | `/agents/:agentId` | Update agent |
| `DELETE` | `/agents/:agentId` | Delete agent |
| `POST` | `/agents/:agentId/toggle-active` | Toggle active status |
| `POST` | `/agents/:agentId/avatar` | Upload avatar image (base64 JSON body) |
| `PUT` | `/agents/:agentId/status` | Admin force-set agent status (body: `{ status }`) |

### Avatar Upload

`POST /agents/:agentId/avatar` accepts a JSON body with base64-encoded image data:

```json
{
  "data": "<base64-encoded image>",
  "mimetype": "image/png",
  "filename": "avatar.png"
}
```

- Requires the `uploadFile` adapter. Returns 404 if not configured.
- Allowed MIME types: `image/jpeg`, `image/png`, `image/webp`, `image/gif`.
- Max file size controlled by `options.maxUploadSizeMb` (default: 5MB).

### Agent Hierarchy

| Method | Path | Description |
|--------|------|-------------|
| `GET` | `/agents/team/:teamId` | Get all members of a team |
| `GET` | `/agents/:agentId/team-tree` | Get full subordinate tree below an agent |
| `GET` | `/agents/:agentId/reports` | Get direct reports |
| `PUT` | `/agents/:agentId/hierarchy` | Update hierarchy position (body: `{ parentId?, level?, teamId? }`) |

Agents have hierarchy fields: `level` (default 1), `parentId` (reference to manager), and `teamId` (team grouping). Use these routes to build team structures and escalation paths.

## Settings

| Method | Path | Description |
|--------|------|-------------|
| `GET` | `/settings` | Get global settings |
| `PUT` | `/settings` | Update settings |

### AI Settings

| Method | Path | Description |
|--------|------|-------------|
| `GET` | `/settings/ai` | Get AI settings (`aiMode`, `aiCharacter`, `showAiTag`) |
| `PUT` | `/settings/ai` | Update AI settings |

AI mode values: `manual` (all agents forced manual), `ai` (all agents forced AI), `agent-wise` (defer to per-agent `modeOverride`).

### Rating Config

| Method | Path | Description |
|--------|------|-------------|
| `GET` | `/settings/rating` | Get rating configuration |
| `PUT` | `/settings/rating` | Update rating config (body: `{ enabled?, ratingType?, followUpOptions? }`) |

See [Rating & Feedback](https://github.com/Hariprakash1997/astralib/blob/main/packages/chat/chat-engine/docs/rating-feedback.md) for details.

### Business Hours

| Method | Path | Description |
|--------|------|-------------|
| `GET` | `/settings/business-hours` | Get current business hours status (`isOpen` + config) |
| `PUT` | `/settings/business-hours` | Update business hours config |

### Chat Mode

| Method | Path | Description |
|--------|------|-------------|
| `GET` | `/settings/chat-mode` | Get chat mode (`switchable` or `fixed`) |
| `PUT` | `/settings/chat-mode` | Set chat mode (body: `{ chatMode }`) |

### Tags & Categories

| Method | Path | Description |
|--------|------|-------------|
| `GET` | `/settings/available-tags` | Get available tag list |
| `PUT` | `/settings/available-tags` | Set available tags (body: `{ availableTags }`) |
| `GET` | `/settings/user-categories` | Get available user categories |
| `PUT` | `/settings/user-categories` | Set user categories (body: `{ availableUserCategories }`) |

## Offline Messages

| Method | Path | Description |
|--------|------|-------------|
| `POST` | `/offline-messages` | Submit offline message (public, body: `{ visitorId, formData }`) |
| `GET` | `/offline-messages` | List offline messages (protected, query: `dateFrom`, `dateTo`, `page`, `limit`) |

## FAQ

| Method | Path | Description |
|--------|------|-------------|
| `GET` | `/faq` | List items (query: `category`, `search`) |
| `GET` | `/faq/categories` | List distinct categories |
| `POST` | `/faq` | Create item |
| `PUT` | `/faq/:itemId` | Update item |
| `DELETE` | `/faq/:itemId` | Delete item |
| `PUT` | `/faq/reorder` | Reorder items (body: `{ items: [{ itemId, order }] }`) |
| `POST` | `/faq/import` | Bulk import (body: `{ items: [...] }`) |

## Guided Questions

| Method | Path | Description |
|--------|------|-------------|
| `GET` | `/guided-questions` | List all questions |
| `POST` | `/guided-questions` | Create question |
| `PUT` | `/guided-questions/:questionId` | Update question |
| `DELETE` | `/guided-questions/:questionId` | Delete question |
| `PUT` | `/guided-questions/reorder` | Reorder questions |

## Canned Responses

| Method | Path | Description |
|--------|------|-------------|
| `GET` | `/canned-responses` | List (query: `category`, `search`) |
| `POST` | `/canned-responses` | Create |
| `PUT` | `/canned-responses/:id` | Update |
| `DELETE` | `/canned-responses/:id` | Delete |

## Widget Config

| Method | Path | Description |
|--------|------|-------------|
| `GET` | `/widget-config` | Get config (public, no auth) |
| `PUT` | `/widget-config` | Update config (protected) |

## Capabilities

| Method | Path | Description |
|--------|------|-------------|
| `GET` | `/capabilities` | Feature flags (public, no auth) |

Returns which features are enabled:

```json
{
  "agents": true,
  "ai": false,
  "visitorSelection": false,
  "labeling": false,
  "fileUpload": false,
  "memory": false,
  "prompts": false,
  "knowledge": false
}
```

## Stats

| Method | Path | Description |
|--------|------|-------------|
| `GET` | `/stats` | Dashboard stats |

## Reports

| Method | Path | Description |
|--------|------|-------------|
| `GET` | `/reports/agent-performance` | Agent performance report (query: `dateFrom`, `dateTo`, `agentId`) |
| `GET` | `/reports/overall` | Overall chat report (query: `dateFrom`, `dateTo`) |

## Webhooks

| Method | Path | Description |
|--------|------|-------------|
| `GET` | `/webhooks` | List all webhooks |
| `POST` | `/webhooks` | Register webhook (body: `{ url, events, secret?, description? }`) |
| `PUT` | `/webhooks/:id` | Update webhook |
| `DELETE` | `/webhooks/:id` | Remove webhook |
| `POST` | `/webhooks/retry` | Retry failed deliveries |

See [Webhooks](https://github.com/Hariprakash1997/astralib/blob/main/packages/chat/chat-engine/docs/webhooks.md) for event types, payload structure, and HMAC verification.

## Authentication

All routes except `GET /widget-config`, `GET /capabilities`, and `POST /offline-messages` are protected when the `authenticateRequest` adapter is provided. The adapter receives the Express request and must return `{ userId, permissions? }` or `null` to reject.

```ts
adapters: {
  authenticateRequest: async (req) => {
    const token = req.headers.authorization?.replace('Bearer ', '');
    if (!token) return null;
    const user = await verifyToken(token);
    return user ? { userId: user.id } : null;
  },
}
```
