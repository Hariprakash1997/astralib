import { describe, it, expect, vi, beforeEach } from 'vitest';
import { RedisService } from '../services/redis.service';
import { DEFAULT_OPTIONS } from '../types/config.types';
import type { LogAdapter } from '@astralibx/core';
import type { Redis } from 'ioredis';

function createMockLogger(): LogAdapter {
  return { info: vi.fn(), warn: vi.fn(), error: vi.fn() };
}

function createMockRedis() {
  return {
    set: vi.fn().mockResolvedValue('OK'),
    get: vi.fn().mockResolvedValue(null),
    del: vi.fn().mockResolvedValue(1),
    incr: vi.fn().mockResolvedValue(1),
    expire: vi.fn().mockResolvedValue(1),
    rpush: vi.fn().mockResolvedValue(1),
    lrange: vi.fn().mockResolvedValue([]),
    llen: vi.fn().mockResolvedValue(0),
    pexpire: vi.fn().mockResolvedValue(1),
    eval: vi.fn().mockResolvedValue(1),
  } as unknown as Redis;
}

describe('RedisService', () => {
  let service: RedisService;
  let redis: Redis;
  let logger: LogAdapter;

  beforeEach(() => {
    redis = createMockRedis();
    logger = createMockLogger();
    service = new RedisService(redis, DEFAULT_OPTIONS, 'chat:', logger);
  });

  describe('Visitor connection tracking', () => {
    it('should set visitor connection with TTL', async () => {
      await service.setVisitorConnection('sess-1', 'socket-1', 'vis-1');

      expect(redis.set).toHaveBeenCalledWith(
        'chat:visitor:conn:sess-1',
        JSON.stringify({ socketId: 'socket-1', visitorId: 'vis-1' }),
        'EX',
        expect.any(Number),
      );
    });

    it('should get visitor connection', async () => {
      (redis.get as ReturnType<typeof vi.fn>).mockResolvedValue(
        JSON.stringify({ socketId: 'socket-1', visitorId: 'vis-1' }),
      );

      const result = await service.getVisitorConnection('sess-1');
      expect(result).toEqual({ socketId: 'socket-1', visitorId: 'vis-1' });
    });

    it('should return null for missing connection', async () => {
      const result = await service.getVisitorConnection('nonexistent');
      expect(result).toBeNull();
    });

    it('should return null for invalid JSON', async () => {
      (redis.get as ReturnType<typeof vi.fn>).mockResolvedValue('invalid-json');

      const result = await service.getVisitorConnection('sess-1');
      expect(result).toBeNull();
    });

    it('should remove visitor connection', async () => {
      await service.removeVisitorConnection('sess-1');
      expect(redis.del).toHaveBeenCalledWith('chat:visitor:conn:sess-1');
    });
  });

  describe('Agent connection tracking', () => {
    it('should set agent connection', async () => {
      await service.setAgentConnection('agent-1', 'socket-2', 'admin-1');

      expect(redis.set).toHaveBeenCalledWith(
        'chat:agent:conn:agent-1',
        JSON.stringify({ socketId: 'socket-2', adminUserId: 'admin-1' }),
      );
    });

    it('should get agent connection', async () => {
      (redis.get as ReturnType<typeof vi.fn>).mockResolvedValue(
        JSON.stringify({ socketId: 'socket-2', adminUserId: 'admin-1' }),
      );

      const result = await service.getAgentConnection('agent-1');
      expect(result).toEqual({ socketId: 'socket-2', adminUserId: 'admin-1' });
    });
  });

  describe('Rate limiting', () => {
    it('should allow requests under limit', async () => {
      (redis.incr as ReturnType<typeof vi.fn>).mockResolvedValue(1);

      const allowed = await service.checkRateLimit('sess-1');
      expect(allowed).toBe(true);
      expect(redis.expire).toHaveBeenCalledWith('chat:ratelimit:sess-1', 60);
    });

    it('should deny requests over limit', async () => {
      (redis.incr as ReturnType<typeof vi.fn>).mockResolvedValue(DEFAULT_OPTIONS.rateLimitPerMinute + 1);

      const allowed = await service.checkRateLimit('sess-1');
      expect(allowed).toBe(false);
    });

    it('should allow on Redis error', async () => {
      (redis.incr as ReturnType<typeof vi.fn>).mockRejectedValue(new Error('Redis error'));

      const allowed = await service.checkRateLimit('sess-1');
      expect(allowed).toBe(true);
      expect(logger.warn).toHaveBeenCalled();
    });
  });

  describe('Session activity', () => {
    it('should set session activity timestamp', async () => {
      await service.setSessionActivity('sess-1');

      expect(redis.set).toHaveBeenCalledWith(
        'chat:session:activity:sess-1',
        expect.any(String),
        'EX',
        expect.any(Number),
      );
    });

    it('should get session activity', async () => {
      (redis.get as ReturnType<typeof vi.fn>).mockResolvedValue('1700000000000');

      const result = await service.getSessionActivity('sess-1');
      expect(result).toBe(1700000000000);
    });

    it('should return null for no activity', async () => {
      const result = await service.getSessionActivity('nonexistent');
      expect(result).toBeNull();
    });
  });

  describe('AI lock', () => {
    it('should acquire AI lock when available', async () => {
      (redis.set as ReturnType<typeof vi.fn>).mockResolvedValue('OK');

      const acquired = await service.acquireAiLock('sess-1');
      expect(acquired).toBe(true);
      // RedisLock uses a random UUID as value (not '1'), so we check key, PX, ttl, NX
      expect(redis.set).toHaveBeenCalledWith(
        'chat:ai:lock:sess-1',
        expect.any(String),
        'PX',
        60_000,
        'NX',
      );
    });

    it('should fail to acquire when lock exists', async () => {
      (redis.set as ReturnType<typeof vi.fn>).mockResolvedValue(null);

      const acquired = await service.acquireAiLock('sess-1');
      expect(acquired).toBe(false);
    });

    it('should release AI lock', async () => {
      // Must acquire first so the lock instance is stored
      (redis.set as ReturnType<typeof vi.fn>).mockResolvedValue('OK');
      await service.acquireAiLock('sess-1');

      await service.releaseAiLock('sess-1');
      // RedisLock uses a Lua eval script for safe release instead of simple del
      expect(redis.eval).toHaveBeenCalledWith(
        expect.any(String),
        1,
        'chat:ai:lock:sess-1',
        expect.any(String),
      );
    });
  });

  describe('Pending messages', () => {
    it('should add pending message', async () => {
      const msg = { content: 'hello' };
      await service.addPendingMessage('sess-1', msg);

      expect(redis.rpush).toHaveBeenCalledWith(
        'chat:pending:sess-1',
        JSON.stringify(msg),
      );
    });

    it('should get pending messages', async () => {
      (redis.lrange as ReturnType<typeof vi.fn>).mockResolvedValue([
        JSON.stringify({ content: 'hello' }),
        JSON.stringify({ content: 'world' }),
      ]);

      const result = await service.getPendingMessages('sess-1');
      expect(result).toEqual([{ content: 'hello' }, { content: 'world' }]);
    });

    it('should handle invalid JSON in pending messages', async () => {
      (redis.lrange as ReturnType<typeof vi.fn>).mockResolvedValue(['invalid']);

      const result = await service.getPendingMessages('sess-1');
      expect(result).toEqual([{}]);
    });
  });

  describe('Disconnect tracking (reconnect detection)', () => {
    it('should set disconnect marker with TTL', async () => {
      await service.markDisconnected('sess-1');

      expect(redis.set).toHaveBeenCalledWith(
        'chat:disconnect:sess-1',
        '1',
        'PX',
        DEFAULT_OPTIONS.reconnectWindowMs,
      );
    });

    it('should return true and delete key when recent disconnect exists', async () => {
      (redis.get as ReturnType<typeof vi.fn>).mockResolvedValue('1');

      const result = await service.hadRecentDisconnect('sess-1');
      expect(result).toBe(true);
      expect(redis.del).toHaveBeenCalledWith('chat:disconnect:sess-1');
    });

    it('should return false when no recent disconnect', async () => {
      (redis.get as ReturnType<typeof vi.fn>).mockResolvedValue(null);

      const result = await service.hadRecentDisconnect('sess-1');
      expect(result).toBe(false);
      expect(redis.del).not.toHaveBeenCalled();
    });
  });

  describe('getStaleActiveSessions()', () => {
    it('should return empty for empty input', async () => {
      const result = await service.getStaleActiveSessions([]);
      expect(result).toEqual([]);
    });

    it('should identify stale sessions', async () => {
      // First call returns null (no activity), second returns recent timestamp
      (redis.get as ReturnType<typeof vi.fn>)
        .mockResolvedValueOnce(null)
        .mockResolvedValueOnce(Date.now().toString());

      const result = await service.getStaleActiveSessions(['sess-stale', 'sess-active']);
      expect(result).toContain('sess-stale');
      expect(result).not.toContain('sess-active');
    });
  });
});
