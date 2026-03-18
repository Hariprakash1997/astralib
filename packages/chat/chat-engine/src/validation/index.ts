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
  singleSessionPerVisitor: z.boolean().optional(),
  trackEventsAsMessages: z.boolean().optional(),
  labelingEnabled: z.boolean().optional(),
  maxUploadSizeMb: z.number().optional(),
  aiSimulation: z.object({
    deliveryDelay: z.object({ min: z.number(), max: z.number() }).optional(),
    readDelay: z.object({ min: z.number(), max: z.number() }).optional(),
    preTypingDelay: z.object({ min: z.number(), max: z.number() }).optional(),
    bubbleDelay: z.object({ min: z.number(), max: z.number() }).optional(),
    minTypingDuration: z.number().optional(),
  }).optional(),
}).optional();

const adaptersSchema = z.object({
  assignAgent: z.function().optional(),
  generateAiResponse: z.function().optional(),
  identifyVisitor: z.function().optional(),
  trackEvent: z.function().optional(),
  authenticateAgent: z.function().optional(),
  authenticateVisitor: z.function().optional(),
  authenticateRequest: z.function().optional(),
  uploadFile: z.function().optional(),
  enrichSessionContext: z.function().optional(),
});

const hooksSchema = z.object({
  onSessionCreated: z.function().optional(),
  onSessionResolved: z.function().optional(),
  onSessionAbandoned: z.function().optional(),
  onSessionTimeout: z.function().optional(),
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
  onSaveMemory: z.function().optional(),
  onDeleteMemory: z.function().optional(),
  onSessionArchive: z.function().optional(),
  onAiRequest: z.function().optional(),
  onMetric: z.function().optional(),
  onError: z.function().optional(),
}).optional();

const configSchema = z.object({
  db: baseDbSchema,
  redis: baseRedisSchema,
  socket: socketSchema,
  options: optionsSchema,
  adapters: adaptersSchema.optional().default({}),
  hooks: hooksSchema.optional().default({}),
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
