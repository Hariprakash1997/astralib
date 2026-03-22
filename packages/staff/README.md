# @astralibx/staff-*

Production-grade staff management for Node.js -- JWT authentication with role-based expiry, runtime-configurable permissions, owner-gated CRUD, IP-based rate limiting, and an embeddable admin UI.

## Features

### Authentication
- **JWT with role-based expiry** -- owners get a longer-lived token (`ownerTokenExpiry`, default 30d); staff members get a shorter one (`staffTokenExpiry`, default 24h). Both are configurable.
- **Rate-limited login** -- IP-based brute-force protection using Redis or in-memory fallback. Default: 5 attempts per 15-minute window. Configurable via `rateLimiter.windowMs` and `rateLimiter.maxAttempts`.
- **Setup route for first owner** -- `POST /setup` creates the initial owner account and then locks itself permanently. Subsequent calls return `STAFF_SETUP_ALREADY_COMPLETE`.
- **Token error distinction** -- the middleware differentiates between expired tokens (`STAFF_TOKEN_EXPIRED`) and invalid/tampered tokens (`STAFF_TOKEN_INVALID`) so clients can prompt re-login vs. show an error.

### Staff CRUD
- **Create staff** -- owner creates staff with name, email, password, optional permissions, and optional external user ID. Email uniqueness is enforced by default.
- **List staff** -- paginated list with optional filters for status and role. Default page size 20, max 100.
- **Update staff** -- owner can update name, email, and metadata.
- **Activate / deactivate** -- owner changes staff status. The last active owner cannot be deactivated (last-owner guard).
- **No delete policy** -- staff records are never hard-deleted. Deactivate to revoke access; tokens for inactive accounts are rejected on every request.
- **Password reset** -- owner can reset any staff member's password. Optionally staff can change their own password (`allowSelfPasswordChange`).

### Permissions
- **Runtime-configurable groups** -- permission groups (collections of permission entries) are stored in MongoDB and managed via API at runtime -- no redeploy needed to add new permissions.
- **Three permission types** -- `view`, `edit`, `action`. Each entry has a machine-readable key and a human-readable label.
- **Edit-to-view cascade** -- granting an `edit` permission automatically implies the corresponding `view` permission (single-level cascade).
- **Permission cache** -- staff permissions are cached per-staff (Redis or in-memory) with a configurable TTL (`permissionCacheTtlMs`, default 5 min). Cache is invalidated on every permission update.
- **Owner bypasses all checks** -- owner role has implicit access to everything; `requirePermission` middleware skips checks for owners.

### Security
- **IP-based rate limiting** -- login attempts tracked by IP using Redis sorted sets or in-memory maps. Redis is preferred but optional.
- **Inactive staff token rejection** -- every authenticated request re-checks staff status in the database. Deactivated accounts are rejected immediately even with a valid token.
- **Last-owner guard** -- prevents deactivating the final active owner, ensuring admin access is never locked out.
- **Permission cache with TTL** -- limits database reads per request while ensuring permission changes propagate within the cache window.

### Admin UI
- **7 Lit web components** -- self-contained shadow DOM components for building a staff management dashboard. Communicate with the engine REST API via `AlxStaffConfig`.
- **Theming via CSS custom properties** -- all colors, spacing, and typography are overridable via CSS variables on the host element.
- **Compact density mode** -- all components accept a `density="compact"` attribute for tighter layouts.

## Packages

| Package | npm | Description |
|---------|-----|-------------|
| [staff-types](https://github.com/Hariprakash1997/astralib/tree/main/packages/staff/staff-types) | `@astralibx/staff-types` | Shared TypeScript types, enums, and config contracts |
| [staff-engine](https://github.com/Hariprakash1997/astralib/tree/main/packages/staff/staff-engine) | `@astralibx/staff-engine` | Backend engine: JWT auth, staff CRUD, permission groups, REST API |
| [staff-ui](https://github.com/Hariprakash1997/astralib/tree/main/packages/staff/staff-ui) | `@astralibx/staff-ui` | Admin dashboard Lit components (7 components) |

## Architecture

```
@astralibx/core
     |
     +-- staff-types                (pure TS, no runtime deps)
              |
              +-- staff-engine      (peer: express, mongoose)
              |
              +-- staff-ui          (peer: lit)
```

- **staff-engine** owns all server-side logic -- authentication, authorization, CRUD, rate limiting, permission cache
- **staff-ui** has no dependency on **staff-engine** -- it communicates via HTTP using `AlxStaffConfig` and `StaffApiClient`
- **staff-types** is the only shared dependency between server and UI packages

## Design Principles

1. **Adapter-based password hashing** -- the engine does not depend on any specific hashing library. Consumers provide `hashPassword` and `comparePassword` adapters. Use bcrypt, argon2, or any other library.

2. **Factory pattern** -- `createStaffEngine` validates config with Zod, registers Mongoose models, creates all services, and returns a ready-to-use object.

3. **No hardcoded permissions** -- the library does not define any permission keys. All permission groups and entries are created by the consumer at runtime via the API, making it domain-agnostic.

4. **Optional Redis** -- rate limiting and permission caching work without Redis using in-memory fallbacks. Redis is recommended for multi-process deployments.

5. **Tenant scoping** -- all database queries are automatically scoped to `tenantId` when provided. Enables multi-tenant deployments on a shared MongoDB cluster.

## End-to-End Setup

### 1. Install packages

```bash
# Server
npm install @astralibx/staff-engine
npm install express mongoose

# Frontend
npm install @astralibx/staff-ui
npm install lit
```

### 2. Create the engine

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
    staffTokenExpiry: '24h',
    ownerTokenExpiry: '30d',
  },
  adapters: {
    hashPassword: (plain) => bcrypt.hash(plain, 12),
    comparePassword: (plain, hash) => bcrypt.compare(plain, hash),
  },
  hooks: {
    onLogin: (staff, ip) => console.log(`Login: ${staff.email} from ${ip}`),
    onLoginFailed: (email, ip) => console.warn(`Failed login: ${email} from ${ip}`),
  },
});
```

### 3. Mount routes

```ts
app.use('/api/staff', engine.routes);
app.listen(3000);
```

### 4. Protect your own routes

```ts
// Require a valid staff token
app.get('/api/dashboard', engine.auth.verifyToken, (req, res) => {
  res.json({ ok: true });
});

// Require a specific permission
app.get('/api/contacts', engine.auth.requirePermission('contacts.view'), (req, res) => {
  res.json({ contacts: [] });
});

// Owner only
app.delete('/api/data', engine.auth.ownerOnly, (req, res) => {
  res.json({ deleted: true });
});
```

### 5. Add the admin UI

```ts
import { AlxStaffConfig } from '@astralibx/staff-ui';

AlxStaffConfig.setup({
  staffApi: '/api/staff',
  authToken: 'Bearer <owner-token>',
});

import '@astralibx/staff-ui';
```

```html
<alx-staff-list></alx-staff-list>
<alx-staff-create-form></alx-staff-create-form>
<alx-permission-group-editor></alx-permission-group-editor>
```

## Package READMEs

1. [staff-types/README.md](https://github.com/Hariprakash1997/astralib/blob/main/packages/staff/staff-types/README.md) -- Types and enums
2. [staff-engine/README.md](https://github.com/Hariprakash1997/astralib/blob/main/packages/staff/staff-engine/README.md) -- Server engine
3. [staff-ui/README.md](https://github.com/Hariprakash1997/astralib/blob/main/packages/staff/staff-ui/README.md) -- Admin dashboard

## License

MIT
