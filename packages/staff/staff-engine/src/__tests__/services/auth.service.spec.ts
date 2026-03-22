import { describe, it, expect, beforeEach, vi } from 'vitest';
import { AuthService } from '../../services/auth.service.js';
import {
  AuthenticationError, StaffNotFoundError,
  SetupError, RateLimitError,
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
    countDocuments: vi.fn().mockResolvedValue(2),
    create: vi.fn().mockResolvedValue(doc),
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

function makeRateLimiter() {
  return {
    checkLimit: vi.fn().mockResolvedValue({ allowed: true, remaining: 5 }),
    recordAttempt: vi.fn().mockResolvedValue(undefined),
    reset: vi.fn().mockResolvedValue(undefined),
  };
}

function makeService(overrides: {
  Staff?: any;
  adapters?: any;
  hooks?: any;
  rateLimiter?: any;
  allowSelfPasswordChange?: boolean;
  tenantId?: string;
} = {}) {
  return new AuthService({
    Staff: overrides.Staff ?? makeStaffModel(),
    adapters: overrides.adapters ?? makeAdapters(),
    hooks: overrides.hooks ?? makeHooks(),
    rateLimiter: overrides.rateLimiter ?? makeRateLimiter(),
    logger: noopLogger,
    jwtSecret: 'test-secret',
    staffTokenExpiry: '24h',
    ownerTokenExpiry: '30d',
    allowSelfPasswordChange: overrides.allowSelfPasswordChange ?? true,
    tenantId: overrides.tenantId,
  });
}

// ─── setupOwner ─────────────────────────────────────────────────────────────

describe('AuthService.setupOwner', () => {
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

describe('AuthService.login', () => {
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

// ─── resetPassword ────────────────────────────────────────────────────────────

describe('AuthService.resetPassword', () => {
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

describe('AuthService.changeOwnPassword', () => {
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
