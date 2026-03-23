import jwt from 'jsonwebtoken';
import type { Request, Response, NextFunction, RequestHandler } from 'express';
import type { LogAdapter } from '@astralibx/staff-types';
import { STAFF_ROLE, STAFF_STATUS } from '@astralibx/staff-types';
import type { PermissionCacheService } from '../services/permission-cache.service.js';
import type { IStaffDocument } from '../schemas/staff.schema.js';
import type { Model } from 'mongoose';
import { TokenError, AuthorizationError } from '../errors/index.js';
import { ERROR_CODE, ERROR_MESSAGE } from '../constants/index.js';

export interface StaffUser {
  staffId: string;
  name: string;
  email: string;
  role: string;
  permissions: string[];
}

export interface AuthenticatedRequest extends Request {
  user: StaffUser;
}

export interface AuthMiddleware {
  verifyToken: RequestHandler;
  resolveStaff: (token: string) => Promise<StaffUser | null>;
  requirePermission: (...keys: string[]) => RequestHandler;
  ownerOnly: RequestHandler;
  requireRole: (...roles: string[]) => RequestHandler;
}

export function createAuthMiddleware(
  jwtSecret: string,
  permissionCache: PermissionCacheService,
  StaffModel: Model<IStaffDocument>,
  logger: LogAdapter,
  tenantId?: string,
): AuthMiddleware {

  async function resolveStaffFromToken(token: string): Promise<StaffUser | null> {
    try {
      const payload = jwt.verify(token, jwtSecret) as { staffId: string; role: string };
      if (!payload.staffId || !payload.role) return null;

      // Check staff status
      const filter: Record<string, unknown> = { _id: payload.staffId };
      if (tenantId) filter.tenantId = tenantId;
      const staff = await StaffModel.findOne(filter).select('name email status role').lean() as IStaffDocument | null;
      if (!staff) return null;
      if (staff.status !== STAFF_STATUS.Active) return null;

      const permissions = await permissionCache.get(payload.staffId);
      return { staffId: payload.staffId, name: staff.name, email: staff.email, role: staff.role, permissions };
    } catch {
      return null;
    }
  }

  const verifyToken: RequestHandler = async (req: Request, res: Response, next: NextFunction) => {
    const authHeader = req.headers.authorization;
    if (!authHeader?.startsWith('Bearer ')) {
      res.status(401).json({ success: false, error: ERROR_MESSAGE.TokenInvalid, code: ERROR_CODE.TokenInvalid });
      return;
    }

    const token = authHeader.slice(7);

    // Distinguish expired vs invalid tokens before full resolution
    try {
      jwt.verify(token, jwtSecret);
    } catch (err: unknown) {
      if (err instanceof jwt.TokenExpiredError) {
        res.status(401).json({ success: false, error: ERROR_MESSAGE.TokenExpired, code: ERROR_CODE.TokenExpired });
        return;
      }
      res.status(401).json({ success: false, error: ERROR_MESSAGE.TokenInvalid, code: ERROR_CODE.TokenInvalid });
      return;
    }

    const user = await resolveStaffFromToken(token);
    if (!user) {
      res.status(401).json({ success: false, error: ERROR_MESSAGE.TokenInvalid, code: ERROR_CODE.TokenInvalid });
      return;
    }

    (req as AuthenticatedRequest).user = user;
    next();
  };

  function requirePermission(...keys: string[]): RequestHandler {
    return (req: Request, res: Response, next: NextFunction) => {
      const user = (req as AuthenticatedRequest).user;
      if (!user) {
        res.status(401).json({ success: false, error: ERROR_MESSAGE.TokenInvalid, code: ERROR_CODE.TokenInvalid });
        return;
      }

      // Owner bypasses permission checks
      if (user.role === STAFF_ROLE.Owner) {
        next();
        return;
      }

      const permSet = new Set(user.permissions);
      const missing: string[] = [];

      for (const key of keys) {
        if (!permSet.has(key)) {
          missing.push(key);
          continue;
        }
        // Single-level edit→view cascade
        if (key.endsWith(':edit')) {
          const prefix = key.substring(0, key.lastIndexOf(':'));
          const viewKey = `${prefix}:view`;
          if (!permSet.has(viewKey)) {
            missing.push(viewKey);
          }
        }
      }

      if (missing.length > 0) {
        res.status(403).json({
          success: false,
          error: ERROR_MESSAGE.InsufficientPermissions,
          code: ERROR_CODE.InsufficientPermissions,
          missing,
        });
        return;
      }

      next();
    };
  }

  const ownerOnly: RequestHandler = (req: Request, res: Response, next: NextFunction) => {
    const user = (req as AuthenticatedRequest).user;
    if (!user || user.role !== STAFF_ROLE.Owner) {
      res.status(403).json({ success: false, error: ERROR_MESSAGE.OwnerOnly, code: ERROR_CODE.OwnerOnly });
      return;
    }
    next();
  };

  function requireRole(...roles: string[]): RequestHandler {
    return (req: Request, res: Response, next: NextFunction) => {
      const user = (req as AuthenticatedRequest).user;
      if (!user || !roles.includes(user.role)) {
        res.status(403).json({ success: false, error: ERROR_MESSAGE.InsufficientPermissions, code: ERROR_CODE.InsufficientPermissions });
        return;
      }
      next();
    };
  }

  return {
    verifyToken,
    resolveStaff: resolveStaffFromToken,
    requirePermission,
    ownerOnly,
    requireRole,
  };
}
