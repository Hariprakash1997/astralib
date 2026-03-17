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

    it("doesn't throw when eval fails (catches error)", async () => {
      mockRedis.set.mockResolvedValue('OK');
      mockRedis.eval.mockRejectedValue(new Error('Redis connection lost'));

      await lock.acquire();
      await expect(lock.release()).resolves.toBeUndefined();

      expect(mockLogger.error).toHaveBeenCalledWith(
        'Failed to release lock',
        expect.objectContaining({ error: expect.any(Error) })
      );
    });
  });
});
