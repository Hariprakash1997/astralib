import { z } from 'zod';
import { loggerSchema, baseDbSchema } from '@astralibx/core';
import { ConfigValidationError } from '../errors';

const configSchema = z.object({
  accountManager: z.object({}).passthrough().refine(
    (val) => val != null && typeof val === 'object',
    { message: 'accountManager is required and must be a TelegramAccountManager instance' },
  ),
  db: baseDbSchema,
  media: z.object({
    uploadAdapter: z.function().optional(),
    maxFileSizeMb: z.number().positive().max(500).optional(),
  }).optional(),
  options: z.object({
    historySyncLimit: z.number().int().positive().max(1000).optional(),
    autoAttachOnConnect: z.boolean().optional(),
    typingTimeoutMs: z.number().int().positive().optional(),
  }).optional(),
  logger: loggerSchema.optional(),
  hooks: z.object({
    onNewMessage: z.function().optional(),
    onMessageRead: z.function().optional(),
    onNewContact: z.function().optional(),
    onTyping: z.function().optional(),
  }).optional(),
});

export function validateConfig(raw: unknown): void {
  const result = configSchema.safeParse(raw);
  if (!result.success) {
    const issues = result.error.issues
      .map((i) => `  ${i.path.join('.')}: ${i.message}`)
      .join('\n');
    throw new ConfigValidationError(
      `Invalid TelegramInboxConfig:\n${issues}`,
      result.error.issues[0]?.path.join('.') ?? '',
    );
  }
}
