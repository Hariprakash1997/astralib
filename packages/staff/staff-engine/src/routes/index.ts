import { Router } from 'express';
import type { StaffService } from '../services/staff.service.js';
import type { PermissionService } from '../services/permission.service.js';
import type { AuthMiddleware } from '../middleware/auth.middleware.js';
import type { LogAdapter } from '@astralibx/staff-types';
import { createAuthRoutes } from './auth.routes.js';
import { createStaffRoutes } from './staff.routes.js';
import { createPermissionGroupRoutes } from './permission-group.routes.js';

export interface RouteServices {
  staff: StaffService;
  permissions: PermissionService;
}

export function createRoutes(
  services: RouteServices,
  auth: AuthMiddleware,
  logger: LogAdapter,
  allowSelfPasswordChange: boolean,
): Router {
  const router = Router();

  // Public + authenticated routes (setup, login, /me)
  router.use('/', createAuthRoutes(services.staff, auth, logger, allowSelfPasswordChange));

  // Owner-only staff CRUD routes
  router.use('/', auth.verifyToken, auth.ownerOnly, createStaffRoutes(services.staff, logger));

  // Permission group routes (GET is authenticated, CUD is owner-only)
  router.use('/permission-groups', createPermissionGroupRoutes(services.permissions, auth, logger));

  return router;
}
