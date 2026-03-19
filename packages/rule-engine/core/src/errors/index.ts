import { AlxError } from '@astralibx/core';

export class AlxRuleEngineError extends AlxError {
  constructor(message: string, code: string) {
    super(message, code);
    this.name = 'AlxRuleEngineError';
  }
}

export class ConfigValidationError extends AlxRuleEngineError {
  constructor(message: string, public readonly field: string) {
    super(message, 'CONFIG_VALIDATION');
    this.name = 'ConfigValidationError';
  }
}

export class TemplateNotFoundError extends AlxRuleEngineError {
  constructor(public readonly templateId: string) {
    super(`Template not found: ${templateId}`, 'TEMPLATE_NOT_FOUND');
    this.name = 'TemplateNotFoundError';
  }
}

export class TemplateSyntaxError extends AlxRuleEngineError {
  constructor(message: string, public readonly errors: string[]) {
    super(message, 'TEMPLATE_SYNTAX');
    this.name = 'TemplateSyntaxError';
  }
}

export class RuleNotFoundError extends AlxRuleEngineError {
  constructor(public readonly ruleId: string) {
    super(`Rule not found: ${ruleId}`, 'RULE_NOT_FOUND');
    this.name = 'RuleNotFoundError';
  }
}

export class RuleTemplateIncompatibleError extends AlxRuleEngineError {
  constructor(public readonly reason: string) {
    super(`Rule-template incompatibility: ${reason}`, 'RULE_TEMPLATE_INCOMPATIBLE');
    this.name = 'RuleTemplateIncompatibleError';
  }
}

export class LockAcquisitionError extends AlxRuleEngineError {
  constructor() {
    super('Could not acquire distributed lock — another run is in progress', 'LOCK_ACQUISITION');
    this.name = 'LockAcquisitionError';
  }
}

export class DuplicateSlugError extends AlxRuleEngineError {
  constructor(public readonly slug: string) {
    super(`Template with slug "${slug}" already exists`, 'DUPLICATE_SLUG');
    this.name = 'DuplicateSlugError';
  }
}
