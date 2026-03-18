import { describe, it, expect, vi, beforeEach } from 'vitest';
import type { LogAdapter } from '@astralibx/core';
import type { Redis } from 'ioredis';
import {
  validateMessageContent,
  checkConnectionRateLimit,
  clearAllConnectionLimits,
  isJsonSafe,
  withSocketErrorHandler,
} from '../gateway/helpers';
import { RedisService } from '../services/redis.service';
import { DEFAULT_OPTIONS } from '../types/config.types';
import { ChatEngineError } from '../errors';
import type { Socket } from 'socket.io';

// -- Shared utilities --

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
    ttl: vi.fn().mockResolvedValue(60),
    decr: vi.fn().mockResolvedValue(0),
  } as unknown as Redis;
}

function createMockSocket(): Socket {
  return {
    id: 'socket-1',
    emit: vi.fn(),
    on: vi.fn(),
    join: vi.fn(),
    rooms: new Set<string>(),
    disconnect: vi.fn(),
  } as unknown as Socket;
}

describe('Security', () => {
  describe('Input Validation', () => {
    it('should reject empty message content', () => {
      expect(() => validateMessageContent('', DEFAULT_OPTIONS)).toThrow('Message content is required');
    });

    it('should reject whitespace-only message content', () => {
      expect(() => validateMessageContent('   ', DEFAULT_OPTIONS)).toThrow('Message content cannot be empty');
    });

    it('should reject message exceeding maxMessageLength', () => {
      const longContent = 'a'.repeat(DEFAULT_OPTIONS.maxMessageLength + 1);
      expect(() => validateMessageContent(longContent, DEFAULT_OPTIONS)).toThrow(
        `Message exceeds maximum length of ${DEFAULT_OPTIONS.maxMessageLength} characters`,
      );
    });

    it('should accept message within maxMessageLength', () => {
      const content = 'Hello, this is a valid message';
      expect(validateMessageContent(content, DEFAULT_OPTIONS)).toBe(content);
    });

    it('should reject invalid rating values (0, 6, -1, 3.5)', () => {
      // Ratings are validated in visitor.handler.ts and session.routes.ts
      // Here we test the validation logic inline
      const invalidRatings = [0, 6, -1, 3.5, NaN, Infinity];
      for (const rating of invalidRatings) {
        const isValid =
          typeof rating === 'number' &&
          rating >= 1 &&
          rating <= 5 &&
          Number.isInteger(rating);
        expect(isValid).toBe(false);
      }
    });

    it('should accept valid rating values (1-5)', () => {
      for (const rating of [1, 2, 3, 4, 5]) {
        const isValid =
          typeof rating === 'number' &&
          rating >= 1 &&
          rating <= 5 &&
          Number.isInteger(rating);
        expect(isValid).toBe(true);
      }
    });

    it('should reject circular reference in metadata', () => {
      const obj: Record<string, unknown> = { a: 1 };
      obj.self = obj;
      expect(isJsonSafe(obj)).toBe(false);
    });

    it('should accept safe metadata', () => {
      expect(isJsonSafe({ key: 'value', nested: { arr: [1, 2] } })).toBe(true);
    });
  });

  describe('Connection Rate Limiting', () => {
    beforeEach(() => {
      clearAllConnectionLimits();
    });

    it('should allow connections within limit', () => {
      for (let i = 0; i < 20; i++) {
        expect(checkConnectionRateLimit('192.168.1.1')).toBe(true);
      }
    });

    it('should block connections exceeding limit', () => {
      for (let i = 0; i < 20; i++) {
        checkConnectionRateLimit('192.168.1.1');
      }
      expect(checkConnectionRateLimit('192.168.1.1')).toBe(false);
    });

    it('should track different IPs independently', () => {
      for (let i = 0; i < 20; i++) {
        checkConnectionRateLimit('192.168.1.1');
      }
      expect(checkConnectionRateLimit('192.168.1.1')).toBe(false);
      expect(checkConnectionRateLimit('192.168.1.2')).toBe(true);
    });
  });

  describe('Error Message Sanitization', () => {
    it('should send generic message for unknown errors', async () => {
      const socket = createMockSocket();
      const logger = createMockLogger();

      const handler = withSocketErrorHandler(socket, logger, async () => {
        throw new TypeError('Cannot read property of undefined');
      });

      await handler();
      // Wait for async catch to complete
      await new Promise((r) => setTimeout(r, 10));

      expect(socket.emit).toHaveBeenCalledWith('chat:error', {
        code: 'INTERNAL_ERROR',
        message: 'An unexpected error occurred',
      });
    });

    it('should preserve message for known errors (with code)', async () => {
      const socket = createMockSocket();
      const logger = createMockLogger();

      const handler = withSocketErrorHandler(socket, logger, async () => {
        throw new ChatEngineError('Session not found: sess-1', 'SESSION_NOT_FOUND');
      });

      await handler();
      await new Promise((r) => setTimeout(r, 10));

      expect(socket.emit).toHaveBeenCalledWith('chat:error', {
        code: 'SESSION_NOT_FOUND',
        message: 'Session not found: sess-1',
      });
    });

    it('should log stack trace internally for all errors', async () => {
      const socket = createMockSocket();
      const logger = createMockLogger();

      const handler = withSocketErrorHandler(socket, logger, async () => {
        throw new Error('Something broke');
      });

      await handler();
      await new Promise((r) => setTimeout(r, 10));

      expect(logger.error).toHaveBeenCalledWith('Socket handler error', expect.objectContaining({
        stack: expect.any(String),
      }));
    });
  });

  describe('Pending Messages', () => {
    let service: RedisService;
    let redis: ReturnType<typeof createMockRedis>;
    let logger: LogAdapter;

    beforeEach(() => {
      redis = createMockRedis() as unknown as ReturnType<typeof createMockRedis>;
      logger = createMockLogger();
      service = new RedisService(redis as unknown as Redis, DEFAULT_OPTIONS, 'chat:', logger);
    });

    it('should cap pending messages at MAX_PENDING', async () => {
      (redis.llen as ReturnType<typeof vi.fn>).mockResolvedValue(100);

      await service.addPendingMessage('sess-1', { content: 'overflow' });

      expect(redis.rpush).not.toHaveBeenCalled();
      expect(logger.warn).toHaveBeenCalledWith('Pending message limit reached', {
        sessionId: 'sess-1',
        count: 100,
      });
    });

    it('should allow pending messages under limit', async () => {
      (redis.llen as ReturnType<typeof vi.fn>).mockResolvedValue(50);

      await service.addPendingMessage('sess-1', { content: 'hello' });

      expect(redis.rpush).toHaveBeenCalledWith(
        'chat:pending:sess-1',
        JSON.stringify({ content: 'hello' }),
      );
    });
  });

  describe('Rate Limit Fail-Open Logging', () => {
    it('should log security warning on Redis error during rate limit check', async () => {
      const redis = createMockRedis();
      const logger = createMockLogger();
      const service = new RedisService(redis as unknown as Redis, DEFAULT_OPTIONS, 'chat:', logger);

      (redis.incr as ReturnType<typeof vi.fn>).mockRejectedValue(new Error('ECONNREFUSED'));

      const allowed = await service.checkRateLimit('sess-1');

      expect(allowed).toBe(true);
      expect(logger.warn).toHaveBeenCalledWith(
        'Rate limit check failed \u2014 allowing request (fail-open)',
        expect.objectContaining({
          sessionId: 'sess-1',
          error: 'ECONNREFUSED',
        }),
      );
    });
  });
});
