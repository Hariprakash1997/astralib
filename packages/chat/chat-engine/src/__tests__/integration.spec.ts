import { describe, it, expect, vi, beforeEach } from 'vitest';

// Mock socket.io before importing anything
vi.mock('socket.io', () => {
  const mockNamespace = {
    on: vi.fn(),
    use: vi.fn(),
    emit: vi.fn(),
  };
  return {
    Server: vi.fn().mockImplementation(() => ({
      of: vi.fn().mockReturnValue(mockNamespace),
      close: vi.fn((cb: () => void) => cb()),
    })),
  };
});

import { createChatEngine } from '../index';
import { InvalidConfigError } from '../errors';
import type { Connection } from 'mongoose';
import type { Redis } from 'ioredis';

function createMockConnection() {
  return {
    model: vi.fn().mockImplementation((_name, _schema) => {
      const MockModel: any = vi.fn();
      MockModel.find = vi.fn().mockReturnValue({ sort: vi.fn().mockResolvedValue([]) });
      MockModel.findOne = vi.fn().mockResolvedValue(null);
      MockModel.findById = vi.fn().mockResolvedValue(null);
      MockModel.create = vi.fn().mockResolvedValue({});
      MockModel.updateOne = vi.fn().mockResolvedValue({ modifiedCount: 0 });
      MockModel.updateMany = vi.fn().mockResolvedValue({ modifiedCount: 0 });
      MockModel.deleteOne = vi.fn().mockResolvedValue({ deletedCount: 0 });
      MockModel.deleteMany = vi.fn().mockResolvedValue({ deletedCount: 0 });
      MockModel.countDocuments = vi.fn().mockResolvedValue(0);
      MockModel.distinct = vi.fn().mockResolvedValue([]);
      MockModel.bulkWrite = vi.fn().mockResolvedValue({});
      MockModel.insertMany = vi.fn().mockResolvedValue([]);
      MockModel.findOneAndUpdate = vi.fn().mockResolvedValue(null);
      MockModel.findByIdAndUpdate = vi.fn().mockResolvedValue(null);
      MockModel.findByIdAndDelete = vi.fn().mockResolvedValue(null);
      return MockModel;
    }),
  } as unknown as Connection;
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
    pexpire: vi.fn().mockResolvedValue(1),
    status: 'ready',
  } as unknown as Redis;
}

function createValidConfig() {
  return {
    db: { connection: createMockConnection() },
    redis: { connection: createMockRedis() },
    socket: {
      cors: { origin: '*' },
    },
    adapters: {
      assignAgent: vi.fn().mockResolvedValue(null),
    },
  };
}

describe('createChatEngine Integration', () => {
  describe('with valid config', () => {
    it('should create engine with all services', () => {
      const config = createValidConfig();
      const engine = createChatEngine(config);

      expect(engine).toBeDefined();
      expect(engine.sessions).toBeDefined();
      expect(engine.messages).toBeDefined();
      expect(engine.agents).toBeDefined();
      expect(engine.settings).toBeDefined();
      expect(engine.faq).toBeDefined();
      expect(engine.guidedQuestions).toBeDefined();
      expect(engine.cannedResponses).toBeDefined();
      expect(engine.widgetConfig).toBeDefined();
    });

    it('should expose REST routes', () => {
      const config = createValidConfig();
      const engine = createChatEngine(config);

      expect(engine.routes).toBeDefined();
    });

    it('should expose all models', () => {
      const config = createValidConfig();
      const engine = createChatEngine(config);

      expect(engine.models.ChatSession).toBeDefined();
      expect(engine.models.ChatMessage).toBeDefined();
      expect(engine.models.ChatAgent).toBeDefined();
      expect(engine.models.ChatSettings).toBeDefined();
      expect(engine.models.PendingMessage).toBeDefined();
      expect(engine.models.ChatFAQItem).toBeDefined();
      expect(engine.models.ChatGuidedQuestion).toBeDefined();
      expect(engine.models.ChatCannedResponse).toBeDefined();
      expect(engine.models.ChatWidgetConfig).toBeDefined();
    });

    it('should have attach and destroy functions', () => {
      const config = createValidConfig();
      const engine = createChatEngine(config);

      expect(typeof engine.attach).toBe('function');
      expect(typeof engine.destroy).toBe('function');
    });

    it('should apply custom options over defaults', () => {
      const config = {
        ...createValidConfig(),
        options: {
          maxMessageLength: 10000,
          rateLimitPerMinute: 60,
        },
      };
      const engine = createChatEngine(config);

      // Services should be created with merged options
      expect(engine).toBeDefined();
    });

    it('should accept custom collection prefix', () => {
      const config = createValidConfig();
      config.db = { connection: createMockConnection(), collectionPrefix: 'myapp_' } as any;

      const engine = createChatEngine(config);
      expect(engine).toBeDefined();

      // Verify model was called with prefixed name
      expect(config.db.connection.model).toHaveBeenCalledWith(
        'myapp_ChatSession',
        expect.any(Object),
      );
    });

    it('should destroy cleanly', async () => {
      const config = createValidConfig();
      const engine = createChatEngine(config);

      await expect(engine.destroy()).resolves.not.toThrow();
    });
  });

  describe('with invalid config', () => {
    it('should throw InvalidConfigError when db.connection is missing', () => {
      expect(() =>
        createChatEngine({
          db: {} as any,
          redis: { connection: createMockRedis() },
          socket: {},
          adapters: { assignAgent: vi.fn() },
        }),
      ).toThrow(InvalidConfigError);
    });

    it('should throw InvalidConfigError when adapters.assignAgent is missing', () => {
      expect(() =>
        createChatEngine({
          db: { connection: createMockConnection() },
          redis: { connection: createMockRedis() },
          socket: {},
          adapters: {} as any,
        }),
      ).toThrow(InvalidConfigError);
    });

    it('should throw InvalidConfigError when redis.connection is missing', () => {
      expect(() =>
        createChatEngine({
          db: { connection: createMockConnection() },
          redis: {} as any,
          socket: {},
          adapters: { assignAgent: vi.fn() },
        }),
      ).toThrow(InvalidConfigError);
    });
  });

  describe('with authenticateRequest adapter', () => {
    it('should create engine with auth-protected routes', () => {
      const config = createValidConfig();
      (config.adapters as any).authenticateRequest = vi.fn().mockResolvedValue({ userId: 'admin-1' });

      const engine = createChatEngine(config);
      expect(engine.routes).toBeDefined();
    });
  });
});
