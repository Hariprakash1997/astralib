# @astralibx/staff-types

[![npm version](https://img.shields.io/npm/v/@astralibx/staff-types.svg)](https://www.npmjs.com/package/@astralibx/staff-types)
[![License: MIT](https://img.shields.io/badge/License-MIT-blue.svg)](https://opensource.org/licenses/MIT)

Shared TypeScript type definitions, enums, and config contracts for the staff module.

## Install

```bash
npm install @astralibx/staff-types
```

No runtime dependencies -- pure TypeScript declarations and const enums.

## Enums

| Enum | Values | Description |
|------|--------|-------------|
| `STAFF_ROLE` | `Owner`, `Staff` | Role level for a staff account |
| `STAFF_STATUS` | `Active`, `Inactive`, `Pending` | Account lifecycle status |
| `PERMISSION_TYPE` | `View`, `Edit`, `Action` | Capability type for a permission entry |

### Enum values

```ts
import { STAFF_ROLE, STAFF_STATUS, PERMISSION_TYPE } from '@astralibx/staff-types';

STAFF_ROLE.Owner      // 'owner'
STAFF_ROLE.Staff      // 'staff'

STAFF_STATUS.Active   // 'active'
STAFF_STATUS.Inactive // 'inactive'
STAFF_STATUS.Pending  // 'pending'

PERMISSION_TYPE.View   // 'view'
PERMISSION_TYPE.Edit   // 'edit'
PERMISSION_TYPE.Action // 'action'
```

## Interfaces

| Interface | Source | Description |
|-----------|--------|-------------|
| `IStaff` | `staff.types` | Full staff document: name, email, hashed password, role, status, permissions, lastLoginAt, metadata, tenantId |
| `IStaffSummary` | `staff.types` | Public staff projection (no password): name, email, role, status, permissions, lastLoginAt |
| `IStaffCreateInput` | `staff.types` | Input for creating a staff member: name, email, password (plain), role, status, permissions, externalUserId, metadata |
| `IStaffUpdateInput` | `staff.types` | Input for updating a staff member: name, email, metadata |
| `IStaffListFilters` | `staff.types` | List query filters: status, role, page, limit |
| `IPaginatedResult<T>` | `staff.types` | Generic pagination wrapper (utility type). Staff list endpoint returns flat `{ staff[], total, page, limit, totalPages }` instead. |
| `IPermissionEntry` | `permission.types` | Single permission entry: key, label, type |
| `IPermissionGroup` | `permission.types` | Permission group document: groupId, label, permissions[], sortOrder, tenantId |
| `IPermissionGroupCreateInput` | `permission.types` | Input for creating a permission group |
| `IPermissionGroupUpdateInput` | `permission.types` | Input for updating a permission group |
| `StaffAdapters` | `adapter.types` | Required adapters: hashPassword, comparePassword |
| `LogAdapter` | `config.types` | Logger interface: info, warn, error |
| `StaffMetric` | `config.types` | Metric event: name, value, labels, timestamp |
| `StaffHooks` | `config.types` | Lifecycle hooks: onStaffCreated, onLogin, onLoginFailed, onPermissionsChanged, onStatusChanged, onMetric |
| `StaffEngineOptions` | `config.types` | Engine options: requireEmailUniqueness, allowSelfPasswordChange, rateLimiter |
| `StaffEngineConfig` | `config.types` | Full engine configuration: db, redis, logger, tenantId, auth, adapters, hooks, options |
| `ResolvedOptions` | `config.types` | Resolved options with defaults applied |
| `DEFAULT_OPTIONS` | `config.types` | Default values for all options |

## Usage

```ts
import type {
  IStaff,
  IStaffSummary,
  IPermissionGroup,
  StaffEngineConfig,
} from '@astralibx/staff-types';
import { STAFF_ROLE, STAFF_STATUS, PERMISSION_TYPE } from '@astralibx/staff-types';

// Type a staff record
const staff: IStaffSummary = {
  _id: '...',
  name: 'Alice',
  email: 'alice@example.com',
  role: STAFF_ROLE.Owner,
  status: STAFF_STATUS.Active,
  permissions: ['contacts.view', 'contacts.edit'],
  createdAt: new Date(),
};

// Type a permission group
const group: IPermissionGroup = {
  _id: '...',
  groupId: 'crm',
  label: 'CRM',
  permissions: [
    { key: 'contacts.view', label: 'View Contacts', type: PERMISSION_TYPE.View },
    { key: 'contacts.edit', label: 'Edit Contacts', type: PERMISSION_TYPE.Edit },
  ],
  sortOrder: 1,
  createdAt: new Date(),
  updatedAt: new Date(),
};
```

## Links

- [GitHub](https://github.com/Hariprakash1997/astralib/tree/main/packages/staff/staff-types)
- [CHANGELOG](https://github.com/Hariprakash1997/astralib/blob/main/packages/staff/staff-types/CHANGELOG.md)

## License

MIT
