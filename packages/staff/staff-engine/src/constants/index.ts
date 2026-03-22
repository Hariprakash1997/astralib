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
