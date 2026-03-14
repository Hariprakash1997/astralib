import { describe, it, expect } from 'vitest';
import {
  AlxEmailError,
  ConfigValidationError,
  TemplateNotFoundError,
  TemplateSyntaxError,
  RuleNotFoundError,
  RuleTemplateIncompatibleError,
  LockAcquisitionError,
  DuplicateSlugError,
} from '../errors';

describe('Error Classes', () => {
  describe('AlxEmailError', () => {
    it('creates with message and code', () => {
      const err = new AlxEmailError('something broke', 'CUSTOM_CODE');
      expect(err.message).toBe('something broke');
      expect(err.code).toBe('CUSTOM_CODE');
      expect(err.name).toBe('AlxEmailError');
    });

    it('is instanceof Error', () => {
      const err = new AlxEmailError('test', 'TEST');
      expect(err).toBeInstanceOf(Error);
    });
  });

  describe('ConfigValidationError', () => {
    it('has correct code and field', () => {
      const err = new ConfigValidationError('bad config', 'db.connection');
      expect(err.code).toBe('CONFIG_VALIDATION');
      expect(err.field).toBe('db.connection');
      expect(err.name).toBe('ConfigValidationError');
      expect(err.message).toBe('bad config');
    });

    it('is instanceof AlxEmailError and Error', () => {
      const err = new ConfigValidationError('msg', 'field');
      expect(err).toBeInstanceOf(AlxEmailError);
      expect(err).toBeInstanceOf(Error);
    });
  });

  describe('TemplateNotFoundError', () => {
    it('has correct code and templateId', () => {
      const err = new TemplateNotFoundError('tmpl-123');
      expect(err.code).toBe('TEMPLATE_NOT_FOUND');
      expect(err.templateId).toBe('tmpl-123');
      expect(err.name).toBe('TemplateNotFoundError');
      expect(err.message).toBe('Template not found: tmpl-123');
    });

    it('is instanceof AlxEmailError', () => {
      expect(new TemplateNotFoundError('x')).toBeInstanceOf(AlxEmailError);
    });
  });

  describe('TemplateSyntaxError', () => {
    it('has correct code and errors array', () => {
      const syntaxErrors = ['unclosed block', 'missing helper'];
      const err = new TemplateSyntaxError('invalid template', syntaxErrors);
      expect(err.code).toBe('TEMPLATE_SYNTAX');
      expect(err.errors).toEqual(syntaxErrors);
      expect(err.name).toBe('TemplateSyntaxError');
    });

    it('is instanceof AlxEmailError', () => {
      expect(new TemplateSyntaxError('msg', [])).toBeInstanceOf(AlxEmailError);
    });
  });

  describe('RuleNotFoundError', () => {
    it('has correct code and ruleId', () => {
      const err = new RuleNotFoundError('rule-456');
      expect(err.code).toBe('RULE_NOT_FOUND');
      expect(err.ruleId).toBe('rule-456');
      expect(err.name).toBe('RuleNotFoundError');
      expect(err.message).toBe('Rule not found: rule-456');
    });

    it('is instanceof AlxEmailError', () => {
      expect(new RuleNotFoundError('x')).toBeInstanceOf(AlxEmailError);
    });
  });

  describe('RuleTemplateIncompatibleError', () => {
    it('has correct code and reason', () => {
      const err = new RuleTemplateIncompatibleError('audience mismatch');
      expect(err.code).toBe('RULE_TEMPLATE_INCOMPATIBLE');
      expect(err.reason).toBe('audience mismatch');
      expect(err.name).toBe('RuleTemplateIncompatibleError');
      expect(err.message).toBe('Rule-template incompatibility: audience mismatch');
    });

    it('is instanceof AlxEmailError', () => {
      expect(new RuleTemplateIncompatibleError('x')).toBeInstanceOf(AlxEmailError);
    });
  });

  describe('LockAcquisitionError', () => {
    it('has correct code and fixed message', () => {
      const err = new LockAcquisitionError();
      expect(err.code).toBe('LOCK_ACQUISITION');
      expect(err.name).toBe('LockAcquisitionError');
      expect(err.message).toContain('Could not acquire distributed lock');
    });

    it('is instanceof AlxEmailError', () => {
      expect(new LockAcquisitionError()).toBeInstanceOf(AlxEmailError);
    });
  });

  describe('DuplicateSlugError', () => {
    it('has correct code and slug', () => {
      const err = new DuplicateSlugError('welcome-email');
      expect(err.code).toBe('DUPLICATE_SLUG');
      expect(err.slug).toBe('welcome-email');
      expect(err.name).toBe('DuplicateSlugError');
      expect(err.message).toBe('Template with slug "welcome-email" already exists');
    });

    it('is instanceof AlxEmailError', () => {
      expect(new DuplicateSlugError('x')).toBeInstanceOf(AlxEmailError);
    });
  });
});
