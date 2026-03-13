export { TemplateCategory, TemplateAudience, RuleOperator, EmailType, RunTrigger, ThrottleWindow } from './enums';
export type {
  EmailTemplate, CreateEmailTemplateInput, UpdateEmailTemplateInput
} from './template.types';
export type {
  RuleCondition, RuleRunStats, RuleTarget,
  EmailRule, CreateEmailRuleInput, UpdateEmailRuleInput,
  EmailRuleSend, PerRuleStats, EmailRuleRunLog
} from './rule.types';
export type { EmailThrottleConfig, UpdateEmailThrottleConfigInput } from './throttle.types';
export type {
  EmailRuleEngineConfig, SendEmailParams, AgentSelection,
  RecipientIdentifier, LogAdapter
} from './config.types';
