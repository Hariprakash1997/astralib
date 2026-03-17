import { z } from 'zod';
import { loggerSchema, baseDbSchema } from '@astralibx/core';
import { ConfigValidationError } from '../errors';

const configSchema = z.object({
  token: z.string().min(1, 'Bot token is required'),
  mode: z.enum(['polling', 'webhook']),
  webhook: z.object({
    domain: z.string().url(),
    path: z.string().optional(),
    port: z.number().int().positive().optional(),
    secretToken: z.string().optional(),
  }).optional(),
  db: baseDbSchema,
  commands: z.array(z.object({
    command: z.string().min(1),
    description: z.string().min(1),
    handler: z.function(),
  })).optional(),
  callbacks: z.array(z.object({
    pattern: z.instanceof(RegExp),
    handler: z.function(),
  })).optional(),
  inlineQueries: z.array(z.object({
    pattern: z.instanceof(RegExp),
    handler: z.function(),
  })).optional(),
  middleware: z.array(z.function()).optional(),
  logger: loggerSchema.optional(),
  hooks: z.object({
    onUserStart: z.function().optional(),
    onUserBlocked: z.function().optional(),
    onCommand: z.function().optional(),
    onError: z.function().optional(),
  }).optional(),
}).refine(
  (data) => data.mode !== 'webhook' || data.webhook !== undefined,
  { message: 'webhook config is required when mode is "webhook"', path: ['webhook'] },
);

export function validateConfig(raw: unknown): void {
  const result = configSchema.safeParse(raw);
  if (!result.success) {
    const issues = result.error.issues
      .map((i) => `  ${i.path.join('.')}: ${i.message}`)
      .join('\n');
    throw new ConfigValidationError(
      `Invalid TelegramBotConfig:\n${issues}`,
      result.error.issues[0]?.path.join('.') ?? '',
    );
  }
}