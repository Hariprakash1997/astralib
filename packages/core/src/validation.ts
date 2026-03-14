import { z, type ZodSchema } from 'zod';
import { ConfigValidationError } from './errors';

export const loggerSchema = z.object({
  info: z.function(),
  warn: z.function(),
  error: z.function(),
});

export const baseDbSchema = z.object({
  connection: z.any().refine((val) => val != null, 'db.connection is required'),
  collectionPrefix: z.string().optional(),
});

export const baseRedisSchema = z.object({
  connection: z.any().refine((val) => val != null, 'redis.connection is required'),
  keyPrefix: z.string().optional(),
});

export function createConfigValidator(
  configSchema: ZodSchema,
  ErrorClass: typeof ConfigValidationError = ConfigValidationError,
): (raw: unknown) => void {
  return function validateConfig(raw: unknown): void {
    const result = configSchema.safeParse(raw);
    if (!result.success) {
      const issues = result.error.issues
        .map((i) => `  ${i.path.join('.')}: ${i.message}`)
        .join('\n');
      throw new ErrorClass(
        `Invalid config:\n${issues}`,
        result.error.issues[0]?.path.join('.') ?? '',
      );
    }
  };
}
