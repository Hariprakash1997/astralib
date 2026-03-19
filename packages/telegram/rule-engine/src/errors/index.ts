// Re-export core errors with telegram-friendly aliases
export {
  AlxRuleEngineError as AlxTelegramError,
  ConfigValidationError,
  TemplateNotFoundError,
  RuleNotFoundError,
  LockAcquisitionError as LockError,
} from '@astralibx/rule-engine';

import { AlxError } from '@astralibx/core';

// Telegram-specific errors not present in core
export class RunError extends AlxError {
  constructor(message: string, public readonly runId?: string) {
    super(message, 'RUN_ERROR');
    this.name = 'RunError';
  }
}

export class ThrottleError extends AlxError {
  constructor(message: string) {
    super(message, 'THROTTLE_ERROR');
    this.name = 'ThrottleError';
  }
}
