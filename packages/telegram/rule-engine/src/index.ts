import type { Router } from 'express';
import { createRuleEngine, type RuleEngine } from '@astralibx/rule-engine';
import type { TelegramRuleEngineConfig } from './types/config.types';
import { createTelegramAdapters } from './adapters/telegram.adapter';

/**
 * Engine instance with Express routes and programmatic service access.
 */
export interface TelegramRuleEngine {
  routes: Router;
  runner: RuleEngine['services']['runner'];
  templateService: RuleEngine['services']['template'];
  ruleService: RuleEngine['services']['rule'];
  models: RuleEngine['models'];
  destroy(): Promise<void>;
}

/**
 * Creates a telegram rule engine instance that wraps core's createRuleEngine
 * with telegram-specific adapters.
 *
 * @param config - Engine configuration including DB, Redis, adapters, and options.
 * @returns Engine instance with Express routes and programmatic service access.
 * @throws {ConfigValidationError} If the provided config is invalid.
 *
 * @example
 * ```typescript
 * const engine = createTelegramRuleEngine({
 *   db: { connection: mongoose.createConnection(uri) },
 *   redis: { connection: new Redis() },
 *   adapters: { queryUsers, resolveData, sendMessage, selectAccount, findIdentifier },
 * });
 * app.use('/api/telegram-rules', engine.routes);
 * ```
 */
export function createTelegramRuleEngine(config: TelegramRuleEngineConfig): TelegramRuleEngine {
  const adapters = createTelegramAdapters(config);

  const engine = createRuleEngine({
    db: config.db,
    redis: config.redis,
    adapters,
    collections: config.collections,
    platforms: config.platforms || ['telegram'],
    audiences: config.audiences,
    categories: config.categories,
    logger: config.logger,
    options: {
      lockTTLMs: config.options?.lockTTLMs,
      defaultMaxPerRun: config.options?.defaultMaxPerRun,
      sendWindow: config.options?.sendWindow,
      delayBetweenSendsMs: config.options?.delayBetweenSendsMs,
      jitterMs: config.options?.jitterMs,
    },
    hooks: config.hooks ? {
      onRunStart: config.hooks.onRunStart,
      onRuleStart: config.hooks.onRuleStart,
      onRuleComplete: config.hooks.onRuleComplete ? (info: any) => {
        config.hooks!.onRuleComplete!({
          ruleId: info.ruleId,
          ruleName: info.ruleName,
          stats: { sent: info.stats.sent, failed: info.stats.failed, skipped: info.stats.skipped, throttled: info.stats.throttled ?? 0 },
          templateId: info.templateId,
          runId: info.runId,
        });
      } : undefined,
      onRunComplete: config.hooks.onRunComplete ? (info: any) => {
        config.hooks!.onRunComplete!({
          duration: info.duration,
          totalStats: { sent: info.totalStats.sent, failed: info.totalStats.failed, skipped: info.totalStats.skipped, throttled: info.totalStats.throttled ?? 0 },
          perRuleStats: info.perRuleStats,
          runId: info.runId,
        });
      } : undefined,
      onSend: config.hooks.onSend ? (info: any) => {
        config.hooks!.onSend!({
          ruleId: info.ruleId,
          ruleName: info.ruleName,
          identifierId: info.contactValue || info.identifierId || '',
          status: info.status,
          accountId: info.accountId,
          templateId: info.templateId,
          runId: info.runId,
          messageIndex: info.bodyIndex ?? info.messageIndex ?? -1,
          failureReason: info.failureReason,
        });
      } : undefined,
      beforeSend: config.hooks.beforeSend ? async (params: any) => {
        const result = await config.hooks!.beforeSend!({
          message: params.body,
          account: { id: params.account.id, phone: params.account.contactValue, metadata: params.account.metadata },
          user: { id: params.user.id, contactId: params.user.contactId || params.user.contactValue, name: params.user.name },
          context: params.context,
          media: params.metadata?.media,
        });
        // Telegram's BeforeSendResult only has message/media; map back to core's shape.
        // textBody/subject are not used in telegram — pass through unchanged from params.
        return { body: result.message, textBody: params.textBody, subject: params.subject };
      } : undefined,
    } : undefined,
  });

  return {
    routes: engine.routes,
    runner: engine.services.runner,
    templateService: engine.services.template,
    ruleService: engine.services.rule,
    models: engine.models,
    destroy: engine.destroy,
  };
}

// ── Re-export core types for consumers ────────────────────────────────

export type {
  RuleEngine,
  RuleEngineConfig,
  RuleEngineAdapters,
  SendParams,
  AgentSelection,
  RecipientIdentifier,
  BeforeSendParams,
  BeforeSendResult,
  RunProgress,
  RunStatus,
  RunStatusResponse,
  // Template types
  Template,
  CreateTemplateInput,
  UpdateTemplateInput,
  Attachment,
  // Rule types
  RuleRunStats,
  PerRuleStats,
  // Collection types
  CollectionSchema,
  JoinDefinition,
} from '@astralibx/rule-engine';

// Re-export core constants
export {
  TEMPLATE_CATEGORY,
  TEMPLATE_AUDIENCE,
  RULE_OPERATOR,
  RULE_TYPE,
  RUN_TRIGGER,
  THROTTLE_WINDOW,
  SEND_STATUS,
  TARGET_MODE,
  RUN_LOG_STATUS,
  FIELD_TYPE,
  TYPE_OPERATORS,
} from '@astralibx/rule-engine';

export type {
  TemplateCategory,
  TemplateAudience,
  RuleOperator,
  RuleType,
  RunTrigger,
  SendStatus,
  TargetMode,
  RunLogStatus,
  FieldType,
} from '@astralibx/rule-engine';

// Re-export core errors
export {
  AlxRuleEngineError,
  ConfigValidationError,
  TemplateNotFoundError,
  TemplateSyntaxError,
  RuleNotFoundError,
  RuleTemplateIncompatibleError,
  LockAcquisitionError,
  DuplicateSlugError,
} from '@astralibx/rule-engine';

// Re-export core utilities
export { validateConfig } from '@astralibx/rule-engine';
export { RedisLock } from '@astralibx/core';

// Re-export core schemas
export {
  createTemplateSchema,
  createRuleSchema,
  createSendLogSchema,
  createRunLogSchema,
  createErrorLogSchema,
  createThrottleConfigSchema,
  type TemplateModel,
  type RuleModel,
  type SendLogModel,
  type RunLogModel,
  type ErrorLogModel,
  type ThrottleConfigModel,
} from '@astralibx/rule-engine';

// Re-export core services
export { TemplateRenderService, type RenderResult, type CompiledTemplate } from '@astralibx/rule-engine';
export { TemplateService } from '@astralibx/rule-engine';
export { RuleService } from '@astralibx/rule-engine';
export { RuleRunnerService } from '@astralibx/rule-engine';
export { SchedulerService } from '@astralibx/rule-engine';
export { validateConditions, validateJoinAliases, type ConditionValidationError } from '@astralibx/rule-engine';
export { flattenFields } from '@astralibx/rule-engine';
export { buildAggregationPipeline, type PipelineBuilderOptions } from '@astralibx/rule-engine';

// ── Telegram-specific exports ─────────────────────────────────────────

// Backward compat aliases for consumers importing telegram-specific names
export type {
  SendParams as SendMessageParams,
  AgentSelection as AccountSelection,
} from '@astralibx/rule-engine';

// Telegram-specific config type
export type { TelegramRuleEngineConfig } from './types/config.types';
export type { LogAdapter } from '@astralibx/core';

// Telegram-specific types (enums, rule types, throttle, template)
export {
  DELIVERY_STATUS, type DeliveryStatus,
  ERROR_CATEGORY, type ErrorCategory,
  ERROR_OPERATION, type ErrorOperation,
} from './types/enums';

export type {
  CreateTelegramTemplateInput,
  UpdateTelegramTemplateInput,
} from './types/template.types';

export type { RuleTarget, QueryTarget, ListTarget } from './types/rule.types';
export type { ThrottleConfig, ThrottleWindow } from './types/throttle.types';

// Telegram-specific errors (not in core)
export { RunError, ThrottleError } from './errors';
// Backward compat aliases
export { AlxRuleEngineError as AlxTelegramError, LockAcquisitionError as LockError } from '@astralibx/rule-engine';

// Telegram-specific constants
export {
  DEFAULT_LOCK_TTL_MS,
  DEFAULT_MAX_PER_RUN,
  DEFAULT_DELAY_BETWEEN_SENDS_MS,
  DEFAULT_JITTER_MS,
  DEFAULT_MAX_CONSECUTIVE_FAILURES,
  DEFAULT_THINKING_PAUSE_PROBABILITY,
  DEFAULT_BATCH_PROGRESS_INTERVAL,
  DEFAULT_THROTTLE_CONFIG,
  DEFAULT_THROTTLE_TTL_SECONDS,
  DEFAULT_HEALTH_DELAY_MULTIPLIER,
  REDIS_KEY_PREFIX,
  RUN_PROGRESS_TTL_SECONDS,
  MESSAGE_PREVIEW_LENGTH,
} from './constants';

// Telegram-specific utilities
export { calculateDelay, isWithinSendWindow, getHumanDelay, getHealthAdjustedDelay } from './utils/delay';
export { categorizeError, isRetryableError, checkRedisThrottle, incrementRedisThrottle, calculateTelegramDelay } from './middleware/telegram-send.middleware';
export { createTelegramAdapters } from './adapters/telegram.adapter';
