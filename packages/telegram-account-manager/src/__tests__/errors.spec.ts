import { describe, it, expect } from 'vitest';
import {
  AlxTelegramAccountError,
  ConfigValidationError,
  ConnectionError,
  AccountNotFoundError,
  AccountBannedError,
  QuarantineError,
  normalizeErrorCode,
} from '../errors';

describe('Error Classes', () => {
  describe('AlxTelegramAccountError', () => {
    it('creates with message and code', () => {
      const err = new AlxTelegramAccountError('something broke', 'CUSTOM_CODE');
      expect(err.message).toBe('something broke');
      expect(err.code).toBe('CUSTOM_CODE');
      expect(err.name).toBe('AlxTelegramAccountError');
    });

    it('is instanceof Error', () => {
      const err = new AlxTelegramAccountError('test', 'TEST');
      expect(err).toBeInstanceOf(Error);
    });

    it('captures stack trace', () => {
      const err = new AlxTelegramAccountError('test', 'TEST');
      expect(err.stack).toBeDefined();
      expect(err.stack).toContain('AlxTelegramAccountError');
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

    it('is instanceof AlxTelegramAccountError and Error', () => {
      const err = new ConfigValidationError('msg', 'field');
      expect(err).toBeInstanceOf(AlxTelegramAccountError);
      expect(err).toBeInstanceOf(Error);
    });

    it('captures stack trace', () => {
      const err = new ConfigValidationError('msg', 'field');
      expect(err.stack).toBeDefined();
    });
  });

  describe('ConnectionError', () => {
    it('has correct code, accountId, and originalError', () => {
      const original = new Error('ECONNREFUSED');
      const err = new ConnectionError('acc-456', original);
      expect(err.code).toBe('CONNECTION_ERROR');
      expect(err.accountId).toBe('acc-456');
      expect(err.originalError).toBe(original);
      expect(err.name).toBe('ConnectionError');
      expect(err.message).toBe('Telegram connection failed for account acc-456: ECONNREFUSED');
    });

    it('is instanceof AlxTelegramAccountError and Error', () => {
      const err = new ConnectionError('acc-1', new Error('fail'));
      expect(err).toBeInstanceOf(AlxTelegramAccountError);
      expect(err).toBeInstanceOf(Error);
    });

    it('preserves original error reference', () => {
      const original = new Error('timeout');
      const err = new ConnectionError('acc-1', original);
      expect(err.originalError).toBe(original);
      expect(err.originalError.message).toBe('timeout');
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

    it('is instanceof AlxTelegramAccountError and Error', () => {
      const err = new AccountNotFoundError('x');
      expect(err).toBeInstanceOf(AlxTelegramAccountError);
      expect(err).toBeInstanceOf(Error);
    });
  });

  describe('AccountBannedError', () => {
    it('has correct code, accountId, and errorCode', () => {
      const err = new AccountBannedError('acc-123', 'USER_DEACTIVATED_BAN');
      expect(err.code).toBe('ACCOUNT_BANNED');
      expect(err.accountId).toBe('acc-123');
      expect(err.errorCode).toBe('USER_DEACTIVATED_BAN');
      expect(err.name).toBe('AccountBannedError');
      expect(err.message).toBe('Account acc-123 is banned: USER_DEACTIVATED_BAN');
    });

    it('is instanceof AlxTelegramAccountError and Error', () => {
      const err = new AccountBannedError('acc-1', 'PHONE_NUMBER_BANNED');
      expect(err).toBeInstanceOf(AlxTelegramAccountError);
      expect(err).toBeInstanceOf(Error);
    });

    it('formats message with accountId and errorCode', () => {
      const err = new AccountBannedError('my-account', 'SESSION_REVOKED');
      expect(err.message).toContain('my-account');
      expect(err.message).toContain('SESSION_REVOKED');
    });
  });

  describe('QuarantineError', () => {
    it('has correct code, accountId, reason, and until', () => {
      const until = new Date('2025-06-15T12:00:00Z');
      const err = new QuarantineError('acc-456', 'PEER_FLOOD', until);
      expect(err.code).toBe('QUARANTINE');
      expect(err.accountId).toBe('acc-456');
      expect(err.reason).toBe('PEER_FLOOD');
      expect(err.until).toBe(until);
      expect(err.name).toBe('QuarantineError');
      expect(err.message).toBe(`Account acc-456 is quarantined until ${until.toISOString()}: PEER_FLOOD`);
    });

    it('is instanceof AlxTelegramAccountError and Error', () => {
      const err = new QuarantineError('acc-1', 'reason', new Date());
      expect(err).toBeInstanceOf(AlxTelegramAccountError);
      expect(err).toBeInstanceOf(Error);
    });

    it('formats message with ISO date string', () => {
      const until = new Date('2025-12-31T23:59:59Z');
      const err = new QuarantineError('acc-1', 'flood', until);
      expect(err.message).toContain('2025-12-31T23:59:59.000Z');
    });
  });
});

describe('normalizeErrorCode()', () => {
  describe('RPCError with .errorMessage property', () => {
    it('extracts error code from errorMessage', () => {
      const rpcError = { errorMessage: 'AUTH_KEY_UNREGISTERED' };
      const result = normalizeErrorCode(rpcError);
      expect(result).toEqual({ code: 'AUTH_KEY_UNREGISTERED' });
    });

    it('uppercases the error code', () => {
      const rpcError = { errorMessage: 'peer_flood' };
      const result = normalizeErrorCode(rpcError);
      expect(result).toEqual({ code: 'PEER_FLOOD' });
    });

    it('trims whitespace', () => {
      const rpcError = { errorMessage: '  USER_NOT_FOUND  ' };
      const result = normalizeErrorCode(rpcError);
      expect(result).toEqual({ code: 'USER_NOT_FOUND' });
    });
  });

  describe('FLOOD_WAIT extraction', () => {
    it('extracts FLOOD_WAIT with seconds from RPCError', () => {
      const rpcError = { errorMessage: 'FLOOD_WAIT_300', seconds: 300 };
      const result = normalizeErrorCode(rpcError);
      expect(result).toEqual({ code: 'FLOOD_WAIT', floodWaitSeconds: 300 });
    });

    it('handles FLOOD_WAIT without seconds property', () => {
      const rpcError = { errorMessage: 'FLOOD_WAIT_60' };
      const result = normalizeErrorCode(rpcError);
      expect(result).toEqual({ code: 'FLOOD_WAIT', floodWaitSeconds: undefined });
    });

    it('extracts SLOWMODE_WAIT with seconds', () => {
      const rpcError = { errorMessage: 'SLOWMODE_WAIT_120', seconds: 120 };
      const result = normalizeErrorCode(rpcError);
      expect(result).toEqual({ code: 'SLOWMODE_WAIT', floodWaitSeconds: 120 });
    });
  });

  describe('Error with .code property', () => {
    it('extracts from .code string property', () => {
      const err = { code: 'NETWORK_ERROR' };
      const result = normalizeErrorCode(err);
      expect(result).toEqual({ code: 'NETWORK_ERROR' });
    });

    it('uppercases the code', () => {
      const err = { code: 'timeout' };
      const result = normalizeErrorCode(err);
      expect(result).toEqual({ code: 'TIMEOUT' });
    });
  });

  describe('Error with .message property containing error code', () => {
    it('extracts error code from message using regex', () => {
      const err = new Error('Got error AUTH_KEY_UNREGISTERED from server');
      const result = normalizeErrorCode(err);
      expect(result).toEqual({ code: 'AUTH_KEY_UNREGISTERED' });
    });

    it('extracts FLOOD_WAIT from message with seconds', () => {
      const err = new Error('FLOOD_WAIT_300 wait 300 seconds');
      const result = normalizeErrorCode(err);
      expect(result.code).toBe('FLOOD_WAIT');
      expect(result.floodWaitSeconds).toBe(300);
    });

    it('returns UNKNOWN_ERROR for message without error code pattern', () => {
      const err = new Error('something went wrong');
      const result = normalizeErrorCode(err);
      expect(result).toEqual({ code: 'UNKNOWN_ERROR' });
    });
  });

  describe('edge cases', () => {
    it('returns UNKNOWN_ERROR for null', () => {
      const result = normalizeErrorCode(null);
      expect(result).toEqual({ code: 'UNKNOWN_ERROR' });
    });

    it('returns UNKNOWN_ERROR for undefined', () => {
      const result = normalizeErrorCode(undefined);
      expect(result).toEqual({ code: 'UNKNOWN_ERROR' });
    });

    it('returns UNKNOWN_ERROR for plain string', () => {
      const result = normalizeErrorCode('some string');
      expect(result).toEqual({ code: 'UNKNOWN_ERROR' });
    });

    it('returns UNKNOWN_ERROR for number', () => {
      const result = normalizeErrorCode(42);
      expect(result).toEqual({ code: 'UNKNOWN_ERROR' });
    });

    it('prioritizes errorMessage over code property', () => {
      const err = { errorMessage: 'PEER_FLOOD', code: 'DIFFERENT_CODE' };
      const result = normalizeErrorCode(err);
      expect(result).toEqual({ code: 'PEER_FLOOD' });
    });
  });
});
