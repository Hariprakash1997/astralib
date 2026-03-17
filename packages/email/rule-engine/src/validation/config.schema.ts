import { z } from 'zod';
import { loggerSchema, baseDbSchema, baseRedisSchema } from '@astralibx/core';
import { ConfigValidationError } from '../errors';

const configSchema = z.object({
  db: baseDbSchema,
  redis: baseRedisSchema,
  adapters: z.object({
    queryUsers: z.function(),
    resolveData: z.function(),
    sendEmail: z.function(),
    selectAgent: z.function(),
    findIdentifier: z.function(),
    sendTestEmail: z.function().optional(),
  }),
  platforms: z.array(z.string()).optional(),
  audiences: z.array(z.string()).optional(),
  categories: z.array(z.string()).optional(),
  logger: loggerSchema.optional(),
  options: z.object({
    lockTTLMs: z.number().positive().optional(),
    defaultMaxPerRun: z.number().positive().optional(),
    sendWindow: z.object({
      startHour: z.number().min(0).max(23),
      endHour: z.number().min(0).max(23),
      timezone: z.string(),
    }).optional(),
    delayBetweenSendsMs: z.number().min(0).optional(),
    jitterMs: z.number().min(0).optional(),
  }).optional(),
  hooks: z.object({
    onRunStart: z.function().optional(),
    onRuleStart: z.function().optional(),
    onSend: z.function().optional(),
    onRuleComplete: z.function().optional(),
    onRunComplete: z.function().optional(),
  }).optional(),
});

export function validateConfig(raw: unknown): void {
  const result = configSchema.safeParse(raw);
  if (!result.success) {
    const issues = result.error.issues
      .map((i) => `  ${i.path.join('.')}: ${i.message}`)
      .join('\n');
    throw new ConfigValidationError(
      `Invalid EmailRuleEngineConfig:\n${issues}`,
      result.error.issues[0]?.path.join('.') ?? '',
    );
  }
}
