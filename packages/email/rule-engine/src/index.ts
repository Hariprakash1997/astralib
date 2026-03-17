import type { EmailRuleEngineConfig } from './types/config.types';
import { createEmailTemplateSchema, type EmailTemplateModel } from './schemas/template.schema';
import { createEmailRuleSchema, type EmailRuleModel } from './schemas/rule.schema';
import { createEmailRuleSendSchema, type EmailRuleSendModel } from './schemas/rule-send.schema';
import { createEmailRuleRunLogSchema, type EmailRuleRunLogModel } from './schemas/run-log.schema';
import { createEmailThrottleConfigSchema, type EmailThrottleConfigModel } from './schemas/throttle-config.schema';
import { TemplateService } from './services/template.service';
import { RuleService } from './services/rule.service';
import { RuleRunnerService } from './services/rule-runner.service';
import { createRoutes } from './routes';
import { validateConfig } from './validation/config.schema';
import type { Router } from 'express';

/**
 * Engine instance with Express routes and programmatic service access.
 */
export interface EmailRuleEngine {
  routes: Router;
  runner: RuleRunnerService;
  templateService: TemplateService;
  ruleService: RuleService;
  models: {
    EmailTemplate: EmailTemplateModel;
    EmailRule: EmailRuleModel;
    EmailRuleSend: EmailRuleSendModel;
    EmailRuleRunLog: EmailRuleRunLogModel;
    EmailThrottleConfig: EmailThrottleConfigModel;
  };
}

/**
 * Creates an email rule engine instance with routes, services, and models.
 *
 * @param config - Engine configuration including DB, Redis, adapters, and options.
 * @returns Engine instance with Express routes and programmatic service access.
 * @throws {ConfigValidationError} If the provided config is invalid.
 *
 * @example
 * ```typescript
 * const engine = createEmailRuleEngine({
 *   db: { connection: mongoose.createConnection(uri) },
 *   redis: { connection: new Redis() },
 *   adapters: { queryUsers, resolveData, sendEmail, selectAgent, findIdentifier },
 * });
 * app.use('/api/email-rules', engine.routes);
 * ```
 */
export function createEmailRuleEngine(config: EmailRuleEngineConfig): EmailRuleEngine {
  validateConfig(config);

  const conn = config.db.connection;
  const prefix = config.db.collectionPrefix || '';

  const EmailTemplate = conn.model<any>(
    `${prefix}EmailTemplate`,
    createEmailTemplateSchema(config.platforms, config.audiences, config.categories, prefix)
  ) as EmailTemplateModel;

  const EmailRule = conn.model<any>(
    `${prefix}EmailRule`,
    createEmailRuleSchema(config.platforms, config.audiences, prefix)
  ) as EmailRuleModel;

  const EmailRuleSend = conn.model<any>(
    `${prefix}EmailRuleSend`,
    createEmailRuleSendSchema(prefix)
  ) as EmailRuleSendModel;

  const EmailRuleRunLog = conn.model<any>(
    `${prefix}EmailRuleRunLog`,
    createEmailRuleRunLogSchema(prefix)
  ) as EmailRuleRunLogModel;

  const EmailThrottleConfig = conn.model<any>(
    `${prefix}EmailThrottleConfig`,
    createEmailThrottleConfigSchema(prefix)
  ) as EmailThrottleConfigModel;

  const templateService = new TemplateService(EmailTemplate, config);
  const ruleService = new RuleService(EmailRule, EmailTemplate, EmailRuleRunLog, config);
  const runnerService = new RuleRunnerService(
    EmailRule, EmailTemplate, EmailRuleSend, EmailRuleRunLog, EmailThrottleConfig, config
  );

  const routes = createRoutes({
    templateService,
    ruleService,
    runnerService,
    EmailRuleRunLog,
    EmailRuleSend,
    EmailThrottleConfig,
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
    models: { EmailTemplate, EmailRule, EmailRuleSend, EmailRuleRunLog, EmailThrottleConfig }
  };
}

export * from './types';
export * from './constants';
export * from './errors';
export { validateConfig } from './validation/config.schema';
export * from './schemas';
export { TemplateRenderService, type RenderResult, type CompiledTemplate } from './services/template-render.service';
export { TemplateService } from './services/template.service';
export { RuleService } from './services/rule.service';
export { RuleRunnerService } from './services/rule-runner.service';
export { RedisLock } from '@astralibx/core';
export { SchedulerService } from './services/scheduler.service';
