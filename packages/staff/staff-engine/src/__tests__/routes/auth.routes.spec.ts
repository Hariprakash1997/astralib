import { describe, it, expect, vi, beforeEach } from 'vitest';
import type { Request, Response, NextFunction } from 'express';
import { createAuthRoutes } from '../../routes/auth.routes.js';
import {
  AuthenticationError, SetupError, RateLimitError, StaffNotFoundError,
} from '../../errors/index.js';

// ─── Helpers ─────────────────────────────────────────────────────────────────

const noopLogger = { info: vi.fn(), warn: vi.fn(), error: vi.fn() };

function makeRes() {
  const res = {
    status: vi.fn().mockReturnThis(),
    json: vi.fn().mockReturnThis(),
    set: vi.fn().mockReturnThis(),
  };
  return res as unknown as Response;
}

function makeReq(overrides: Partial<Request> = {}): Request {
  return {
    body: {},
    query: {},
    params: {},
    headers: {},
    ip: '127.0.0.1',
    socket: { remoteAddress: '127.0.0.1' },
    ...overrides,
  } as unknown as Request;
}

const noopNext: NextFunction = vi.fn();

function makeAuth(userOverride?: Record<string, unknown>) {
  return {
    verifyToken: vi.fn((req: Request, res: Response, next: NextFunction) => {
      (req as any).user = userOverride ?? { staffId: 'staff-1', role: 'staff', permissions: ['module:view'] };
      next();
    }),
    ownerOnly: vi.fn((_req: Request, _res: Response, next: NextFunction) => next()),
    requirePermission: vi.fn(() => (_req: Request, _res: Response, next: NextFunction) => next()),
    requireRole: vi.fn(() => (_req: Request, _res: Response, next: NextFunction) => next()),
    resolveStaff: vi.fn(),
  };
}

function makeStaffService(overrides: Partial<Record<string, unknown>> = {}) {
  return {
    getById: vi.fn().mockResolvedValue({ _id: 'staff-1', name: 'Owner' }),
    ...overrides,
  } as any;
}

function makeAuthService(overrides: Partial<Record<string, unknown>> = {}) {
  return {
    setupOwner: vi.fn().mockResolvedValue({ staff: { _id: 'staff-1', name: 'Owner' }, token: 'tok' }),
    login: vi.fn().mockResolvedValue({ staff: { _id: 'staff-1', name: 'Owner' }, token: 'tok' }),
    changeOwnPassword: vi.fn().mockResolvedValue(undefined),
    ...overrides,
  } as any;
}

// ─── Helper to invoke a route handler ────────────────────────────────────────

async function invokeRoute(
  router: ReturnType<typeof createAuthRoutes>,
  method: string,
  path: string,
  req: Request,
  res: Response,
): Promise<void> {
  return new Promise((resolve) => {
    (router as any).handle({ ...req, method: method.toUpperCase(), url: path, path }, res, () => resolve());
    // Allow async handlers to settle
    setTimeout(resolve, 50);
  });
}

// ─── Tests ────────────────────────────────────────────────────────────────────

describe('createAuthRoutes', () => {
  let res: Response;

  beforeEach(() => {
    res = makeRes();
    vi.clearAllMocks();
  });

  describe('POST /setup', () => {
    it('returns 201 with staff and token on success', async () => {
      const staffService = makeStaffService();
      const authService = makeAuthService();
      const auth = makeAuth();
      const router = createAuthRoutes(staffService, authService, auth, noopLogger, false);

      const req = makeReq({ body: { name: 'Owner', email: 'owner@x.com', password: 'Pass1!' } });
      await invokeRoute(router, 'POST', '/setup', req, res);

      expect(authService.setupOwner).toHaveBeenCalledWith({ name: 'Owner', email: 'owner@x.com', password: 'Pass1!' });
      expect(res.status).toHaveBeenCalledWith(201);
    });

    it('returns 403 when setup already complete', async () => {
      const staffService = makeStaffService();
      const authService = makeAuthService({
        setupOwner: vi.fn().mockRejectedValue(new SetupError()),
      });
      const auth = makeAuth();
      const router = createAuthRoutes(staffService, authService, auth, noopLogger, false);

      const req = makeReq({ body: { name: 'Owner', email: 'o@x.com', password: 'p' } });
      await invokeRoute(router, 'POST', '/setup', req, res);

      expect(res.status).toHaveBeenCalledWith(403);
    });
  });

  describe('POST /login', () => {
    it('returns 200 with staff and token on valid credentials', async () => {
      const staffService = makeStaffService();
      const authService = makeAuthService();
      const auth = makeAuth();
      const router = createAuthRoutes(staffService, authService, auth, noopLogger, false);

      const req = makeReq({ body: { email: 'owner@x.com', password: 'Pass1!' } });
      await invokeRoute(router, 'POST', '/login', req, res);

      expect(authService.login).toHaveBeenCalledWith('owner@x.com', 'Pass1!', '127.0.0.1');
      expect(res.status).toHaveBeenCalledWith(200);
    });

    it('returns 401 on invalid credentials', async () => {
      const staffService = makeStaffService();
      const authService = makeAuthService({
        login: vi.fn().mockRejectedValue(new AuthenticationError()),
      });
      const auth = makeAuth();
      const router = createAuthRoutes(staffService, authService, auth, noopLogger, false);

      const req = makeReq({ body: { email: 'owner@x.com', password: 'wrong' } });
      await invokeRoute(router, 'POST', '/login', req, res);

      expect(res.status).toHaveBeenCalledWith(401);
    });

    it('returns 429 with Retry-After header on rate limit', async () => {
      const staffService = makeStaffService();
      const authService = makeAuthService({
        login: vi.fn().mockRejectedValue(new RateLimitError(10000)),
      });
      const auth = makeAuth();
      const router = createAuthRoutes(staffService, authService, auth, noopLogger, false);

      const req = makeReq({ body: { email: 'owner@x.com', password: 'p' } });
      await invokeRoute(router, 'POST', '/login', req, res);

      expect(res.set).toHaveBeenCalledWith('Retry-After', '10');
      expect(res.status).toHaveBeenCalledWith(429);
    });
  });

  describe('GET /me', () => {
    it('returns current staff profile with permissions', async () => {
      const staffDoc = { _id: 'staff-1', name: 'Alice' };
      const staffService = makeStaffService({
        getById: vi.fn().mockResolvedValue(staffDoc),
      });
      const authService = makeAuthService();
      const auth = makeAuth({ staffId: 'staff-1', role: 'staff', permissions: ['module:view'] });
      const router = createAuthRoutes(staffService, authService, auth, noopLogger, false);

      const req = makeReq();
      await invokeRoute(router, 'GET', '/me', req, res);

      expect(staffService.getById).toHaveBeenCalledWith('staff-1');
      expect(res.status).toHaveBeenCalledWith(200);
    });

    it('returns 404 when staff not found', async () => {
      const staffService = makeStaffService({
        getById: vi.fn().mockRejectedValue(new StaffNotFoundError('staff-1')),
      });
      const authService = makeAuthService();
      const auth = makeAuth();
      const router = createAuthRoutes(staffService, authService, auth, noopLogger, false);

      const req = makeReq();
      await invokeRoute(router, 'GET', '/me', req, res);

      expect(res.status).toHaveBeenCalledWith(404);
    });
  });

  describe('PUT /me/password', () => {
    it('is not registered when allowSelfPasswordChange is false', () => {
      const staffService = makeStaffService();
      const authService = makeAuthService();
      const auth = makeAuth();
      const router = createAuthRoutes(staffService, authService, auth, noopLogger, false);

      // Check that the route does not exist in the router stack
      const stack = (router as any).stack as Array<{ route?: { path: string; methods: Record<string, boolean> } }>;
      const hasPasswordRoute = stack.some(
        (layer) => layer.route?.path === '/me/password',
      );
      expect(hasPasswordRoute).toBe(false);
    });

    it('is registered when allowSelfPasswordChange is true', () => {
      const staffService = makeStaffService();
      const authService = makeAuthService();
      const auth = makeAuth();
      const router = createAuthRoutes(staffService, authService, auth, noopLogger, true);

      const stack = (router as any).stack as Array<{ route?: { path: string; methods: Record<string, boolean> } }>;
      const hasPasswordRoute = stack.some(
        (layer) => layer.route?.path === '/me/password',
      );
      expect(hasPasswordRoute).toBe(true);
    });

    it('changes password on success when enabled', async () => {
      const staffService = makeStaffService();
      const authService = makeAuthService();
      const auth = makeAuth({ staffId: 'staff-1', role: 'staff', permissions: [] });
      const router = createAuthRoutes(staffService, authService, auth, noopLogger, true);

      const req = makeReq({ body: { oldPassword: 'old', newPassword: 'new' } });
      await invokeRoute(router, 'PUT', '/me/password', req, res);

      expect(authService.changeOwnPassword).toHaveBeenCalledWith('staff-1', 'old', 'new');
      expect(res.status).toHaveBeenCalledWith(200);
    });
  });
});
