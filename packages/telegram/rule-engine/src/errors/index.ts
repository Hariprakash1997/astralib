import { AlxError } from '@astralibx/core';

export class AlxTelegramError extends AlxError {
  constructor(message: string, code: string) {
    super(message, code);
    this.name = 'AlxTelegramError';
  }
}

export class ConfigValidationError extends AlxTelegramError {
  constructor(message: string, public readonly field: string) {
    super(message, 'CONFIG_VALIDATION');
    this.name = 'ConfigValidationError';
  }
}

export class RuleNotFoundError extends AlxTelegramError {
  constructor(public readonly ruleId: string) {
    super(`Rule not found: ${ruleId}`, 'RULE_NOT_FOUND');
    this.name = 'RuleNotFoundError';
  }
}

export class TemplateNotFoundError extends AlxTelegramError {
  constructor(public readonly templateId: string) {
    super(`Template not found: ${templateId}`, 'TEMPLATE_NOT_FOUND');
    this.name = 'TemplateNotFoundError';
  }
}

export class RunError extends AlxTelegramError {
  constructor(message: string, public readonly runId?: string) {
    super(message, 'RUN_ERROR');
    this.name = 'RunError';
  }
}

export class ThrottleError extends AlxTelegramError {
  constructor(message: string) {
    super(message, 'THROTTLE_ERROR');
    this.name = 'ThrottleError';
  }
}

export class LockError extends AlxTelegramError {
  constructor() {
    super('Could not acquire distributed lock — another run is in progress', 'LOCK_ACQUISITION');
    this.name = 'LockError';
  }
}
