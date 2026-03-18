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

    it('should accept config without assignAgent adapter (solo mode)', () => {
      const engine = createChatEngine({
        db: { connection: createMockConnection() },
        redis: { connection: createMockRedis() },
        socket: {},
        adapters: {},
      } as any);

      expect(engine).toBeDefined();
      expect(engine.sessions).toBeDefined();
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

  describe('solo mode (no assignAgent)', () => {
    it('should create engine without assignAgent', () => {
      const engine = createChatEngine({
        db: { connection: createMockConnection() },
        redis: { connection: createMockRedis() },
        socket: { cors: { origin: '*' } },
        adapters: {},
      } as any);

      expect(engine).toBeDefined();
      expect(engine.agents).toBeDefined();
      expect(engine.sessions).toBeDefined();
      expect(engine.messages).toBeDefined();
    });
  });

  describe('Factory CRUD operations', () => {
    // --- Agent Service ---
    it('should create an agent through engine.agents', async () => {
      const engine = createChatEngine(createValidConfig());
      const mockDoc = {
        _id: 'agent1', name: 'Sarah', role: 'Support', isAI: false,
        isActive: true, visibility: 'public', isDefault: false,
        status: 'available', activeChats: 0, totalChatsHandled: 0,
      };
      engine.models.ChatAgent.create = vi.fn().mockResolvedValue(mockDoc);

      const result = await engine.agents.create({ name: 'Sarah', role: 'Support' });
      expect(result).toBeDefined();
      expect(engine.models.ChatAgent.create).toHaveBeenCalled();
    });

    it('should list agents through engine.agents', async () => {
      const engine = createChatEngine(createValidConfig());
      engine.models.ChatAgent.find = vi.fn().mockReturnValue({
        sort: vi.fn().mockResolvedValue([]),
      });

      const result = await engine.agents.list();
      expect(Array.isArray(result)).toBe(true);
    });

    it('should find default AI agent through engine.agents', async () => {
      const engine = createChatEngine(createValidConfig());
      engine.models.ChatAgent.findOne = vi.fn().mockResolvedValue(null);

      const result = await engine.agents.findDefaultAiAgent();
      expect(result).toBeNull();
    });

    it('should list public agents through engine.agents', async () => {
      const engine = createChatEngine(createValidConfig());
      engine.models.ChatAgent.find = vi.fn().mockReturnValue({
        lean: vi.fn().mockResolvedValue([]),
      });

      const result = await engine.agents.listPublicAgents();
      expect(Array.isArray(result)).toBe(true);
    });

    // --- Session Service ---
    it('should access sessions through engine.sessions', async () => {
      const engine = createChatEngine(createValidConfig());
      // findOne is called in singleSessionPerVisitor path with .sort() chain
      engine.models.ChatSession.findOne = vi.fn().mockReturnValue({
        sort: vi.fn().mockResolvedValue(null),
      });
      engine.models.ChatSession.create = vi.fn().mockResolvedValue({
        _id: 'sess1', sessionId: 'sess1', visitorId: 'v1', status: 'new',
        mode: 'ai', channel: 'web', messageCount: 0, startedAt: new Date(),
      });

      const result = await engine.sessions.findOrCreate({
        visitorId: 'v1', channel: 'web',
      });
      expect(result).toBeDefined();
    });

    it('should get session context through engine.sessions', async () => {
      const engine = createChatEngine(createValidConfig());
      const mockSession = {
        _id: 'sess1', sessionId: 'sess1', visitorId: 'v1', status: 'active',
        mode: 'ai', channel: 'web', messageCount: 1, startedAt: new Date(),
        preferences: {}, conversationSummary: '', feedback: null, metadata: {},
        toObject: vi.fn().mockReturnThis(),
      };
      engine.models.ChatSession.findOne = vi.fn().mockResolvedValue(mockSession);
      engine.models.ChatMessage.find = vi.fn().mockReturnValue({
        sort: vi.fn().mockResolvedValue([]),
      });

      const ctx = await engine.sessions.getSessionContext('sess1');
      expect(ctx).toBeDefined();
      expect(ctx.visitorId).toBe('v1');
    });

    // --- Message Service ---
    it('should create message through engine.messages', async () => {
      const engine = createChatEngine(createValidConfig());
      const mockMsg = {
        _id: 'msg1', messageId: 'msg1', sessionId: 'sess1',
        senderType: 'visitor', content: 'Hello', contentType: 'text',
        status: 'sent', createdAt: new Date(),
      };
      engine.models.ChatMessage.create = vi.fn().mockResolvedValue(mockMsg);

      const result = await engine.messages.create({
        sessionId: 'sess1', senderType: 'visitor' as any, content: 'Hello', contentType: 'text' as any,
      });
      expect(result).toBeDefined();
      expect(result.content).toBe('Hello');
    });

    it('should create system message through engine.messages', async () => {
      const engine = createChatEngine(createValidConfig());
      engine.models.ChatMessage.create = vi.fn().mockResolvedValue({
        _id: 'msg2', messageId: 'msg2', sessionId: 'sess1',
        senderType: 'system', content: 'Agent joined', contentType: 'system',
        status: 'sent', createdAt: new Date(),
      });

      const result = await engine.messages.createSystemMessage('sess1', 'Agent joined');
      expect(result).toBeDefined();
      expect(result.senderType).toBe('system');
    });

    it('should update message label through engine.messages', async () => {
      const engine = createChatEngine(createValidConfig());
      engine.models.ChatMessage.updateOne = vi.fn().mockResolvedValue({ modifiedCount: 1 });

      await engine.messages.updateLabel('msg1', 'good');
      expect(engine.models.ChatMessage.updateOne).toHaveBeenCalledWith(
        { messageId: 'msg1' },
        { $set: { trainingQuality: 'good' } },
      );
    });

    // --- Settings Service ---
    it('should get and update settings through engine.settings', async () => {
      const engine = createChatEngine(createValidConfig());
      engine.models.ChatSettings.findOneAndUpdate = vi.fn().mockResolvedValue({
        key: 'global', defaultSessionMode: 'ai', aiEnabled: true,
        requireAgentForChat: false, visitorAgentSelection: true,
      });

      const result = await engine.settings.update({ aiEnabled: true, visitorAgentSelection: true });
      expect(result).toBeDefined();
    });

    // --- FAQ Service ---
    it('should create FAQ through engine.faq', async () => {
      const engine = createChatEngine(createValidConfig());
      engine.models.ChatFAQItem.create = vi.fn().mockResolvedValue({
        _id: 'faq1', question: 'Test?', answer: 'Yes', category: 'general',
        isActive: true, order: 0,
      });

      const result = await engine.faq.create({
        question: 'Test?', answer: 'Yes', category: 'general', order: 0, isActive: true,
      });
      expect(result).toBeDefined();
      expect(result.question).toBe('Test?');
    });

    // --- Canned Response Service ---
    it('should create canned response through engine.cannedResponses', async () => {
      const engine = createChatEngine(createValidConfig());
      engine.models.ChatCannedResponse.create = vi.fn().mockResolvedValue({
        _id: 'cr1', title: 'Greeting', content: 'Hi!', shortcut: '/hi',
        isActive: true, order: 0,
      });

      const result = await engine.cannedResponses.create({
        title: 'Greeting', content: 'Hi!', shortcut: '/hi', isActive: true, order: 0,
      });
      expect(result).toBeDefined();
      expect(result.shortcut).toBe('/hi');
    });

    // --- Capabilities / Routes ---
    it('should return capabilities reflecting config', () => {
      const config = createValidConfig();
      (config.adapters as any).generateAiResponse = vi.fn();
      const engine = createChatEngine(config);
      expect(engine.routes).toBeDefined();
    });

    it('should return capabilities without AI when no adapter', () => {
      const engine = createChatEngine({
        db: { connection: createMockConnection() },
        redis: { connection: createMockRedis() },
        socket: { cors: { origin: '*' } },
        adapters: {},
      } as any);
      expect(engine.routes).toBeDefined();
    });

    // --- Solo mode full flow ---
    it('should work in solo mode (no adapters, no agents needed)', async () => {
      const engine = createChatEngine({
        db: { connection: createMockConnection() },
        redis: { connection: createMockRedis() },
        socket: { cors: { origin: '*' } },
        adapters: {},
      } as any);

      // All services should be accessible
      expect(engine.agents).toBeDefined();
      expect(engine.sessions).toBeDefined();
      expect(engine.messages).toBeDefined();
      expect(engine.settings).toBeDefined();
      expect(engine.faq).toBeDefined();
      expect(engine.guidedQuestions).toBeDefined();
      expect(engine.cannedResponses).toBeDefined();
      expect(engine.widgetConfig).toBeDefined();
      expect(engine.routes).toBeDefined();
      expect(typeof engine.attach).toBe('function');
      expect(typeof engine.destroy).toBe('function');

      // Should be able to call service methods
      engine.models.ChatAgent.create = vi.fn().mockResolvedValue({ _id: 'a1', name: 'Solo' });
      const agent = await engine.agents.create({ name: 'Solo' });
      expect(agent).toBeDefined();

      await engine.destroy();
    });
  });

  describe('new config options', () => {
    it('should accept aiSimulation config', () => {
      const config = {
        ...createValidConfig(),
        options: {
          aiSimulation: {
            deliveryDelay: { min: 300, max: 1000 },
            readDelay: { min: 1000, max: 3000 },
            preTypingDelay: { min: 500, max: 1500 },
            bubbleDelay: { min: 800, max: 2000 },
            minTypingDuration: 2000,
          },
        },
      };
      const engine = createChatEngine(config);
      expect(engine).toBeDefined();
    });

    it('should accept singleSessionPerVisitor, trackEventsAsMessages, labelingEnabled, maxUploadSizeMb options', () => {
      const config = {
        ...createValidConfig(),
        options: {
          singleSessionPerVisitor: false,
          trackEventsAsMessages: true,
          labelingEnabled: true,
          maxUploadSizeMb: 10,
        },
      };
      const engine = createChatEngine(config);
      expect(engine).toBeDefined();
    });
  });
});
