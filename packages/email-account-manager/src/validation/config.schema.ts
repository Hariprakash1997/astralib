import { z } from 'zod';
import { loggerSchema, baseDbSchema, baseRedisSchema } from '@astralibx/core';
import { ConfigValidationError } from '../errors';

const warmupPhaseSchema = z.object({
  days: z.tuple([z.number().int().min(0), z.number().int().min(0)]),
  dailyLimit: z.number().int().positive(),
  delayMinMs: z.number().int().min(0),
  delayMaxMs: z.number().int().min(0),
});

const configSchema = z.object({
  db: baseDbSchema,
  redis: baseRedisSchema,
  logger: loggerSchema.optional(),
  options: z.object({
    warmup: z.object({
      defaultSchedule: z.array(warmupPhaseSchema).min(1),
    }).optional(),
    healthDefaults: z.object({
      minScore: z.number().min(0).max(100).optional(),
      maxBounceRate: z.number().min(0).max(100).optional(),
      maxConsecutiveErrors: z.number().int().positive().optional(),
    }).optional(),
    ses: z.object({
      enabled: z.boolean(),
      validateSignature: z.boolean().optional(),
      allowedTopicArns: z.array(z.string()).optional(),
    }).optional(),
    unsubscribe: z.object({
      builtin: z.object({
        enabled: z.boolean(),
        secret: z.string().min(1),
        baseUrl: z.string().url(),
        tokenExpiryDays: z.number().int().positive().optional(),
      }).optional(),
      generateUrl: z.function().optional(),
    }).optional(),
    queues: z.object({
      sendQueueName: z.string().optional(),
      approvalQueueName: z.string().optional(),
    }).optional(),
  }).optional(),
  hooks: z.object({
    onAccountDisabled: z.function().optional(),
    onWarmupComplete: z.function().optional(),
    onHealthDegraded: z.function().optional(),
    onSend: z.function().optional(),
    onSendError: z.function().optional(),
    onBounce: z.function().optional(),
    onUnsubscribe: z.function().optional(),
    onDelivery: z.function().optional(),
    onComplaint: z.function().optional(),
    onOpen: z.function().optional(),
    onClick: z.function().optional(),
    onDraftCreated: z.function().optional(),
    onDraftApproved: z.function().optional(),
    onDraftRejected: z.function().optional(),
  }).optional(),
});

export function validateConfig(raw: unknown): void {
  const result = configSchema.safeParse(raw);
  if (!result.success) {
    const issues = result.error.issues
      .map((i) => `  ${i.path.join('.')}: ${i.message}`)
      .join('\n');
    throw new ConfigValidationError(
      `Invalid EmailAccountManagerConfig:\n${issues}`,
      result.error.issues[0]?.path.join('.') ?? '',
    );
  }
}
