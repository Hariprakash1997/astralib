# Staff Engine Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build `@astralibx/staff-engine` — a staff management library with JWT authentication, runtime-configurable permissions, and Lit admin UI components.

**Architecture:** Three packages (staff-types, staff-engine, staff-ui) following the same factory pattern as chat-engine and call-log-engine. Types package has no runtime deps. Engine peers on express + mongoose. UI uses Lit web components.

**Tech Stack:** TypeScript, Mongoose, Express, Zod, jsonwebtoken, Lit, Vitest, tsup, Vite

**Spec:** `docs/superpowers/specs/2026-03-22-staff-engine-design.md`

---

## File Structure

### staff-types (9 files)

| File | Responsibility |
|------|---------------|
| `packages/staff/staff-types/package.json` | Package config, no runtime deps |
| `packages/staff/staff-types/tsconfig.json` | Extends base, no composite |
| `packages/staff/staff-types/tsup.config.ts` | Dual CJS/ESM build |
| `packages/staff/staff-types/src/index.ts` | Barrel export |
| `packages/staff/staff-types/src/enums.ts` | StaffRole, StaffStatus, PermissionType enums |
| `packages/staff/staff-types/src/staff.types.ts` | IStaff, IStaffSummary, IStaffCreateInput |
| `packages/staff/staff-types/src/permission.types.ts` | IPermissionGroup, IPermissionEntry |
| `packages/staff/staff-types/src/adapter.types.ts` | Adapter callback signatures |
| `packages/staff/staff-types/src/config.types.ts` | StaffEngineConfig, ResolvedOptions, DEFAULT_OPTIONS, hook types, StaffMetric |

### staff-engine (22 files)

| File | Responsibility |
|------|---------------|
| `packages/staff/staff-engine/package.json` | Deps: staff-types, core, zod, jsonwebtoken. Peers: express, mongoose |
| `packages/staff/staff-engine/tsconfig.json` | Extends base |
| `packages/staff/staff-engine/tsup.config.ts` | Dual CJS/ESM build |
| `packages/staff/staff-engine/vitest.config.ts` | Test config with 80% coverage thresholds |
| `packages/staff/staff-engine/src/index.ts` | Factory function (with inline Zod config schema) + barrel exports |
| `packages/staff/staff-engine/src/constants/index.ts` | ERROR_CODE, ERROR_MESSAGE, DEFAULTS |
| `packages/staff/staff-engine/src/errors/index.ts` | AlxStaffError hierarchy (10 error classes, incl. GroupNotFoundError) |
| `packages/staff/staff-engine/src/schemas/staff.schema.ts` | Staff mongoose schema + model factory |
| `packages/staff/staff-engine/src/schemas/permission-group.schema.ts` | PermissionGroup schema + model factory |
| `packages/staff/staff-engine/src/schemas/index.ts` | Barrel export schemas |
| `packages/staff/staff-engine/src/services/rate-limiter.service.ts` | IP-based rate limiting (Redis or in-memory) |
| `packages/staff/staff-engine/src/services/permission-cache.service.ts` | Permission cache (Redis or in-memory) |
| `packages/staff/staff-engine/src/services/permission.service.ts` | PermissionGroup CRUD |
| `packages/staff/staff-engine/src/services/staff.service.ts` | Staff CRUD, login, password, setup |
| `packages/staff/staff-engine/src/services/index.ts` | Barrel export services |
| `packages/staff/staff-engine/src/utils/error-handler.ts` | Reusable handleStaffError for routes |
| `packages/staff/staff-engine/src/middleware/auth.middleware.ts` | verifyToken, resolveStaff, requirePermission, ownerOnly, requireRole |
| `packages/staff/staff-engine/src/routes/auth.routes.ts` | POST /setup, POST /login, GET /me, PUT /me/password |
| `packages/staff/staff-engine/src/routes/staff.routes.ts` | Staff CRUD routes (owner only) |
| `packages/staff/staff-engine/src/routes/permission-group.routes.ts` | Permission group CRUD routes |
| `packages/staff/staff-engine/src/routes/index.ts` | createRoutes factory, mounts all sub-routers |
| `packages/staff/staff-engine/src/validation/index.ts` | Zod config schema, permission pair validation |

### staff-ui (15 files)

| File | Responsibility |
|------|---------------|
| `packages/staff/staff-ui/package.json` | Dep: lit, staff-types. Vite build |
| `packages/staff/staff-ui/tsconfig.json` | DOM target, decorators |
| `packages/staff/staff-ui/vite.config.ts` | Library build, external lit + @astralibx |
| `packages/staff/staff-ui/src/index.ts` | Register all components |
| `packages/staff/staff-ui/src/config.ts` | AlxStaffConfig static class |
| `packages/staff/staff-ui/src/api/staff-api-client.ts` | Typed API client for all routes |
| `packages/staff/staff-ui/src/styles/shared.ts` | Shared Lit CSS styles |
| `packages/staff/staff-ui/src/utils/safe-register.ts` | Safe custom element registration |
| `packages/staff/staff-ui/src/components/alx-staff-list.ts` | Staff table component |
| `packages/staff/staff-ui/src/components/alx-staff-create-form.ts` | Create staff form |
| `packages/staff/staff-ui/src/components/alx-staff-permission-editor.ts` | Permission picker with groups |
| `packages/staff/staff-ui/src/components/alx-staff-password-reset.ts` | Password reset modal |
| `packages/staff/staff-ui/src/components/alx-staff-status-toggle.ts` | Inline status toggle |
| `packages/staff/staff-ui/src/components/alx-permission-group-editor.ts` | Permission group CRUD |
| `packages/staff/staff-ui/src/components/alx-staff-setup.ts` | First-run setup form |

### Root files

| File | Responsibility |
|------|---------------|
| `packages/staff/README.md` | Module overview with packages table |
| `package.json` (root, modify) | Add `"packages/staff/*"` to workspaces |

---

## Task 1: Scaffold staff-types package

**Files:**
- Create: `packages/staff/staff-types/package.json`
- Create: `packages/staff/staff-types/tsconfig.json`
- Create: `packages/staff/staff-types/tsup.config.ts`
- Create: `packages/staff/staff-types/src/enums.ts`
- Create: `packages/staff/staff-types/src/staff.types.ts`
- Create: `packages/staff/staff-types/src/permission.types.ts`
- Create: `packages/staff/staff-types/src/adapter.types.ts`
- Create: `packages/staff/staff-types/src/config.types.ts`
- Create: `packages/staff/staff-types/src/index.ts`
- Modify: `package.json` (root)

- [ ] **Step 1: Add workspace entry**

In root `package.json`, add `"packages/staff/*"` to the workspaces array.

- [ ] **Step 2: Create package.json**

```json
{
  "name": "@astralibx/staff-types",
  "version": "0.1.0",
  "description": "Shared TypeScript type definitions, enums, and contracts for the staff module",
  "repository": {
    "type": "git",
    "url": "https://github.com/Hariprakash1997/astralib.git",
    "directory": "packages/staff/staff-types"
  },
  "main": "dist/index.cjs",
  "module": "dist/index.mjs",
  "types": "dist/index.d.ts",
  "exports": {
    ".": {
      "import": { "types": "./dist/index.d.mts", "default": "./dist/index.mjs" },
      "require": { "types": "./dist/index.d.ts", "default": "./dist/index.cjs" }
    }
  },
  "files": ["dist"],
  "scripts": {
    "build": "tsup",
    "dev": "tsup --watch",
    "test": "vitest run",
    "test:watch": "vitest",
    "test:coverage": "vitest run --coverage",
    "lint": "eslint src/",
    "clean": "rm -rf dist"
  },
  "keywords": ["staff", "types", "permissions", "authentication"],
  "license": "MIT",
  "devDependencies": {
    "@vitest/coverage-v8": "^3.0.0",
    "tsup": "^8.0.0",
    "typescript": "^5.8.2",
    "vitest": "^3.0.0"
  }
}
```

- [ ] **Step 3: Create tsconfig.json**

```json
{
  "extends": "../../../tsconfig.base.json",
  "compilerOptions": {
    "outDir": "./dist",
    "rootDir": "./src",
    "composite": false,
    "incremental": false
  },
  "include": ["src/**/*"],
  "exclude": ["node_modules", "dist", "**/*.spec.ts", "**/*.test.ts"]
}
```

- [ ] **Step 4: Create tsup.config.ts**

```ts
import { defineConfig } from 'tsup';

export default defineConfig({
  entry: ['src/index.ts'],
  format: ['cjs', 'esm'],
  dts: true,
  clean: true,
  sourcemap: true,
  splitting: false,
  treeshake: true,
  skipNodeModulesBundle: true,
  outExtension({ format }) {
    return { js: format === 'cjs' ? '.cjs' : '.mjs' };
  },
});
```

- [ ] **Step 5: Create enums.ts**

```ts
export const STAFF_ROLE = {
  Owner: 'owner',
  Staff: 'staff',
} as const;

export type StaffRole = (typeof STAFF_ROLE)[keyof typeof STAFF_ROLE];

export const STAFF_ROLE_VALUES = Object.values(STAFF_ROLE);

export const STAFF_STATUS = {
  Active: 'active',
  Inactive: 'inactive',
  Pending: 'pending',
} as const;

export type StaffStatus = (typeof STAFF_STATUS)[keyof typeof STAFF_STATUS];

export const STAFF_STATUS_VALUES = Object.values(STAFF_STATUS);

export const PERMISSION_TYPE = {
  View: 'view',
  Edit: 'edit',
  Action: 'action',
} as const;

export type PermissionType = (typeof PERMISSION_TYPE)[keyof typeof PERMISSION_TYPE];

export const PERMISSION_TYPE_VALUES = Object.values(PERMISSION_TYPE);
```

- [ ] **Step 6: Create staff.types.ts**

```ts
import type { StaffRole, StaffStatus } from './enums.js';

export interface IStaff {
  _id: unknown;
  name: string;
  email: string;
  password: string;
  role: StaffRole;
  status: StaffStatus;
  permissions: string[];
  externalUserId?: string;
  lastLoginAt?: Date;
  lastLoginIp?: string;
  metadata?: Record<string, unknown>;
  tenantId?: string;
  createdAt: Date;
  updatedAt: Date;
}

export interface IStaffSummary {
  _id: unknown;
  name: string;
  email: string;
  role: StaffRole;
  status: StaffStatus;
  permissions: string[];
  lastLoginAt?: Date;
  createdAt: Date;
}

export interface IStaffCreateInput {
  name: string;
  email: string;
  password: string;
  role?: StaffRole;
  status?: StaffStatus;
  permissions?: string[];
  externalUserId?: string;
  metadata?: Record<string, unknown>;
}

export interface IStaffUpdateInput {
  name?: string;
  email?: string;
  metadata?: Record<string, unknown>;
}

export interface IStaffListFilters {
  status?: StaffStatus;
  role?: StaffRole;
  page?: number;
  limit?: number;
}

export interface IPaginatedResult<T> {
  data: T[];
  pagination: {
    page: number;
    limit: number;
    total: number;
    totalPages: number;
  };
}
```

- [ ] **Step 7: Create permission.types.ts**

```ts
import type { PermissionType } from './enums.js';

export interface IPermissionEntry {
  key: string;
  label: string;
  type: PermissionType;
}

export interface IPermissionGroup {
  _id: unknown;
  groupId: string;
  label: string;
  permissions: IPermissionEntry[];
  sortOrder: number;
  tenantId?: string;
  createdAt: Date;
  updatedAt: Date;
}

export interface IPermissionGroupCreateInput {
  groupId: string;
  label: string;
  permissions: IPermissionEntry[];
  sortOrder?: number;
}

export interface IPermissionGroupUpdateInput {
  label?: string;
  permissions?: IPermissionEntry[];
  sortOrder?: number;
}
```

- [ ] **Step 8: Create adapter.types.ts**

```ts
export interface StaffAdapters {
  hashPassword: (password: string) => Promise<string>;
  comparePassword: (plain: string, hash: string) => Promise<boolean>;
}
```

- [ ] **Step 9: Create config.types.ts**

```ts
import type { StaffAdapters } from './adapter.types.js';

export interface LogAdapter {
  info: (message: string, meta?: Record<string, unknown>) => void;
  warn: (message: string, meta?: Record<string, unknown>) => void;
  error: (message: string, meta?: Record<string, unknown>) => void;
}

export interface StaffMetric {
  name: string;
  value: number;
  labels?: Record<string, string>;
  timestamp?: Date;
}

export interface StaffHooks {
  onStaffCreated?: (staff: unknown) => void | Promise<void>;
  onLogin?: (staff: unknown, ip?: string) => void | Promise<void>;
  onLoginFailed?: (email: string, ip?: string) => void | Promise<void>;
  onPermissionsChanged?: (staffId: string, oldPerms: string[], newPerms: string[]) => void | Promise<void>;
  onStatusChanged?: (staffId: string, oldStatus: string, newStatus: string) => void | Promise<void>;
  onMetric?: (metric: StaffMetric) => void | Promise<void>;
}

export interface RateLimiterOptions {
  windowMs?: number;
  maxAttempts?: number;
}

export interface StaffEngineOptions {
  requireEmailUniqueness?: boolean;
  allowSelfPasswordChange?: boolean;
  rateLimiter?: RateLimiterOptions;
}

export interface StaffEngineConfig {
  db: {
    connection: unknown;
    collectionPrefix?: string;
  };
  redis?: {
    connection: unknown;
    keyPrefix?: string;
  };
  logger?: LogAdapter;
  tenantId?: string;
  auth: {
    jwtSecret: string;
    staffTokenExpiry?: string;
    ownerTokenExpiry?: string;
    permissionCacheTtlMs?: number;
  };
  adapters: StaffAdapters;
  hooks?: StaffHooks;
  options?: StaffEngineOptions;
}

export interface ResolvedOptions {
  requireEmailUniqueness: boolean;
  allowSelfPasswordChange: boolean;
  rateLimiter: {
    windowMs: number;
    maxAttempts: number;
  };
}

export const DEFAULT_OPTIONS: ResolvedOptions = {
  requireEmailUniqueness: true,
  allowSelfPasswordChange: false,
  rateLimiter: {
    windowMs: 15 * 60 * 1000,
    maxAttempts: 5,
  },
};

// DEFAULT_AUTH lives in staff-engine/src/constants/index.ts (internal, not exported from types)
```

- [ ] **Step 10: Create index.ts barrel**

```ts
export * from './enums.js';
export * from './staff.types.js';
export * from './permission.types.js';
export * from './adapter.types.js';
export * from './config.types.js';
```

- [ ] **Step 11: Build and verify**

Run: `cd packages/staff/staff-types && npx tsup`
Expected: Clean build with `dist/index.cjs`, `dist/index.mjs`, `dist/index.d.ts`

- [ ] **Step 12: Commit**

```
feat(staff-types): scaffold staff-types package with enums, interfaces, and config types
```

---

## Task 2: Scaffold staff-engine package with constants and errors

**Files:**
- Create: `packages/staff/staff-engine/package.json`
- Create: `packages/staff/staff-engine/tsconfig.json`
- Create: `packages/staff/staff-engine/tsup.config.ts`
- Create: `packages/staff/staff-engine/vitest.config.ts`
- Create: `packages/staff/staff-engine/src/constants/index.ts`
- Create: `packages/staff/staff-engine/src/errors/index.ts`

- [ ] **Step 1: Create package.json**

```json
{
  "name": "@astralibx/staff-engine",
  "version": "0.1.0",
  "description": "Staff management engine with JWT authentication, runtime-configurable permissions, and CRUD operations",
  "repository": {
    "type": "git",
    "url": "https://github.com/Hariprakash1997/astralib.git",
    "directory": "packages/staff/staff-engine"
  },
  "main": "dist/index.cjs",
  "module": "dist/index.mjs",
  "types": "dist/index.d.ts",
  "exports": {
    ".": {
      "import": { "types": "./dist/index.d.mts", "default": "./dist/index.mjs" },
      "require": { "types": "./dist/index.d.ts", "default": "./dist/index.cjs" }
    }
  },
  "files": ["dist"],
  "scripts": {
    "build": "tsup",
    "dev": "tsup --watch",
    "test": "vitest run",
    "test:watch": "vitest",
    "test:coverage": "vitest run --coverage",
    "lint": "eslint src/",
    "clean": "rm -rf dist"
  },
  "keywords": ["staff", "authentication", "permissions", "jwt"],
  "license": "MIT",
  "dependencies": {
    "@astralibx/staff-types": "^0.1.0",
    "@astralibx/core": "^1.2.1",
    "jsonwebtoken": "^9.0.0",
    "zod": "^3.23.0"
  },
  "peerDependencies": {
    "express": "^4.18.0 || ^5.0.0",
    "mongoose": "^7.0.0 || ^8.0.0"
  },
  "devDependencies": {
    "@types/express": "^5.0.0",
    "@types/jsonwebtoken": "^9.0.0",
    "@types/node": "^22.0.0",
    "@vitest/coverage-v8": "^3.0.0",
    "express": "^5.0.0",
    "mongoose": "^8.12.1",
    "tsup": "^8.0.0",
    "typescript": "^5.8.2",
    "vitest": "^3.0.0"
  }
}
```

- [ ] **Step 2: Create tsconfig.json, tsup.config.ts, vitest.config.ts**

tsconfig.json — same as staff-types.

tsup.config.ts — same as staff-types.

vitest.config.ts:
```ts
import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    globals: true,
    environment: 'node',
    root: './src',
    include: ['**/__tests__/**/*.spec.ts'],
    coverage: {
      provider: 'v8',
      thresholds: {
        statements: 80,
        branches: 75,
        functions: 80,
        lines: 80,
      },
      include: ['**/*.ts'],
      exclude: ['**/types/**', '**/__tests__/**', '**/index.ts'],
    },
  },
});
```

- [ ] **Step 3: Create constants/index.ts**

```ts
export const ERROR_CODE = {
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

  // Config
  InvalidConfig: 'STAFF_INVALID_CONFIG',
} as const;

export type ErrorCode = (typeof ERROR_CODE)[keyof typeof ERROR_CODE];

export const ERROR_MESSAGE = {
  InvalidCredentials: 'Invalid email or password',
  AccountInactive: 'Account is deactivated',
  AccountPending: 'Account is pending activation',
  RateLimited: 'Too many login attempts. Please try again later.',
  TokenExpired: 'Token has expired',
  TokenInvalid: 'Invalid token',
  InsufficientPermissions: 'Insufficient permissions',
  OwnerOnly: 'This action requires owner privileges',
  StaffNotFound: 'Staff member not found',
  EmailExists: 'A staff member with this email already exists',
  SetupAlreadyComplete: 'Initial setup has already been completed',
  LastOwnerGuard: 'Cannot deactivate the last active owner',
  InvalidPermissions: 'Edit permissions require corresponding view permissions',
  GroupNotFound: 'Permission group not found',
  GroupIdExists: 'A permission group with this ID already exists',
  InvalidConfig: 'Invalid engine configuration',
} as const;

export const DEFAULTS = {
  ListPageSize: 20,
  MaxListPageSize: 100,
  PermissionCacheTtlMs: 5 * 60 * 1000,
} as const;

export const DEFAULT_AUTH = {
  staffTokenExpiry: '24h',
  ownerTokenExpiry: '30d',
  permissionCacheTtlMs: 5 * 60 * 1000,
} as const;
```

- [ ] **Step 4: Create errors/index.ts**

```ts
import { AlxError } from '@astralibx/core';
import { ERROR_CODE, ERROR_MESSAGE } from '../constants/index.js';

export class AlxStaffError extends AlxError {
  constructor(
    message: string,
    code: string,
    public readonly context?: Record<string, unknown>,
  ) {
    super(message, code);
    this.name = 'AlxStaffError';
  }
}

export class AuthenticationError extends AlxStaffError {
  constructor(code: string = ERROR_CODE.InvalidCredentials, message?: string) {
    super(message || ERROR_MESSAGE.InvalidCredentials, code);
    this.name = 'AuthenticationError';
  }
}

export class AuthorizationError extends AlxStaffError {
  constructor(code: string = ERROR_CODE.InsufficientPermissions, message?: string) {
    super(message || ERROR_MESSAGE.InsufficientPermissions, code);
    this.name = 'AuthorizationError';
  }
}

export class RateLimitError extends AlxStaffError {
  constructor(public readonly retryAfterMs: number) {
    super(ERROR_MESSAGE.RateLimited, ERROR_CODE.RateLimited, { retryAfterMs });
    this.name = 'RateLimitError';
  }
}

export class TokenError extends AlxStaffError {
  constructor(code: string = ERROR_CODE.TokenInvalid, message?: string) {
    super(message || ERROR_MESSAGE.TokenInvalid, code);
    this.name = 'TokenError';
  }
}

export class StaffNotFoundError extends AlxStaffError {
  constructor(public readonly staffId: string) {
    super(ERROR_MESSAGE.StaffNotFound, ERROR_CODE.StaffNotFound, { staffId });
    this.name = 'StaffNotFoundError';
  }
}

export class DuplicateError extends AlxStaffError {
  constructor(code: string, message: string, context?: Record<string, unknown>) {
    super(message, code, context);
    this.name = 'DuplicateError';
  }
}

export class SetupError extends AlxStaffError {
  constructor() {
    super(ERROR_MESSAGE.SetupAlreadyComplete, ERROR_CODE.SetupAlreadyComplete);
    this.name = 'SetupError';
  }
}

export class LastOwnerError extends AlxStaffError {
  constructor(public readonly staffId: string) {
    super(ERROR_MESSAGE.LastOwnerGuard, ERROR_CODE.LastOwnerGuard, { staffId });
    this.name = 'LastOwnerError';
  }
}

export class InvalidPermissionError extends AlxStaffError {
  constructor(public readonly missingViewKeys: string[]) {
    super(ERROR_MESSAGE.InvalidPermissions, ERROR_CODE.InvalidPermissions, { missingViewKeys });
    this.name = 'InvalidPermissionError';
  }
}

export class GroupNotFoundError extends AlxStaffError {
  constructor(public readonly groupId: string) {
    super(ERROR_MESSAGE.GroupNotFound, ERROR_CODE.GroupNotFound, { groupId });
    this.name = 'GroupNotFoundError';
  }
}

export class InvalidConfigError extends AlxStaffError {
  constructor(public readonly field: string, public readonly reason: string) {
    super(`Invalid config for "${field}": ${reason}`, ERROR_CODE.InvalidConfig, { field, reason });
    this.name = 'InvalidConfigError';
  }
}
```

- [ ] **Step 5: Write error tests**

Create `packages/staff/staff-engine/src/__tests__/errors.spec.ts`:

```ts
import { describe, it, expect } from 'vitest';
import {
  AlxStaffError, AuthenticationError, AuthorizationError,
  RateLimitError, TokenError, StaffNotFoundError, DuplicateError,
  SetupError, LastOwnerError, InvalidPermissionError, InvalidConfigError,
} from '../errors/index.js';
import { ERROR_CODE } from '../constants/index.js';

describe('Error classes', () => {
  it('AlxStaffError has code and context', () => {
    const err = new AlxStaffError('test', 'CODE', { key: 'val' });
    expect(err.message).toBe('test');
    expect(err.code).toBe('CODE');
    expect(err.context).toEqual({ key: 'val' });
    expect(err.name).toBe('AlxStaffError');
  });

  it('AuthenticationError defaults to InvalidCredentials', () => {
    const err = new AuthenticationError();
    expect(err.code).toBe(ERROR_CODE.InvalidCredentials);
  });

  it('RateLimitError includes retryAfterMs', () => {
    const err = new RateLimitError(30000);
    expect(err.retryAfterMs).toBe(30000);
    expect(err.code).toBe(ERROR_CODE.RateLimited);
  });

  it('StaffNotFoundError includes staffId', () => {
    const err = new StaffNotFoundError('abc123');
    expect(err.staffId).toBe('abc123');
    expect(err.code).toBe(ERROR_CODE.StaffNotFound);
  });

  it('LastOwnerError includes staffId', () => {
    const err = new LastOwnerError('owner1');
    expect(err.staffId).toBe('owner1');
    expect(err.code).toBe(ERROR_CODE.LastOwnerGuard);
  });

  it('InvalidPermissionError includes missing keys', () => {
    const err = new InvalidPermissionError(['chat:view']);
    expect(err.missingViewKeys).toEqual(['chat:view']);
    expect(err.code).toBe(ERROR_CODE.InvalidPermissions);
  });

  it('InvalidConfigError includes field and reason', () => {
    const err = new InvalidConfigError('jwtSecret', 'must be a string');
    expect(err.field).toBe('jwtSecret');
    expect(err.reason).toBe('must be a string');
  });

  it('SetupError has correct code', () => {
    const err = new SetupError();
    expect(err.code).toBe(ERROR_CODE.SetupAlreadyComplete);
  });
});
```

- [ ] **Step 6: Run tests**

Run: `cd packages/staff/staff-engine && npx vitest run`
Expected: All error tests pass.

- [ ] **Step 7: Commit**

```
feat(staff-engine): scaffold staff-engine package with constants and error hierarchy
```

---

## Task 3: Mongoose schemas

**Files:**
- Create: `packages/staff/staff-engine/src/schemas/staff.schema.ts`
- Create: `packages/staff/staff-engine/src/schemas/permission-group.schema.ts`
- Create: `packages/staff/staff-engine/src/schemas/index.ts`

- [ ] **Step 1: Create staff.schema.ts**

```ts
import { Schema, type Connection, type Model, type Document, type Types } from 'mongoose';
import { STAFF_ROLE_VALUES, STAFF_STATUS_VALUES, STAFF_STATUS } from '@astralibx/staff-types';
import type { IStaff } from '@astralibx/staff-types';

export interface IStaffDocument extends Omit<IStaff, '_id'>, Document {
  _id: Types.ObjectId;
}

export function createStaffModel(connection: Connection, prefix?: string): Model<IStaffDocument> {
  const schema = new Schema<IStaffDocument>(
    {
      name: { type: String, required: true, trim: true },
      email: { type: String, required: true, trim: true, lowercase: true },
      password: { type: String, required: true, select: false },
      role: { type: String, enum: STAFF_ROLE_VALUES, default: 'staff' },
      status: { type: String, enum: STAFF_STATUS_VALUES, default: STAFF_STATUS.Pending },
      permissions: { type: [String], default: [] },
      externalUserId: { type: String, sparse: true },
      lastLoginAt: { type: Date },
      lastLoginIp: { type: String },
      metadata: { type: Schema.Types.Mixed },
      tenantId: { type: String, sparse: true },
    },
    { timestamps: true },
  );

  schema.index({ email: 1, tenantId: 1 }, { unique: true });
  schema.index({ status: 1 });
  schema.index({ role: 1 });

  const collectionName = prefix ? `${prefix}_staff` : 'staff';
  return connection.model<IStaffDocument>('Staff', schema, collectionName);
}
```

- [ ] **Step 2: Create permission-group.schema.ts**

```ts
import { Schema, type Connection, type Model, type Document, type Types } from 'mongoose';
import { PERMISSION_TYPE_VALUES } from '@astralibx/staff-types';
import type { IPermissionGroup } from '@astralibx/staff-types';

export interface IPermissionGroupDocument extends Omit<IPermissionGroup, '_id'>, Document {
  _id: Types.ObjectId;
}

const permissionEntrySchema = new Schema(
  {
    key: { type: String, required: true },
    label: { type: String, required: true },
    type: { type: String, enum: PERMISSION_TYPE_VALUES, required: true },
  },
  { _id: false },
);

export function createPermissionGroupModel(
  connection: Connection,
  prefix?: string,
): Model<IPermissionGroupDocument> {
  const schema = new Schema<IPermissionGroupDocument>(
    {
      groupId: { type: String, required: true },
      label: { type: String, required: true, trim: true },
      permissions: { type: [permissionEntrySchema], default: [] },
      sortOrder: { type: Number, default: 0 },
      tenantId: { type: String, index: true, sparse: true },
    },
    { timestamps: true },
  );

  schema.index({ groupId: 1, tenantId: 1 }, { unique: true });
  schema.index({ sortOrder: 1 });

  const collectionName = prefix ? `${prefix}_permission_groups` : 'permission_groups';
  return connection.model<IPermissionGroupDocument>('PermissionGroup', schema, collectionName);
}
```

- [ ] **Step 3: Create schemas/index.ts barrel**

```ts
export { createStaffModel, type IStaffDocument } from './staff.schema.js';
export { createPermissionGroupModel, type IPermissionGroupDocument } from './permission-group.schema.js';
```

- [ ] **Step 4: Commit**

```
feat(staff-engine): add Staff and PermissionGroup mongoose schemas
```

---

## Task 4: RateLimiterService and PermissionCacheService

**Files:**
- Create: `packages/staff/staff-engine/src/services/rate-limiter.service.ts`
- Create: `packages/staff/staff-engine/src/services/permission-cache.service.ts`
- Create: `packages/staff/staff-engine/src/__tests__/services/rate-limiter.service.spec.ts`
- Create: `packages/staff/staff-engine/src/__tests__/services/permission-cache.service.spec.ts`

- [ ] **Step 1: Create rate-limiter.service.ts**

```ts
import type { LogAdapter } from '@astralibx/staff-types';

interface RateLimitEntry {
  count: number;
  expiresAt: number;
}

export class RateLimiterService {
  private memoryStore = new Map<string, RateLimitEntry>();

  constructor(
    private windowMs: number,
    private maxAttempts: number,
    private redis: unknown | null,
    private keyPrefix: string,
    private logger: LogAdapter,
  ) {}

  async checkLimit(key: string): Promise<{ allowed: boolean; remaining: number; retryAfterMs?: number }> {
    if (this.redis) {
      return this.checkLimitRedis(key);
    }
    return this.checkLimitMemory(key);
  }

  async recordAttempt(key: string): Promise<void> {
    if (this.redis) {
      return this.recordAttemptRedis(key);
    }
    this.recordAttemptMemory(key);
  }

  async reset(key: string): Promise<void> {
    if (this.redis) {
      await (this.redis as any).del(`${this.keyPrefix}rate:${key}`);
      return;
    }
    this.memoryStore.delete(key);
  }

  private checkLimitMemory(key: string): { allowed: boolean; remaining: number; retryAfterMs?: number } {
    const entry = this.memoryStore.get(key);
    if (!entry || Date.now() > entry.expiresAt) {
      return { allowed: true, remaining: this.maxAttempts };
    }
    if (entry.count >= this.maxAttempts) {
      return { allowed: false, remaining: 0, retryAfterMs: entry.expiresAt - Date.now() };
    }
    return { allowed: true, remaining: this.maxAttempts - entry.count };
  }

  private recordAttemptMemory(key: string): void {
    const entry = this.memoryStore.get(key);
    if (!entry || Date.now() > entry.expiresAt) {
      this.memoryStore.set(key, { count: 1, expiresAt: Date.now() + this.windowMs });
    } else {
      entry.count++;
    }
  }

  private async checkLimitRedis(key: string): Promise<{ allowed: boolean; remaining: number; retryAfterMs?: number }> {
    const redisKey = `${this.keyPrefix}rate:${key}`;
    const redis = this.redis as any;
    const count = await redis.get(redisKey);
    const current = count ? parseInt(count, 10) : 0;
    if (current >= this.maxAttempts) {
      const ttl = await redis.pttl(redisKey);
      return { allowed: false, remaining: 0, retryAfterMs: ttl > 0 ? ttl : this.windowMs };
    }
    return { allowed: true, remaining: this.maxAttempts - current };
  }

  private async recordAttemptRedis(key: string): Promise<void> {
    const redisKey = `${this.keyPrefix}rate:${key}`;
    const redis = this.redis as any;
    const count = await redis.incr(redisKey);
    if (count === 1) {
      await redis.pexpire(redisKey, this.windowMs);
    }
  }
}
```

- [ ] **Step 2: Create permission-cache.service.ts**

```ts
import type { Model } from 'mongoose';
import type { LogAdapter } from '@astralibx/staff-types';
import type { IStaffDocument } from '../schemas/staff.schema.js';

export class PermissionCacheService {
  private memoryCache = new Map<string, { permissions: string[]; expiresAt: number }>();

  constructor(
    private StaffModel: Model<IStaffDocument>,
    private ttlMs: number,
    private redis: unknown | null,
    private keyPrefix: string,
    private logger: LogAdapter,
    private tenantId?: string,
  ) {}

  async get(staffId: string): Promise<string[]> {
    if (this.redis) {
      return this.getRedis(staffId);
    }
    return this.getMemory(staffId);
  }

  async invalidate(staffId: string): Promise<void> {
    if (this.redis) {
      await (this.redis as any).del(`${this.keyPrefix}perms:${staffId}`);
      return;
    }
    this.memoryCache.delete(staffId);
  }

  async invalidateAll(): Promise<void> {
    if (this.redis) {
      const redis = this.redis as any;
      const keys = await redis.keys(`${this.keyPrefix}perms:*`);
      if (keys.length > 0) {
        await redis.del(...keys);
      }
      return;
    }
    this.memoryCache.clear();
  }

  private async getMemory(staffId: string): Promise<string[]> {
    const cached = this.memoryCache.get(staffId);
    if (cached && Date.now() < cached.expiresAt) {
      return cached.permissions;
    }
    const permissions = await this.fetchFromDb(staffId);
    this.memoryCache.set(staffId, { permissions, expiresAt: Date.now() + this.ttlMs });
    return permissions;
  }

  private async getRedis(staffId: string): Promise<string[]> {
    const redisKey = `${this.keyPrefix}perms:${staffId}`;
    const redis = this.redis as any;
    const cached = await redis.get(redisKey);
    if (cached) {
      return JSON.parse(cached);
    }
    const permissions = await this.fetchFromDb(staffId);
    await redis.set(redisKey, JSON.stringify(permissions), 'PX', this.ttlMs);
    return permissions;
  }

  private async fetchFromDb(staffId: string): Promise<string[]> {
    const filter: Record<string, unknown> = { _id: staffId };
    if (this.tenantId) filter.tenantId = this.tenantId;
    const staff = await this.StaffModel.findOne(filter).select('permissions').lean();
    return staff?.permissions ?? [];
  }
}
```

- [ ] **Step 3: Write rate-limiter tests**

Create `packages/staff/staff-engine/src/__tests__/services/rate-limiter.service.spec.ts`:

```ts
import { describe, it, expect, beforeEach, vi } from 'vitest';
import { RateLimiterService } from '../../services/rate-limiter.service.js';

const noopLogger = { info: vi.fn(), warn: vi.fn(), error: vi.fn() };

describe('RateLimiterService (in-memory)', () => {
  let limiter: RateLimiterService;

  beforeEach(() => {
    limiter = new RateLimiterService(60000, 3, null, '', noopLogger);
  });

  it('allows requests under the limit', async () => {
    const result = await limiter.checkLimit('ip1');
    expect(result.allowed).toBe(true);
    expect(result.remaining).toBe(3);
  });

  it('blocks after max attempts', async () => {
    await limiter.recordAttempt('ip1');
    await limiter.recordAttempt('ip1');
    await limiter.recordAttempt('ip1');
    const result = await limiter.checkLimit('ip1');
    expect(result.allowed).toBe(false);
    expect(result.remaining).toBe(0);
    expect(result.retryAfterMs).toBeGreaterThan(0);
  });

  it('decrements remaining on each attempt', async () => {
    await limiter.recordAttempt('ip1');
    const result = await limiter.checkLimit('ip1');
    expect(result.remaining).toBe(2);
  });

  it('resets counter for a key', async () => {
    await limiter.recordAttempt('ip1');
    await limiter.recordAttempt('ip1');
    await limiter.reset('ip1');
    const result = await limiter.checkLimit('ip1');
    expect(result.allowed).toBe(true);
    expect(result.remaining).toBe(3);
  });

  it('isolates keys from each other', async () => {
    await limiter.recordAttempt('ip1');
    await limiter.recordAttempt('ip1');
    await limiter.recordAttempt('ip1');
    const result = await limiter.checkLimit('ip2');
    expect(result.allowed).toBe(true);
  });
});
```

- [ ] **Step 4: Write permission-cache tests**

Create `packages/staff/staff-engine/src/__tests__/services/permission-cache.service.spec.ts`:

```ts
import { describe, it, expect, beforeEach, vi } from 'vitest';
import { PermissionCacheService } from '../../services/permission-cache.service.js';

const noopLogger = { info: vi.fn(), warn: vi.fn(), error: vi.fn() };

function mockStaffModel(permissions: string[] = []) {
  return {
    findOne: vi.fn().mockReturnValue({
      select: vi.fn().mockReturnValue({
        lean: vi.fn().mockResolvedValue({ permissions }),
      }),
    }),
  } as any;
}

describe('PermissionCacheService (in-memory)', () => {
  let cache: PermissionCacheService;
  let model: any;

  beforeEach(() => {
    model = mockStaffModel(['chat:view', 'chat:edit']);
    cache = new PermissionCacheService(model, 60000, null, '', noopLogger);
  });

  it('fetches from DB on cache miss', async () => {
    const perms = await cache.get('staff1');
    expect(perms).toEqual(['chat:view', 'chat:edit']);
    expect(model.findOne).toHaveBeenCalledOnce();
  });

  it('returns cached value on second call', async () => {
    await cache.get('staff1');
    await cache.get('staff1');
    expect(model.findOne).toHaveBeenCalledOnce();
  });

  it('invalidate forces re-fetch', async () => {
    await cache.get('staff1');
    await cache.invalidate('staff1');
    await cache.get('staff1');
    expect(model.findOne).toHaveBeenCalledTimes(2);
  });

  it('invalidateAll clears all entries', async () => {
    await cache.get('staff1');
    await cache.get('staff2');
    await cache.invalidateAll();
    await cache.get('staff1');
    expect(model.findOne).toHaveBeenCalledTimes(3);
  });

  it('returns empty array if staff not found', async () => {
    const emptyModel = {
      findOne: vi.fn().mockReturnValue({
        select: vi.fn().mockReturnValue({
          lean: vi.fn().mockResolvedValue(null),
        }),
      }),
    } as any;
    const emptyCache = new PermissionCacheService(emptyModel, 60000, null, '', noopLogger);
    const perms = await emptyCache.get('unknown');
    expect(perms).toEqual([]);
  });
});
```

- [ ] **Step 5: Run tests**

Run: `cd packages/staff/staff-engine && npx vitest run`
Expected: All tests pass.

- [ ] **Step 6: Commit**

```
feat(staff-engine): add RateLimiterService and PermissionCacheService with tests
```

---

## Task 5: PermissionService

**Files:**
- Create: `packages/staff/staff-engine/src/services/permission.service.ts`
- Create: `packages/staff/staff-engine/src/__tests__/services/permission.service.spec.ts`

- [ ] **Step 1: Create permission.service.ts**

```ts
import type { Model } from 'mongoose';
import type { LogAdapter, IPermissionGroupCreateInput, IPermissionGroupUpdateInput } from '@astralibx/staff-types';
import type { IPermissionGroupDocument } from '../schemas/permission-group.schema.js';
import { DuplicateError, GroupNotFoundError } from '../errors/index.js';
import { ERROR_CODE, ERROR_MESSAGE } from '../constants/index.js';
import type { PermissionCacheService } from './permission-cache.service.js';

export class PermissionService {
  constructor(
    private PermissionGroup: Model<IPermissionGroupDocument>,
    private permissionCache: PermissionCacheService,
    private logger: LogAdapter,
    private tenantId?: string,
  ) {}

  private get tenantFilter(): Record<string, unknown> {
    return this.tenantId ? { tenantId: this.tenantId } : {};
  }

  async listGroups(): Promise<IPermissionGroupDocument[]> {
    return this.PermissionGroup.find(this.tenantFilter).sort({ sortOrder: 1 }).lean();
  }

  async createGroup(data: IPermissionGroupCreateInput): Promise<IPermissionGroupDocument> {
    const existing = await this.PermissionGroup.findOne({
      groupId: data.groupId,
      ...this.tenantFilter,
    });
    if (existing) {
      throw new DuplicateError(
        ERROR_CODE.GroupIdExists,
        ERROR_MESSAGE.GroupIdExists,
        { groupId: data.groupId },
      );
    }
    const group = await this.PermissionGroup.create({
      ...data,
      sortOrder: data.sortOrder ?? 0,
      ...this.tenantFilter,
    });
    this.logger.info('Permission group created', { groupId: data.groupId });
    return group.toObject();
  }

  async updateGroup(groupId: string, data: IPermissionGroupUpdateInput): Promise<IPermissionGroupDocument> {
    const group = await this.PermissionGroup.findOneAndUpdate(
      { groupId, ...this.tenantFilter },
      { $set: data },
      { new: true },
    ).lean();
    if (!group) {
      throw new GroupNotFoundError(groupId);
    }
    await this.permissionCache.invalidateAll();
    this.logger.info('Permission group updated', { groupId, fields: Object.keys(data) });
    return group;
  }

  async deleteGroup(groupId: string): Promise<void> {
    const result = await this.PermissionGroup.deleteOne({ groupId, ...this.tenantFilter });
    if (result.deletedCount === 0) {
      throw new GroupNotFoundError(groupId);
    }
    await this.permissionCache.invalidateAll();
    this.logger.info('Permission group deleted', { groupId });
  }

  async getAllPermissionKeys(): Promise<string[]> {
    const groups = await this.listGroups();
    return groups.flatMap(g => g.permissions.map(p => p.key));
  }
}
```

- [ ] **Step 2: Write permission service tests**

Create `packages/staff/staff-engine/src/__tests__/services/permission.service.spec.ts` with tests for:
- `listGroups` returns sorted groups
- `createGroup` creates and returns group
- `createGroup` throws DuplicateError on existing groupId
- `updateGroup` updates and invalidates cache
- `updateGroup` throws on not found
- `deleteGroup` deletes and invalidates cache
- `deleteGroup` throws on not found
- `getAllPermissionKeys` returns flat array

Use mock model pattern: `findOne`, `find`, `create`, `findOneAndUpdate`, `deleteOne` as vi.fn() returning appropriate values.

- [ ] **Step 3: Run tests and commit**

```
feat(staff-engine): add PermissionService with group CRUD and cache invalidation
```

---

## Task 6: StaffService

**Files:**
- Create: `packages/staff/staff-engine/src/services/staff.service.ts`
- Create: `packages/staff/staff-engine/src/validation/index.ts`
- Create: `packages/staff/staff-engine/src/__tests__/services/staff.service.spec.ts`

- [ ] **Step 1: Create validation/index.ts**

```ts
import { PERMISSION_TYPE } from '@astralibx/staff-types';
import { InvalidPermissionError } from '../errors/index.js';
import type { IPermissionGroupDocument } from '../schemas/permission-group.schema.js';
import type { Model } from 'mongoose';

/**
 * Validates that for every edit-type permission, the corresponding view-type permission
 * is also present. Single-level cascade only.
 * Example: 'chat:edit' requires 'chat:view'
 */
export function validatePermissionPairs(
  permissions: string[],
  allGroups: IPermissionGroupDocument[],
): void {
  const allEntries = allGroups.flatMap(g => g.permissions);
  const editKeys = allEntries
    .filter(e => e.type === PERMISSION_TYPE.Edit)
    .map(e => e.key);

  const permissionSet = new Set(permissions);
  const missingViewKeys: string[] = [];

  for (const editKey of editKeys) {
    if (!permissionSet.has(editKey)) continue;
    const prefix = editKey.substring(0, editKey.lastIndexOf(':'));
    const viewKey = `${prefix}:view`;
    const viewEntry = allEntries.find(e => e.key === viewKey && e.type === PERMISSION_TYPE.View);
    if (viewEntry && !permissionSet.has(viewKey)) {
      missingViewKeys.push(viewKey);
    }
  }

  if (missingViewKeys.length > 0) {
    throw new InvalidPermissionError(missingViewKeys);
  }
}
```

- [ ] **Step 2: Create staff.service.ts**

```ts
import jwt from 'jsonwebtoken';
import type { Model } from 'mongoose';
import type {
  LogAdapter, StaffHooks, StaffAdapters, IStaffCreateInput,
  IStaffUpdateInput, IStaffListFilters, IPaginatedResult,
} from '@astralibx/staff-types';
import { STAFF_ROLE, STAFF_STATUS } from '@astralibx/staff-types';
import type { IStaffDocument } from '../schemas/staff.schema.js';
import type { IPermissionGroupDocument } from '../schemas/permission-group.schema.js';
import type { PermissionCacheService } from './permission-cache.service.js';
import type { RateLimiterService } from './rate-limiter.service.js';
import {
  AuthenticationError, DuplicateError, StaffNotFoundError,
  LastOwnerError, SetupError, RateLimitError,
} from '../errors/index.js';
import { ERROR_CODE, ERROR_MESSAGE, DEFAULTS } from '../constants/index.js';
import { validatePermissionPairs } from '../validation/index.js';

export interface StaffServiceDeps {
  Staff: Model<IStaffDocument>;
  PermissionGroup: Model<IPermissionGroupDocument>;
  adapters: StaffAdapters;
  hooks: StaffHooks;
  permissionCache: PermissionCacheService;
  rateLimiter: RateLimiterService;
  logger: LogAdapter;
  tenantId?: string;
  jwtSecret: string;
  staffTokenExpiry: string;
  ownerTokenExpiry: string;
  requireEmailUniqueness: boolean;
  allowSelfPasswordChange: boolean;
}

export class StaffService {
  private Staff: Model<IStaffDocument>;
  private PermissionGroup: Model<IPermissionGroupDocument>;
  private adapters: StaffAdapters;
  private hooks: StaffHooks;
  private permissionCache: PermissionCacheService;
  private rateLimiter: RateLimiterService;
  private logger: LogAdapter;
  private tenantId?: string;
  private jwtSecret: string;
  private staffTokenExpiry: string;
  private ownerTokenExpiry: string;
  private requireEmailUniqueness: boolean;
  private allowSelfPasswordChange: boolean;

  constructor(deps: StaffServiceDeps) {
    this.Staff = deps.Staff;
    this.PermissionGroup = deps.PermissionGroup;
    this.adapters = deps.adapters;
    this.hooks = deps.hooks;
    this.permissionCache = deps.permissionCache;
    this.rateLimiter = deps.rateLimiter;
    this.logger = deps.logger;
    this.tenantId = deps.tenantId;
    this.jwtSecret = deps.jwtSecret;
    this.staffTokenExpiry = deps.staffTokenExpiry;
    this.ownerTokenExpiry = deps.ownerTokenExpiry;
    this.requireEmailUniqueness = deps.requireEmailUniqueness;
    this.allowSelfPasswordChange = deps.allowSelfPasswordChange;
  }

  private get tenantFilter(): Record<string, unknown> {
    return this.tenantId ? { tenantId: this.tenantId } : {};
  }

  private generateToken(staffId: string, role: string): string {
    const expiresIn = role === STAFF_ROLE.Owner ? this.ownerTokenExpiry : this.staffTokenExpiry;
    return jwt.sign({ staffId, role }, this.jwtSecret, { expiresIn });
  }

  async setupOwner(data: { name: string; email: string; password: string }): Promise<{ staff: IStaffDocument; token: string }> {
    // Race-safe: use findOneAndUpdate with upsert. The filter ensures this only
    // succeeds when zero staff exist for the tenant. If two requests race, only
    // the first upsert creates a document; the second finds the existing one
    // and we detect it was not newly created.
    const hashedPassword = await this.adapters.hashPassword(data.password);
    const filter = { role: STAFF_ROLE.Owner, ...this.tenantFilter };
    const result = await this.Staff.findOneAndUpdate(
      filter,
      {
        $setOnInsert: {
          name: data.name,
          email: data.email.toLowerCase().trim(),
          password: hashedPassword,
          role: STAFF_ROLE.Owner,
          status: STAFF_STATUS.Active,
          permissions: [],
          ...this.tenantFilter,
        },
      },
      { upsert: true, new: true, rawResult: true },
    );

    if (!result.lastErrorObject?.upserted) {
      throw new SetupError();
    }

    const staff = result.value!;
    const token = this.generateToken(staff._id.toString(), STAFF_ROLE.Owner);
    this.logger.info('Owner setup complete', { staffId: staff._id.toString() });
    this.hooks.onStaffCreated?.(staff.toObject());
    this.hooks.onMetric?.({ name: 'staff_setup_complete', value: 1 });
    return { staff: staff.toObject(), token };
  }

  async login(email: string, password: string, ip?: string): Promise<{ staff: IStaffDocument; token: string }> {
    if (ip) {
      const limit = await this.rateLimiter.checkLimit(ip);
      if (!limit.allowed) {
        this.hooks.onLoginFailed?.(email, ip);
        throw new RateLimitError(limit.retryAfterMs!);
      }
    }

    const staff = await this.Staff.findOne({
      email: email.toLowerCase().trim(),
      ...this.tenantFilter,
    }).select('+password');

    if (!staff) {
      if (ip) await this.rateLimiter.recordAttempt(ip);
      this.hooks.onLoginFailed?.(email, ip);
      throw new AuthenticationError(ERROR_CODE.InvalidCredentials);
    }

    const valid = await this.adapters.comparePassword(password, staff.password);
    if (!valid) {
      if (ip) await this.rateLimiter.recordAttempt(ip);
      this.hooks.onLoginFailed?.(email, ip);
      throw new AuthenticationError(ERROR_CODE.InvalidCredentials);
    }

    if (staff.status === STAFF_STATUS.Inactive) {
      throw new AuthenticationError(ERROR_CODE.AccountInactive, ERROR_MESSAGE.AccountInactive);
    }
    if (staff.status === STAFF_STATUS.Pending) {
      throw new AuthenticationError(ERROR_CODE.AccountPending, ERROR_MESSAGE.AccountPending);
    }

    staff.lastLoginAt = new Date();
    if (ip) staff.lastLoginIp = ip;
    await staff.save();

    if (ip) await this.rateLimiter.reset(ip);
    const token = this.generateToken(staff._id.toString(), staff.role);
    this.hooks.onLogin?.(staff.toObject(), ip);
    this.hooks.onMetric?.({ name: 'staff_login', value: 1, labels: { role: staff.role } });
    this.logger.info('Staff login', { staffId: staff._id.toString() });

    const staffObj = staff.toObject();
    delete (staffObj as any).password;
    return { staff: staffObj, token };
  }

  async create(data: IStaffCreateInput): Promise<IStaffDocument> {
    if (this.requireEmailUniqueness) {
      const existing = await this.Staff.findOne({
        email: data.email.toLowerCase().trim(),
        ...this.tenantFilter,
      });
      if (existing) {
        throw new DuplicateError(ERROR_CODE.EmailExists, ERROR_MESSAGE.EmailExists, { email: data.email });
      }
    }

    const hashedPassword = await this.adapters.hashPassword(data.password);
    const staff = await this.Staff.create({
      ...data,
      email: data.email.toLowerCase().trim(),
      password: hashedPassword,
      role: data.role ?? STAFF_ROLE.Staff,
      status: data.status ?? STAFF_STATUS.Pending,
      permissions: data.permissions ?? [],
      ...this.tenantFilter,
    });

    this.logger.info('Staff created', { staffId: staff._id.toString() });
    this.hooks.onStaffCreated?.(staff.toObject());
    return staff.toObject();
  }

  async list(filters: IStaffListFilters = {}): Promise<IPaginatedResult<IStaffDocument>> {
    const page = Math.max(1, filters.page ?? 1);
    const limit = Math.min(filters.limit ?? DEFAULTS.ListPageSize, DEFAULTS.MaxListPageSize);

    const query: Record<string, unknown> = { ...this.tenantFilter };
    if (filters.status) query.status = filters.status;
    if (filters.role) query.role = filters.role;

    const [data, total] = await Promise.all([
      this.Staff.find(query)
        .sort({ createdAt: -1 })
        .skip((page - 1) * limit)
        .limit(limit)
        .lean(),
      this.Staff.countDocuments(query),
    ]);

    return {
      data,
      pagination: { page, limit, total, totalPages: Math.ceil(total / limit) },
    };
  }

  async getById(staffId: string): Promise<IStaffDocument> {
    const staff = await this.Staff.findOne({ _id: staffId, ...this.tenantFilter }).lean();
    if (!staff) throw new StaffNotFoundError(staffId);
    return staff;
  }

  async update(staffId: string, data: IStaffUpdateInput): Promise<IStaffDocument> {
    const updateData: Record<string, unknown> = {};
    if (data.name !== undefined) updateData.name = data.name;
    if (data.email !== undefined) updateData.email = data.email.toLowerCase().trim();
    if (data.metadata !== undefined) updateData.metadata = data.metadata;

    if (data.email && this.requireEmailUniqueness) {
      const existing = await this.Staff.findOne({
        email: data.email.toLowerCase().trim(),
        _id: { $ne: staffId },
        ...this.tenantFilter,
      });
      if (existing) {
        throw new DuplicateError(ERROR_CODE.EmailExists, ERROR_MESSAGE.EmailExists, { email: data.email });
      }
    }

    const staff = await this.Staff.findOneAndUpdate(
      { _id: staffId, ...this.tenantFilter },
      { $set: updateData },
      { new: true },
    ).lean();
    if (!staff) throw new StaffNotFoundError(staffId);

    this.logger.info('Staff updated', { staffId, fields: Object.keys(updateData) });
    return staff;
  }

  async updatePermissions(staffId: string, permissions: string[]): Promise<IStaffDocument> {
    const groups = await this.PermissionGroup.find(this.tenantFilter).lean();
    validatePermissionPairs(permissions, groups);

    const staff = await this.Staff.findOne({ _id: staffId, ...this.tenantFilter });
    if (!staff) throw new StaffNotFoundError(staffId);

    const oldPerms = [...staff.permissions];
    staff.permissions = permissions;
    await staff.save();

    await this.permissionCache.invalidate(staffId);
    this.hooks.onPermissionsChanged?.(staffId, oldPerms, permissions);
    this.logger.info('Staff permissions updated', { staffId, count: permissions.length });
    return staff.toObject();
  }

  async updateStatus(staffId: string, status: string): Promise<IStaffDocument> {
    const staff = await this.Staff.findOne({ _id: staffId, ...this.tenantFilter });
    if (!staff) throw new StaffNotFoundError(staffId);

    if (status === STAFF_STATUS.Inactive && staff.role === STAFF_ROLE.Owner) {
      const activeOwnerCount = await this.Staff.countDocuments({
        role: STAFF_ROLE.Owner,
        status: STAFF_STATUS.Active,
        ...this.tenantFilter,
      });
      if (activeOwnerCount <= 1) throw new LastOwnerError(staffId);
    }

    const oldStatus = staff.status;
    staff.status = status as any;
    await staff.save();

    await this.permissionCache.invalidate(staffId);
    this.hooks.onStatusChanged?.(staffId, oldStatus, status);
    this.logger.info('Staff status updated', { staffId, oldStatus, newStatus: status });
    return staff.toObject();
  }

  async resetPassword(staffId: string, newPassword: string): Promise<void> {
    const staff = await this.Staff.findOne({ _id: staffId, ...this.tenantFilter });
    if (!staff) throw new StaffNotFoundError(staffId);

    staff.password = await this.adapters.hashPassword(newPassword);
    await staff.save();
    this.logger.info('Staff password reset', { staffId });
  }

  async changeOwnPassword(staffId: string, oldPassword: string, newPassword: string): Promise<void> {
    if (!this.allowSelfPasswordChange) {
      throw new AuthenticationError(ERROR_CODE.InsufficientPermissions, 'Self password change is disabled');
    }

    const staff = await this.Staff.findOne({ _id: staffId, ...this.tenantFilter }).select('+password');
    if (!staff) throw new StaffNotFoundError(staffId);

    const valid = await this.adapters.comparePassword(oldPassword, staff.password);
    if (!valid) throw new AuthenticationError(ERROR_CODE.InvalidCredentials, 'Current password is incorrect');

    staff.password = await this.adapters.hashPassword(newPassword);
    await staff.save();
    this.logger.info('Staff changed own password', { staffId });
  }
}
```

- [ ] **Step 3: Write staff service tests**

Create `packages/staff/staff-engine/src/__tests__/services/staff.service.spec.ts` with tests for:
- `setupOwner` creates owner and returns token
- `setupOwner` throws SetupError if staff exist
- `login` returns token for valid credentials
- `login` throws on invalid credentials
- `login` throws on inactive account
- `login` throws on pending account
- `login` rate limits by IP
- `login` resets rate limit on success
- `create` creates staff with hashed password
- `create` throws DuplicateError on existing email
- `list` returns paginated results
- `getById` returns staff
- `getById` throws StaffNotFoundError
- `update` updates name/email/metadata
- `updatePermissions` validates edit→view pairs
- `updatePermissions` invalidates cache
- `updateStatus` deactivates staff
- `updateStatus` throws LastOwnerError for last owner
- `resetPassword` hashes new password
- `changeOwnPassword` validates old password
- `changeOwnPassword` throws if disabled

Mock all model methods and adapters using vi.fn(). Verify hooks are called.

- [ ] **Step 4: Run tests and commit**

```
feat(staff-engine): add StaffService with CRUD, login, setup, permissions, and password management
```

---

## Task 7: Auth middleware

**Files:**
- Create: `packages/staff/staff-engine/src/middleware/auth.middleware.ts`
- Create: `packages/staff/staff-engine/src/__tests__/middleware/auth.middleware.spec.ts`

- [ ] **Step 1: Create auth.middleware.ts**

```ts
import jwt from 'jsonwebtoken';
import type { Request, Response, NextFunction, RequestHandler } from 'express';
import type { LogAdapter } from '@astralibx/staff-types';
import { STAFF_ROLE, STAFF_STATUS } from '@astralibx/staff-types';
import type { PermissionCacheService } from '../services/permission-cache.service.js';
import type { IStaffDocument } from '../schemas/staff.schema.js';
import type { Model } from 'mongoose';
import { TokenError, AuthorizationError } from '../errors/index.js';
import { ERROR_CODE, ERROR_MESSAGE } from '../constants/index.js';

export interface StaffUser {
  staffId: string;
  role: string;
  permissions: string[];
}

export interface AuthenticatedRequest extends Request {
  user: StaffUser;
}

export interface AuthMiddleware {
  verifyToken: RequestHandler;
  resolveStaff: (token: string) => Promise<StaffUser | null>;
  requirePermission: (...keys: string[]) => RequestHandler;
  ownerOnly: RequestHandler;
  requireRole: (...roles: string[]) => RequestHandler;
}

export function createAuthMiddleware(
  jwtSecret: string,
  permissionCache: PermissionCacheService,
  StaffModel: Model<IStaffDocument>,
  logger: LogAdapter,
  tenantId?: string,
): AuthMiddleware {

  async function resolveStaffFromToken(token: string): Promise<StaffUser | null> {
    try {
      const payload = jwt.verify(token, jwtSecret) as { staffId: string; role: string };
      if (!payload.staffId || !payload.role) return null;

      // Check staff status
      const filter: Record<string, unknown> = { _id: payload.staffId };
      if (tenantId) filter.tenantId = tenantId;
      const staff = await StaffModel.findOne(filter).select('status role').lean();
      if (!staff) return null;
      if (staff.status !== STAFF_STATUS.Active) return null;

      const permissions = await permissionCache.get(payload.staffId);
      return { staffId: payload.staffId, role: staff.role, permissions };
    } catch {
      return null;
    }
  }

  const verifyToken: RequestHandler = async (req: Request, res: Response, next: NextFunction) => {
    const authHeader = req.headers.authorization;
    if (!authHeader?.startsWith('Bearer ')) {
      res.status(401).json({ success: false, error: ERROR_MESSAGE.TokenInvalid, code: ERROR_CODE.TokenInvalid });
      return;
    }

    const token = authHeader.slice(7);

    // Distinguish expired vs invalid tokens before full resolution
    try {
      jwt.verify(token, jwtSecret);
    } catch (err: unknown) {
      if (err instanceof jwt.TokenExpiredError) {
        res.status(401).json({ success: false, error: ERROR_MESSAGE.TokenExpired, code: ERROR_CODE.TokenExpired });
        return;
      }
      res.status(401).json({ success: false, error: ERROR_MESSAGE.TokenInvalid, code: ERROR_CODE.TokenInvalid });
      return;
    }

    const user = await resolveStaffFromToken(token);
    if (!user) {
      res.status(401).json({ success: false, error: ERROR_MESSAGE.TokenInvalid, code: ERROR_CODE.TokenInvalid });
      return;
    }

    (req as AuthenticatedRequest).user = user;
    next();
  };

  function requirePermission(...keys: string[]): RequestHandler {
    return (req: Request, res: Response, next: NextFunction) => {
      const user = (req as AuthenticatedRequest).user;
      if (!user) {
        res.status(401).json({ success: false, error: ERROR_MESSAGE.TokenInvalid, code: ERROR_CODE.TokenInvalid });
        return;
      }

      // Owner bypasses permission checks
      if (user.role === STAFF_ROLE.Owner) {
        next();
        return;
      }

      const permSet = new Set(user.permissions);
      const missing: string[] = [];

      for (const key of keys) {
        if (!permSet.has(key)) {
          missing.push(key);
          continue;
        }
        // Single-level edit→view cascade
        if (key.endsWith(':edit')) {
          const prefix = key.substring(0, key.lastIndexOf(':'));
          const viewKey = `${prefix}:view`;
          if (!permSet.has(viewKey)) {
            missing.push(viewKey);
          }
        }
      }

      if (missing.length > 0) {
        res.status(403).json({
          success: false,
          error: ERROR_MESSAGE.InsufficientPermissions,
          code: ERROR_CODE.InsufficientPermissions,
          missing,
        });
        return;
      }

      next();
    };
  }

  const ownerOnly: RequestHandler = (req: Request, res: Response, next: NextFunction) => {
    const user = (req as AuthenticatedRequest).user;
    if (!user || user.role !== STAFF_ROLE.Owner) {
      res.status(403).json({ success: false, error: ERROR_MESSAGE.OwnerOnly, code: ERROR_CODE.OwnerOnly });
      return;
    }
    next();
  };

  function requireRole(...roles: string[]): RequestHandler {
    return (req: Request, res: Response, next: NextFunction) => {
      const user = (req as AuthenticatedRequest).user;
      if (!user || !roles.includes(user.role)) {
        res.status(403).json({ success: false, error: ERROR_MESSAGE.InsufficientPermissions, code: ERROR_CODE.InsufficientPermissions });
        return;
      }
      next();
    };
  }

  return {
    verifyToken,
    resolveStaff: resolveStaffFromToken,
    requirePermission,
    ownerOnly,
    requireRole,
  };
}
```

- [ ] **Step 2: Write auth middleware tests**

Test: verifyToken (valid, missing header, invalid token, expired, inactive staff), requirePermission (has permission, missing permission, cascade check, owner bypasses), ownerOnly (owner passes, staff blocked), requireRole (matching, not matching), resolveStaff (valid, invalid).

Mock `jwt.verify` with vi.fn(), mock StaffModel and PermissionCacheService.

- [ ] **Step 3: Run tests and commit**

```
feat(staff-engine): add auth middleware with verifyToken, requirePermission, ownerOnly, and resolveStaff
```

---

## Task 8: Routes

**Files:**
- Create: `packages/staff/staff-engine/src/routes/auth.routes.ts`
- Create: `packages/staff/staff-engine/src/routes/staff.routes.ts`
- Create: `packages/staff/staff-engine/src/routes/permission-group.routes.ts`
- Create: `packages/staff/staff-engine/src/routes/index.ts`

- [ ] **Step 0: Create services/index.ts barrel and utils/error-handler.ts**

`services/index.ts`:
```ts
export { StaffService } from './staff.service.js';
export { PermissionService } from './permission.service.js';
export { RateLimiterService } from './rate-limiter.service.js';
export { PermissionCacheService } from './permission-cache.service.js';
```

`utils/error-handler.ts` — reusable error-to-HTTP mapper used by all route files:
```ts
import type { Response } from 'express';
import type { LogAdapter } from '@astralibx/staff-types';
import { sendSuccess, sendError } from '@astralibx/core';
import {
  AlxStaffError, AuthenticationError, AuthorizationError,
  RateLimitError, TokenError, StaffNotFoundError, DuplicateError,
  SetupError, LastOwnerError, InvalidPermissionError, GroupNotFoundError,
} from '../errors/index.js';

export { sendSuccess };

export function handleStaffError(res: Response, error: unknown, logger: LogAdapter): void {
  if (error instanceof RateLimitError) {
    res.set('Retry-After', String(Math.ceil(error.retryAfterMs / 1000)));
    sendError(res, error.message, 429);
  } else if (error instanceof AuthenticationError || error instanceof TokenError) {
    sendError(res, error.message, 401);
  } else if (error instanceof AuthorizationError || error instanceof SetupError) {
    sendError(res, error.message, 403);
  } else if (error instanceof StaffNotFoundError || error instanceof GroupNotFoundError) {
    sendError(res, error.message, 404);
  } else if (error instanceof DuplicateError) {
    sendError(res, error.message, 409);
  } else if (error instanceof LastOwnerError || error instanceof InvalidPermissionError) {
    sendError(res, error.message, 400);
  } else if (error instanceof AlxStaffError) {
    sendError(res, error.message, 400);
  } else {
    const message = error instanceof Error ? error.message : 'Unknown error';
    logger.error('Unexpected error', { error: message });
    sendError(res, message, 500);
  }
}
```

- [ ] **Step 1: Create auth.routes.ts**

Handles: `POST /setup`, `POST /login`, `GET /me`, `PUT /me/password` (conditionally mounted).

Each route handler: try/catch using `handleStaffError` for error mapping, `sendSuccess` for success responses.

Login route extracts IP from `req.ip || req.socket.remoteAddress`.

Setup route calls `staffService.setupOwner()`.

`/me` returns staff profile with permissions resolved from cache.

`/me/password` calls `staffService.changeOwnPassword()` — only registered if `allowSelfPasswordChange`.

- [ ] **Step 2: Create staff.routes.ts**

Handles: `GET /`, `POST /`, `PUT /:staffId`, `PUT /:staffId/permissions`, `PUT /:staffId/status`, `PUT /:staffId/password`.

All routes require ownerOnly middleware.

Each route: parse params/body, call service, return `sendSuccess(res, result)`.

Error mapping: `AuthenticationError`→401, `AuthorizationError`→403, `RateLimitError`→429 (with Retry-After header), `StaffNotFoundError`→404, `DuplicateError`→409, `SetupError`→403, `LastOwnerError`→400, `InvalidPermissionError`→400, `AlxStaffError`→400, else→500.

- [ ] **Step 3: Create permission-group.routes.ts**

Handles: `GET /`, `POST /`, `PUT /:groupId`, `DELETE /:groupId`.

GET is authenticated only. POST/PUT/DELETE require ownerOnly.

- [ ] **Step 4: Create routes/index.ts**

```ts
import { Router } from 'express';
import type { StaffService } from '../services/staff.service.js';
import type { PermissionService } from '../services/permission.service.js';
import type { AuthMiddleware } from '../middleware/auth.middleware.js';
import type { LogAdapter } from '@astralibx/staff-types';
import { createAuthRoutes } from './auth.routes.js';
import { createStaffRoutes } from './staff.routes.js';
import { createPermissionGroupRoutes } from './permission-group.routes.js';

export interface RouteServices {
  staff: StaffService;
  permissions: PermissionService;
}

export function createRoutes(
  services: RouteServices,
  auth: AuthMiddleware,
  logger: LogAdapter,
  allowSelfPasswordChange: boolean,
): Router {
  const router = Router();

  router.use('/', createAuthRoutes(services.staff, auth, logger, allowSelfPasswordChange));
  router.use('/', auth.verifyToken, auth.ownerOnly, createStaffRoutes(services.staff, logger));
  router.use('/permission-groups', createPermissionGroupRoutes(services.permissions, auth, logger));

  return router;
}
```

- [ ] **Step 5: Write route tests**

Test each endpoint for success and error cases. Mock services, use a helper to create mock req/res objects.

- [ ] **Step 6: Run tests and commit**

```
feat(staff-engine): add REST routes for auth, staff CRUD, and permission group management
```

---

## Task 9: Factory function and barrel exports

**Files:**
- Create: `packages/staff/staff-engine/src/index.ts`

- [ ] **Step 1: Create index.ts with factory**

Factory function `createStaffEngine(config)`:
1. Validate config with Zod
2. Resolve options from defaults
3. Set up logger (fallback to noopLogger from core)
4. Register mongoose models with collectionPrefix
5. Create services in dependency order: RateLimiterService → PermissionCacheService → PermissionService → StaffService
6. Create auth middleware
7. Create routes
8. Return engine object with services, auth, routes, models, destroy

Barrel exports: re-export constants, errors, schemas, services, types.

- [ ] **Step 2: Write factory tests**

Test: valid config creates engine, missing jwtSecret throws, missing adapters throws, destroy cleans up.

- [ ] **Step 3: Build the full package**

Run: `cd packages/staff/staff-engine && npx tsup`
Expected: Clean build.

- [ ] **Step 4: Run all tests**

Run: `cd packages/staff/staff-engine && npx vitest run`
Expected: All tests pass (~105 tests).

- [ ] **Step 5: Commit**

```
feat(staff-engine): add createStaffEngine factory function and barrel exports
```

---

## Task 10: Scaffold staff-ui package

**Files:**
- Create: `packages/staff/staff-ui/package.json`
- Create: `packages/staff/staff-ui/tsconfig.json`
- Create: `packages/staff/staff-ui/vite.config.ts`
- Create: `packages/staff/staff-ui/src/config.ts`
- Create: `packages/staff/staff-ui/src/utils/safe-register.ts`
- Create: `packages/staff/staff-ui/src/styles/shared.ts`
- Create: `packages/staff/staff-ui/src/api/staff-api-client.ts`
- Create: `packages/staff/staff-ui/src/index.ts`

- [ ] **Step 1: Create package.json, tsconfig.json, vite.config.ts**

Follow exact patterns from chat-ui. Type: module. Dep: lit, @astralibx/staff-types. Vite library build with external lit and @astralibx.

- [ ] **Step 2: Create config.ts**

```ts
export class AlxStaffConfig {
  private static staffApi = '';
  private static authToken = '';

  static setup(config: { staffApi: string; authToken: string }) {
    AlxStaffConfig.staffApi = config.staffApi;
    AlxStaffConfig.authToken = config.authToken;
  }

  static getApiUrl(): string { return AlxStaffConfig.staffApi; }
  static getAuthToken(): string { return AlxStaffConfig.authToken; }
}
```

- [ ] **Step 3: Create safe-register.ts, shared styles, API client**

Copy `safe-register.ts` pattern from chat-ui. Create shared styles module. Create `StaffApiClient` with typed methods for all 14 routes.

- [ ] **Step 4: Create index.ts barrel**

Import and register all components (empty for now, components added in next tasks).

- [ ] **Step 5: Build and verify**

Run: `cd packages/staff/staff-ui && npx vite build`

- [ ] **Step 6: Commit**

```
feat(staff-ui): scaffold staff-ui package with config, API client, and shared styles
```

---

## Task 11: Staff UI components

**Files:**
- Create: `packages/staff/staff-ui/src/components/alx-staff-list.ts`
- Create: `packages/staff/staff-ui/src/components/alx-staff-create-form.ts`
- Create: `packages/staff/staff-ui/src/components/alx-staff-permission-editor.ts`
- Create: `packages/staff/staff-ui/src/components/alx-permission-group-editor.ts`

- [ ] **Step 1: Create alx-staff-list.ts**

Lit component: table with name, email, role badge, status badge, permissions count, last login. Loads from API on connect. Row actions: edit permissions, reset password, toggle status. Dispatches events.

- [ ] **Step 2: Create alx-staff-create-form.ts**

Lit component: form with name, email, password, permission picker. Calls API to create. Dispatches `staff-created` event.

- [ ] **Step 3: Create alx-staff-permission-editor.ts**

Lit component: loads permission groups from API, shows grouped checkboxes. Edit auto-checks view. Select-all/clear-all per group. Save calls API to update permissions. Dispatches `permissions-updated` event.

- [ ] **Step 4: Create alx-staff-password-reset.ts**

Lit component: modal with new password + confirm password inputs. Validates passwords match. Calls API `resetPassword(staffId, newPassword)`. Dispatches `password-reset` event with `{ staffId }`.

- [ ] **Step 5: Create alx-staff-status-toggle.ts**

Lit component: inline toggle showing current status (active/inactive). Confirmation prompt before changing. Calls API `updateStatus(staffId, newStatus)`. Dispatches `status-changed` event with `{ staffId, status }`.

- [ ] **Step 6: Create alx-permission-group-editor.ts**

Lit component: owner-only CRUD for permission groups. Add group form, edit inline, delete with confirm. Add permission entries via "Add permission" button with key/label/type inputs. Dispatches `group-created`, `group-updated`, `group-deleted` events.

- [ ] **Step 7: Create alx-staff-setup.ts**

Lit component: first-run setup form. Fields: owner name, email, password, confirm password. Calls API `POST /setup`. On success dispatches `setup-complete` event with `{ staff, token }`. Shows error if setup already complete.

- [ ] **Step 8: Update index.ts to register all 7 components**

- [ ] **Step 9: Build and verify**

Run: `cd packages/staff/staff-ui && npx vite build`

- [ ] **Step 10: Commit**

```
feat(staff-ui): add all staff UI components - list, create, permissions, password reset, status toggle, group editor, setup
```

---

## Task 12: README docs and final verification

**Files:**
- Create: `packages/staff/README.md`
- Create: `packages/staff/staff-engine/README.md`
- Create: `packages/staff/staff-types/README.md`
- Create: `packages/staff/staff-ui/README.md`

- [ ] **Step 1: Create module root README**

Follow chat module README pattern: features, packages table, architecture diagram, design principles, end-to-end setup, license.

- [ ] **Step 2: Create per-package READMEs**

staff-types: enums table, interfaces table, usage example.
staff-engine: install, peer deps, quick start, full setup, features list (as per new chat-engine README pattern — clear capability descriptions), routes table, architecture, links.
staff-ui: install, setup, components table, events table, theming.

- [ ] **Step 3: Install deps and build all**

Run: `npm install && npx turbo run build --filter=@astralibx/staff-*`

- [ ] **Step 4: Run all tests**

Run: `npx turbo run test --filter=@astralibx/staff-*`
Expected: All tests pass.

- [ ] **Step 5: Commit**

```
feat(staff): add README documentation for staff module and all sub-packages
```

- [ ] **Step 6: Update deploy.bat**

Add staff packages to the deploy script following existing pattern.

- [ ] **Step 7: Final commit**

```
feat(staff): complete staff module with types, engine, and UI packages
```
