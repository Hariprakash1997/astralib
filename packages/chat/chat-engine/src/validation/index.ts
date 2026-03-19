import { z } from 'zod';
import { loggerSchema, baseDbSchema, baseRedisSchema } from '@astralibx/core';
import { InvalidConfigError } from '../errors/index.js';

// ── Socket schema ────────────────────────────────────────────────────────────

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

// ── AI simulation schema ─────────────────────────────────────────────────────

const delayRangeSchema = z
  .object({ min: z.number().nonnegative(), max: z.number().nonnegative() })
  .refine((d) => d.max >= d.min, { message: 'max must be >= min' })
  .optional();

const aiSimulationSchema = z.object({
  deliveryDelay: delayRangeSchema,
  readDelay: delayRangeSchema,
  preTypingDelay: delayRangeSchema,
  bubbleDelay: delayRangeSchema,
  minTypingDuration: z.number().nonnegative().optional(),
}).optional();

// ── Options schema ───────────────────────────────────────────────────────────

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
  maxUploadSizeMb: z.number().positive().optional(),
  aiSimulation: aiSimulationSchema,
}).optional();

// ── Adapters schema ──────────────────────────────────────────────────────────

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
  resolveUserIdentity: z.function().optional(),
  fileStorage: z.object({
    upload: z.function(),
    delete: z.function(),
    getSignedUrl: z.function().optional(),
  }).optional(),
});

// ── Hooks schema ─────────────────────────────────────────────────────────────

const hooksSchema = z.object({
  onSessionCreated: z.function().optional(),
  onSessionResolved: z.function().optional(),
  onSessionAbandoned: z.function().optional(),
  onSessionClosed: z.function().optional(),
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

// ── Full config schema ───────────────────────────────────────────────────────

const chatEngineConfigSchema = z.object({
  db: baseDbSchema,
  redis: baseRedisSchema,
  socket: socketSchema,
  options: optionsSchema,
  adapters: adaptersSchema.optional().default({}),
  hooks: hooksSchema.optional().default({}),
  logger: loggerSchema.optional(),
});

export { chatEngineConfigSchema };

// Note: core's createConfigValidator is not used here because it requires an ErrorClass
// extending ConfigValidationError, but chat-engine throws InvalidConfigError (extends
// AlxChatError -> AlxError) to keep error hierarchy within the chat-engine domain.
export function validateConfig(raw: unknown): void {
  const result = chatEngineConfigSchema.safeParse(raw);
  if (!result.success) {
    const issues = result.error.issues
      .map((i) => `  ${i.path.join('.')}: ${i.message}`)
      .join('\n');
    throw new InvalidConfigError(
      result.error.issues[0]?.path.join('.') || 'config',
      `Invalid ChatEngineConfig:\n${issues}`,
    );
  }
}

// Re-export sub-modules
export { validateMessageContent, validateSessionForMessaging, validateAgentOwnership } from './message.validator.js';
export { validateSessionTransition } from './state.validator.js';
export { validateEscalation } from './escalation.validator.js';
