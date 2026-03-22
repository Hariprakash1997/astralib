import { describe, it, expect, vi, beforeEach } from 'vitest';
import type { Request, Response, NextFunction } from 'express';
import { createPermissionGroupRoutes } from '../../routes/permission-group.routes.js';
import { GroupNotFoundError, DuplicateError } from '../../errors/index.js';
import { ERROR_CODE } from '../../constants/index.js';

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
    ...overrides,
  } as unknown as Request;
}

function makeAuth() {
  return {
    verifyToken: vi.fn((_req: Request, _res: Response, next: NextFunction) => next()),
    ownerOnly: vi.fn((_req: Request, _res: Response, next: NextFunction) => next()),
    requirePermission: vi.fn(() => (_req: Request, _res: Response, next: NextFunction) => next()),
    requireRole: vi.fn(() => (_req: Request, _res: Response, next: NextFunction) => next()),
    resolveStaff: vi.fn(),
  };
}

function makePermissionService(overrides: Partial<Record<string, unknown>> = {}) {
  const groupDoc = { groupId: 'grp-1', name: 'Admin', permissions: [] };
  return {
    listGroups: vi.fn().mockResolvedValue([groupDoc]),
    createGroup: vi.fn().mockResolvedValue(groupDoc),
    updateGroup: vi.fn().mockResolvedValue(groupDoc),
    deleteGroup: vi.fn().mockResolvedValue(undefined),
    ...overrides,
  } as any;
}

async function invokeRoute(
  router: ReturnType<typeof createPermissionGroupRoutes>,
  method: string,
  path: string,
  req: Request,
  res: Response,
): Promise<void> {
  return new Promise((resolve) => {
    (router as any).handle({ ...req, method: method.toUpperCase(), url: path, path }, res, () => resolve());
    setTimeout(resolve, 50);
  });
}

// ─── Tests ────────────────────────────────────────────────────────────────────

describe('createPermissionGroupRoutes', () => {
  let res: Response;

  beforeEach(() => {
    res = makeRes();
    vi.clearAllMocks();
  });

  describe('GET /', () => {
    it('lists groups and returns 200', async () => {
      const permissionService = makePermissionService();
      const auth = makeAuth();
      const router = createPermissionGroupRoutes(permissionService, auth, noopLogger);

      const req = makeReq();
      await invokeRoute(router, 'GET', '/', req, res);

      expect(auth.verifyToken).toHaveBeenCalled();
      expect(permissionService.listGroups).toHaveBeenCalled();
      expect(res.status).toHaveBeenCalledWith(200);
    });
  });

  describe('POST /', () => {
    it('creates group and returns 201', async () => {
      const permissionService = makePermissionService();
      const auth = makeAuth();
      const router = createPermissionGroupRoutes(permissionService, auth, noopLogger);

      const req = makeReq({ body: { groupId: 'grp-1', name: 'Admin', permissions: [] } });
      await invokeRoute(router, 'POST', '/', req, res);

      expect(auth.verifyToken).toHaveBeenCalled();
      expect(auth.ownerOnly).toHaveBeenCalled();
      expect(permissionService.createGroup).toHaveBeenCalledWith(req.body);
      expect(res.status).toHaveBeenCalledWith(201);
    });

    it('returns 409 on duplicate groupId', async () => {
      const permissionService = makePermissionService({
        createGroup: vi.fn().mockRejectedValue(
          new DuplicateError(ERROR_CODE.GroupIdExists, 'group id exists'),
        ),
      });
      const auth = makeAuth();
      const router = createPermissionGroupRoutes(permissionService, auth, noopLogger);

      const req = makeReq({ body: { groupId: 'grp-1', name: 'Admin', permissions: [] } });
      await invokeRoute(router, 'POST', '/', req, res);

      expect(res.status).toHaveBeenCalledWith(409);
    });
  });

  describe('PUT /:groupId', () => {
    it('updates group and returns 200', async () => {
      const permissionService = makePermissionService();
      const auth = makeAuth();
      const router = createPermissionGroupRoutes(permissionService, auth, noopLogger);

      const req = makeReq({
        params: { groupId: 'grp-1' } as any,
        body: { name: 'Super Admin' },
      });
      await invokeRoute(router, 'PUT', '/grp-1', req, res);

      expect(permissionService.updateGroup).toHaveBeenCalledWith('grp-1', { name: 'Super Admin' });
      expect(res.status).toHaveBeenCalledWith(200);
    });

    it('returns 404 when group not found', async () => {
      const permissionService = makePermissionService({
        updateGroup: vi.fn().mockRejectedValue(new GroupNotFoundError('grp-1')),
      });
      const auth = makeAuth();
      const router = createPermissionGroupRoutes(permissionService, auth, noopLogger);

      const req = makeReq({
        params: { groupId: 'grp-1' } as any,
        body: { name: 'Super Admin' },
      });
      await invokeRoute(router, 'PUT', '/grp-1', req, res);

      expect(res.status).toHaveBeenCalledWith(404);
    });
  });

  describe('DELETE /:groupId', () => {
    it('deletes group and returns 200', async () => {
      const permissionService = makePermissionService();
      const auth = makeAuth();
      const router = createPermissionGroupRoutes(permissionService, auth, noopLogger);

      const req = makeReq({ params: { groupId: 'grp-1' } as any });
      await invokeRoute(router, 'DELETE', '/grp-1', req, res);

      expect(auth.verifyToken).toHaveBeenCalled();
      expect(auth.ownerOnly).toHaveBeenCalled();
      expect(permissionService.deleteGroup).toHaveBeenCalledWith('grp-1');
      expect(res.status).toHaveBeenCalledWith(200);
    });

    it('returns 404 when group not found', async () => {
      const permissionService = makePermissionService({
        deleteGroup: vi.fn().mockRejectedValue(new GroupNotFoundError('grp-1')),
      });
      const auth = makeAuth();
      const router = createPermissionGroupRoutes(permissionService, auth, noopLogger);

      const req = makeReq({ params: { groupId: 'grp-1' } as any });
      await invokeRoute(router, 'DELETE', '/grp-1', req, res);

      expect(res.status).toHaveBeenCalledWith(404);
    });
  });
});
