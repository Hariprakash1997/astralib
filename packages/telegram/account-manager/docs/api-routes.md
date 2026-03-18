# API Routes

The library exposes a single Express router. Mount it on your Express app at a path of your choosing.

```ts
// Admin API (protect with your own auth middleware)
app.use('/api/telegram', tam.routes);
```

## Authentication

This package does **not** include authentication. The router is returned bare -- apply your own auth middleware when mounting:

```ts
app.use('/api/telegram', authMiddleware, tam.routes);
```

> **Important:** Always protect routes with authentication. All endpoints are admin-level operations.

## Account Routes

All paths below are relative to the mount point.

| Method | Path | Description |
|--------|------|-------------|
| `GET` | `/accounts` | List all accounts (session redacted) |
| `POST` | `/accounts` | Create a new account |
| `GET` | `/accounts/capacity` | Get all accounts' capacity summary |
| `GET` | `/accounts/health` | Get all accounts' health |
| `GET` | `/accounts/:id` | Get account by ID |
| `PUT` | `/accounts/:id` | Update account |
| `DELETE` | `/accounts/:id` | Delete account (must be disconnected) |
| `GET` | `/accounts/:id/capacity` | Get single account capacity |
| `GET` | `/accounts/:id/health` | Get single account health |
| `POST` | `/accounts/:id/connect` | Connect TDLib client |
| `POST` | `/accounts/:id/disconnect` | Disconnect TDLib client |
| `POST` | `/accounts/:id/reconnect` | Reconnect TDLib client |
| `POST` | `/accounts/:id/quarantine` | Manually quarantine account |
| `POST` | `/accounts/:id/release` | Release from quarantine |
| `POST` | `/accounts/connect-all` | Connect all disconnected accounts |
| `POST` | `/accounts/disconnect-all` | Disconnect all connected accounts |
| `POST` | `/accounts/:id/send` | Send a message from connected account |

### List accounts

`GET /accounts?status=connected&tag=vip&page=1&limit=20`

**Query params:** `status` (filter), `tag` (filter -- only return accounts with this tag), `page` (default 1), `limit` (default 20)

**Response:**
```json
{
  "success": true,
  "data": {
    "accounts": [{ "phone": "+1...", "name": "...", "status": "connected", ... }],
    "total": 5
  }
}
```

### Create account

`POST /accounts`

| Field | Type | Required | Description |
|-------|------|----------|-------------|
| `phone` | string | yes | Phone number |
| `name` | string | yes | Display name |
| `session` | string | yes | TDLib session string |
| `tags` | string[] | no | Tags for categorization and filtering |

**Response:** `201` with `{ success: true, data: { account } }` (session redacted)

New accounts start with:
- `healthScore: 100`, `consecutiveErrors: 0`, `floodWaitCount: 0`
- `currentDailyLimit: 40` (default)
- Warmup enabled with configured schedule (if `options.warmup.enabled !== false`)

### Update account

`PUT /accounts/:id`

| Field | Type | Description |
|-------|------|-------------|
| `name` | string | Display name |
| `session` | string | New session string |
| `currentDailyLimit` | number | Override daily limit |
| `currentDelayMin` | number | Min delay between messages (ms) |
| `currentDelayMax` | number | Max delay between messages (ms) |
| `tags` | string[] | Tags for categorization and filtering |

### Delete account

`DELETE /accounts/:id`

Account must be disconnected first. Returns `400` if still connected.

### Connect all accounts

`POST /accounts/connect-all`

No request body required. Connects all accounts with status `disconnected`. Skips accounts that are already connected, banned, or quarantined.

**Response:**
```json
{ "success": true, "data": { "connected": 3, "skipped": 2, "errors": 0 } }
```

### Disconnect all accounts

`POST /accounts/disconnect-all`

No request body required. Disconnects all currently connected accounts.

**Response:**
```json
{ "success": true, "data": { "disconnected": 5 } }
```

### Connect / Disconnect / Reconnect

`POST /accounts/:id/connect` -- Start TDLib client session.
`POST /accounts/:id/disconnect` -- Gracefully disconnect client.
`POST /accounts/:id/reconnect` -- Disconnect and reconnect client.

No request body required.

### Quarantine account

`POST /accounts/:id/quarantine`

| Field | Type | Required | Description |
|-------|------|----------|-------------|
| `reason` | string | yes | Quarantine reason |
| `durationMs` | number | no | Duration in ms (default: `options.quarantine.defaultDurationMs` or 24 hours) |

**Response:**
```json
{ "success": true }
```

Delegates to `QuarantineService.quarantine()` which atomically updates status and disconnects the client if currently connected.

### Release from quarantine

`POST /accounts/:id/release`

No request body. Delegates to `QuarantineService.release()` which atomically clears quarantine fields and sets status to `disconnected`.

### Send message

`POST /accounts/:id/send`

| Field | Type | Required | Description |
|-------|------|----------|-------------|
| `chatId` | string | yes | Telegram chat/user ID to send to |
| `text` | string | yes | Message text |

**Response:**
```json
{ "success": true, "data": { "messageId": "12345" } }
```

Account must be connected. Returns `500` if account is not connected.

### Get all capacity

`GET /accounts/capacity`

**Response:**
```json
{
  "success": true,
  "data": {
    "accounts": [
      { "accountId": "...", "phone": "+1...", "dailyMax": 40, "sentToday": 12, "remaining": 28, "usagePercent": 30, "status": "connected" }
    ],
    "totalRemaining": 150
  }
}
```

Only includes accounts with status `connected` or `warmup`.

### Get all health

`GET /accounts/health`

**Response:**
```json
{
  "success": true,
  "data": {
    "accounts": [
      { "accountId": "...", "phone": "+1...", "healthScore": 95, "consecutiveErrors": 0, "floodWaitCount": 0, "status": "connected", "lastSuccessfulSendAt": "..." }
    ]
  }
}
```

### Get single account capacity / health

`GET /accounts/:id/capacity` -- Same shape as individual entry in all-capacity response.
`GET /accounts/:id/health` -- Same shape as individual entry in all-health response.

---

## Identifier Routes

| Method | Path | Description |
|--------|------|-------------|
| `GET` | `/identifiers` | List identifiers |
| `POST` | `/identifiers` | Create identifier |
| `GET` | `/identifiers/:id` | Get identifier by ID |
| `PUT` | `/identifiers/:id` | Update identifier |
| `PUT` | `/identifiers/:id/status` | Update identifier status |
| `DELETE` | `/identifiers/:id` | Delete identifier |

**Identifier statuses:** `active`, `blocked`, `privacy_blocked`, `inactive`, `invalid`

### List identifiers

`GET /identifiers?status=active&contactId=abc&page=1&limit=20`

**Query params:** `status` (filter), `contactId` (filter), `page` (default 1), `limit` (default 20)

### Create identifier

`POST /identifiers`

| Field | Type | Required | Description |
|-------|------|----------|-------------|
| `contactId` | string | yes | Your system's contact ID |
| `telegramUserId` | string | yes | Telegram user ID |
| `username` | string | no | Telegram username |
| `firstName` | string | no | First name |
| `lastName` | string | no | Last name |
| `phone` | string | no | Phone number |

**Response:** `201` with `{ success: true, data: { identifier } }`

Returns `400` if `telegramUserId` is already registered.

### Update identifier

`PUT /identifiers/:id`

| Field | Type | Description |
|-------|------|-------------|
| `username` | string | Telegram username |
| `firstName` | string | First name |
| `lastName` | string | Last name |
| `phone` | string | Phone number |
| `status` | string | Identifier status |
| `lastActiveAt` | Date | Last activity timestamp |

### Update identifier status

`PUT /identifiers/:id/status`

| Field | Type | Required | Description |
|-------|------|----------|-------------|
| `status` | string | yes | New status (`active`, `blocked`, `privacy_blocked`, `inactive`, `invalid`) -- validated against `IDENTIFIER_STATUS` values, returns `400` if invalid |

---

## Session Routes

| Method | Path | Description |
|--------|------|-------------|
| `POST` | `/sessions/request-code` | Send auth code to phone number |
| `POST` | `/sessions/verify-code` | Verify code and get session string |

### Request code

`POST /sessions/request-code`

| Field | Type | Required | Description |
|-------|------|----------|-------------|
| `phone` | string | yes | Phone number in international format (e.g., `+919876543210`) |

**Response:**
```json
{ "success": true, "data": { "phoneCodeHash": "abc123..." } }
```

Sends an OTP to the user's Telegram app. Store the returned `phoneCodeHash` for the verify step.

### Verify code

`POST /sessions/verify-code`

| Field | Type | Required | Description |
|-------|------|----------|-------------|
| `phone` | string | yes | Same phone number used in request-code |
| `code` | string | yes | OTP code received on Telegram |
| `phoneCodeHash` | string | yes | Hash from request-code response |
| `password` | string | no | 2FA password (if account has two-step verification enabled) |

**Response:**
```json
{ "success": true, "data": { "session": "1AgAO..." } }
```

Returns a session string that can be used to create a new account via `POST /accounts`. If 2FA is enabled and no password is provided, returns an error asking for the password.

---

## Response Format

All endpoints return JSON with a consistent envelope:

**Success:** `{ "success": true, "data": { ... } }`

**Error:** `{ "success": false, "error": "Error message" }`

**HTTP status codes:**
- `200` -- Success
- `201` -- Created
- `400` -- Bad request (validation error, account still connected)
- `404` -- Not found
- `500` -- Internal server error
