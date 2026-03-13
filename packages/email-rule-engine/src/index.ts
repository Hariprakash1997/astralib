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
import type { Router } from 'express';

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

export function createEmailRuleEngine(config: EmailRuleEngineConfig): EmailRuleEngine {
  const conn = config.db.connection;
  const prefix = config.db.collectionPrefix || '';

  const EmailTemplate = conn.model<any>(
    `${prefix}EmailTemplate`,
    createEmailTemplateSchema(config.platforms)
  ) as EmailTemplateModel;

  const EmailRule = conn.model<any>(
    `${prefix}EmailRule`,
    createEmailRuleSchema(config.platforms)
  ) as EmailRuleModel;

  const EmailRuleSend = conn.model<any>(
    `${prefix}EmailRuleSend`,
    createEmailRuleSendSchema()
  ) as EmailRuleSendModel;

  const EmailRuleRunLog = conn.model<any>(
    `${prefix}EmailRuleRunLog`,
    createEmailRuleRunLogSchema()
  ) as EmailRuleRunLogModel;

  const EmailThrottleConfig = conn.model<any>(
    `${prefix}EmailThrottleConfig`,
    createEmailThrottleConfigSchema()
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
    EmailThrottleConfig,
    platformValues: config.platforms
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
export * from './schemas';
export { TemplateRenderService, type RenderResult, type CompiledTemplate } from './services/template-render.service';
export { TemplateService } from './services/template.service';
export { RuleService } from './services/rule.service';
export { RuleRunnerService } from './services/rule-runner.service';
export { RedisLock } from './utils/redis-lock';
