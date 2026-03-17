import { describe, it, expect, vi, beforeEach } from 'vitest';
import { RedisLock } from '@astralibx/core';

const mockRedis = {
  set: vi.fn(),
  eval: vi.fn(),
};

describe('RedisLock', () => {
  let lock: RedisLock;
  const mockLogger = { info: vi.fn(), warn: vi.fn(), error: vi.fn() };

  beforeEach(() => {
    vi.clearAllMocks();
    lock = new RedisLock(mockRedis as any, 'test:lock', 30000, mockLogger);
  });

  describe('acquire', () => {
    it('returns true when SET NX succeeds', async () => {
      mockRedis.set.mockResolvedValue('OK');

      const result = await lock.acquire();

      expect(result).toBe(true);
      expect(mockRedis.set).toHaveBeenCalledWith(
        'test:lock',
        expect.any(String),
        'PX',
        30000,
        'NX'
      );
    });

    it('returns false when SET NX fails (lock held)', async () => {
      mockRedis.set.mockResolvedValue(null);

      const result = await lock.acquire();

      expect(result).toBe(false);
    });

    it('uses the provided TTL in milliseconds', async () => {
      const customLock = new RedisLock(mockRedis as any, 'custom:lock', 60000);
      mockRedis.set.mockResolvedValue('OK');

      await customLock.acquire();

      expect(mockRedis.set).toHaveBeenCalledWith(
        'custom:lock',
        expect.any(String),
        'PX',
        60000,
        'NX'
      );
    });
  });

  describe('release', () => {
    it('calls eval with correct Lua script', async () => {
      mockRedis.set.mockResolvedValue('OK');
      mockRedis.eval.mockResolvedValue(1);

      await lock.acquire();
      await lock.release();

      expect(mockRedis.eval).toHaveBeenCalledWith(
        expect.stringContaining("redis.call('get',KEYS[1])"),
        1,
        'test:lock',
        expect.any(String)
      );
    });

    it('only releases own lock (uses lock value in Lua script)', async () => {
      mockRedis.set.mockResolvedValue('OK');
      mockRedis.eval.mockResolvedValue(1);

      await lock.acquire();
      await lock.release();

      const evalCall = mockRedis.eval.mock.calls[0];
      const luaScript = evalCall[0];
      expect(luaScript).toContain("redis.call('get',KEYS[1]) == ARGV[1]");
      expect(luaScript).toContain("redis.call('del',KEYS[1])");
    });

    it('does not throw when eval fails (catches error)', async () => {
      mockRedis.set.mockResolvedValue('OK');
      mockRedis.eval.mockRejectedValue(new Error('Redis connection lost'));

      await lock.acquire();
      await expect(lock.release()).resolves.toBeUndefined();

      expect(mockLogger.error).toHaveBeenCalledWith(
        'Failed to release lock',
        expect.objectContaining({ error: expect.any(Error) })
      );
    });

    it('does not throw when eval returns 0 (lock expired)', async () => {
      mockRedis.set.mockResolvedValue('OK');
      mockRedis.eval.mockResolvedValue(0);

      await lock.acquire();
      await expect(lock.release()).resolves.toBeUndefined();
    });
  });

  describe('without logger', () => {
    it('does not throw when release fails and no logger provided', async () => {
      const lockNoLogger = new RedisLock(mockRedis as any, 'test:lock', 30000);
      mockRedis.set.mockResolvedValue('OK');
      mockRedis.eval.mockRejectedValue(new Error('Redis down'));

      await lockNoLogger.acquire();
      await expect(lockNoLogger.release()).resolves.toBeUndefined();
    });
  });
});
