import { Router } from 'express';
import type { Request, Response } from 'express';
import type { LogAdapter } from '@astralibx/staff-types';
import type { StaffService } from '../services/staff.service.js';
import { sendSuccess, handleStaffError } from '../utils/error-handler.js';

export function createStaffRoutes(
  staffService: StaffService,
  logger: LogAdapter,
): Router {
  const router = Router();

  // GET / — list staff
  router.get('/', async (req: Request, res: Response) => {
    try {
      const query = req.query as Record<string, string | undefined>;
      const filters: Record<string, unknown> = {};
      if (query['status']) filters['status'] = query['status'];
      if (query['role']) filters['role'] = query['role'];
      if (query['page']) filters['page'] = parseInt(query['page']!, 10);
      if (query['limit']) filters['limit'] = parseInt(query['limit']!, 10);
      const result = await staffService.list(filters as Parameters<typeof staffService.list>[0]);
      sendSuccess(res, result);
    } catch (error: unknown) {
      handleStaffError(res, error, logger);
    }
  });

  // POST / — create staff member
  router.post('/', async (req: Request, res: Response) => {
    try {
      const result = await staffService.create(req.body);
      sendSuccess(res, result, 201);
    } catch (error: unknown) {
      handleStaffError(res, error, logger);
    }
  });

  // PUT /:staffId — update staff member
  router.put('/:staffId', async (req: Request, res: Response) => {
    try {
      const result = await staffService.update(req.params['staffId']!, req.body);
      sendSuccess(res, result);
    } catch (error: unknown) {
      handleStaffError(res, error, logger);
    }
  });

  // PUT /:staffId/permissions — update staff permissions
  router.put('/:staffId/permissions', async (req: Request, res: Response) => {
    try {
      const result = await staffService.updatePermissions(
        req.params['staffId']!,
        req.body.permissions,
      );
      sendSuccess(res, result);
    } catch (error: unknown) {
      handleStaffError(res, error, logger);
    }
  });

  // PUT /:staffId/status — update staff status
  router.put('/:staffId/status', async (req: Request, res: Response) => {
    try {
      const result = await staffService.updateStatus(
        req.params['staffId']!,
        req.body.status,
      );
      sendSuccess(res, result);
    } catch (error: unknown) {
      handleStaffError(res, error, logger);
    }
  });

  // PUT /:staffId/password — reset staff password (owner action)
  router.put('/:staffId/password', async (req: Request, res: Response) => {
    try {
      await staffService.resetPassword(req.params['staffId']!, req.body.password);
      sendSuccess(res, { message: 'Password reset successfully' });
    } catch (error: unknown) {
      handleStaffError(res, error, logger);
    }
  });

  return router;
}
