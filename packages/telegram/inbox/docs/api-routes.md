# API Routes

The library exposes a single Express router. Mount it on your Express app at a path of your choosing.

```ts
// Inbox API (protect with your own auth middleware)
app.use('/api/telegram/inbox', inbox.routes);
```

## Authentication

This package does **not** include authentication. The router is returned bare -- apply your own auth middleware when mounting:

```ts
app.use('/api/telegram/inbox', authMiddleware, inbox.routes);
```

> **Important:** Always protect routes with authentication. All endpoints are admin-level operations.

---

## Conversation Routes

All paths below are relative to the mount point.

| Method | Path | Description |
|--------|------|-------------|
| `GET` | `/conversations/dialogs` | Load dialogs from Telegram for a connected account |
| `GET` | `/conversations` | List conversations with last message and unread counts |
| `GET` | `/conversations/unread` | Get total unread message count |
| `GET` | `/conversations/search` | Search messages by text content |
| `GET` | `/conversations/:chatId/messages` | Get messages for a conversation |
| `POST` | `/conversations/:chatId/send` | Send a message to a chat |
| `POST` | `/conversations/:chatId/read` | Mark conversation messages as read |
| `POST` | `/conversations/:chatId/sync` | Sync message history from Telegram |
| `POST` | `/conversations/sync-dialogs` | Sync dialogs from Telegram to the database |

### Sync dialogs to DB

`POST /conversations/sync-dialogs?accountId=xxx&limit=50`

Fetches dialogs from Telegram and syncs them into the database as conversation records. Unlike `GET /conversations/dialogs` which only reads from Telegram, this endpoint persists the results.

**Query params:** `accountId` (required), `limit` (default 50)

**Response:**
```json
{
  "success": true,
  "data": {
    "synced": 12,
    "total": 12
  }
}
```

Returns `400` if `accountId` is missing. Returns `500` if the account is not connected.

### Load dialogs

`GET /conversations/dialogs?accountId=xxx&limit=50`

Fetches the list of conversations/dialogs directly from Telegram for a connected account. Use this to initially populate the inbox with existing conversations.

**Query params:** `accountId` (required), `limit` (default 50)

**Response:**
```json
{
  "success": true,
  "data": {
    "dialogs": [
      {
        "chatId": "123456789",
        "title": "John Doe",
        "type": "user",
        "unreadCount": 3,
        "lastMessage": {
          "text": "Hello!",
          "date": "2025-01-15T10:30:00.000Z"
        }
      }
    ]
  }
}
```

Returns `400` if `accountId` is missing. Returns `500` if the account is not connected.

### List conversations

`GET /conversations?page=1&limit=50&accountId=xxx`

**Query params:** `page` (default 1), `limit` (default 50), `accountId` (optional filter -- only return conversations involving this account)

**Response:**
```json
{
  "success": true,
  "data": {
    "conversations": [
      {
        "conversationId": "123456789",
        "lastMessage": {
          "content": "Hello!",
          "contentType": "text",
          "direction": "inbound",
          "createdAt": "2025-01-15T10:30:00.000Z"
        },
        "messageCount": 42,
        "unreadCount": 3
      }
    ],
    "total": 15
  }
}
```

### Get unread count

`GET /conversations/unread?accountId=xxx`

**Query params:** `accountId` (optional filter -- only count unread for this account)

**Response:**
```json
{
  "success": true,
  "data": {
    "unreadCount": 12
  }
}
```

### Search messages

`GET /conversations/search?q=hello&page=1&limit=50&accountId=xxx`

Search across all messages by text content. Returns matching messages with pagination.

**Query params:** `q` (required -- search query), `page` (default 1), `limit` (default 50), `accountId` (optional filter -- only search messages from this account)

**Response:**
```json
{
  "success": true,
  "data": {
    "messages": [
      {
        "conversationId": "123456789",
        "messageId": "msg_001",
        "senderId": "123456789",
        "senderType": "user",
        "direction": "inbound",
        "contentType": "text",
        "content": "Hello there!",
        "readAt": null,
        "createdAt": "2025-01-15T10:30:00.000Z"
      }
    ],
    "total": 5
  }
}
```

Returns `400` if `q` is missing or empty.

### Get messages

`GET /conversations/:chatId/messages?page=1&limit=50&accountId=xxx`

**Query params:** `page` (default 1), `limit` (default 50), `accountId` (optional filter -- only return messages from this account)

**Response:**
```json
{
  "success": true,
  "data": {
    "messages": [
      {
        "conversationId": "123456789",
        "messageId": "msg_001",
        "senderId": "123456789",
        "senderType": "user",
        "direction": "inbound",
        "contentType": "text",
        "content": "Hello!",
        "readAt": null,
        "createdAt": "2025-01-15T10:30:00.000Z"
      }
    ],
    "total": 42
  }
}
```

### Send message

`POST /conversations/:chatId/send`

| Field | Type | Required | Description |
|-------|------|----------|-------------|
| `accountId` | string | yes | Account to send from |
| `text` | string | yes | Message text |
| `media` | object | no | Media attachment |

**Response:** `201` with `{ success: true, data: { message } }`

Returns `400` if `accountId` or `text` is missing.

### Mark as read

`POST /conversations/:chatId/read`

No request body required. Marks all unread inbound messages in the conversation as read.

**Response:**
```json
{
  "success": true,
  "data": {
    "markedCount": 5
  }
}
```

### Sync history

`POST /conversations/:chatId/sync`

| Field | Type | Required | Description |
|-------|------|----------|-------------|
| `accountId` | string | yes | Account to fetch history from |
| `limit` | number | no | Max messages to sync (default: `options.historySyncLimit` or 100) |

Returns `400` if `accountId` is missing.

**Response:**
```json
{
  "success": true,
  "data": {
    "success": true,
    "messagesImported": 47,
    "oldestMessageId": 12345,
    "hasMore": false
  }
}
```

---

## Session Routes

| Method | Path | Description |
|--------|------|-------------|
| `GET` | `/sessions` | List sessions |
| `GET` | `/sessions/:id` | Get session by ID |
| `POST` | `/sessions/:id/close` | Close a session |
| `POST` | `/sessions/:id/pause` | Pause a session |
| `POST` | `/sessions/:id/resume` | Resume a paused session |

### List sessions

`GET /sessions?accountId=abc&contactId=xyz&status=active&page=1&limit=50`

**Query params:** `accountId` (filter), `contactId` (filter), `status` (filter), `page` (default 1), `limit` (default 50)

**Response:**
```json
{
  "success": true,
  "data": {
    "sessions": [
      {
        "accountId": "acc_001",
        "contactId": "contact_001",
        "conversationId": "123456789",
        "status": "active",
        "startedAt": "2025-01-15T10:00:00.000Z",
        "messageCount": 12,
        "lastMessageAt": "2025-01-15T10:30:00.000Z"
      }
    ],
    "total": 8
  }
}
```

### Get session by ID

`GET /sessions/:id`

**Response:** `{ success: true, data: { session } }`

Returns `404` if session not found.

### Close / Pause / Resume

`POST /sessions/:id/close` -- Sets status to `closed` and records `endedAt`.
`POST /sessions/:id/pause` -- Sets status to `paused`.
`POST /sessions/:id/resume` -- Sets status back to `active`.

No request body required. Returns `404` if session not found.

**Response:** `{ success: true, data: { session } }`

---

## Response Format

All endpoints return JSON with a consistent envelope:

**Success:** `{ "success": true, "data": { ... } }`

**Error:** `{ "success": false, "error": "Error message" }`

**HTTP status codes:**
- `200` -- Success
- `201` -- Created
- `400` -- Bad request (missing required fields)
- `404` -- Not found
- `500` -- Internal server error
