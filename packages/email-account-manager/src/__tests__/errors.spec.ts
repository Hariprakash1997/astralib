import { describe, it, expect } from 'vitest';
import {
  AlxAccountError,
  ConfigValidationError,
  AccountDisabledError,
  NoAvailableAccountError,
  SmtpConnectionError,
  InvalidTokenError,
  QuotaExceededError,
  SnsSignatureError,
  AccountNotFoundError,
  DraftNotFoundError,
} from '../errors';

describe('Error Classes', () => {
  describe('AlxAccountError', () => {
    it('creates with message and code', () => {
      const err = new AlxAccountError('something broke', 'CUSTOM_CODE');
      expect(err.message).toBe('something broke');
      expect(err.code).toBe('CUSTOM_CODE');
      expect(err.name).toBe('AlxAccountError');
    });

    it('is instanceof Error', () => {
      const err = new AlxAccountError('test', 'TEST');
      expect(err).toBeInstanceOf(Error);
    });

    it('captures stack trace', () => {
      const err = new AlxAccountError('test', 'TEST');
      expect(err.stack).toBeDefined();
      expect(err.stack).toContain('AlxAccountError');
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

    it('is instanceof AlxAccountError and Error', () => {
      const err = new ConfigValidationError('msg', 'field');
      expect(err).toBeInstanceOf(AlxAccountError);
      expect(err).toBeInstanceOf(Error);
    });

    it('captures stack trace', () => {
      const err = new ConfigValidationError('msg', 'field');
      expect(err.stack).toBeDefined();
    });
  });

  describe('AccountDisabledError', () => {
    it('has correct code, accountId, and reason', () => {
      const err = new AccountDisabledError('acc-123', 'too many bounces');
      expect(err.code).toBe('ACCOUNT_DISABLED');
      expect(err.accountId).toBe('acc-123');
      expect(err.reason).toBe('too many bounces');
      expect(err.name).toBe('AccountDisabledError');
      expect(err.message).toBe('Account acc-123 is disabled: too many bounces');
    });

    it('is instanceof AlxAccountError and Error', () => {
      const err = new AccountDisabledError('acc-1', 'reason');
      expect(err).toBeInstanceOf(AlxAccountError);
      expect(err).toBeInstanceOf(Error);
    });

    it('formats message with accountId and reason', () => {
      const err = new AccountDisabledError('my-account', 'quota exceeded');
      expect(err.message).toContain('my-account');
      expect(err.message).toContain('quota exceeded');
    });
  });

  describe('NoAvailableAccountError', () => {
    it('has correct code and fixed message', () => {
      const err = new NoAvailableAccountError();
      expect(err.code).toBe('NO_AVAILABLE_ACCOUNT');
      expect(err.name).toBe('NoAvailableAccountError');
      expect(err.message).toBe('No available accounts with remaining capacity');
    });

    it('is instanceof AlxAccountError and Error', () => {
      const err = new NoAvailableAccountError();
      expect(err).toBeInstanceOf(AlxAccountError);
      expect(err).toBeInstanceOf(Error);
    });
  });

  describe('SmtpConnectionError', () => {
    it('has correct code, accountId, and originalError', () => {
      const original = new Error('ECONNREFUSED');
      const err = new SmtpConnectionError('acc-456', original);
      expect(err.code).toBe('SMTP_CONNECTION');
      expect(err.accountId).toBe('acc-456');
      expect(err.originalError).toBe(original);
      expect(err.name).toBe('SmtpConnectionError');
      expect(err.message).toBe('SMTP connection failed for account acc-456: ECONNREFUSED');
    });

    it('is instanceof AlxAccountError and Error', () => {
      const err = new SmtpConnectionError('acc-1', new Error('fail'));
      expect(err).toBeInstanceOf(AlxAccountError);
      expect(err).toBeInstanceOf(Error);
    });

    it('preserves original error reference', () => {
      const original = new Error('timeout');
      const err = new SmtpConnectionError('acc-1', original);
      expect(err.originalError).toBe(original);
      expect(err.originalError.message).toBe('timeout');
    });
  });

  describe('InvalidTokenError', () => {
    it('has correct code and tokenType', () => {
      const err = new InvalidTokenError('unsubscribe');
      expect(err.code).toBe('INVALID_TOKEN');
      expect(err.tokenType).toBe('unsubscribe');
      expect(err.name).toBe('InvalidTokenError');
      expect(err.message).toBe('Invalid or expired unsubscribe token');
    });

    it('is instanceof AlxAccountError and Error', () => {
      const err = new InvalidTokenError('unsubscribe');
      expect(err).toBeInstanceOf(AlxAccountError);
      expect(err).toBeInstanceOf(Error);
    });
  });

  describe('QuotaExceededError', () => {
    it('has correct code, accountId, dailyMax, and currentSent', () => {
      const err = new QuotaExceededError('acc-789', 100, 105);
      expect(err.code).toBe('QUOTA_EXCEEDED');
      expect(err.accountId).toBe('acc-789');
      expect(err.dailyMax).toBe(100);
      expect(err.currentSent).toBe(105);
      expect(err.name).toBe('QuotaExceededError');
      expect(err.message).toBe('Account acc-789 exceeded daily quota: 105/100');
    });

    it('is instanceof AlxAccountError and Error', () => {
      const err = new QuotaExceededError('acc-1', 50, 60);
      expect(err).toBeInstanceOf(AlxAccountError);
      expect(err).toBeInstanceOf(Error);
    });

    it('formats message with quota numbers', () => {
      const err = new QuotaExceededError('test-acc', 200, 250);
      expect(err.message).toContain('250/200');
    });
  });

  describe('SnsSignatureError', () => {
    it('has correct code and fixed message', () => {
      const err = new SnsSignatureError();
      expect(err.code).toBe('SNS_SIGNATURE_INVALID');
      expect(err.name).toBe('SnsSignatureError');
      expect(err.message).toBe('SNS message signature verification failed');
    });

    it('is instanceof AlxAccountError and Error', () => {
      const err = new SnsSignatureError();
      expect(err).toBeInstanceOf(AlxAccountError);
      expect(err).toBeInstanceOf(Error);
    });
  });

  describe('AccountNotFoundError', () => {
    it('has correct code and accountId', () => {
      const err = new AccountNotFoundError('acc-999');
      expect(err.code).toBe('ACCOUNT_NOT_FOUND');
      expect(err.accountId).toBe('acc-999');
      expect(err.name).toBe('AccountNotFoundError');
      expect(err.message).toBe('Account not found: acc-999');
    });

    it('is instanceof AlxAccountError and Error', () => {
      const err = new AccountNotFoundError('x');
      expect(err).toBeInstanceOf(AlxAccountError);
      expect(err).toBeInstanceOf(Error);
    });
  });

  describe('DraftNotFoundError', () => {
    it('has correct code and draftId', () => {
      const err = new DraftNotFoundError('draft-abc');
      expect(err.code).toBe('DRAFT_NOT_FOUND');
      expect(err.draftId).toBe('draft-abc');
      expect(err.name).toBe('DraftNotFoundError');
      expect(err.message).toBe('Draft not found: draft-abc');
    });

    it('is instanceof AlxAccountError and Error', () => {
      const err = new DraftNotFoundError('x');
      expect(err).toBeInstanceOf(AlxAccountError);
      expect(err).toBeInstanceOf(Error);
    });
  });
});
