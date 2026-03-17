export {
  DELIVERY_STATUS, type DeliveryStatus,
  ERROR_CATEGORY, type ErrorCategory,
  SEND_STATUS, type SendStatus,
  ERROR_OPERATION, type ErrorOperation,
} from './enums';

export type {
  CreateTelegramTemplateInput, UpdateTelegramTemplateInput,
} from './template.types';

export type {
  RuleRunStats, RuleTarget, QueryTarget, ListTarget,
  PerRuleStats,
} from './rule.types';

export type { ThrottleConfig, ThrottleWindow } from './throttle.types';

export type {
  TelegramRuleEngineConfig, SendMessageParams, AccountSelection,
  RecipientIdentifier, LogAdapter, BeforeSendParams, BeforeSendResult,
  RunProgress, RunStatus, RunStatusResponse,
} from './config.types';

export {
  AlxTelegramError, ConfigValidationError, TemplateNotFoundError,
  RuleNotFoundError, RunError, ThrottleError, LockError,
} from '../errors';

export { validateConfig } from '../validation/config.schema';
