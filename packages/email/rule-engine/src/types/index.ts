export {
  TEMPLATE_CATEGORY, TEMPLATE_AUDIENCE, RULE_OPERATOR, EMAIL_TYPE, RUN_TRIGGER, THROTTLE_WINDOW, EMAIL_SEND_STATUS,
  type TemplateCategory, type TemplateAudience, type RuleOperator, type EmailType, type RunTrigger, type ThrottleWindow, type EmailSendStatus,
} from '../constants';

export type {
  EmailAttachment, EmailTemplate, CreateEmailTemplateInput, UpdateEmailTemplateInput
} from './template.types';
export type {
  RuleCondition, RuleRunStats, RuleTarget, QueryTarget, ListTarget,
  EmailRule, CreateEmailRuleInput, UpdateEmailRuleInput,
  EmailRuleSend, PerRuleStats, EmailRuleRunLog
} from './rule.types';
export type { EmailThrottleConfig, UpdateEmailThrottleConfigInput, SendWindowConfig } from './throttle.types';
export type {
  EmailRuleEngineConfig, SendEmailParams, AgentSelection,
  RecipientIdentifier, LogAdapter, BeforeSendParams, BeforeSendResult
} from './config.types';
export type {
  FieldType, FieldDefinition, JoinDefinition, CollectionSchema, FlattenedField
} from './collection.types';

export {
  AlxEmailError, ConfigValidationError, TemplateNotFoundError,
  TemplateSyntaxError, RuleNotFoundError, RuleTemplateIncompatibleError,
  LockAcquisitionError, DuplicateSlugError,
} from '../errors';

export { validateConfig } from '../validation/config.schema';
