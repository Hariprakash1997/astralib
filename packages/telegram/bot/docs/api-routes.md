# API Routes

The library exposes a single Express router with 4 admin endpoints. Mount it on your Express app at a path of your choosing.

```ts
// Admin API (protect with your own auth middleware)
app.use('/api/bot', bot.routes);
```

## Authentication

This package does **not** include authentication. The router is returned bare -- apply your own auth middleware when mounting:

```ts
app.use('/api/bot', authMiddleware, bot.routes);
```

> **Important:** Always protect routes with authentication. All endpoints are admin-level operations.

## Routes

All paths below are relative to the mount point.

| Method | Path | Description |
|--------|------|-------------|
| `GET` | `/status` | Get bot running status and info |
| `GET` | `/stats` | Get user statistics |
| `GET` | `/users` | List tracked users |
| `GET` | `/users/:userId` | Get single user by Telegram user ID |

---

### Get bot status

`GET /status`

Returns the bot's running state, bot info, and uptime.

**Response:**
```json
{
  "success": true,
  "data": {
    "running": true,
    "botInfo": {
      "username": "@my_bot",
      "id": 123456789
    },
    "uptimeMs": 3600000
  }
}
```

---

### Get stats

`GET /stats`

Returns aggregated user statistics for the bot.

**Response:**
```json
{
  "success": true,
  "data": {
    "totalUsers": 1500,
    "activeUsers": 1200,
    "blockedUsers": 200,
    "stoppedUsers": 100,
    "newUsersToday": 25,
    "newUsersThisWeek": 150,
    "returningUsers": 800,
    "blockRate": 13.3
  }
}
```

---

### List users

`GET /users?status=active&page=1&limit=20`

**Query params:**

| Param | Type | Default | Description |
|-------|------|---------|-------------|
| `status` | `string` | -- | Filter by interaction status (`active`, `blocked`, `stopped`) |
| `page` | `number` | `1` | Page number |
| `limit` | `number` | `20` | Users per page |

**Response:**
```json
{
  "success": true,
  "data": {
    "users": [
      {
        "telegramUserId": "12345",
        "firstName": "John",
        "username": "johndoe",
        "interactions": [
          {
            "botUsername": "@my_bot",
            "status": "active",
            "interactionCount": 42,
            "firstInteractionAt": "2025-01-01T00:00:00.000Z",
            "lastInteractionAt": "2025-06-15T12:30:00.000Z"
          }
        ]
      }
    ],
    "total": 1500
  }
}
```

---

### Get user by ID

`GET /users/:userId`

Returns a single user by their Telegram user ID.

**Response (200):**
```json
{
  "success": true,
  "data": {
    "user": {
      "telegramUserId": "12345",
      "firstName": "John",
      "username": "johndoe",
      "interactions": [...]
    }
  }
}
```

**Response (404):**
```json
{
  "success": false,
  "error": "User not found"
}
```

---

## Response Format

All endpoints return JSON with a consistent envelope:

**Success:** `{ "success": true, "data": { ... } }`

**Error:** `{ "success": false, "error": "Error message" }`

**HTTP status codes:**
- `200` -- Success
- `404` -- User not found
- `500` -- Internal server error
