import { z } from 'zod';
import { ConfigValidationError } from '../errors';

const configSchema = z.object({
  db: z.object({
    connection: z.any().refine(v => v && typeof v.model === 'function', 'Must be a Mongoose connection'),
    collectionPrefix: z.string().optional(),
  }),
  redis: z.object({
    connection: z.any().refine(v => v !== null && v !== undefined, 'Redis connection is required'),
    keyPrefix: z.string().optional(),
  }),
  adapters: z.object({
    queryUsers: z.function(),
    resolveData: z.function(),
    send: z.function(),
    selectAgent: z.function(),
    findIdentifier: z.function(),
    sendTest: z.function().optional(),
  }),
  collections: z.array(z.any()).optional(),
  platforms: z.array(z.string()).optional(),
  audiences: z.array(z.string()).optional(),
  categories: z.array(z.string()).optional(),
  logger: z.any().optional(),
  options: z.any().optional(),
  hooks: z.any().optional(),
});

export function validateConfig(config: unknown): void {
  const result = configSchema.safeParse(config);
  if (!result.success) {
    const firstError = result.error.issues[0];
    const field = firstError.path.join('.');
    throw new ConfigValidationError(firstError.message, field);
  }
}
