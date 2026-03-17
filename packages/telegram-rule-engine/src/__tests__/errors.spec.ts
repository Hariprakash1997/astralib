import { describe, it, expect } from 'vitest';
import {
  AlxTelegramError,
  ConfigValidationError,
  RuleNotFoundError,
  TemplateNotFoundError,
  RunError,
  ThrottleError,
  LockError,
} from '../errors';

describe('Error Classes', () => {
  describe('AlxTelegramError', () => {
    it('creates with message and code', () => {
      const err = new AlxTelegramError('something broke', 'CUSTOM_CODE');
      expect(err.message).toBe('something broke');
      expect(err.code).toBe('CUSTOM_CODE');
      expect(err.name).toBe('AlxTelegramError');
    });

    it('is instanceof Error', () => {
      const err = new AlxTelegramError('test', 'TEST');
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

    it('is instanceof AlxTelegramError and Error', () => {
      const err = new ConfigValidationError('msg', 'field');
      expect(err).toBeInstanceOf(AlxTelegramError);
      expect(err).toBeInstanceOf(Error);
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

    it('is instanceof AlxTelegramError', () => {
      expect(new RuleNotFoundError('x')).toBeInstanceOf(AlxTelegramError);
    });

    it('is instanceof Error', () => {
      expect(new RuleNotFoundError('x')).toBeInstanceOf(Error);
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

    it('is instanceof AlxTelegramError', () => {
      expect(new TemplateNotFoundError('x')).toBeInstanceOf(AlxTelegramError);
    });
  });

  describe('RunError', () => {
    it('has correct code and message', () => {
      const err = new RunError('run failed');
      expect(err.code).toBe('RUN_ERROR');
      expect(err.name).toBe('RunError');
      expect(err.message).toBe('run failed');
    });

    it('stores optional runId', () => {
      const err = new RunError('run failed', 'run-789');
      expect(err.runId).toBe('run-789');
    });

    it('runId is undefined when not provided', () => {
      const err = new RunError('run failed');
      expect(err.runId).toBeUndefined();
    });

    it('is instanceof AlxTelegramError', () => {
      expect(new RunError('msg')).toBeInstanceOf(AlxTelegramError);
    });
  });

  describe('ThrottleError', () => {
    it('has correct code and message', () => {
      const err = new ThrottleError('user throttled');
      expect(err.code).toBe('THROTTLE_ERROR');
      expect(err.name).toBe('ThrottleError');
      expect(err.message).toBe('user throttled');
    });

    it('is instanceof AlxTelegramError', () => {
      expect(new ThrottleError('msg')).toBeInstanceOf(AlxTelegramError);
    });
  });

  describe('LockError', () => {
    it('has correct code and fixed message', () => {
      const err = new LockError();
      expect(err.code).toBe('LOCK_ACQUISITION');
      expect(err.name).toBe('LockError');
      expect(err.message).toContain('Could not acquire distributed lock');
    });

    it('is instanceof AlxTelegramError', () => {
      expect(new LockError()).toBeInstanceOf(AlxTelegramError);
    });

    it('is instanceof Error', () => {
      expect(new LockError()).toBeInstanceOf(Error);
    });
  });
});
