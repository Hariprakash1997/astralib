import { describe, it, expect } from 'vitest';
import {
  ACCOUNT_STATUS,
  IDENTIFIER_STATUS,
  CRITICAL_ERRORS,
  QUARANTINE_ERRORS,
  SKIP_ERRORS,
  RECOVERABLE_ERRORS,
  DEFAULT_HEALTH_SCORE,
  MIN_HEALTH_SCORE,
  MAX_HEALTH_SCORE,
  DEFAULT_DAILY_LIMIT,
  DEFAULT_WARMUP_SCHEDULE,
  DEFAULT_CONNECTION_TIMEOUT_MS,
  DEFAULT_HEALTH_CHECK_INTERVAL_MS,
  DEFAULT_QUARANTINE_MONITOR_INTERVAL_MS,
  DEFAULT_QUARANTINE_DURATION_MS,
  DEFAULT_MAX_ACCOUNTS,
  DEFAULT_RECONNECT_MAX_RETRIES,
  type AccountStatus,
  type IdentifierStatus,
} from '../constants';

describe('Constants', () => {
  describe('ACCOUNT_STATUS', () => {
    it('has all expected values', () => {
      expect(ACCOUNT_STATUS.Connected).toBe('connected');
      expect(ACCOUNT_STATUS.Disconnected).toBe('disconnected');
      expect(ACCOUNT_STATUS.Error).toBe('error');
      expect(ACCOUNT_STATUS.Banned).toBe('banned');
      expect(ACCOUNT_STATUS.Quarantined).toBe('quarantined');
      expect(ACCOUNT_STATUS.Warmup).toBe('warmup');
    });

    it('has exactly 6 entries', () => {
      expect(Object.keys(ACCOUNT_STATUS)).toHaveLength(6);
    });

    it('all values are unique', () => {
      const values = Object.values(ACCOUNT_STATUS);
      expect(new Set(values).size).toBe(values.length);
    });

    it('union type accepts valid values', () => {
      const connected: AccountStatus = 'connected';
      const warmup: AccountStatus = 'warmup';
      expect(connected).toBe(ACCOUNT_STATUS.Connected);
      expect(warmup).toBe(ACCOUNT_STATUS.Warmup);
    });
  });

  describe('IDENTIFIER_STATUS', () => {
    it('has all expected values', () => {
      expect(IDENTIFIER_STATUS.Active).toBe('active');
      expect(IDENTIFIER_STATUS.Blocked).toBe('blocked');
      expect(IDENTIFIER_STATUS.PrivacyBlocked).toBe('privacy_blocked');
      expect(IDENTIFIER_STATUS.Inactive).toBe('inactive');
      expect(IDENTIFIER_STATUS.Invalid).toBe('invalid');
    });

    it('has exactly 5 entries', () => {
      expect(Object.keys(IDENTIFIER_STATUS)).toHaveLength(5);
    });

    it('all values are unique', () => {
      const values = Object.values(IDENTIFIER_STATUS);
      expect(new Set(values).size).toBe(values.length);
    });

    it('union type accepts valid values', () => {
      const blocked: IdentifierStatus = 'blocked';
      expect(blocked).toBe(IDENTIFIER_STATUS.Blocked);
    });
  });

  describe('CRITICAL_ERRORS', () => {
    it('contains expected error codes', () => {
      expect(CRITICAL_ERRORS).toContain('AUTH_KEY_UNREGISTERED');
      expect(CRITICAL_ERRORS).toContain('SESSION_REVOKED');
      expect(CRITICAL_ERRORS).toContain('USER_DEACTIVATED_BAN');
      expect(CRITICAL_ERRORS).toContain('AUTH_KEY_DUPLICATED');
      expect(CRITICAL_ERRORS).toContain('PHONE_NUMBER_BANNED');
    });

    it('has exactly 5 entries', () => {
      expect(CRITICAL_ERRORS).toHaveLength(5);
    });

    it('all values are uppercase strings', () => {
      for (const code of CRITICAL_ERRORS) {
        expect(code).toBe(code.toUpperCase());
        expect(typeof code).toBe('string');
      }
    });
  });

  describe('QUARANTINE_ERRORS', () => {
    it('contains expected error codes', () => {
      expect(QUARANTINE_ERRORS).toContain('PEER_FLOOD');
      expect(QUARANTINE_ERRORS).toContain('USER_RESTRICTED');
    });

    it('has exactly 2 entries', () => {
      expect(QUARANTINE_ERRORS).toHaveLength(2);
    });
  });

  describe('SKIP_ERRORS', () => {
    it('contains expected error codes', () => {
      expect(SKIP_ERRORS).toContain('USER_NOT_FOUND');
      expect(SKIP_ERRORS).toContain('INPUT_USER_DEACTIVATED');
      expect(SKIP_ERRORS).toContain('USER_PRIVACY_RESTRICTED');
      expect(SKIP_ERRORS).toContain('USER_IS_BLOCKED');
      expect(SKIP_ERRORS).toContain('PEER_ID_INVALID');
      expect(SKIP_ERRORS).toContain('USER_IS_BOT');
      expect(SKIP_ERRORS).toContain('CHAT_WRITE_FORBIDDEN');
      expect(SKIP_ERRORS).toContain('USER_NOT_MUTUAL_CONTACT');
      expect(SKIP_ERRORS).toContain('CHAT_SEND_PLAIN_FORBIDDEN');
      expect(SKIP_ERRORS).toContain('CHAT_SEND_MEDIA_FORBIDDEN');
    });

    it('has exactly 10 entries', () => {
      expect(SKIP_ERRORS).toHaveLength(10);
    });
  });

  describe('RECOVERABLE_ERRORS', () => {
    it('contains expected error codes', () => {
      expect(RECOVERABLE_ERRORS).toContain('TIMEOUT');
      expect(RECOVERABLE_ERRORS).toContain('NETWORK_ERROR');
      expect(RECOVERABLE_ERRORS).toContain('RPC_TIMEOUT');
      expect(RECOVERABLE_ERRORS).toContain('CONNECTION_ERROR');
      expect(RECOVERABLE_ERRORS).toContain('MSG_WAIT_FAILED');
      expect(RECOVERABLE_ERRORS).toContain('RPC_CALL_FAIL');
      expect(RECOVERABLE_ERRORS).toContain('CONNECTION_NOT_INITED');
    });

    it('has exactly 7 entries', () => {
      expect(RECOVERABLE_ERRORS).toHaveLength(7);
    });
  });

  describe('default values', () => {
    it('DEFAULT_HEALTH_SCORE is 100', () => {
      expect(DEFAULT_HEALTH_SCORE).toBe(100);
    });

    it('MIN_HEALTH_SCORE is 0', () => {
      expect(MIN_HEALTH_SCORE).toBe(0);
    });

    it('MAX_HEALTH_SCORE is 100', () => {
      expect(MAX_HEALTH_SCORE).toBe(100);
    });

    it('DEFAULT_DAILY_LIMIT is 40', () => {
      expect(DEFAULT_DAILY_LIMIT).toBe(40);
    });

    it('DEFAULT_CONNECTION_TIMEOUT_MS is 30000', () => {
      expect(DEFAULT_CONNECTION_TIMEOUT_MS).toBe(30000);
    });

    it('DEFAULT_HEALTH_CHECK_INTERVAL_MS is 300000', () => {
      expect(DEFAULT_HEALTH_CHECK_INTERVAL_MS).toBe(300000);
    });

    it('DEFAULT_QUARANTINE_MONITOR_INTERVAL_MS is 300000', () => {
      expect(DEFAULT_QUARANTINE_MONITOR_INTERVAL_MS).toBe(300000);
    });

    it('DEFAULT_QUARANTINE_DURATION_MS is 86400000 (24h)', () => {
      expect(DEFAULT_QUARANTINE_DURATION_MS).toBe(86400000);
    });

    it('DEFAULT_MAX_ACCOUNTS is 50', () => {
      expect(DEFAULT_MAX_ACCOUNTS).toBe(50);
    });

    it('DEFAULT_RECONNECT_MAX_RETRIES is 5', () => {
      expect(DEFAULT_RECONNECT_MAX_RETRIES).toBe(5);
    });
  });

  describe('DEFAULT_WARMUP_SCHEDULE', () => {
    it('has 4 phases', () => {
      expect(DEFAULT_WARMUP_SCHEDULE).toHaveLength(4);
    });

    it('first phase covers days 1-3 with limit 10', () => {
      expect(DEFAULT_WARMUP_SCHEDULE[0]).toEqual({
        days: [1, 3],
        dailyLimit: 10,
        delayMinMs: 60000,
        delayMaxMs: 120000,
      });
    });

    it('second phase covers days 4-7 with limit 25', () => {
      expect(DEFAULT_WARMUP_SCHEDULE[1]).toEqual({
        days: [4, 7],
        dailyLimit: 25,
        delayMinMs: 45000,
        delayMaxMs: 90000,
      });
    });

    it('third phase covers days 8-14 with limit 50', () => {
      expect(DEFAULT_WARMUP_SCHEDULE[2]).toEqual({
        days: [8, 14],
        dailyLimit: 50,
        delayMinMs: 30000,
        delayMaxMs: 60000,
      });
    });

    it('fourth phase is open-ended (days[1] = 0) with limit 100', () => {
      expect(DEFAULT_WARMUP_SCHEDULE[3]).toEqual({
        days: [15, 0],
        dailyLimit: 100,
        delayMinMs: 15000,
        delayMaxMs: 45000,
      });
    });

    it('daily limits increase progressively', () => {
      const limits = DEFAULT_WARMUP_SCHEDULE.map((p) => p.dailyLimit);
      for (let i = 1; i < limits.length; i++) {
        expect(limits[i]).toBeGreaterThan(limits[i - 1]);
      }
    });

    it('delays decrease progressively', () => {
      const maxDelays = DEFAULT_WARMUP_SCHEDULE.map((p) => p.delayMaxMs);
      for (let i = 1; i < maxDelays.length; i++) {
        expect(maxDelays[i]).toBeLessThan(maxDelays[i - 1]);
      }
    });

    it('each phase has delayMinMs <= delayMaxMs', () => {
      for (const phase of DEFAULT_WARMUP_SCHEDULE) {
        expect(phase.delayMinMs).toBeLessThanOrEqual(phase.delayMaxMs);
      }
    });
  });

  describe('as const behavior', () => {
    it('values are plain strings (as const is compile-time only)', () => {
      expect(typeof ACCOUNT_STATUS.Connected).toBe('string');
      expect(typeof ACCOUNT_STATUS.Banned).toBe('string');
      expect(typeof IDENTIFIER_STATUS.Active).toBe('string');
      expect(typeof IDENTIFIER_STATUS.PrivacyBlocked).toBe('string');
    });

    it('type-level satisfies checks compile correctly', () => {
      const _status: AccountStatus = ACCOUNT_STATUS.Connected;
      const _idStatus: IdentifierStatus = IDENTIFIER_STATUS.Active;

      expect(_status).toBeDefined();
      expect(_idStatus).toBeDefined();
    });
  });
});
