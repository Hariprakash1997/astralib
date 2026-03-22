import { Router } from 'express';
import type { Request, Response } from 'express';
import type { LogAdapter } from '@astralibx/staff-types';
import type { PermissionService } from '../services/permission.service.js';
import type { AuthMiddleware } from '../middleware/auth.middleware.js';
import { sendSuccess, handleStaffError } from '../utils/error-handler.js';

export function createPermissionGroupRoutes(
  permissionService: PermissionService,
  auth: AuthMiddleware,
  logger: LogAdapter,
): Router {
  const router = Router();

  // GET / — authenticated, list all permission groups
  router.get('/', auth.verifyToken, async (req: Request, res: Response) => {
    try {
      const result = await permissionService.listGroups();
      sendSuccess(res, result);
    } catch (error: unknown) {
      handleStaffError(res, error, logger);
    }
  });

  // POST / — owner only, create permission group
  router.post('/', auth.verifyToken, auth.ownerOnly, async (req: Request, res: Response) => {
    try {
      const result = await permissionService.createGroup(req.body);
      sendSuccess(res, result, 201);
    } catch (error: unknown) {
      handleStaffError(res, error, logger);
    }
  });

  // PUT /:groupId — owner only, update permission group
  router.put('/:groupId', auth.verifyToken, auth.ownerOnly, async (req: Request, res: Response) => {
    try {
      const result = await permissionService.updateGroup(req.params['groupId']!, req.body);
      sendSuccess(res, result);
    } catch (error: unknown) {
      handleStaffError(res, error, logger);
    }
  });

  // DELETE /:groupId — owner only, delete permission group
  router.delete('/:groupId', auth.verifyToken, auth.ownerOnly, async (req: Request, res: Response) => {
    try {
      await permissionService.deleteGroup(req.params['groupId']!);
      sendSuccess(res, { message: 'Group deleted successfully' });
    } catch (error: unknown) {
      handleStaffError(res, error, logger);
    }
  });

  return router;
}
