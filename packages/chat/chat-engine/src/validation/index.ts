import { z } from 'zod';
import { loggerSchema, baseDbSchema, baseRedisSchema } from '@astralibx/core';
import { InvalidConfigError } from '../errors';

const socketSchema = z.object({
  pingIntervalMs: z.number().int().positive().optional(),
  pingTimeoutMs: z.number().int().positive().optional(),
  cors: z.object({
    origin: z.union([z.string(), z.array(z.string())]),
    credentials: z.boolean().optional(),
  }).optional(),
  namespaces: z.object({
    visitor: z.string().optional(),
    agent: z.string().optional(),
  }).optional(),
});

const optionsSchema = z.object({
  maxMessageLength: z.number().int().positive().optional(),
  rateLimitPerMinute: z.number().int().positive().optional(),
  sessionVisibilityMs: z.number().int().positive().optional(),
  sessionResumptionMs: z.number().int().positive().optional(),
  maxSessionHistory: z.number().int().positive().optional(),
  idleTimeoutMs: z.number().int().positive().optional(),
  sessionTimeoutCheckMs: z.number().int().positive().optional(),
  reconnectWindowMs: z.number().int().positive().optional(),
  pendingMessageTTLMs: z.number().int().positive().optional(),
  maxConcurrentChatsPerAgent: z.number().int().positive().optional(),
  aiDebounceMs: z.number().int().positive().optional(),
  aiTypingSimulation: z.boolean().optional(),
  aiTypingSpeedCpm: z.number().int().positive().optional(),
}).optional();

const adaptersSchema = z.object({
  assignAgent: z.function(),
  generateAiResponse: z.function().optional(),
  identifyVisitor: z.function().optional(),
  trackEvent: z.function().optional(),
  authenticateAgent: z.function().optional(),
  authenticateVisitor: z.function().optional(),
  authenticateRequest: z.function().optional(),
});

const hooksSchema = z.object({
  onSessionCreated: z.function().optional(),
  onSessionResolved: z.function().optional(),
  onSessionAbandoned: z.function().optional(),
  onMessageSent: z.function().optional(),
  onAgentTakeOver: z.function().optional(),
  onAgentHandBack: z.function().optional(),
  onEscalation: z.function().optional(),
  onVisitorConnected: z.function().optional(),
  onVisitorDisconnected: z.function().optional(),
  onAgentTransfer: z.function().optional(),
  onQueueJoin: z.function().optional(),
  onQueuePositionChanged: z.function().optional(),
  onFeedbackReceived: z.function().optional(),
  onOfflineMessage: z.function().optional(),
  onMetric: z.function().optional(),
  onError: z.function().optional(),
}).optional();

const configSchema = z.object({
  db: baseDbSchema,
  redis: baseRedisSchema,
  socket: socketSchema,
  options: optionsSchema,
  adapters: adaptersSchema,
  hooks: hooksSchema,
  logger: loggerSchema.optional(),
});

// Note: core's createConfigValidator is not used here because it requires an ErrorClass
// extending ConfigValidationError, but chat-engine throws InvalidConfigError (extends
// ChatEngineError -> AlxError) to keep error hierarchy within the chat-engine domain.
export function validateConfig(raw: unknown): void {
  const result = configSchema.safeParse(raw);
  if (!result.success) {
    const issues = result.error.issues
      .map((i) => `  ${i.path.join('.')}: ${i.message}`)
      .join('\n');
    throw new InvalidConfigError(
      `Invalid ChatEngineConfig:\n${issues}`,
      result.error.issues[0]?.path.join('.') ?? '',
    );
  }
}
