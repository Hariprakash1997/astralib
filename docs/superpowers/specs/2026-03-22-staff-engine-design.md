# @astralibx/staff-engine — Design Specification

**Date:** 2026-03-22
**Status:** Approved
**Goal:** Build a staff management library with authentication, runtime-configurable permissions, and admin UI components. Staff-engine becomes the identity source of truth for chat-engine and call-log-engine.

---

## 1. Package Structure

```
packages/staff/
├── staff-types/         # Pure TS types, enums, config interface
├── staff-engine/        # Backend: schemas, services, auth, routes, rate limiter
└── staff-ui/            # Lit web components for admin UI
```

### Directory Layout — staff-types

```
staff-types/src/
├── enums.ts              # StaffRole, StaffStatus, PermissionType
├── staff.types.ts        # IStaff, IStaffSummary
├── permission.types.ts   # IPermissionGroup, IPermissionEntry
├── adapter.types.ts      # Adapter callback signatures
├── config.types.ts       # StaffEngineConfig, ResolvedOptions, DEFAULT_OPTIONS
├── metric.types.ts       # StaffMetric type
└── index.ts              # Barrel export
```

### Directory Layout — staff-engine

```
staff-engine/src/
├── __tests__/
│   ├── services/
│   ├── middleware/
│   └── routes/
├── constants/
│   └── index.ts
├── errors/
│   └── index.ts
├── middleware/
│   └── auth.middleware.ts
├── routes/
│   ├── index.ts
│   ├── auth.routes.ts
│   ├── staff.routes.ts
│   └── permission-group.routes.ts
├── schemas/
│   ├── staff.schema.ts
│   ├── permission-group.schema.ts
│   └── index.ts
├── services/
│   ├── staff.service.ts
│   ├── permission.service.ts
│   ├── rate-limiter.service.ts
│   ├── permission-cache.service.ts
│   └── index.ts
├── validation/
│   └── index.ts
└── index.ts
```

### Directory Layout — staff-ui

```
staff-ui/src/
├── api/
│   └── staff-api-client.ts
├── components/
│   ├── alx-staff-list.ts
│   ├── alx-staff-create-form.ts
│   ├── alx-staff-permission-editor.ts
│   ├── alx-staff-password-reset.ts
│   ├── alx-staff-status-toggle.ts
│   ├── alx-permission-group-editor.ts
│   └── alx-staff-setup.ts
├── styles/
│   └── shared.ts
├── utils/
│   └── safe-register.ts
├── config.ts              # AlxStaffConfig static class
└── index.ts               # Barrel export + register all components
```

### Barrel Exports — staff-engine/src/index.ts

```ts
// Factory
export { createStaffEngine } from './factory.js';

// Re-exports for direct consumer access
export * from './constants/index.js';
export * from './errors/index.js';
export * from './schemas/index.js';
export * from './validation/index.js';
export { StaffService } from './services/staff.service.js';
export { PermissionService } from './services/permission.service.js';
export { createRoutes } from './routes/index.js';
export type { StaffEngineConfig, ResolvedOptions } from '@astralibx/staff-types';
export { DEFAULT_OPTIONS } from '@astralibx/staff-types';
```

---

## 2. Data Model

### Staff Schema

```ts
{
  name: string;                          // required
  email: string;                         // required, unique per tenant
  password: string;                      // hashed via adapter
  role: 'owner' | 'staff';              // default 'staff'
  status: 'active' | 'inactive' | 'pending';  // default 'pending'
  permissions: string[];                 // runtime-configured keys from PermissionGroup
  externalUserId?: string;               // link to consuming project's user model
  lastLoginAt?: Date;
  lastLoginIp?: string;
  metadata?: Record<string, unknown>;
  tenantId?: string;                     // multi-tenant support
  // timestamps: true → createdAt, updatedAt
}
```

Indexes: `{ email: 1, tenantId: 1 }` unique, `{ status: 1 }`, `{ role: 1 }`, `{ tenantId: 1 }` sparse.

### PermissionGroup Schema

```ts
{
  groupId: string;                       // unique slug, e.g. 'chat-management'
  label: string;                         // display name, e.g. 'Chat Management'
  permissions: [
    { key: string, label: string, type: 'view' | 'edit' | 'action' }
  ];
  sortOrder: number;                     // UI ordering
  tenantId?: string;
  // timestamps: true
}
```

Indexes: `{ groupId: 1, tenantId: 1 }` unique, `{ sortOrder: 1 }`.

### View/Edit Cascading

Single-level cascading only. When `requirePermission('chat:edit')` is called, middleware auto-verifies that `chat:view` is also present. The cascade looks at the last `:` segment — `chat:edit` requires `chat:view`. Deeper keys like `chat:settings:edit` require `chat:settings:view` only, NOT `chat:view`.

**Validation on save:** `StaffService.updatePermissions()` validates that for every `edit`-type permission key assigned, the corresponding `view`-type key is also in the array. Rejects with `InvalidPermissionError` if not. This prevents invalid states from being persisted.

### Staff Deletion Policy

Staff members are never deleted — only deactivated via `updateStatus(staffId, 'inactive')`. No `DELETE /:staffId` route exists. Deactivated staff cannot log in but their records are preserved for audit trails.

---

## 3. Factory API

```ts
const engine = createStaffEngine({
  db: { connection: mongooseConnection, collectionPrefix?: '' },
  redis?: { connection: redisClient, keyPrefix?: 'staff:' },  // optional — in-memory fallback
  logger?: LogAdapter,
  tenantId?: string,                     // default applied to all operations
  auth: {
    jwtSecret: string,
    staffTokenExpiry?: '24h',
    ownerTokenExpiry?: '30d',
    permissionCacheTtlMs?: 300_000,      // default 5min
  },
  adapters: {
    hashPassword: (password: string) => Promise<string>,
    comparePassword: (plain: string, hash: string) => Promise<boolean>,
  },
  hooks?: {
    onStaffCreated?: (staff) => void | Promise<void>,
    onLogin?: (staff, ip?: string) => void | Promise<void>,
    onLoginFailed?: (email: string, ip?: string) => void | Promise<void>,
    onPermissionsChanged?: (staffId, oldPerms, newPerms) => void | Promise<void>,
    onStatusChanged?: (staffId, oldStatus, newStatus) => void | Promise<void>,
    onMetric?: (metric: StaffMetric) => void | Promise<void>,
  },
  options?: {
    requireEmailUniqueness?: true,
    allowSelfPasswordChange?: false,
    rateLimiter?: {
      windowMs?: 900_000,                // default 15min
      maxAttempts?: 5,
    },
  },
});
```

Note: `onStaffCreated` moved from `adapters` to `hooks` for consistency with chat-engine/call-log-engine where all lifecycle callbacks live under `hooks`. Adapters are reserved for functions the engine calls to get data or perform operations (`hashPassword`, `comparePassword`).

### Returns

```ts
engine.routes         // Express Router → mount at /api/staff
engine.auth           // { verifyToken, resolveStaff, requirePermission, ownerOnly, requireRole }
engine.staff          // StaffService (CRUD, login, password)
engine.permissions    // PermissionService (group CRUD)
engine.models         // { Staff, PermissionGroup }
engine.destroy()      // cleanup: clear cache, stop timers
```

### Config Validation

Zod schema validates config at factory call time. Required fields: `db.connection`, `auth.jwtSecret`, `adapters.hashPassword`, `adapters.comparePassword`. Redis is validated with `redis: baseRedisSchema.optional()` (not required like chat-engine). `InvalidConfigError` is a startup-only error — thrown during factory construction, never returned as HTTP response.

---

## 4. REST API Routes

| Method | Path | Access | Description |
|--------|------|--------|-------------|
| `POST` | `/setup` | Public (auto-locks, per tenant) | Create first owner. Uses `findOneAndUpdate` with upsert to prevent race conditions. Returns 403 if any staff exist for the tenant. |
| `POST` | `/login` | Public (rate limited by IP) | Authenticate, return JWT |
| `GET` | `/me` | Authenticated | Current staff profile + permissions |
| `PUT` | `/me/password` | Authenticated | Change own password. Route only mounted if `allowSelfPasswordChange: true`. |
| `GET` | `/` | Owner only | List all staff (paginated: `?page=1&limit=20&status=active&role=staff`) |
| `POST` | `/` | Owner only | Create staff member |
| `PUT` | `/:staffId` | Owner only | Update staff (name, email, metadata) |
| `PUT` | `/:staffId/permissions` | Owner only | Set staff permissions |
| `PUT` | `/:staffId/status` | Owner only | Activate/deactivate (last-owner guard: cannot deactivate if only active owner) |
| `PUT` | `/:staffId/password` | Owner only | Reset staff password |
| `GET` | `/permission-groups` | Authenticated | List permission groups |
| `POST` | `/permission-groups` | Owner only | Create permission group |
| `PUT` | `/permission-groups/:groupId` | Owner only | Update permission group |
| `DELETE` | `/permission-groups/:groupId` | Owner only | Delete permission group |

### Pagination

All list endpoints use page/limit pagination matching call-log-engine:
```ts
{ data: T[], pagination: { page: number, limit: number, total: number, totalPages: number } }
```

---

## 5. Services

### StaffService

- `setupOwner(data)` → uses `findOneAndUpdate` with upsert (race-safe). Creates first owner if zero staff exist for the tenant. Hashes password via adapter, returns JWT.
- `login(email, password, ip?)` → checks rate limit (keyed by IP), validates credentials, checks status (active only), updates lastLoginAt/lastLoginIp, resets rate limit on success, fires hooks, returns JWT
- `create(data)` → validates email uniqueness per tenant, hashes password via adapter, fires `onStaffCreated` hook
- `list(filters?)` → paginated (page/limit), filterable by status/role
- `getById(staffId)` → single staff lookup
- `update(staffId, data)` → name, email, metadata only (not permissions/status)
- `updatePermissions(staffId, permissions[])` → validates edit→view pairs present, sets permissions, invalidates cache, fires `onPermissionsChanged` hook
- `updateStatus(staffId, status)` → **last-owner guard:** if deactivating, count active owners first; reject if this is the last one. Invalidates cache, fires `onStatusChanged` hook
- `resetPassword(staffId, newPassword)` → hash via adapter
- `changeOwnPassword(staffId, oldPassword, newPassword)` → validates old password first, only callable if `allowSelfPasswordChange` enabled

### PermissionService

- `listGroups()` → all groups sorted by sortOrder
- `createGroup(data)` → validates unique groupId per tenant
- `updateGroup(groupId, data)` → update label, permissions array, sortOrder. Calls `PermissionCacheService.invalidateAll()` since key meanings may have changed.
- `deleteGroup(groupId)` → removes group. Does NOT auto-revoke keys from staff (orphaned keys are inert — middleware checks against cache/DB, not against groups). Calls `invalidateAll()`.
- `getAllPermissionKeys()` → flat array of all keys across all groups

### RateLimiterService

- Redis-backed if Redis provided, in-memory Map fallback
- Key format for login: IP address (e.g., `rate:login:192.168.1.1`)
- `checkLimit(key)` → `{ allowed, remaining, retryAfterMs? }`
- `recordAttempt(key)` → increment counter with window expiry
- `reset(key)` → clear on successful login

### PermissionCacheService

- Redis hash if available, in-memory Map fallback
- `get(staffId)` → permissions[] from cache, DB fallback on miss, re-populates cache
- `invalidate(staffId)` → clear single entry
- `invalidateAll()` → flush entire cache (triggered by permission group changes)

---

## 6. Auth Middleware

### JWT Token

Payload: `{ staffId, role }` — minimal. Permissions resolved from cache on every request.

Token expiry: `ownerTokenExpiry` (default 30d) for owners, `staffTokenExpiry` (default 24h) for staff.

### Middleware Exports

```ts
engine.auth.verifyToken
// Express middleware. Parses JWT from Authorization header, validates signature and expiry.
// Resolves permissions from PermissionCacheService (async — falls back to DB on cache miss).
// Checks staff status from cache/DB — rejects inactive/pending staff even if token is valid.
// Attaches { staffId, role, permissions[] } to req.user.
// 401 on missing/invalid/expired token or inactive account.

engine.auth.resolveStaff(token: string): Promise<{ staffId, role, permissions[] } | null>
// Programmatic (non-middleware) version for use in adapter callbacks.
// Returns null if token invalid or staff inactive. Async.

engine.auth.requirePermission(...keys)
// Checks all keys present in req.user.permissions.
// Edit→view cascading: 'chat:edit' auto-requires 'chat:view' (single-level only).
// 403 on missing permissions.

engine.auth.ownerOnly
// Checks req.user.role === 'owner'. 403 otherwise.

engine.auth.requireRole(...roles)
// Checks req.user.role in provided list. 403 otherwise.
```

### Consumer Integration

```ts
// Staff-engine provides identity, other engines consume via adapters:
const chatEngine = createChatEngine({
  adapters: {
    authenticateAgent: async (token) => {
      const staff = await staffEngine.auth.resolveStaff(token);
      if (!staff || !staff.permissions.includes('chat:view')) return null;
      return { adminUserId: staff.staffId, displayName: staff.name };
    },
  },
});
```

### Multi-Tenant Setup Behavior

In multi-tenant mode (`tenantId` provided in config), the `/setup` route scopes the "zero staff exist" check to the current tenant. Each tenant gets their own first-owner setup independently.

---

## 7. Error Handling

### Error Codes

```ts
const ERROR_CODE = {
  // Auth
  InvalidCredentials: 'STAFF_INVALID_CREDENTIALS',
  AccountInactive: 'STAFF_ACCOUNT_INACTIVE',
  AccountPending: 'STAFF_ACCOUNT_PENDING',
  RateLimited: 'STAFF_RATE_LIMITED',
  TokenExpired: 'STAFF_TOKEN_EXPIRED',
  TokenInvalid: 'STAFF_TOKEN_INVALID',
  InsufficientPermissions: 'STAFF_INSUFFICIENT_PERMISSIONS',
  OwnerOnly: 'STAFF_OWNER_ONLY',

  // CRUD
  StaffNotFound: 'STAFF_NOT_FOUND',
  EmailExists: 'STAFF_EMAIL_EXISTS',
  SetupAlreadyComplete: 'STAFF_SETUP_ALREADY_COMPLETE',
  LastOwnerGuard: 'STAFF_LAST_OWNER_GUARD',
  InvalidPermissions: 'STAFF_INVALID_PERMISSIONS',

  // Permission Groups
  GroupNotFound: 'STAFF_GROUP_NOT_FOUND',
  GroupIdExists: 'STAFF_GROUP_ID_EXISTS',

  // Config (startup-only, not HTTP)
  InvalidConfig: 'STAFF_INVALID_CONFIG',
} as const;
```

### Error Class Hierarchy

```
AlxStaffError (extends AlxError from @astralibx/core)
├── AuthenticationError     → 401 (InvalidCredentials, AccountInactive, AccountPending)
├── AuthorizationError      → 403 (InsufficientPermissions, OwnerOnly)
├── RateLimitError          → 429 (RateLimited — includes retryAfterMs, Retry-After header)
├── TokenError              → 401 (TokenExpired, TokenInvalid)
├── StaffNotFoundError      → 404 (StaffNotFound)
├── DuplicateError          → 409 (EmailExists, GroupIdExists)
├── SetupError              → 403 (SetupAlreadyComplete)
├── LastOwnerError          → 400 (LastOwnerGuard — cannot deactivate last owner)
├── InvalidPermissionError  → 400 (InvalidPermissions — edit without view)
└── InvalidConfigError      → startup-only, never returned as HTTP response
```

---

## 8. UI Components

| Component | Tag | Purpose |
|-----------|-----|---------|
| `AlxStaffConfig` | — | Static config class (`staffApi`, `authToken`) |
| `AlxStaffList` | `<alx-staff-list>` | Table: name, email, role, status badge, permissions count, last login |
| `AlxStaffCreateForm` | `<alx-staff-create-form>` | Form: name, email, password, permission picker |
| `AlxStaffPermissionEditor` | `<alx-staff-permission-editor>` | Grouped checkboxes, select-all/clear-all, edit→view auto-check |
| `AlxStaffPasswordReset` | `<alx-staff-password-reset>` | Modal: new password + confirm |
| `AlxStaffStatusToggle` | `<alx-staff-status-toggle>` | Inline active/inactive toggle with confirmation |
| `AlxPermissionGroupEditor` | `<alx-permission-group-editor>` | Owner-only CRUD for permission groups |
| `AlxStaffSetup` | `<alx-staff-setup>` | First-run setup form |

### UI Events

| Component | Event | Detail |
|-----------|-------|--------|
| `AlxStaffCreateForm` | `staff-created` | `{ staff }` |
| `AlxStaffPermissionEditor` | `permissions-updated` | `{ staffId, permissions }` |
| `AlxStaffPasswordReset` | `password-reset` | `{ staffId }` |
| `AlxStaffStatusToggle` | `status-changed` | `{ staffId, status }` |
| `AlxPermissionGroupEditor` | `group-created` | `{ group }` |
| `AlxPermissionGroupEditor` | `group-updated` | `{ groupId, group }` |
| `AlxPermissionGroupEditor` | `group-deleted` | `{ groupId }` |
| `AlxStaffSetup` | `setup-complete` | `{ staff, token }` |

### UI Patterns

- **Shared styles** — reuses `alxResetStyles`, `alxThemeStyles`, `alxDensityStyles`, `alxButtonStyles`, `alxInputStyles`, `alxTableStyles`, `alxCardStyles`
- **API client** — `StaffApiClient` with typed methods for every route. Configured via `AlxStaffConfig.setup()`
- **Events over callbacks** — components dispatch CustomEvents (see table above)
- **Progressive disclosure** — staff list shows essentials, actions expand on interaction
- **Permission picker** — grouped by PermissionGroup, collapsible sections, edit auto-checks view

---

## 9. Testing Strategy

| Area | Tests | Count |
|------|-------|-------|
| StaffService | create, login, update, permissions, status, password reset, setupOwner, email uniqueness, inactive rejection, last-owner guard, edit→view validation | ~28 |
| PermissionService | group CRUD, duplicate groupId, getAllKeys, sortOrder, invalidateAll on change | ~12 |
| Auth middleware | verifyToken (valid/expired/invalid/inactive-staff), resolveStaff, requirePermission (has/missing/cascade), ownerOnly, requireRole | ~14 |
| RateLimiterService | allow/block, window reset, Redis mode, in-memory mode, key format | ~8 |
| PermissionCacheService | get/set/invalidate, TTL, DB fallback, invalidateAll | ~8 |
| Routes | each endpoint success + error, setup auto-lock, setup race safety, rate limit on login, last-owner guard, self-password route gating | ~24 |
| Validation | Zod config, email format, permission pair validation | ~6 |
| Error classes | correct codes, context, HTTP status mapping | ~5 |
| **Total** | | **~105** |

### Test Approach

- Mock mongoose models, adapters, Redis client
- Services tested independently
- Routes tested with supertest-style handler invocation
- Integration tests for: setup→login flow, permission-cache-invalidation flow, multi-tenant isolation
- Coverage threshold: 80% statements/branches/functions/lines

---

## 10. Decisions Log

| # | Decision | Rationale |
|---|----------|-----------|
| D1 | Own `staff` collection | Clean separation. `externalUserId` for linking to consuming project. |
| D2 | Runtime-configurable permissions | Admin creates groups via API/UI. Library enforces, doesn't define keys. |
| D3 | Staff-engine is identity source | Chat and call-log consume via existing adapter wiring. |
| D4 | Password hashing as adapter | No crypto dependency. Consumer provides bcrypt/argon2. |
| D5 | Optional Redis | In-memory fallback for rate limiter and permission cache. Redis for multi-instance. |
| D6 | Role-based owner concept | `role: 'owner' \| 'staff'`. Extensible for future roles. |
| D7 | Setup route for first owner | `POST /setup` auto-locks per tenant. Race-safe via `findOneAndUpdate`. |
| D8 | Minimal JWT + permission cache | Token carries `{ staffId, role }`. Permissions resolved from cache (5min TTL). |
| D9 | `verifyToken` checks staff status | Inactive/pending staff rejected even with valid token. No token blacklisting needed. |
| D10 | Last-owner guard | Cannot deactivate the last active owner. Prevents lockout. |
| D11 | Single-level edit→view cascade | `chat:edit` → `chat:view`. Not recursive. Validated on save and enforced in middleware. |
| D12 | `onStaffCreated` is a hook, not adapter | All lifecycle callbacks under `hooks`. Adapters only for data/operation functions. |
| D13 | No staff deletion | Deactivate only. Records preserved for audit. |
| D14 | Rate limiter keyed by IP | Prevents brute force from single source. Reset on successful login. |
| D15 | Multi-tenant setup isolation | `/setup` scoped per tenant. Each tenant bootstraps independently. |
