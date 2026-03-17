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
| `GET` | `/sessions` | Paginated list (query: `status`, `channel`, `mode`, `search`, `dateFrom`, `dateTo`, `page`, `limit`) |
| `GET` | `/sessions/:sessionId` | Single session |
| `GET` | `/sessions/:sessionId/messages` | Message history (query: `before`, `limit`) |
| `POST` | `/sessions/:sessionId/resolve` | End session |
| `POST` | `/sessions/:sessionId/feedback` | Submit feedback (body: `{ rating?, survey? }`) |
| `GET` | `/sessions/feedback-stats` | Aggregate feedback ratings |

## Offline Messages

| Method | Path | Description |
|--------|------|-------------|
| `POST` | `/offline-messages` | Submit offline message (public, body: `{ visitorId, formData }`) |
| `GET` | `/offline-messages` | List offline messages (protected, query: `dateFrom`, `dateTo`, `page`, `limit`) |

## Agents

| Method | Path | Description |
|--------|------|-------------|
| `GET` | `/agents` | List all agents |
| `GET` | `/agents/:agentId` | Single agent |
| `POST` | `/agents` | Create agent |
| `PUT` | `/agents/:agentId` | Update agent |
| `DELETE` | `/agents/:agentId` | Delete agent |
| `POST` | `/agents/:agentId/toggle-active` | Toggle active status |

## Settings

| Method | Path | Description |
|--------|------|-------------|
| `GET` | `/settings` | Get global settings |
| `PUT` | `/settings` | Update settings |

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

## Stats

| Method | Path | Description |
|--------|------|-------------|
| `GET` | `/stats` | Dashboard stats |

## Authentication

All routes except `GET /widget-config` and `POST /offline-messages` are protected when the `authenticateRequest` adapter is provided. The adapter receives the Express request and must return `{ userId, permissions? }` or `null` to reject.

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
