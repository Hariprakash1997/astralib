# @astralibx/staff-engine

[![npm version](https://img.shields.io/npm/v/@astralibx/staff-engine.svg)](https://www.npmjs.com/package/@astralibx/staff-engine)
[![License: MIT](https://img.shields.io/badge/License-MIT-blue.svg)](https://opensource.org/licenses/MIT)

Staff management backend with JWT authentication, role-based token expiry, IP-based rate limiting, runtime-configurable permission groups, and a REST admin API. No hardcoded permissions -- all groups and entries are defined at runtime via API.

## Install

```bash
npm install @astralibx/staff-engine
```

### Peer Dependencies

| Package | Required |
|---------|----------|
| `express` | Yes |
| `mongoose` | Yes |

```bash
npm install express mongoose
```

## Quick Start

```ts
import { createStaffEngine } from '@astralibx/staff-engine';
import mongoose from 'mongoose';
import bcrypt from 'bcryptjs';
import express from 'express';

const app = express();
app.use(express.json());

const connection = mongoose.createConnection('mongodb://localhost:27017/myapp');

const engine = createStaffEngine({
  db: { connection },
  auth: {
    jwtSecret: process.env.JWT_SECRET!,
  },
  adapters: {
    hashPassword: (plain) => bcrypt.hash(plain, 12),
    comparePassword: (plain, hash) => bcrypt.compare(plain, hash),
  },
});

app.use('/api/staff', engine.routes);
app.listen(3000);
```

## Features

### Authentication

- **JWT with role-based expiry** -- login returns a JWT signed with `jwtSecret`. Owners get `ownerTokenExpiry` (default `30d`); staff members get `staffTokenExpiry` (default `24h`). Both are configurable.
- **Login with IP rate limiting** -- `POST /login` tracks failed attempts per IP using Redis sorted sets or in-memory fallback. Locks out after `maxAttempts` failures within `windowMs` (default: 5 attempts / 15 min). Returns `STAFF_RATE_LIMITED` on lockout.
- **Setup route auto-locks** -- `POST /setup` creates the initial owner account and then permanently locks itself. Any subsequent call returns `STAFF_SETUP_ALREADY_COMPLETE`. This route is always public and never requires a token.
- **Token distinguishes expired vs invalid** -- `verifyToken` middleware checks `TokenExpiredError` separately from all other JWT errors and returns `STAFF_TOKEN_EXPIRED` vs `STAFF_TOKEN_INVALID` so clients can show the correct message.

### Staff Management

- **Create staff with permissions** -- owner creates staff with name, email, password hash (via adapter), optional initial permissions, and optional `externalUserId` for linking to external identity systems.
- **Email uniqueness** -- duplicate email rejected with `STAFF_EMAIL_EXISTS`. Can be disabled via `requireEmailUniqueness: false`.
- **Paginated list with filters** -- `GET /` supports `status`, `role`, `page`, and `limit` query params. Returns `data[]` + `pagination` with total counts.
- **Owner-only access** -- all staff CRUD routes (`GET /`, `POST /`, `PUT /:id`, `PUT /:id/permissions`, `PUT /:id/status`, `PUT /:id/password`) require owner role. `GET /me` and `PUT /me/password` are staff-accessible.
- **No-delete policy** -- staff records are never hard-deleted. Deactivate to revoke access. Inactive staff tokens are rejected on every authenticated request even before JWT expiry.

### Permissions

- **Runtime-configurable groups via API** -- `POST /permission-groups` creates a named group with permission entries. Groups have `groupId`, `label`, `sortOrder`, and an array of entries (key, label, type). No redeploy required to define new permissions.
- **Edit-to-view cascade** -- when granting a permission ending in `.edit`, the corresponding `.view` key is automatically required. The engine validates this on `PUT /:id/permissions`.
- **Permission cache (Redis or in-memory)** -- each staff member's resolved permission list is cached after the first lookup. TTL is `permissionCacheTtlMs` (default 5 min). Cache is invalidated immediately on `updatePermissions` or `updateStatus`.
- **Owner bypasses all checks** -- `requirePermission` middleware skips the permission check entirely when `req.user.role === 'owner'`.

### Security

- **Rate limiting (configurable window/max)** -- `windowMs` and `maxAttempts` are configurable at engine creation time. Uses Redis `ZADD`/`ZREMRANGEBYSCORE` for accurate per-IP tracking across multiple processes.
- **Last-owner guard** -- `PUT /:id/status` with `status: 'inactive'` checks that at least one other active owner exists before allowing the change. Returns `STAFF_LAST_OWNER_GUARD` if blocked.
- **Inactive token rejection** -- every call through `verifyToken` re-reads staff status from MongoDB (with optional tenant filter). Inactive or pending accounts are rejected with `STAFF_TOKEN_INVALID` even with an otherwise valid JWT.
- **Status checks on every request** -- `verifyToken` loads status and role fresh on each request. There is no session store; the database is the source of truth.

### Integration

- **`resolveStaff` for programmatic token resolution** -- `engine.auth.resolveStaff(token)` returns `{ staffId, role, permissions }` or `null` without sending an HTTP response. Useful for WebSocket authentication or programmatic access in other modules.
- **`requirePermission` middleware for consumer routes** -- `engine.auth.requirePermission('contacts.view', 'contacts.edit')` returns an Express middleware that checks the current user's permissions. Owners always pass. Non-owners are rejected with `STAFF_INSUFFICIENT_PERMISSIONS` and a list of missing keys.
- **`requireRole` middleware** -- `engine.auth.requireRole('owner', 'staff')` checks the token's resolved role against the provided list.

## Routes

| Method | Path | Auth | Description |
|--------|------|------|-------------|
| `POST` | `/setup` | Public | Create initial owner account (auto-locks after first use) |
| `POST` | `/login` | Public | Authenticate and receive JWT token |
| `GET` | `/me` | Staff | Get current staff profile and resolved permissions |
| `PUT` | `/me/password` | Staff | Change own password (only when `allowSelfPasswordChange: true`) |
| `GET` | `/` | Owner | List staff with pagination and status/role filters |
| `POST` | `/` | Owner | Create a new staff member |
| `PUT` | `/:staffId` | Owner | Update staff name, email, metadata |
| `PUT` | `/:staffId/permissions` | Owner | Replace staff permission set |
| `PUT` | `/:staffId/status` | Owner | Activate or deactivate a staff member |
| `PUT` | `/:staffId/password` | Owner | Reset a staff member's password |
| `GET` | `/permission-groups` | Staff | List all permission groups |
| `POST` | `/permission-groups` | Owner | Create a new permission group |
| `PUT` | `/permission-groups/:groupId` | Owner | Update a permission group's entries or label |
| `DELETE` | `/permission-groups/:groupId` | Owner | Delete a permission group |

## Architecture

The factory function returns a single `StaffEngine` object:

| Export | Purpose |
|--------|---------|
| `engine.routes` | Express router -- mount at `/api/staff` or similar |
| `engine.auth.verifyToken` | Middleware to authenticate any route |
| `engine.auth.requirePermission(...keys)` | Middleware for permission-gated routes |
| `engine.auth.ownerOnly` | Middleware to restrict to owner role |
| `engine.auth.resolveStaff(token)` | Programmatic token resolution (no HTTP response) |
| `engine.staff` | Direct access to `StaffService` for programmatic use |
| `engine.permissions` | Direct access to `PermissionService` |
| `engine.models` | Mongoose models (`Staff`, `PermissionGroup`) |
| `engine.destroy()` | Flush permission cache and clean up resources |

## Redis Key Prefix (Required for Multi-Project Deployments)

> **WARNING:** If multiple projects share the same Redis server, you MUST set a unique `keyPrefix` per project. Without this, rate limiter state and permission cache entries will collide across projects.

```ts
const engine = createStaffEngine({
  redis: {
    connection: redis,
    keyPrefix: 'myproject:staff:', // REQUIRED if sharing Redis
  },
  // ...
});
```

## Links

- [GitHub](https://github.com/Hariprakash1997/astralib/tree/main/packages/staff/staff-engine)
- [staff-types](https://github.com/Hariprakash1997/astralib/tree/main/packages/staff/staff-types)
- [staff-ui](https://github.com/Hariprakash1997/astralib/tree/main/packages/staff/staff-ui)

## License

MIT
