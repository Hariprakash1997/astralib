import type { Router } from 'express';
import type { RuleEngineConfig } from './types/config.types';
import {
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
} from './schemas';
import { TemplateService } from './services/template.service';
import { RuleService } from './services/rule.service';
import { RuleRunnerService } from './services/rule-runner.service';
import { validateConfig } from './validation/config.validator';
import { createRoutes } from './routes';

export interface RuleEngine {
  routes: Router;
  services: {
    template: TemplateService;
    rule: RuleService;
    runner: RuleRunnerService;
  };
  models: {
    Template: TemplateModel;
    Rule: RuleModel;
    SendLog: SendLogModel;
    RunLog: RunLogModel;
    ErrorLog: ErrorLogModel;
    ThrottleConfig: ThrottleConfigModel;
  };
  destroy: () => Promise<void>;
}

export function createRuleEngine(config: RuleEngineConfig): RuleEngine {
  validateConfig(config);

  const conn = config.db.connection;
  const prefix = config.db.collectionPrefix || '';

  const Template = conn.model<any>(
    `${prefix}Template`,
    createTemplateSchema(config.platforms, config.audiences, config.categories, prefix)
  ) as TemplateModel;

  const Rule = conn.model<any>(
    `${prefix}Rule`,
    createRuleSchema(config.platforms, config.audiences, prefix)
  ) as RuleModel;

  const SendLog = conn.model<any>(
    `${prefix}SendLog`,
    createSendLogSchema(prefix)
  ) as SendLogModel;

  const RunLog = conn.model<any>(
    `${prefix}RunLog`,
    createRunLogSchema(prefix)
  ) as RunLogModel;

  const ErrorLog = conn.model<any>(
    `${prefix}ErrorLog`,
    createErrorLogSchema(prefix)
  ) as ErrorLogModel;

  const ThrottleConfig = conn.model<any>(
    `${prefix}ThrottleConfig`,
    createThrottleConfigSchema(prefix)
  ) as ThrottleConfigModel;

  const templateService = new TemplateService(Template, config, Rule);
  const ruleService = new RuleService(Rule, Template, RunLog, config);
  const runnerService = new RuleRunnerService(Rule, Template, SendLog, RunLog, ErrorLog, ThrottleConfig, config);

  const routes = createRoutes({
    templateService,
    ruleService,
    runnerService,
    RunLog,
    SendLog,
    ThrottleConfig,
    platformValues: config.platforms,
    categoryValues: config.categories,
    audienceValues: config.audiences,
    logger: config.logger,
    collections: config.collections || [],
  });

  return {
    routes,
    services: { template: templateService, rule: ruleService, runner: runnerService },
    models: { Template, Rule, SendLog, RunLog, ErrorLog, ThrottleConfig },
    destroy: async () => {
      // scheduler cleanup if needed
    },
  };
}

// Re-export everything
export * from './types';
export * from './constants';
export * from './errors';
export { validateConfig } from './validation/config.validator';
export { validateConditions, validateJoinAliases, type ConditionValidationError } from './validation/condition.validator';
export { flattenFields } from './controllers/collection.controller';
export { buildAggregationPipeline, type PipelineBuilderOptions } from './utils/pipeline-builder';
export * from './schemas';
export { TemplateRenderService, type RenderResult, type CompiledTemplate } from './services/template-render.service';
export { TemplateService } from './services/template.service';
export { RuleService } from './services/rule.service';
export { RuleRunnerService } from './services/rule-runner.service';
export { SchedulerService } from './services/scheduler.service';
export { RedisLock } from '@astralibx/core';
