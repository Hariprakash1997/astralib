import { describe, it, expect, vi, beforeEach } from 'vitest';
import type { Request, Response } from 'express';
import { createStaffRoutes } from '../../routes/staff.routes.js';
import {
  StaffNotFoundError, DuplicateError, LastOwnerError, InvalidPermissionError,
} from '../../errors/index.js';
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

function makeStaffService(overrides: Partial<Record<string, unknown>> = {}) {
  const staffDoc = { _id: 'staff-1', name: 'Alice', role: 'staff' };
  return {
    list: vi.fn().mockResolvedValue({ items: [staffDoc], total: 1, page: 1, limit: 20 }),
    create: vi.fn().mockResolvedValue(staffDoc),
    update: vi.fn().mockResolvedValue(staffDoc),
    updatePermissions: vi.fn().mockResolvedValue(staffDoc),
    updateStatus: vi.fn().mockResolvedValue(staffDoc),
    resetPassword: vi.fn().mockResolvedValue(undefined),
    ...overrides,
  } as any;
}

async function invokeRoute(
  router: ReturnType<typeof createStaffRoutes>,
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

describe('createStaffRoutes', () => {
  let res: Response;

  beforeEach(() => {
    res = makeRes();
    vi.clearAllMocks();
  });

  describe('GET /', () => {
    it('lists staff and returns 200', async () => {
      const staffService = makeStaffService();
      const router = createStaffRoutes(staffService, noopLogger);

      const req = makeReq({ query: { status: 'active', page: '1', limit: '10' } as any });
      await invokeRoute(router, 'GET', '/', req, res);

      expect(staffService.list).toHaveBeenCalled();
      expect(res.status).toHaveBeenCalledWith(200);
    });
  });

  describe('POST /', () => {
    it('creates staff and returns 201', async () => {
      const staffService = makeStaffService();
      const router = createStaffRoutes(staffService, noopLogger);

      const req = makeReq({ body: { name: 'Bob', email: 'bob@x.com', password: 'Pass1!', role: 'staff' } });
      await invokeRoute(router, 'POST', '/', req, res);

      expect(staffService.create).toHaveBeenCalledWith(req.body);
      expect(res.status).toHaveBeenCalledWith(201);
    });

    it('returns 409 on duplicate email', async () => {
      const staffService = makeStaffService({
        create: vi.fn().mockRejectedValue(new DuplicateError(ERROR_CODE.EmailInUse, 'email in use')),
      });
      const router = createStaffRoutes(staffService, noopLogger);

      const req = makeReq({ body: { name: 'Bob', email: 'bob@x.com', password: 'Pass1!', role: 'staff' } });
      await invokeRoute(router, 'POST', '/', req, res);

      expect(res.status).toHaveBeenCalledWith(409);
    });
  });

  describe('PUT /:staffId', () => {
    it('updates staff and returns 200', async () => {
      const staffService = makeStaffService();
      const router = createStaffRoutes(staffService, noopLogger);

      const req = makeReq({ params: { staffId: 'staff-1' } as any, body: { name: 'Bobby' } });
      await invokeRoute(router, 'PUT', '/staff-1', req, res);

      expect(res.status).toHaveBeenCalledWith(200);
    });

    it('returns 404 when staff not found', async () => {
      const staffService = makeStaffService({
        update: vi.fn().mockRejectedValue(new StaffNotFoundError('staff-1')),
      });
      const router = createStaffRoutes(staffService, noopLogger);

      const req = makeReq({ params: { staffId: 'staff-1' } as any, body: { name: 'Bobby' } });
      await invokeRoute(router, 'PUT', '/staff-1', req, res);

      expect(res.status).toHaveBeenCalledWith(404);
    });
  });

  describe('PUT /:staffId/permissions', () => {
    it('updates permissions and returns 200', async () => {
      const staffService = makeStaffService();
      const router = createStaffRoutes(staffService, noopLogger);

      const req = makeReq({
        params: { staffId: 'staff-1' } as any,
        body: { permissions: ['module:view'] },
      });
      await invokeRoute(router, 'PUT', '/staff-1/permissions', req, res);

      expect(staffService.updatePermissions).toHaveBeenCalledWith('staff-1', ['module:view']);
      expect(res.status).toHaveBeenCalledWith(200);
    });

    it('returns 400 on invalid permissions', async () => {
      const staffService = makeStaffService({
        updatePermissions: vi.fn().mockRejectedValue(new InvalidPermissionError(['bad:view'])),
      });
      const router = createStaffRoutes(staffService, noopLogger);

      const req = makeReq({
        params: { staffId: 'staff-1' } as any,
        body: { permissions: ['bad:view'] },
      });
      await invokeRoute(router, 'PUT', '/staff-1/permissions', req, res);

      expect(res.status).toHaveBeenCalledWith(400);
    });
  });

  describe('PUT /:staffId/status', () => {
    it('updates status and returns 200', async () => {
      const staffService = makeStaffService();
      const router = createStaffRoutes(staffService, noopLogger);

      const req = makeReq({
        params: { staffId: 'staff-1' } as any,
        body: { status: 'inactive' },
      });
      await invokeRoute(router, 'PUT', '/staff-1/status', req, res);

      expect(staffService.updateStatus).toHaveBeenCalledWith('staff-1', 'inactive');
      expect(res.status).toHaveBeenCalledWith(200);
    });

    it('returns 400 on last owner guard', async () => {
      const staffService = makeStaffService({
        updateStatus: vi.fn().mockRejectedValue(new LastOwnerError('staff-1')),
      });
      const router = createStaffRoutes(staffService, noopLogger);

      const req = makeReq({
        params: { staffId: 'staff-1' } as any,
        body: { status: 'inactive' },
      });
      await invokeRoute(router, 'PUT', '/staff-1/status', req, res);

      expect(res.status).toHaveBeenCalledWith(400);
    });
  });

  describe('PUT /:staffId/password', () => {
    it('resets password and returns 200', async () => {
      const staffService = makeStaffService();
      const router = createStaffRoutes(staffService, noopLogger);

      const req = makeReq({
        params: { staffId: 'staff-1' } as any,
        body: { password: 'NewPass1!' },
      });
      await invokeRoute(router, 'PUT', '/staff-1/password', req, res);

      expect(staffService.resetPassword).toHaveBeenCalledWith('staff-1', 'NewPass1!');
      expect(res.status).toHaveBeenCalledWith(200);
    });
  });
});
