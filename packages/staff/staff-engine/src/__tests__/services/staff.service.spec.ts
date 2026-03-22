import { describe, it, expect, beforeEach, vi } from 'vitest';
import { StaffService } from '../../services/staff.service.js';
import {
  AuthenticationError, DuplicateError, StaffNotFoundError,
  LastOwnerError, SetupError, RateLimitError, InvalidPermissionError,
} from '../../errors/index.js';
import { ERROR_CODE } from '../../constants/index.js';

// ─── Helpers ────────────────────────────────────────────────────────────────

const noopLogger = { info: vi.fn(), warn: vi.fn(), error: vi.fn() };

function makeStaffDoc(overrides: Record<string, unknown> = {}) {
  const doc = {
    _id: { toString: () => 'staff-id-1' },
    name: 'Alice',
    email: 'alice@example.com',
    password: 'hashed',
    role: 'staff',
    status: 'active',
    permissions: [] as string[],
    lastLoginAt: null as Date | null,
    lastLoginIp: null as string | null,
    save: vi.fn().mockResolvedValue(undefined),
    toObject: vi.fn().mockReturnThis(),
    ...overrides,
  };
  doc.toObject = vi.fn().mockReturnValue({ ...doc });
  return doc;
}

function makeOwnerDoc(overrides: Record<string, unknown> = {}) {
  return makeStaffDoc({ role: 'owner', ...overrides });
}

function makeStaffModel(defaultDoc?: ReturnType<typeof makeStaffDoc>) {
  const doc = defaultDoc ?? makeStaffDoc();
  return {
    findOne: vi.fn().mockReturnValue({
      select: vi.fn().mockResolvedValue(doc),
      lean: vi.fn().mockResolvedValue(doc),
    }),
    findOneAndUpdate: vi.fn().mockReturnValue({
      lean: vi.fn().mockResolvedValue(doc),
    }),
    countDocuments: vi.fn().mockResolvedValue(2),
    find: vi.fn().mockReturnValue({
      sort: vi.fn().mockReturnThis(),
      skip: vi.fn().mockReturnThis(),
      limit: vi.fn().mockReturnThis(),
      lean: vi.fn().mockResolvedValue([doc]),
    }),
    create: vi.fn().mockResolvedValue(doc),
  } as any;
}

function makePermissionGroupModel(groups: unknown[] = []) {
  return {
    find: vi.fn().mockReturnValue({
      lean: vi.fn().mockResolvedValue(groups),
    }),
  } as any;
}

function makeAdapters() {
  return {
    hashPassword: vi.fn().mockResolvedValue('hashed'),
    comparePassword: vi.fn().mockResolvedValue(true),
  };
}

function makeHooks() {
  return {
    onStaffCreated: vi.fn(),
    onLogin: vi.fn(),
    onLoginFailed: vi.fn(),
    onPermissionsChanged: vi.fn(),
    onStatusChanged: vi.fn(),
    onMetric: vi.fn(),
  };
}

function makePermissionCache() {
  return {
    get: vi.fn(),
    invalidate: vi.fn().mockResolvedValue(undefined),
    invalidateAll: vi.fn().mockResolvedValue(undefined),
  };
}

function makeRateLimiter() {
  return {
    checkLimit: vi.fn().mockResolvedValue({ allowed: true, remaining: 5 }),
    recordAttempt: vi.fn().mockResolvedValue(undefined),
    reset: vi.fn().mockResolvedValue(undefined),
  };
}

function makeService(overrides: {
  Staff?: any;
  PermissionGroup?: any;
  adapters?: any;
  hooks?: any;
  permissionCache?: any;
  rateLimiter?: any;
  allowSelfPasswordChange?: boolean;
  requireEmailUniqueness?: boolean;
  tenantId?: string;
} = {}) {
  return new StaffService({
    Staff: overrides.Staff ?? makeStaffModel(),
    PermissionGroup: overrides.PermissionGroup ?? makePermissionGroupModel(),
    adapters: overrides.adapters ?? makeAdapters(),
    hooks: overrides.hooks ?? makeHooks(),
    permissionCache: overrides.permissionCache ?? makePermissionCache(),
    rateLimiter: overrides.rateLimiter ?? makeRateLimiter(),
    logger: noopLogger,
    jwtSecret: 'test-secret',
    staffTokenExpiry: '24h',
    ownerTokenExpiry: '30d',
    requireEmailUniqueness: overrides.requireEmailUniqueness ?? true,
    allowSelfPasswordChange: overrides.allowSelfPasswordChange ?? true,
    tenantId: overrides.tenantId,
  });
}

// ─── setupOwner ─────────────────────────────────────────────────────────────

describe('StaffService.setupOwner', () => {
  it('creates owner and returns token when no staff exist', async () => {
    const ownerDoc = makeOwnerDoc();
    const Staff = {
      ...makeStaffModel(ownerDoc),
      countDocuments: vi.fn().mockResolvedValue(0),
      create: vi.fn().mockResolvedValue(ownerDoc),
    };
    const hooks = makeHooks();
    const service = makeService({ Staff, hooks });

    const result = await service.setupOwner({ name: 'Owner', email: 'owner@x.com', password: 'pass' });

    expect(result.token).toBeDefined();
    expect(typeof result.token).toBe('string');
    expect(Staff.create).toHaveBeenCalledOnce();
    expect(hooks.onStaffCreated).toHaveBeenCalledOnce();
    expect(hooks.onMetric).toHaveBeenCalledWith({ name: 'staff_setup_complete', value: 1 });
  });

  it('throws SetupError if staff already exist', async () => {
    const Staff = {
      ...makeStaffModel(),
      countDocuments: vi.fn().mockResolvedValue(1),
    };
    const service = makeService({ Staff });

    await expect(service.setupOwner({ name: 'Owner', email: 'owner@x.com', password: 'pass' }))
      .rejects.toBeInstanceOf(SetupError);
  });

  it('throws SetupError on duplicate key race condition', async () => {
    const Staff = {
      ...makeStaffModel(),
      countDocuments: vi.fn().mockResolvedValue(0),
      create: vi.fn().mockRejectedValue({ code: 11000 }),
    };
    const service = makeService({ Staff });

    await expect(service.setupOwner({ name: 'Owner', email: 'owner@x.com', password: 'pass' }))
      .rejects.toBeInstanceOf(SetupError);
  });
});

// ─── login ───────────────────────────────────────────────────────────────────

describe('StaffService.login', () => {
  it('returns token for valid credentials', async () => {
    const staffDoc = makeStaffDoc({ status: 'active' });
    staffDoc.toObject = vi.fn().mockReturnValue({ ...staffDoc, role: 'staff' });
    const Staff = {
      ...makeStaffModel(),
      findOne: vi.fn().mockReturnValue({
        select: vi.fn().mockResolvedValue(staffDoc),
      }),
    };
    const adapters = makeAdapters();
    const service = makeService({ Staff, adapters });

    const result = await service.login('alice@example.com', 'password', '127.0.0.1');

    expect(result.token).toBeDefined();
    expect(adapters.comparePassword).toHaveBeenCalledWith('password', 'hashed');
  });

  it('throws AuthenticationError on wrong password', async () => {
    const staffDoc = makeStaffDoc({ status: 'active' });
    const Staff = {
      ...makeStaffModel(),
      findOne: vi.fn().mockReturnValue({
        select: vi.fn().mockResolvedValue(staffDoc),
      }),
    };
    const adapters = { ...makeAdapters(), comparePassword: vi.fn().mockResolvedValue(false) };
    const service = makeService({ Staff, adapters });

    await expect(service.login('alice@example.com', 'wrong', '127.0.0.1'))
      .rejects.toBeInstanceOf(AuthenticationError);
  });

  it('throws AuthenticationError on nonexistent email', async () => {
    const Staff = {
      ...makeStaffModel(),
      findOne: vi.fn().mockReturnValue({
        select: vi.fn().mockResolvedValue(null),
      }),
    };
    const service = makeService({ Staff });

    await expect(service.login('nobody@example.com', 'pass'))
      .rejects.toBeInstanceOf(AuthenticationError);
  });

  it('throws AuthenticationError with AccountInactive code on inactive account', async () => {
    const staffDoc = makeStaffDoc({ status: 'inactive' });
    staffDoc.toObject = vi.fn().mockReturnValue({ ...staffDoc });
    const Staff = {
      ...makeStaffModel(),
      findOne: vi.fn().mockReturnValue({
        select: vi.fn().mockResolvedValue(staffDoc),
      }),
    };
    const service = makeService({ Staff });

    const err = await service.login('alice@example.com', 'pass').catch(e => e);
    expect(err).toBeInstanceOf(AuthenticationError);
    expect(err.code).toBe(ERROR_CODE.AccountInactive);
  });

  it('throws AuthenticationError with AccountPending code on pending account', async () => {
    const staffDoc = makeStaffDoc({ status: 'pending' });
    staffDoc.toObject = vi.fn().mockReturnValue({ ...staffDoc });
    const Staff = {
      ...makeStaffModel(),
      findOne: vi.fn().mockReturnValue({
        select: vi.fn().mockResolvedValue(staffDoc),
      }),
    };
    const service = makeService({ Staff });

    const err = await service.login('alice@example.com', 'pass').catch(e => e);
    expect(err).toBeInstanceOf(AuthenticationError);
    expect(err.code).toBe(ERROR_CODE.AccountPending);
  });

  it('throws RateLimitError when rate limited', async () => {
    const rateLimiter = {
      ...makeRateLimiter(),
      checkLimit: vi.fn().mockResolvedValue({ allowed: false, remaining: 0, retryAfterMs: 60000 }),
    };
    const service = makeService({ rateLimiter });

    await expect(service.login('alice@example.com', 'pass', '127.0.0.1'))
      .rejects.toBeInstanceOf(RateLimitError);
  });

  it('resets rate limit on successful login', async () => {
    const staffDoc = makeStaffDoc({ status: 'active' });
    staffDoc.toObject = vi.fn().mockReturnValue({ ...staffDoc, role: 'staff' });
    const Staff = {
      ...makeStaffModel(),
      findOne: vi.fn().mockReturnValue({
        select: vi.fn().mockResolvedValue(staffDoc),
      }),
    };
    const rateLimiter = makeRateLimiter();
    const service = makeService({ Staff, rateLimiter });

    await service.login('alice@example.com', 'pass', '127.0.0.1');

    expect(rateLimiter.reset).toHaveBeenCalledWith('127.0.0.1');
  });

  it('calls onLogin and onMetric hooks on success', async () => {
    const staffDoc = makeStaffDoc({ status: 'active' });
    staffDoc.toObject = vi.fn().mockReturnValue({ ...staffDoc, role: 'staff' });
    const Staff = {
      ...makeStaffModel(),
      findOne: vi.fn().mockReturnValue({
        select: vi.fn().mockResolvedValue(staffDoc),
      }),
    };
    const hooks = makeHooks();
    const service = makeService({ Staff, hooks });

    await service.login('alice@example.com', 'pass', '192.168.1.1');

    expect(hooks.onLogin).toHaveBeenCalledOnce();
    expect(hooks.onMetric).toHaveBeenCalledWith(
      expect.objectContaining({ name: 'staff_login', value: 1 }),
    );
  });
});

// ─── create ──────────────────────────────────────────────────────────────────

describe('StaffService.create', () => {
  it('creates staff with hashed password', async () => {
    const staffDoc = makeStaffDoc();
    const Staff = {
      ...makeStaffModel(staffDoc),
      // findOne for duplicate check must resolve to null (no existing staff)
      findOne: vi.fn().mockResolvedValue(null),
      create: vi.fn().mockResolvedValue(staffDoc),
    };
    const adapters = makeAdapters();
    const service = makeService({ Staff, adapters });

    await service.create({ name: 'Bob', email: 'bob@x.com', password: 'secret' });

    expect(adapters.hashPassword).toHaveBeenCalledWith('secret');
    expect(Staff.create).toHaveBeenCalledWith(
      expect.objectContaining({ password: 'hashed' }),
    );
  });

  it('throws DuplicateError on existing email', async () => {
    const existingDoc = makeStaffDoc();
    const Staff = {
      ...makeStaffModel(),
      findOne: vi.fn().mockResolvedValue(existingDoc),
    };
    const service = makeService({ Staff });

    await expect(service.create({ name: 'Bob', email: 'alice@example.com', password: 'pass' }))
      .rejects.toBeInstanceOf(DuplicateError);
  });

  it('calls onStaffCreated hook after creation', async () => {
    const staffDoc = makeStaffDoc();
    const Staff = {
      ...makeStaffModel(staffDoc),
      findOne: vi.fn().mockResolvedValue(null),
      create: vi.fn().mockResolvedValue(staffDoc),
    };
    const hooks = makeHooks();
    const service = makeService({ Staff, hooks });

    await service.create({ name: 'Bob', email: 'bob@x.com', password: 'pass' });

    expect(hooks.onStaffCreated).toHaveBeenCalledOnce();
  });
});

// ─── list ─────────────────────────────────────────────────────────────────────

describe('StaffService.list', () => {
  it('returns paginated results', async () => {
    const staffDoc = makeStaffDoc();
    const Staff = {
      ...makeStaffModel(staffDoc),
      find: vi.fn().mockReturnValue({
        sort: vi.fn().mockReturnThis(),
        skip: vi.fn().mockReturnThis(),
        limit: vi.fn().mockReturnThis(),
        lean: vi.fn().mockResolvedValue([staffDoc]),
      }),
      countDocuments: vi.fn().mockResolvedValue(1),
    };
    const service = makeService({ Staff });

    const result = await service.list({ page: 1, limit: 10 });

    expect(result.data).toHaveLength(1);
    expect(result.pagination.total).toBe(1);
    expect(result.pagination.page).toBe(1);
    expect(result.pagination.limit).toBe(10);
    expect(result.pagination.totalPages).toBe(1);
  });
});

// ─── getById ─────────────────────────────────────────────────────────────────

describe('StaffService.getById', () => {
  it('returns staff document by ID', async () => {
    const staffDoc = makeStaffDoc();
    const Staff = {
      ...makeStaffModel(),
      findOne: vi.fn().mockReturnValue({
        lean: vi.fn().mockResolvedValue(staffDoc),
      }),
    };
    const service = makeService({ Staff });

    const result = await service.getById('staff-id-1');

    expect(result).toBeDefined();
  });

  it('throws StaffNotFoundError when not found', async () => {
    const Staff = {
      ...makeStaffModel(),
      findOne: vi.fn().mockReturnValue({
        lean: vi.fn().mockResolvedValue(null),
      }),
    };
    const service = makeService({ Staff });

    await expect(service.getById('missing-id'))
      .rejects.toBeInstanceOf(StaffNotFoundError);
  });
});

// ─── update ──────────────────────────────────────────────────────────────────

describe('StaffService.update', () => {
  it('updates name, email, and metadata', async () => {
    const updatedDoc = makeStaffDoc({ name: 'Updated Name' });
    const Staff = {
      ...makeStaffModel(),
      findOne: vi.fn().mockResolvedValue(null),
      findOneAndUpdate: vi.fn().mockReturnValue({
        lean: vi.fn().mockResolvedValue(updatedDoc),
      }),
    };
    const service = makeService({ Staff });

    const result = await service.update('staff-id-1', { name: 'Updated Name' });

    expect(result.name).toBe('Updated Name');
  });

  it('throws DuplicateError on email conflict', async () => {
    const conflictDoc = makeStaffDoc({ email: 'other@x.com' });
    const Staff = {
      ...makeStaffModel(),
      findOne: vi.fn().mockResolvedValue(conflictDoc),
    };
    const service = makeService({ Staff });

    await expect(service.update('staff-id-1', { email: 'other@x.com' }))
      .rejects.toBeInstanceOf(DuplicateError);
  });
});

// ─── updatePermissions ────────────────────────────────────────────────────────

describe('StaffService.updatePermissions', () => {
  it('sets permissions and invalidates cache', async () => {
    const staffDoc = makeStaffDoc({ permissions: [] });
    const Staff = {
      ...makeStaffModel(staffDoc),
      findOne: vi.fn().mockResolvedValue(staffDoc),
    };
    const groups = [
      {
        permissions: [
          { key: 'chat:view', label: 'View Chat', type: 'view' },
          { key: 'chat:edit', label: 'Edit Chat', type: 'edit' },
        ],
      },
    ];
    const PermissionGroup = makePermissionGroupModel(groups);
    const permissionCache = makePermissionCache();
    const service = makeService({ Staff, PermissionGroup, permissionCache });

    await service.updatePermissions('staff-id-1', ['chat:view', 'chat:edit']);

    expect(permissionCache.invalidate).toHaveBeenCalledWith('staff-id-1');
  });

  it('throws InvalidPermissionError for edit permission without view', async () => {
    const staffDoc = makeStaffDoc({ permissions: [] });
    const Staff = {
      ...makeStaffModel(staffDoc),
      findOne: vi.fn().mockResolvedValue(staffDoc),
    };
    const groups = [
      {
        permissions: [
          { key: 'chat:view', label: 'View Chat', type: 'view' },
          { key: 'chat:edit', label: 'Edit Chat', type: 'edit' },
        ],
      },
    ];
    const PermissionGroup = makePermissionGroupModel(groups);
    const service = makeService({ Staff, PermissionGroup });

    await expect(service.updatePermissions('staff-id-1', ['chat:edit']))
      .rejects.toBeInstanceOf(InvalidPermissionError);
  });

  it('calls onPermissionsChanged hook', async () => {
    const staffDoc = makeStaffDoc({ permissions: [] });
    const Staff = {
      ...makeStaffModel(staffDoc),
      findOne: vi.fn().mockResolvedValue(staffDoc),
    };
    const PermissionGroup = makePermissionGroupModel([]);
    const hooks = makeHooks();
    const service = makeService({ Staff, PermissionGroup, hooks });

    await service.updatePermissions('staff-id-1', []);

    expect(hooks.onPermissionsChanged).toHaveBeenCalledWith('staff-id-1', [], []);
  });
});

// ─── updateStatus ─────────────────────────────────────────────────────────────

describe('StaffService.updateStatus', () => {
  it('deactivates a staff member', async () => {
    const staffDoc = makeStaffDoc({ status: 'active', role: 'staff' });
    const Staff = {
      ...makeStaffModel(staffDoc),
      findOne: vi.fn().mockResolvedValue(staffDoc),
      countDocuments: vi.fn().mockResolvedValue(2),
    };
    const service = makeService({ Staff });

    await service.updateStatus('staff-id-1', 'inactive');

    expect(staffDoc.save).toHaveBeenCalledOnce();
  });

  it('throws LastOwnerError when deactivating last active owner', async () => {
    const ownerDoc = makeOwnerDoc({ status: 'active' });
    const Staff = {
      ...makeStaffModel(ownerDoc),
      findOne: vi.fn().mockResolvedValue(ownerDoc),
      countDocuments: vi.fn().mockResolvedValue(1),
    };
    const service = makeService({ Staff });

    await expect(service.updateStatus('staff-id-1', 'inactive'))
      .rejects.toBeInstanceOf(LastOwnerError);
  });

  it('calls onStatusChanged hook', async () => {
    const staffDoc = makeStaffDoc({ status: 'active', role: 'staff' });
    const Staff = {
      ...makeStaffModel(staffDoc),
      findOne: vi.fn().mockResolvedValue(staffDoc),
      countDocuments: vi.fn().mockResolvedValue(2),
    };
    const hooks = makeHooks();
    const service = makeService({ Staff, hooks });

    await service.updateStatus('staff-id-1', 'inactive');

    expect(hooks.onStatusChanged).toHaveBeenCalledWith('staff-id-1', 'active', 'inactive');
  });
});

// ─── resetPassword ────────────────────────────────────────────────────────────

describe('StaffService.resetPassword', () => {
  it('hashes new password and saves', async () => {
    const staffDoc = makeStaffDoc();
    const Staff = {
      ...makeStaffModel(staffDoc),
      findOne: vi.fn().mockResolvedValue(staffDoc),
    };
    const adapters = makeAdapters();
    const service = makeService({ Staff, adapters });

    await service.resetPassword('staff-id-1', 'new-pass');

    expect(adapters.hashPassword).toHaveBeenCalledWith('new-pass');
    expect(staffDoc.save).toHaveBeenCalledOnce();
  });
});

// ─── changeOwnPassword ────────────────────────────────────────────────────────

describe('StaffService.changeOwnPassword', () => {
  it('validates old password and saves new hashed password', async () => {
    const staffDoc = makeStaffDoc();
    const Staff = {
      ...makeStaffModel(staffDoc),
      findOne: vi.fn().mockReturnValue({
        select: vi.fn().mockResolvedValue(staffDoc),
      }),
    };
    const adapters = makeAdapters();
    const service = makeService({ Staff, adapters, allowSelfPasswordChange: true });

    await service.changeOwnPassword('staff-id-1', 'old-pass', 'new-pass');

    expect(adapters.comparePassword).toHaveBeenCalledWith('old-pass', 'hashed');
    expect(adapters.hashPassword).toHaveBeenCalledWith('new-pass');
    expect(staffDoc.save).toHaveBeenCalledOnce();
  });

  it('throws AuthenticationError when old password is wrong', async () => {
    const staffDoc = makeStaffDoc();
    const Staff = {
      ...makeStaffModel(staffDoc),
      findOne: vi.fn().mockReturnValue({
        select: vi.fn().mockResolvedValue(staffDoc),
      }),
    };
    const adapters = { ...makeAdapters(), comparePassword: vi.fn().mockResolvedValue(false) };
    const service = makeService({ Staff, adapters, allowSelfPasswordChange: true });

    await expect(service.changeOwnPassword('staff-id-1', 'wrong', 'new'))
      .rejects.toBeInstanceOf(AuthenticationError);
  });

  it('throws AuthenticationError when self password change is disabled', async () => {
    const service = makeService({ allowSelfPasswordChange: false });

    await expect(service.changeOwnPassword('staff-id-1', 'old', 'new'))
      .rejects.toBeInstanceOf(AuthenticationError);
  });
});
