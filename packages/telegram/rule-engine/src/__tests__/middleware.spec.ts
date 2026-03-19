import { describe, it, expect, vi, beforeEach } from 'vitest';
import {
  categorizeError,
  isRetryableError,
  calculateTelegramDelay,
  checkRedisThrottle,
  incrementRedisThrottle,
} from '../middleware/telegram-send.middleware';

describe('Telegram Send Middleware', () => {
  describe('categorizeError', () => {
    it('returns "critical" for AUTH_KEY_UNREGISTERED', () => {
      expect(categorizeError({ code: 'AUTH_KEY_UNREGISTERED' })).toBe('critical');
    });

    it('returns "critical" for SESSION_REVOKED', () => {
      expect(categorizeError({ code: 'SESSION_REVOKED' })).toBe('critical');
    });

    it('returns "critical" for USER_DEACTIVATED_BAN', () => {
      expect(categorizeError({ code: 'USER_DEACTIVATED_BAN' })).toBe('critical');
    });

    it('returns "critical" for PHONE_NUMBER_BANNED', () => {
      expect(categorizeError({ code: 'PHONE_NUMBER_BANNED' })).toBe('critical');
    });

    it('returns "account" for FLOOD_WAIT', () => {
      expect(categorizeError({ code: 'FLOOD_WAIT' })).toBe('account');
    });

    it('returns "account" for PEER_FLOOD', () => {
      expect(categorizeError({ code: 'PEER_FLOOD' })).toBe('account');
    });

    it('returns "account" for USER_RESTRICTED', () => {
      expect(categorizeError({ code: 'USER_RESTRICTED' })).toBe('account');
    });

    it('returns "account" for SLOWMODE_WAIT', () => {
      expect(categorizeError({ code: 'SLOWMODE_WAIT' })).toBe('account');
    });

    it('returns "recoverable" for TIMEOUT', () => {
      expect(categorizeError({ code: 'TIMEOUT' })).toBe('recoverable');
    });

    it('returns "recoverable" for NETWORK_ERROR', () => {
      expect(categorizeError({ code: 'NETWORK_ERROR' })).toBe('recoverable');
    });

    it('returns "recoverable" for RPC_TIMEOUT', () => {
      expect(categorizeError({ code: 'RPC_TIMEOUT' })).toBe('recoverable');
    });

    it('returns "recoverable" for CONNECTION_ERROR', () => {
      expect(categorizeError({ code: 'CONNECTION_ERROR' })).toBe('recoverable');
    });

    it('returns "recoverable" for RPC_CALL_FAIL', () => {
      expect(categorizeError({ code: 'RPC_CALL_FAIL' })).toBe('recoverable');
    });

    it('returns "skip" for USER_NOT_FOUND', () => {
      expect(categorizeError({ code: 'USER_NOT_FOUND' })).toBe('skip');
    });

    it('returns "skip" for USER_PRIVACY_RESTRICTED', () => {
      expect(categorizeError({ code: 'USER_PRIVACY_RESTRICTED' })).toBe('skip');
    });

    it('returns "skip" for USER_IS_BLOCKED', () => {
      expect(categorizeError({ code: 'USER_IS_BLOCKED' })).toBe('skip');
    });

    it('returns "skip" for PEER_ID_INVALID', () => {
      expect(categorizeError({ code: 'PEER_ID_INVALID' })).toBe('skip');
    });

    it('returns "skip" for CHAT_WRITE_FORBIDDEN', () => {
      expect(categorizeError({ code: 'CHAT_WRITE_FORBIDDEN' })).toBe('skip');
    });

    it('returns "unknown" for unrecognized error codes', () => {
      expect(categorizeError({ code: 'SOMETHING_RANDOM' })).toBe('unknown');
    });

    it('returns "unknown" for errors without a code', () => {
      expect(categorizeError(new Error('plain error'))).toBe('unknown');
    });

    it('reads errorMessage when code is absent', () => {
      expect(categorizeError({ errorMessage: 'FLOOD_WAIT_30' })).toBe('account');
    });

    it('handles null/undefined errors', () => {
      expect(categorizeError(null)).toBe('unknown');
      expect(categorizeError(undefined)).toBe('unknown');
    });
  });

  describe('isRetryableError', () => {
    it('returns true for recoverable errors', () => {
      expect(isRetryableError({ code: 'TIMEOUT' })).toBe(true);
      expect(isRetryableError({ code: 'NETWORK_ERROR' })).toBe(true);
      expect(isRetryableError({ code: 'CONNECTION_ERROR' })).toBe(true);
    });

    it('returns false for critical errors', () => {
      expect(isRetryableError({ code: 'AUTH_KEY_UNREGISTERED' })).toBe(false);
    });

    it('returns false for account errors', () => {
      expect(isRetryableError({ code: 'FLOOD_WAIT' })).toBe(false);
    });

    it('returns false for skip errors', () => {
      expect(isRetryableError({ code: 'USER_NOT_FOUND' })).toBe(false);
    });

    it('returns false for unknown errors', () => {
      expect(isRetryableError({ code: 'SOMETHING_ELSE' })).toBe(false);
    });
  });

  describe('calculateTelegramDelay', () => {
    beforeEach(() => {
      vi.restoreAllMocks();
    });

    it('returns base delay with no health adjustment', () => {
      vi.spyOn(Math, 'random').mockReturnValue(0.5);
      const delay = calculateTelegramDelay(3000, 0, 0);
      expect(delay).toBe(3000);
    });

    it('applies health adjustment when healthScore is provided', () => {
      vi.spyOn(Math, 'random').mockReturnValue(0.5);
      const delay = calculateTelegramDelay(3000, 0, 0, 50);
      // getHumanDelay(3000, 0, 0) = 3000
      // getHealthAdjustedDelay(3000, 50, 3) = 3000 * (1 + 3 * 0.5) = 7500
      expect(delay).toBe(7500);
    });

    it('applies custom health multiplier', () => {
      vi.spyOn(Math, 'random').mockReturnValue(0.5);
      const delay = calculateTelegramDelay(3000, 0, 0, 0, 5);
      // health = 0: factor = 1 + 5 * 1 = 6
      expect(delay).toBe(18000);
    });

    it('returns 4x delay when healthScore is 0 with default multiplier', () => {
      vi.spyOn(Math, 'random').mockReturnValue(0.5);
      const delay = calculateTelegramDelay(3000, 0, 0, 0);
      // factor = 1 + 3 * 1 = 4
      expect(delay).toBe(12000);
    });

    it('returns base delay when healthScore is 100', () => {
      vi.spyOn(Math, 'random').mockReturnValue(0.5);
      const delay = calculateTelegramDelay(3000, 0, 0, 100);
      expect(delay).toBe(3000);
    });

    it('includes jitter when jitterMs > 0', () => {
      // random=0 makes jitter = -jitter, so delay = base - jitter = 1500
      vi.spyOn(Math, 'random').mockReturnValue(0);
      const delay = calculateTelegramDelay(3000, 1500, 0);
      expect(delay).toBe(1500);
    });
  });

  describe('checkRedisThrottle', () => {
    function createMockRedis(data: Record<string, string> = {}) {
      return {
        hgetall: vi.fn().mockResolvedValue(data),
      } as any;
    }

    it('allows when no prior sends', async () => {
      const redis = createMockRedis({});
      const result = await checkRedisThrottle(
        { redis, keyPrefix: 'test:' },
        'id-1',
        { maxPerUserPerDay: 3, maxPerUserPerWeek: 10, minGapDays: 0 },
      );

      expect(result.allowed).toBe(true);
    });

    it('blocks when daily limit reached', async () => {
      const todayStr = new Intl.DateTimeFormat('en-CA').format(new Date());
      const redis = createMockRedis({
        today: '3',
        todayDate: todayStr,
        thisWeek: '3',
      });

      const result = await checkRedisThrottle(
        { redis, keyPrefix: 'test:' },
        'id-1',
        { maxPerUserPerDay: 3, maxPerUserPerWeek: 10, minGapDays: 0 },
      );

      expect(result.allowed).toBe(false);
      expect(result.reason).toContain('daily');
    });

    it('blocks when weekly limit reached', async () => {
      const todayStr = new Intl.DateTimeFormat('en-CA').format(new Date());
      // Calculate current week start for test
      const now = new Date();
      const day = now.getDay();
      const diff = now.getDate() - day + (day === 0 ? -6 : 1);
      const monday = new Date(now);
      monday.setDate(diff);
      const weekStartStr = new Intl.DateTimeFormat('en-CA', { timeZone: 'UTC' }).format(monday);

      const redis = createMockRedis({
        today: '1',
        todayDate: todayStr,
        thisWeek: '10',
        weekStartDate: weekStartStr,
      });

      const result = await checkRedisThrottle(
        { redis, keyPrefix: 'test:' },
        'id-1',
        { maxPerUserPerDay: 5, maxPerUserPerWeek: 10, minGapDays: 0 },
      );

      expect(result.allowed).toBe(false);
      expect(result.reason).toContain('weekly');
    });

    it('blocks when min gap days not met', async () => {
      const recentDate = new Date(Date.now() - 86400000); // 1 day ago
      const redis = createMockRedis({
        today: '0',
        thisWeek: '1',
        lastSentDate: recentDate.toISOString(),
      });

      const result = await checkRedisThrottle(
        { redis, keyPrefix: 'test:' },
        'id-1',
        { maxPerUserPerDay: 5, maxPerUserPerWeek: 10, minGapDays: 3 },
      );

      expect(result.allowed).toBe(false);
      expect(result.reason).toContain('gap');
    });

    it('allows when gap days are met', async () => {
      const oldDate = new Date(Date.now() - 4 * 86400000); // 4 days ago
      const redis = createMockRedis({
        today: '0',
        thisWeek: '1',
        lastSentDate: oldDate.toISOString(),
      });

      const result = await checkRedisThrottle(
        { redis, keyPrefix: 'test:' },
        'id-1',
        { maxPerUserPerDay: 5, maxPerUserPerWeek: 10, minGapDays: 3 },
      );

      expect(result.allowed).toBe(true);
    });

    it('resets daily counter when date changed', async () => {
      const redis = createMockRedis({
        today: '99',
        todayDate: '2020-01-01', // old date
        thisWeek: '0',
      });

      const result = await checkRedisThrottle(
        { redis, keyPrefix: 'test:' },
        'id-1',
        { maxPerUserPerDay: 3, maxPerUserPerWeek: 10, minGapDays: 0 },
      );

      expect(result.allowed).toBe(true); // counter reset to 0
    });

    it('fails open when redis throws', async () => {
      const redis = {
        hgetall: vi.fn().mockRejectedValue(new Error('Connection refused')),
      } as any;

      const result = await checkRedisThrottle(
        { redis, keyPrefix: 'test:', logger: { info: vi.fn(), warn: vi.fn(), error: vi.fn() } },
        'id-1',
        { maxPerUserPerDay: 1, maxPerUserPerWeek: 1, minGapDays: 0 },
      );

      expect(result.allowed).toBe(true);
    });
  });

  describe('incrementRedisThrottle', () => {
    it('creates a pipeline with hset/hincrby and expire', async () => {
      const execMock = vi.fn().mockResolvedValue([]);
      const pipe = {
        hset: vi.fn().mockReturnThis(),
        hincrby: vi.fn().mockReturnThis(),
        expire: vi.fn().mockReturnThis(),
        exec: execMock,
      };
      const redis = {
        hget: vi.fn().mockResolvedValue(null),
        pipeline: vi.fn().mockReturnValue(pipe),
      } as any;

      await incrementRedisThrottle({ redis, keyPrefix: 'test:' }, 'id-1');

      expect(redis.pipeline).toHaveBeenCalled();
      expect(pipe.expire).toHaveBeenCalled();
      expect(execMock).toHaveBeenCalled();
    });

    it('increments existing counter when date matches', async () => {
      const todayStr = new Intl.DateTimeFormat('en-CA').format(new Date());
      const execMock = vi.fn().mockResolvedValue([]);
      const pipe = {
        hset: vi.fn().mockReturnThis(),
        hincrby: vi.fn().mockReturnThis(),
        expire: vi.fn().mockReturnThis(),
        exec: execMock,
      };
      const redis = {
        hget: vi.fn().mockImplementation(async (_key: string, field: string) => {
          if (field === 'todayDate') return todayStr;
          return null;
        }),
        pipeline: vi.fn().mockReturnValue(pipe),
      } as any;

      await incrementRedisThrottle({ redis, keyPrefix: 'test:' }, 'id-1');

      // When todayDate matches, it should use hincrby instead of hset for today
      expect(pipe.hincrby).toHaveBeenCalledWith(
        expect.stringContaining('throttle:id-1'),
        'today',
        1,
      );
    });

    it('does not throw when redis pipeline fails', async () => {
      const redis = {
        hget: vi.fn().mockResolvedValue(null),
        pipeline: vi.fn().mockReturnValue({
          hset: vi.fn().mockReturnThis(),
          hincrby: vi.fn().mockReturnThis(),
          expire: vi.fn().mockReturnThis(),
          exec: vi.fn().mockRejectedValue(new Error('Pipeline failed')),
        }),
      } as any;

      await expect(
        incrementRedisThrottle(
          { redis, keyPrefix: 'test:', logger: { info: vi.fn(), warn: vi.fn(), error: vi.fn() } },
          'id-1',
        ),
      ).resolves.toBeUndefined();
    });
  });
});
