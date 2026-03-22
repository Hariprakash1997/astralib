import { Router } from 'express';
import type { Request, Response } from 'express';
import type { LogAdapter } from '@astralibx/staff-types';
import type { StaffService } from '../services/staff.service.js';
import type { AuthService } from '../services/auth.service.js';
import type { AuthMiddleware, AuthenticatedRequest } from '../middleware/auth.middleware.js';
import { sendSuccess, handleStaffError } from '../utils/error-handler.js';

export function createAuthRoutes(
  staffService: StaffService,
  authService: AuthService,
  auth: AuthMiddleware,
  logger: LogAdapter,
  allowSelfPasswordChange: boolean,
): Router {
  const router = Router();

  // POST /setup — public, creates initial owner account
  router.post('/setup', async (req: Request, res: Response) => {
    try {
      const result = await authService.setupOwner(req.body);
      sendSuccess(res, result, 201);
    } catch (error: unknown) {
      handleStaffError(res, error, logger);
    }
  });

  // POST /login — public, returns staff + token
  router.post('/login', async (req: Request, res: Response) => {
    try {
      const { email, password } = req.body as { email: string; password: string };
      const ip = req.ip || req.socket.remoteAddress || '';
      const result = await authService.login(email, password, ip);
      sendSuccess(res, result);
    } catch (error: unknown) {
      handleStaffError(res, error, logger);
    }
  });

  // GET /me — authenticated, returns current staff profile + permissions
  router.get('/me', auth.verifyToken, async (req: Request, res: Response) => {
    try {
      const user = (req as AuthenticatedRequest).user;
      const staff = await staffService.getById(user.staffId);
      sendSuccess(res, { staff, permissions: user.permissions });
    } catch (error: unknown) {
      handleStaffError(res, error, logger);
    }
  });

  // PUT /me/password — only mounted if allowSelfPasswordChange is true
  if (allowSelfPasswordChange) {
    router.put('/me/password', auth.verifyToken, async (req: Request, res: Response) => {
      try {
        const user = (req as AuthenticatedRequest).user;
        const { oldPassword, newPassword } = req.body as { oldPassword: string; newPassword: string };
        await authService.changeOwnPassword(user.staffId, oldPassword, newPassword);
        sendSuccess(res, { message: 'Password changed successfully' });
      } catch (error: unknown) {
        handleStaffError(res, error, logger);
      }
    });
  }

  return router;
}
