# @astralibx/staff-ui

[![npm version](https://img.shields.io/npm/v/@astralibx/staff-ui.svg)](https://www.npmjs.com/package/@astralibx/staff-ui)
[![License: MIT](https://img.shields.io/badge/License-MIT-blue.svg)](https://opensource.org/licenses/MIT)

Admin dashboard Lit web components for staff management. 7 self-contained shadow DOM components for building a staff management UI that connects to `@astralibx/staff-engine` via REST.

## Install

```bash
npm install @astralibx/staff-ui
```

### Peer Dependencies

| Package | Required |
|---------|----------|
| `lit` | Yes |

```bash
npm install lit
```

## Setup

Call `AlxStaffConfig.setup()` once at application startup before rendering any components:

```ts
import { AlxStaffConfig } from '@astralibx/staff-ui';

AlxStaffConfig.setup({
  staffApi: '/api/staff',       // Base URL of the staff engine routes
  authToken: 'Bearer <token>',  // Owner JWT token for API requests
});

import '@astralibx/staff-ui'; // Registers all 7 custom elements
```

To update the token after login (e.g. after setup completes):

```ts
AlxStaffConfig.setAuthToken('Bearer <new-token>');
```

## Components

| Tag | Class | Description |
|-----|-------|-------------|
| `<alx-staff-list>` | `AlxStaffList` | Paginated staff table with status/role filters, inline action buttons for permissions, password reset, and activate/deactivate |
| `<alx-staff-create-form>` | `AlxStaffCreateForm` | Form to create a new staff member with name, email, password, and permission checkboxes grouped by permission group |
| `<alx-staff-permission-editor>` | `AlxStaffPermissionEditor` | Per-staff permission editor with collapsible groups, select-all/clear per group, and edit-to-view auto-cascade |
| `<alx-staff-password-reset>` | `AlxStaffPasswordReset` | Owner form to reset a staff member's password with confirm-password validation |
| `<alx-staff-status-toggle>` | `AlxStaffStatusToggle` | Shows current status badge and toggles active/inactive with a confirmation step |
| `<alx-permission-group-editor>` | `AlxPermissionGroupEditor` | Full CRUD editor for permission groups -- create groups, add/remove permission entries (key, label, type), delete groups |
| `<alx-staff-setup>` | `AlxStaffSetup` | First-run setup form that calls `POST /setup` to create the initial owner account |

### Component attributes

| Component | Attribute | Type | Description |
|-----------|-----------|------|-------------|
| `alx-staff-list` | `density` | `'default' \| 'compact'` | Layout density mode |
| `alx-staff-permission-editor` | `staff-id` | `string` | ID of the staff member to edit permissions for |
| `alx-staff-password-reset` | `staff-id` | `string` | ID of the staff member whose password to reset |
| `alx-staff-status-toggle` | `staff-id` | `string` | ID of the staff member to toggle |
| `alx-staff-status-toggle` | `current-status` | `string` | Current status value shown in the badge |

## Events

All events bubble and are composed (cross shadow DOM).

| Event | Component | Detail | Description |
|-------|-----------|--------|-------------|
| `create-staff` | `alx-staff-list` | `{}` | User clicked "+ Add Staff" button |
| `edit-permissions` | `alx-staff-list` | `{ staffId: string }` | User clicked "Permissions" for a staff row |
| `reset-password` | `alx-staff-list` | `{ staffId: string }` | User clicked "Reset PW" for a staff row |
| `toggle-status` | `alx-staff-list` | `{ staffId: string, currentStatus: string }` | User clicked Activate/Deactivate for a staff row |
| `staff-created` | `alx-staff-create-form` | `{ staff: IStaffSummary }` | New staff member was successfully created |
| `cancel` | `alx-staff-create-form` | `{}` | User cancelled the create form |
| `permissions-updated` | `alx-staff-permission-editor` | `{ staffId: string, permissions: string[] }` | Permissions were saved for a staff member |
| `password-reset` | `alx-staff-password-reset` | `{ staffId: string }` | Password was successfully reset |
| `cancel` | `alx-staff-password-reset` | `{}` | User cancelled the password reset form |
| `status-changed` | `alx-staff-status-toggle` | `{ staffId: string, status: string }` | Staff status was changed |
| `group-created` | `alx-permission-group-editor` | `{ group: IPermissionGroup }` | A new permission group was created |
| `group-updated` | `alx-permission-group-editor` | `{ group: IPermissionGroup }` | A permission group's entries were updated |
| `group-deleted` | `alx-permission-group-editor` | `{ groupId: string }` | A permission group was deleted |
| `setup-complete` | `alx-staff-setup` | `{ staff: IStaff, token: string }` | Initial owner setup completed |

## Theming

All components share a set of CSS custom properties defined on `:host`. Override them to match your design system:

```css
alx-staff-list {
  --alx-bg: #0f1117;
  --alx-surface: #181a20;
  --alx-surface-alt: #1e2028;
  --alx-border: #2a2d37;
  --alx-text: #e1e4ea;
  --alx-text-muted: #8b8fa3;
  --alx-primary: #6366f1;
  --alx-success: #22c55e;
  --alx-danger: #ef4444;
  --alx-warning: #f59e0b;
  --alx-info: #3b82f6;
  --alx-radius: 6px;
  --alx-font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
}
```

### Compact density

Apply the `density="compact"` attribute to reduce padding and font size for tighter layouts:

```html
<alx-staff-list density="compact"></alx-staff-list>
```

## Links

- [GitHub](https://github.com/Hariprakash1997/astralib/tree/main/packages/staff/staff-ui)
- [staff-engine](https://github.com/Hariprakash1997/astralib/tree/main/packages/staff/staff-engine)
- [CHANGELOG](https://github.com/Hariprakash1997/astralib/blob/main/packages/staff/staff-ui/CHANGELOG.md)

## License

MIT
