import { z } from 'zod';

export const StaffEngineConfigSchema = z.object({
  db: z.object({
    connection: z.unknown().refine((v) => v !== undefined && v !== null, {
      message: 'db.connection is required',
    }),
    collectionPrefix: z.string().optional(),
  }),
  redis: z
    .object({
      connection: z.unknown(),
      keyPrefix: z.string().optional(),
    })
    .optional(),
  logger: z
    .object({
      info: z.function(),
      warn: z.function(),
      error: z.function(),
    })
    .optional(),
  tenantId: z.string().optional(),
  auth: z.object({
    jwtSecret: z.string().min(1),
    staffTokenExpiry: z.string().optional(),
    ownerTokenExpiry: z.string().optional(),
    permissionCacheTtlMs: z.number().int().positive().optional(),
  }),
  adapters: z.object({
    hashPassword: z.function(),
    comparePassword: z.function(),
  }),
  hooks: z
    .object({
      onStaffCreated: z.function().optional(),
      onLogin: z.function().optional(),
      onLoginFailed: z.function().optional(),
      onPermissionsChanged: z.function().optional(),
      onStatusChanged: z.function().optional(),
      onMetric: z.function().optional(),
    })
    .optional(),
  options: z
    .object({
      requireEmailUniqueness: z.boolean().optional(),
      allowSelfPasswordChange: z.boolean().optional(),
      rateLimiter: z
        .object({
          windowMs: z.number().int().positive().optional(),
          maxAttempts: z.number().int().positive().optional(),
        })
        .optional(),
    })
    .optional(),
});
