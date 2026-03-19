import { describe, it, expect } from 'vitest';
import {
  AlxRuleEngineError, ConfigValidationError, TemplateNotFoundError,
  TemplateSyntaxError, RuleNotFoundError, RuleTemplateIncompatibleError,
  LockAcquisitionError, DuplicateSlugError
} from '../errors';

describe('Error classes', () => {
  it('AlxRuleEngineError should extend Error', () => {
    const err = new AlxRuleEngineError('test', 'TEST');
    expect(err).toBeInstanceOf(Error);
    expect(err.message).toBe('test');
    expect(err.name).toBe('AlxRuleEngineError');
  });

  it('ConfigValidationError should include field', () => {
    const err = new ConfigValidationError('bad config', 'db');
    expect(err.field).toBe('db');
    expect(err).toBeInstanceOf(AlxRuleEngineError);
  });

  it('TemplateNotFoundError should include templateId', () => {
    const err = new TemplateNotFoundError('abc123');
    expect(err.templateId).toBe('abc123');
    expect(err.message).toContain('abc123');
  });

  it('TemplateSyntaxError should include errors array', () => {
    const err = new TemplateSyntaxError('bad syntax', ['err1', 'err2']);
    expect(err.errors).toEqual(['err1', 'err2']);
  });

  it('RuleNotFoundError should include ruleId', () => {
    const err = new RuleNotFoundError('rule1');
    expect(err.ruleId).toBe('rule1');
  });

  it('RuleTemplateIncompatibleError should include reason', () => {
    const err = new RuleTemplateIncompatibleError('mismatch');
    expect(err.reason).toBe('mismatch');
  });

  it('LockAcquisitionError should have fixed message', () => {
    const err = new LockAcquisitionError();
    expect(err.message).toContain('lock');
  });

  it('DuplicateSlugError should include slug', () => {
    const err = new DuplicateSlugError('my-slug');
    expect(err.slug).toBe('my-slug');
  });
});
