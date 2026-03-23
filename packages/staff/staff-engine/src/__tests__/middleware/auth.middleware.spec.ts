import { describe, it, expect, beforeEach, vi } from 'vitest';
import jwt from 'jsonwebtoken';
import { createAuthMiddleware } from '../../middleware/auth.middleware.js';
import type { AuthenticatedRequest } from '../../middleware/auth.middleware.js';
import { ERROR_CODE, ERROR_MESSAGE } from '../../constants/index.js';

// --- Mocks ---

vi.mock('jsonwebtoken', async () => {
  const actual = await vi.importActual<typeof import('jsonwebtoken')>('jsonwebtoken');

  class TokenExpiredError extends Error {
    expiredAt: Date;
    constructor(message: string, expiredAt: Date) {
      super(message);
      this.name = 'TokenExpiredError';
      this.expiredAt = expiredAt;
    }
  }

  class JsonWebTokenError extends Error {
    constructor(message: string) {
      super(message);
      this.name = 'JsonWebTokenError';
    }
  }

  return {
    ...actual,
    default: {
      ...actual,
      verify: vi.fn(),
      TokenExpiredError,
      JsonWebTokenError,
    },
    TokenExpiredError,
    JsonWebTokenError,
  };
});

const JWT_SECRET = 'test-secret';

function makeStaffModel(staffDoc: Record<string, unknown> | null = null) {
  return {
    findOne: vi.fn().mockReturnValue({
      select: vi.fn().mockReturnValue({
        lean: vi.fn().mockResolvedValue(staffDoc),
      }),
    }),
  } as any;
}

function makePermissionCache(permissions: string[] = []) {
  return {
    get: vi.fn().mockResolvedValue(permissions),
    invalidate: vi.fn(),
    invalidateAll: vi.fn(),
  } as any;
}

const noopLogger = { info: vi.fn(), warn: vi.fn(), error: vi.fn() };

function makeRes() {
  const res: any = {};
  res.status = vi.fn().mockReturnValue(res);
  res.json = vi.fn().mockReturnValue(res);
  return res;
}

function makeReq(overrides: Record<string, unknown> = {}): any {
  return {
    headers: {},
    ...overrides,
  };
}

const next = vi.fn();

describe('createAuthMiddleware', () => {
  let jwtVerify: ReturnType<typeof vi.fn>;

  beforeEach(() => {
    vi.clearAllMocks();
    jwtVerify = (jwt as any).verify as ReturnType<typeof vi.fn>;
  });

  // -------------------------
  // verifyToken
  // -------------------------

  describe('verifyToken', () => {
    it('valid token → attaches user to req and calls next', async () => {
      const staffModel = makeStaffModel({ status: 'active', role: 'staff', name: 'Alice', email: 'alice@test.com' });
      const permCache = makePermissionCache(['chat:view']);
      const { verifyToken } = createAuthMiddleware(JWT_SECRET, permCache, staffModel, noopLogger);

      jwtVerify.mockReturnValue({ staffId: 'staff1', role: 'staff' });

      const req = makeReq({ headers: { authorization: 'Bearer valid.token.here' } });
      const res = makeRes();

      await verifyToken(req, res, next);

      expect(next).toHaveBeenCalledOnce();
      expect((req as AuthenticatedRequest).user).toEqual({
        staffId: 'staff1',
        name: 'Alice',
        email: 'alice@test.com',
        role: 'staff',
        permissions: ['chat:view'],
      });
      expect(res.status).not.toHaveBeenCalled();
    });

    it('missing Authorization header → 401 TokenInvalid', async () => {
      const { verifyToken } = createAuthMiddleware(JWT_SECRET, makePermissionCache(), makeStaffModel(), noopLogger);

      const req = makeReq();
      const res = makeRes();

      await verifyToken(req, res, next);

      expect(res.status).toHaveBeenCalledWith(401);
      expect(res.json).toHaveBeenCalledWith(
        expect.objectContaining({ code: ERROR_CODE.TokenInvalid }),
      );
      expect(next).not.toHaveBeenCalled();
    });

    it('expired token → 401 TokenExpired (distinct from invalid)', async () => {
      const { verifyToken } = createAuthMiddleware(JWT_SECRET, makePermissionCache(), makeStaffModel(), noopLogger);

      const TokenExpiredError = (jwt as any).TokenExpiredError;
      jwtVerify.mockImplementation(() => {
        throw new TokenExpiredError('jwt expired', new Date());
      });

      const req = makeReq({ headers: { authorization: 'Bearer expired.token' } });
      const res = makeRes();

      await verifyToken(req, res, next);

      expect(res.status).toHaveBeenCalledWith(401);
      expect(res.json).toHaveBeenCalledWith(
        expect.objectContaining({ code: ERROR_CODE.TokenExpired }),
      );
      expect(next).not.toHaveBeenCalled();
    });

    it('invalid/malformed token → 401 TokenInvalid', async () => {
      const { verifyToken } = createAuthMiddleware(JWT_SECRET, makePermissionCache(), makeStaffModel(), noopLogger);

      jwtVerify.mockImplementation(() => {
        throw new Error('invalid signature');
      });

      const req = makeReq({ headers: { authorization: 'Bearer bad.token' } });
      const res = makeRes();

      await verifyToken(req, res, next);

      expect(res.status).toHaveBeenCalledWith(401);
      expect(res.json).toHaveBeenCalledWith(
        expect.objectContaining({ code: ERROR_CODE.TokenInvalid }),
      );
      expect(next).not.toHaveBeenCalled();
    });

    it('valid token but staff not found in DB → 401', async () => {
      const staffModel = makeStaffModel(null); // null = not found
      const { verifyToken } = createAuthMiddleware(JWT_SECRET, makePermissionCache(), staffModel, noopLogger);

      jwtVerify.mockReturnValue({ staffId: 'missing', role: 'staff' });

      const req = makeReq({ headers: { authorization: 'Bearer valid.token' } });
      const res = makeRes();

      await verifyToken(req, res, next);

      expect(res.status).toHaveBeenCalledWith(401);
      expect(next).not.toHaveBeenCalled();
    });

    it('valid token but staff inactive → 401', async () => {
      const staffModel = makeStaffModel({ status: 'inactive', role: 'staff' });
      const { verifyToken } = createAuthMiddleware(JWT_SECRET, makePermissionCache(), staffModel, noopLogger);

      jwtVerify.mockReturnValue({ staffId: 'staff1', role: 'staff' });

      const req = makeReq({ headers: { authorization: 'Bearer valid.token' } });
      const res = makeRes();

      await verifyToken(req, res, next);

      expect(res.status).toHaveBeenCalledWith(401);
      expect(next).not.toHaveBeenCalled();
    });
  });

  // -------------------------
  // resolveStaff
  // -------------------------

  describe('resolveStaff', () => {
    it('valid token → returns StaffUser object', async () => {
      const staffModel = makeStaffModel({ status: 'active', role: 'owner', name: 'Boss', email: 'boss@test.com' });
      const permCache = makePermissionCache(['reports:view']);
      const { resolveStaff } = createAuthMiddleware(JWT_SECRET, permCache, staffModel, noopLogger);

      jwtVerify.mockReturnValue({ staffId: 'owner1', role: 'owner' });

      const user = await resolveStaff('valid.token');

      expect(user).toEqual({
        staffId: 'owner1',
        name: 'Boss',
        email: 'boss@test.com',
        role: 'owner',
        permissions: ['reports:view'],
      });
    });

    it('invalid token → returns null', async () => {
      const { resolveStaff } = createAuthMiddleware(JWT_SECRET, makePermissionCache(), makeStaffModel(), noopLogger);

      jwtVerify.mockImplementation(() => {
        throw new Error('invalid');
      });

      const user = await resolveStaff('bad.token');

      expect(user).toBeNull();
    });
  });

  // -------------------------
  // requirePermission
  // -------------------------

  describe('requirePermission', () => {
    function makeAuthedReq(role: string, permissions: string[]): any {
      return {
        headers: {},
        user: { staffId: 'u1', role, permissions },
      };
    }

    it('user has all required permissions → calls next', () => {
      const { requirePermission } = createAuthMiddleware(JWT_SECRET, makePermissionCache(), makeStaffModel(), noopLogger);

      const req = makeAuthedReq('staff', ['chat:view', 'chat:edit']);
      const res = makeRes();

      requirePermission('chat:view')(req, res, next);

      expect(next).toHaveBeenCalledOnce();
      expect(res.status).not.toHaveBeenCalled();
    });

    it('user missing a permission → 403 with missing keys', () => {
      const { requirePermission } = createAuthMiddleware(JWT_SECRET, makePermissionCache(), makeStaffModel(), noopLogger);

      const req = makeAuthedReq('staff', ['chat:view']);
      const res = makeRes();

      requirePermission('reports:view')(req, res, next);

      expect(res.status).toHaveBeenCalledWith(403);
      expect(res.json).toHaveBeenCalledWith(
        expect.objectContaining({
          code: ERROR_CODE.InsufficientPermissions,
          missing: ['reports:view'],
        }),
      );
      expect(next).not.toHaveBeenCalled();
    });

    it('edit key present but view key missing → 403 (cascade)', () => {
      const { requirePermission } = createAuthMiddleware(JWT_SECRET, makePermissionCache(), makeStaffModel(), noopLogger);

      // user has chat:edit but NOT chat:view
      const req = makeAuthedReq('staff', ['chat:edit']);
      const res = makeRes();

      requirePermission('chat:edit')(req, res, next);

      expect(res.status).toHaveBeenCalledWith(403);
      expect(res.json).toHaveBeenCalledWith(
        expect.objectContaining({
          missing: expect.arrayContaining(['chat:view']),
        }),
      );
      expect(next).not.toHaveBeenCalled();
    });

    it('owner bypasses all permission checks → calls next', () => {
      const { requirePermission } = createAuthMiddleware(JWT_SECRET, makePermissionCache(), makeStaffModel(), noopLogger);

      // Owner has no explicit permissions but should bypass
      const req = makeAuthedReq('owner', []);
      const res = makeRes();

      requirePermission('reports:view', 'billing:edit')(req, res, next);

      expect(next).toHaveBeenCalledOnce();
      expect(res.status).not.toHaveBeenCalled();
    });
  });

  // -------------------------
  // ownerOnly
  // -------------------------

  describe('ownerOnly', () => {
    it('owner → calls next', () => {
      const { ownerOnly } = createAuthMiddleware(JWT_SECRET, makePermissionCache(), makeStaffModel(), noopLogger);

      const req: any = { headers: {}, user: { staffId: 'o1', role: 'owner', permissions: [] } };
      const res = makeRes();

      ownerOnly(req, res, next);

      expect(next).toHaveBeenCalledOnce();
      expect(res.status).not.toHaveBeenCalled();
    });

    it('staff → 403', () => {
      const { ownerOnly } = createAuthMiddleware(JWT_SECRET, makePermissionCache(), makeStaffModel(), noopLogger);

      const req: any = { headers: {}, user: { staffId: 's1', role: 'staff', permissions: [] } };
      const res = makeRes();

      ownerOnly(req, res, next);

      expect(res.status).toHaveBeenCalledWith(403);
      expect(res.json).toHaveBeenCalledWith(
        expect.objectContaining({ code: ERROR_CODE.OwnerOnly }),
      );
      expect(next).not.toHaveBeenCalled();
    });
  });

  // -------------------------
  // requireRole
  // -------------------------

  describe('requireRole', () => {
    it('matching role → calls next', () => {
      const { requireRole } = createAuthMiddleware(JWT_SECRET, makePermissionCache(), makeStaffModel(), noopLogger);

      const req: any = { headers: {}, user: { staffId: 's1', role: 'staff', permissions: [] } };
      const res = makeRes();

      requireRole('staff', 'owner')(req, res, next);

      expect(next).toHaveBeenCalledOnce();
      expect(res.status).not.toHaveBeenCalled();
    });

    it('non-matching role → 403', () => {
      const { requireRole } = createAuthMiddleware(JWT_SECRET, makePermissionCache(), makeStaffModel(), noopLogger);

      const req: any = { headers: {}, user: { staffId: 's1', role: 'staff', permissions: [] } };
      const res = makeRes();

      requireRole('owner')(req, res, next);

      expect(res.status).toHaveBeenCalledWith(403);
      expect(res.json).toHaveBeenCalledWith(
        expect.objectContaining({ code: ERROR_CODE.InsufficientPermissions }),
      );
      expect(next).not.toHaveBeenCalled();
    });
  });
});
