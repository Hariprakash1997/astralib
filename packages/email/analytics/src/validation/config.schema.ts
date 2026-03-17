import { z } from 'zod';
import { loggerSchema, baseDbSchema } from '@astralibx/core';
import { ConfigValidationError } from '../errors';

const configSchema = z.object({
  db: baseDbSchema,
  logger: loggerSchema.optional(),
  options: z.object({
    eventTTLDays: z.number().int().positive().optional(),
    timezone: z.string().optional(),
    aggregationSchedule: z.array(
      z.enum(['daily', 'weekly', 'monthly']),
    ).optional(),
  }).optional(),
});

export function validateConfig(raw: unknown): void {
  const result = configSchema.safeParse(raw);
  if (!result.success) {
    const issues = result.error.issues
      .map((i) => `  ${i.path.join('.')}: ${i.message}`)
      .join('\n');
    throw new ConfigValidationError(
      `Invalid EmailAnalyticsConfig:\n${issues}`,
      result.error.issues[0]?.path.join('.') ?? '',
    );
  }
}
