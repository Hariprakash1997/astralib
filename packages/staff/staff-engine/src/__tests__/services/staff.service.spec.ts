import { describe, it, expect, vi } from 'vitest';
import { StaffService } from '../../services/staff.service.js';
import {
  DuplicateError, StaffNotFoundError,
  LastOwnerError, InvalidPermissionError,
} from '../../errors/index.js';

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

function makeService(overrides: {
  Staff?: any;
  PermissionGroup?: any;
  adapters?: any;
  hooks?: any;
  permissionCache?: any;
  requireEmailUniqueness?: boolean;
  tenantId?: string;
} = {}) {
  return new StaffService({
    Staff: overrides.Staff ?? makeStaffModel(),
    PermissionGroup: overrides.PermissionGroup ?? makePermissionGroupModel(),
    adapters: overrides.adapters ?? makeAdapters(),
    hooks: overrides.hooks ?? makeHooks(),
    permissionCache: overrides.permissionCache ?? makePermissionCache(),
    logger: noopLogger,
    requireEmailUniqueness: overrides.requireEmailUniqueness ?? true,
    tenantId: overrides.tenantId,
  });
}

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

    expect(result.staff).toHaveLength(1);
    expect(result.total).toBe(1);
    expect(result.page).toBe(1);
    expect(result.limit).toBe(10);
    expect(result.totalPages).toBe(1);
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
