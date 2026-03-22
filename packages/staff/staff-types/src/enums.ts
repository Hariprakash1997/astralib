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
