import type { TelegramRuleEngineConfig } from './types/config.types';
import { createTelegramTemplateSchema, type TelegramTemplateModel } from './schemas/template.schema';
import { createTelegramRuleSchema, type TelegramRuleModel } from './schemas/rule.schema';
import { createTelegramSendLogSchema, type TelegramSendLogModel } from './schemas/send-log.schema';
import { createTelegramRunLogSchema, type TelegramRunLogModel } from './schemas/run-log.schema';
import { createTelegramErrorLogSchema, type TelegramErrorLogModel } from './schemas/error-log.schema';
import { createTelegramThrottleConfigSchema, type TelegramThrottleConfigModel } from './schemas/throttle-config.schema';
import { createRoutes } from './routes';
import { validateConfig } from './validation/config.schema';
import type { Router } from 'express';
import type { TemplateServiceLike } from './controllers/template.controller';
import type { RuleServiceLike } from './controllers/rule.controller';
import type { RunnerServiceLike } from './controllers/runner.controller';

/**
 * Engine instance with Express routes and programmatic service access.
 */
export interface TelegramRuleEngine {
  routes: Router;
  runner: RunnerServiceLike;
  templateService: TemplateServiceLike;
  ruleService: RuleServiceLike;
  models: {
    TelegramTemplate: TelegramTemplateModel;
    TelegramRule: TelegramRuleModel;
    TelegramSendLog: TelegramSendLogModel;
    TelegramRunLog: TelegramRunLogModel;
    TelegramErrorLog: TelegramErrorLogModel;
    TelegramThrottleConfig: TelegramThrottleConfigModel;
  };
}

/**
 * Creates a telegram rule engine instance with routes, services, and models.
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
  validateConfig(config);

  const conn = config.db.connection;
  const prefix = config.db.collectionPrefix || '';

  // 1. Create all 6 models with prefix
  const TelegramTemplate = conn.model<any>(
    `${prefix}TelegramTemplate`,
    createTelegramTemplateSchema(config.platforms, config.audiences, config.categories, prefix)
  ) as TelegramTemplateModel;

  const TelegramRule = conn.model<any>(
    `${prefix}TelegramRule`,
    createTelegramRuleSchema(config.platforms, config.audiences, prefix)
  ) as TelegramRuleModel;

  const TelegramSendLog = conn.model<any>(
    `${prefix}TelegramSendLog`,
    createTelegramSendLogSchema(prefix)
  ) as TelegramSendLogModel;

  const TelegramRunLog = conn.model<any>(
    `${prefix}TelegramRunLog`,
    createTelegramRunLogSchema(prefix)
  ) as TelegramRunLogModel;

  const TelegramErrorLog = conn.model<any>(
    `${prefix}TelegramErrorLog`,
    createTelegramErrorLogSchema(prefix)
  ) as TelegramErrorLogModel;

  const TelegramThrottleConfig = conn.model<any>(
    `${prefix}TelegramThrottleConfig`,
    createTelegramThrottleConfigSchema(prefix)
  ) as TelegramThrottleConfigModel;

  // 2. Create services (placeholder — will be replaced when service files are created)
  // Services are instantiated here once the service classes exist.
  // For now, the factory creates stub services that satisfy the controller interfaces.
  const { TemplateService } = require('./services/template.service');
  const { RuleService } = require('./services/rule.service');
  const { RuleRunnerService } = require('./services/rule-runner.service');

  const templateService = new TemplateService(TelegramTemplate, config);
  const ruleService = new RuleService(TelegramRule, TelegramTemplate, TelegramRunLog, config);
  const runnerService = new RuleRunnerService(
    TelegramRule, TelegramTemplate, TelegramSendLog, TelegramRunLog, TelegramErrorLog, TelegramThrottleConfig, config
  );

  // 3. Create routes (controllers are created inside createRoutes)
  const routes = createRoutes({
    templateService,
    ruleService,
    runnerService,
    TelegramSendLog,
    TelegramErrorLog,
    TelegramRunLog,
    TelegramThrottleConfig,
    platformValues: config.platforms,
    categoryValues: config.categories,
    audienceValues: config.audiences,
    logger: config.logger,
  });

  return {
    routes,
    runner: runnerService,
    templateService,
    ruleService,
    models: { TelegramTemplate, TelegramRule, TelegramSendLog, TelegramRunLog, TelegramErrorLog, TelegramThrottleConfig },
  };
}

// ── Re-export everything ──────────────────────────────────────────────

export {
  DELIVERY_STATUS, type DeliveryStatus,
  ERROR_CATEGORY, type ErrorCategory,
  SEND_STATUS, type SendStatus,
  ERROR_OPERATION, type ErrorOperation,
} from './types/enums';

export type {
  CreateTelegramTemplateInput, UpdateTelegramTemplateInput,
} from './types/template.types';

export type {
  RuleRunStats, RuleTarget, QueryTarget, ListTarget,
  PerRuleStats,
} from './types/rule.types';

export type { ThrottleConfig, ThrottleWindow } from './types/throttle.types';

export type {
  TelegramRuleEngineConfig, SendMessageParams, AccountSelection,
  RecipientIdentifier, LogAdapter, BeforeSendParams, BeforeSendResult,
  RunProgress, RunStatus, RunStatusResponse,
} from './types/config.types';

export {
  AlxTelegramError, ConfigValidationError, TemplateNotFoundError,
  RuleNotFoundError, RunError, ThrottleError, LockError,
} from './errors';

export { validateConfig } from './validation/config.schema';

export {
  DEFAULT_LOCK_TTL_MS,
  DEFAULT_MAX_PER_RUN,
  DEFAULT_DELAY_BETWEEN_SENDS_MS,
  DEFAULT_JITTER_MS,
  DEFAULT_MAX_CONSECUTIVE_FAILURES,
  DEFAULT_THINKING_PAUSE_PROBABILITY,
  DEFAULT_BATCH_PROGRESS_INTERVAL,
  DEFAULT_THROTTLE_CONFIG,
  REDIS_KEY_PREFIX,
  RUN_PROGRESS_TTL_SECONDS,
  MESSAGE_PREVIEW_LENGTH,
} from './constants';

export * from './schemas';

export { RedisLock } from './utils/redis-lock';
export { calculateDelay, isWithinSendWindow, getHumanDelay } from './utils/delay';
