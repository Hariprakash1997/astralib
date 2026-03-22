import { noopLogger } from '@astralibx/core';
import type { Router } from 'express';
import type { Model } from 'mongoose';
import type { StaffEngineConfig, ResolvedOptions } from '@astralibx/staff-types';
import { DEFAULT_OPTIONS } from '@astralibx/staff-types';
import { createStaffModel, type IStaffDocument } from './schemas/staff.schema.js';
import { createPermissionGroupModel, type IPermissionGroupDocument } from './schemas/permission-group.schema.js';
import { RateLimiterService } from './services/rate-limiter.service.js';
import { PermissionCacheService } from './services/permission-cache.service.js';
import { PermissionService } from './services/permission.service.js';
import { StaffService } from './services/staff.service.js';
import { AuthService } from './services/auth.service.js';
import { createAuthMiddleware, type AuthMiddleware } from './middleware/auth.middleware.js';
import { createRoutes } from './routes/index.js';
import { DEFAULT_AUTH } from './constants/index.js';
import { InvalidConfigError } from './errors/index.js';
import { StaffEngineConfigSchema } from './validation/config.schema.js';

// ── Return type ───────────────────────────────────────────────────────────────

export interface StaffEngine {
  routes: Router;
  auth: AuthMiddleware;
  staff: StaffService;
  authService: AuthService;
  permissions: PermissionService;
  models: {
    Staff: Model<IStaffDocument>;
    PermissionGroup: Model<IPermissionGroupDocument>;
  };
  destroy: () => Promise<void>;
}

// ── Factory ───────────────────────────────────────────────────────────────────

export function createStaffEngine(config: StaffEngineConfig): StaffEngine {
  // 1. Validate config with Zod
  const parseResult = StaffEngineConfigSchema.safeParse(config);
  if (!parseResult.success) {
    const issues = parseResult.error.issues
      .map((i) => `${i.path.join('.')}: ${i.message}`)
      .join(', ');
    throw new InvalidConfigError('config', issues);
  }

  // 2. Resolve options
  const resolvedOptions: ResolvedOptions = {
    requireEmailUniqueness:
      config.options?.requireEmailUniqueness ?? DEFAULT_OPTIONS.requireEmailUniqueness,
    allowSelfPasswordChange:
      config.options?.allowSelfPasswordChange ?? DEFAULT_OPTIONS.allowSelfPasswordChange,
    rateLimiter: {
      windowMs:
        config.options?.rateLimiter?.windowMs ?? DEFAULT_OPTIONS.rateLimiter.windowMs,
      maxAttempts:
        config.options?.rateLimiter?.maxAttempts ?? DEFAULT_OPTIONS.rateLimiter.maxAttempts,
    },
  };

  const resolvedAuth = {
    jwtSecret: config.auth.jwtSecret,
    staffTokenExpiry: config.auth.staffTokenExpiry ?? DEFAULT_AUTH.staffTokenExpiry,
    ownerTokenExpiry: config.auth.ownerTokenExpiry ?? DEFAULT_AUTH.ownerTokenExpiry,
    permissionCacheTtlMs: config.auth.permissionCacheTtlMs ?? DEFAULT_AUTH.permissionCacheTtlMs,
  };

  // 3. Set up logger
  const logger = config.logger ?? noopLogger;

  // 4. Register mongoose models
  const conn = config.db.connection as import('mongoose').Connection;
  const prefix = config.db.collectionPrefix;

  const StaffModel = createStaffModel(conn, prefix);
  const PermissionGroupModel = createPermissionGroupModel(conn, prefix);

  // 5. Create services (dependency order)
  const redis = config.redis?.connection ?? null;
  const keyPrefix = config.redis?.keyPrefix ?? 'staff:';

  const rateLimiter = new RateLimiterService(
    resolvedOptions.rateLimiter.windowMs,
    resolvedOptions.rateLimiter.maxAttempts,
    redis,
    keyPrefix,
    logger,
  );

  const permissionCache = new PermissionCacheService(
    StaffModel,
    resolvedAuth.permissionCacheTtlMs,
    redis,
    keyPrefix,
    logger,
    config.tenantId,
  );

  const permissionService = new PermissionService(
    PermissionGroupModel,
    permissionCache,
    logger,
    config.tenantId,
  );

  const staffService = new StaffService({
    Staff: StaffModel,
    PermissionGroup: PermissionGroupModel,
    adapters: config.adapters,
    hooks: config.hooks ?? {},
    permissionCache,
    logger,
    tenantId: config.tenantId,
    requireEmailUniqueness: resolvedOptions.requireEmailUniqueness,
  });

  const authService = new AuthService({
    Staff: StaffModel,
    adapters: config.adapters,
    hooks: config.hooks ?? {},
    rateLimiter,
    logger,
    tenantId: config.tenantId,
    jwtSecret: resolvedAuth.jwtSecret,
    staffTokenExpiry: resolvedAuth.staffTokenExpiry,
    ownerTokenExpiry: resolvedAuth.ownerTokenExpiry,
    allowSelfPasswordChange: resolvedOptions.allowSelfPasswordChange,
  });

  // 6. Create auth middleware
  const auth = createAuthMiddleware(
    resolvedAuth.jwtSecret,
    permissionCache,
    StaffModel,
    logger,
    config.tenantId,
  );

  // 7. Create routes
  const routes = createRoutes(
    { staff: staffService, auth: authService, permissions: permissionService },
    auth,
    logger,
    resolvedOptions.allowSelfPasswordChange,
  );

  // 8. Return engine object
  async function destroy(): Promise<void> {
    await permissionCache.invalidateAll();
    logger.info('StaffEngine destroyed');
  }

  return {
    routes,
    auth,
    staff: staffService,
    authService,
    permissions: permissionService,
    models: { Staff: StaffModel, PermissionGroup: PermissionGroupModel },
    destroy,
  };
}

// ── Barrel re-exports ─────────────────────────────────────────────────────────

export * from './constants/index.js';
export * from './errors/index.js';
export * from './schemas/index.js';
export * from './services/index.js';
export * from './validation/index.js';
export * from './middleware/auth.middleware.js';
export * from './utils/error-handler.js';
export { createRoutes } from './routes/index.js';
export type { StaffEngineConfig, ResolvedOptions } from '@astralibx/staff-types';
export { DEFAULT_OPTIONS } from '@astralibx/staff-types';
