import { z } from 'zod';
import { loggerSchema, baseDbSchema } from '@astralibx/core';
import { ConfigValidationError } from '../errors';

const warmupPhaseSchema = z.object({
  days: z.tuple([z.number().int().min(0), z.number().int().min(0)]),
  dailyLimit: z.number().int().positive(),
  delayMinMs: z.number().int().min(0),
  delayMaxMs: z.number().int().min(0),
});

const configSchema = z.object({
  db: baseDbSchema,
  credentials: z.object({
    apiId: z.number().int().positive(),
    apiHash: z.string().min(1),
  }),
  logger: loggerSchema.optional(),
  options: z.object({
    maxAccounts: z.number().int().positive().optional(),
    connectionTimeoutMs: z.number().int().positive().optional(),
    healthCheckIntervalMs: z.number().int().positive().optional(),
    idleTimeoutMs: z.number().int().positive().optional(),
    autoReconnect: z.boolean().optional(),
    reconnectMaxRetries: z.number().int().min(0).optional(),
    warmup: z.object({
      enabled: z.boolean().optional(),
      defaultSchedule: z.array(warmupPhaseSchema).min(1).optional(),
      autoAdvance: z.boolean().optional(),
    }).optional(),
    quarantine: z.object({
      monitorIntervalMs: z.number().int().positive().optional(),
      defaultDurationMs: z.number().int().positive().optional(),
    }).optional(),
  }).optional(),
  hooks: z.object({
    onAccountConnected: z.function().optional(),
    onAccountDisconnected: z.function().optional(),
    onAccountQuarantined: z.function().optional(),
    onAccountReleased: z.function().optional(),
    onAccountBanned: z.function().optional(),
    onHealthChange: z.function().optional(),
    onWarmupComplete: z.function().optional(),
  }).optional(),
});

export function validateConfig(raw: unknown): void {
  const result = configSchema.safeParse(raw);
  if (!result.success) {
    const issues = result.error.issues
      .map((i) => `  ${i.path.join('.')}: ${i.message}`)
      .join('\n');
    throw new ConfigValidationError(
      `Invalid TelegramAccountManagerConfig:\n${issues}`,
      result.error.issues[0]?.path.join('.') ?? '',
    );
  }
}
