import { describe, it, expect, vi, beforeAll, afterAll, afterEach } from 'vitest';
import { MongoMemoryServer } from 'mongodb-memory-server';
import mongoose from 'mongoose';
import { existsSync } from 'fs';
import { resolve } from 'path';

vi.setConfig({ testTimeout: 30_000, hookTimeout: 120_000 });

// Mock ioredis with a functional in-memory store
vi.mock('ioredis', () => {
  const store = new Map<string, any>();
  const RedisMock = vi.fn().mockImplementation(() => ({
    options: { host: 'localhost', port: 6379, db: 0 },
    status: 'ready',
    hset: vi.fn().mockImplementation(async (key: string, ...args: string[]) => {
      const current = store.get(key) || {};
      for (let i = 0; i < args.length; i += 2) current[args[i]] = args[i + 1];
      store.set(key, current);
      return 'OK';
    }),
    hgetall: vi.fn().mockImplementation(async (key: string) => store.get(key) || {}),
    hget: vi.fn().mockImplementation(async (key: string, field: string) => (store.get(key) || {})[field] || null),
    hincrby: vi.fn().mockImplementation(async (key: string, field: string, inc: number) => {
      const current = store.get(key) || {};
      current[field] = (parseInt(current[field] || '0') + inc).toString();
      store.set(key, current);
      return parseInt(current[field]);
    }),
    expire: vi.fn().mockResolvedValue(1),
    exists: vi.fn().mockResolvedValue(0),
    set: vi.fn().mockResolvedValue('OK'),
    del: vi.fn().mockResolvedValue(1),
    disconnect: vi.fn(),
    quit: vi.fn(),
    pipeline: vi.fn().mockImplementation(() => {
      const commands: Array<() => Promise<any>> = [];
      const pipe = {
        hset: vi.fn().mockImplementation((...args: any[]) => { commands.push(() => Promise.resolve('OK')); return pipe; }),
        hincrby: vi.fn().mockImplementation((...args: any[]) => { commands.push(() => Promise.resolve(1)); return pipe; }),
        expire: vi.fn().mockImplementation((...args: any[]) => { commands.push(() => Promise.resolve(1)); return pipe; }),
        exec: vi.fn().mockImplementation(async () => commands.map(() => [null, 'OK'])),
      };
      return pipe;
    }),
  }));
  return { default: RedisMock, Redis: RedisMock };
});

import { createTelegramRuleEngine, type TelegramRuleEngine } from '../index';

describe('Telegram Rule Engine — Negative / Edge Cases', () => {
  let mongoServer: MongoMemoryServer;
  let connection: mongoose.Connection;
  let engine: TelegramRuleEngine;
  const consoleWarnSpy = vi.spyOn(console, 'warn').mockImplementation(() => {});

  const adapters = {
    queryUsers: vi.fn().mockResolvedValue([]),
    resolveData: vi.fn().mockReturnValue({ name: 'TestUser' }),
    sendMessage: vi.fn().mockResolvedValue(undefined),
    selectAccount: vi.fn().mockResolvedValue({ accountId: 'acc-1', phone: '+1234567890', metadata: {} }),
    findIdentifier: vi.fn().mockResolvedValue({ id: 'id-1', contactId: 'contact-1' }),
  };

  beforeAll(async () => {
    const cachedBinary = resolve(__dirname, '../../../../../node_modules/.cache/mongodb-memory-server/mongod-x64-win32-8.2.1.exe');
    const binaryOpts = existsSync(cachedBinary) ? { systemBinary: cachedBinary } : {};
    mongoServer = await MongoMemoryServer.create({ binary: binaryOpts });
    const uri = mongoServer.getUri();
    connection = mongoose.createConnection(uri);
    await connection.asPromise();

    const { default: Redis } = await import('ioredis');
    const mockRedis = new Redis();

    engine = createTelegramRuleEngine({
      db: { connection },
      redis: { connection: mockRedis as any },
      adapters,
      categories: ['onboarding', 'engagement', 'transactional'],
      audiences: ['customer', 'provider', 'all'],
    });

    // Wait for index creation
    await new Promise((resolve) => setTimeout(resolve, 1000));
  });

  afterEach(async () => {
    const collections = connection.collections;
    for (const key of Object.keys(collections)) {
      await collections[key].deleteMany({});
    }
    // Reset all adapter mocks to defaults
    adapters.queryUsers.mockReset().mockResolvedValue([]);
    adapters.resolveData.mockReset().mockReturnValue({ name: 'TestUser' });
    adapters.sendMessage.mockReset().mockResolvedValue(undefined);
    adapters.selectAccount.mockReset().mockResolvedValue({ accountId: 'acc-1', phone: '+1234567890', metadata: {} });
    adapters.findIdentifier.mockReset().mockResolvedValue({ id: 'id-1', contactId: 'contact-1' });
  });

  afterAll(async () => {
    consoleWarnSpy.mockRestore();
    if (engine) await engine.destroy();
    if (connection) await connection.close();
    if (mongoServer) await mongoServer.stop();
  });

  // ── Helpers ────────────────────────────────────────────────────────────

  let slugCounter = 0;
  function uniqueSlug(prefix = 'neg') {
    return `${prefix}-${Date.now()}-${++slugCounter}`;
  }

  async function createTemplate(overrides: Record<string, unknown> = {}) {
    const slug = uniqueSlug();
    return engine.templateService.create({
      name: overrides.name as string || `template-${slug}`,
      slug,
      category: 'onboarding',
      audience: 'customer',
      platform: 'telegram',
      bodies: ['Hello {{name}}, welcome!'],
      ...overrides,
    } as any);
  }

  async function createRule(templateId: string, overrides: Record<string, unknown> = {}) {
    return engine.ruleService.create({
      name: `rule-${Date.now()}-${Math.random().toString(36).slice(2)}`,
      platform: 'telegram',
      templateId,
      target: { mode: 'query' as const, role: 'customer', platform: 'telegram', conditions: [] },
      ...overrides,
    } as any);
  }

  // ── 1. Adapter Mapping Edge Cases ────────────────────────────────────

  describe('Adapter Mapping Edge Cases', () => {
    it('should handle selectAccount returning null during run', async () => {
      adapters.queryUsers.mockResolvedValue([
        { _id: 'u1', phone: '+111', name: 'User1' },
      ]);
      adapters.selectAccount.mockResolvedValue(null);

      const template = await createTemplate({ bodies: ['Hi {{name}}'] });
      const rule = await createRule(template._id.toString());
      await engine.ruleService.toggleActive(rule._id.toString());

      const result = await engine.runner.runAllRules('manual');
      expect(result).toHaveProperty('runId');
    });

    it('should handle sendMessage adapter throwing during run', async () => {
      adapters.queryUsers.mockResolvedValue([
        { _id: 'u1', phone: '+111', name: 'User1' },
      ]);
      adapters.findIdentifier.mockResolvedValue({ id: 'id-1', contactId: 'contact-1' });
      adapters.sendMessage.mockRejectedValue(new Error('Network error'));

      const template = await createTemplate({ bodies: ['Hi {{name}}'] });
      const rule = await createRule(template._id.toString());
      await engine.ruleService.toggleActive(rule._id.toString());

      const result = await engine.runner.runAllRules('manual');
      expect(result).toHaveProperty('runId');
    });
  });

  // ── 2. Factory Edge Cases ────────────────────────────────────────────

  describe('Factory Edge Cases', () => {
    it('should throw when creating engine without required adapters', () => {
      expect(() => createTelegramRuleEngine({
        db: { connection },
        redis: { connection: {} as any },
        adapters: {} as any,
      })).toThrow();
    });
  });

  // ── 3. Run Lifecycle Edge Cases ────────────────────────────────────────

  describe('Run Lifecycle Edge Cases', () => {
    it('should return null for getStatus with non-existent runId', async () => {
      const status = await engine.runner.getStatus('non-existent-run-id');
      expect(status).toBeNull();
    });

    it('should return { ok: false } when cancelling non-existent runId', async () => {
      const result = await engine.runner.cancel('non-existent-cancel-id');
      expect(result).toEqual({ ok: false });
    });

    it('should handle multiple rapid trigger calls with unique runIds', async () => {
      const results = [
        engine.runner.trigger('manual'),
        engine.runner.trigger('manual'),
        engine.runner.trigger('manual'),
      ];

      for (const r of results) {
        expect(r.runId).toBeDefined();
        expect(typeof r.runId).toBe('string');
      }

      const ids = results.map(r => r.runId);
      expect(new Set(ids).size).toBe(3);

      // Wait for background runs to settle
      await new Promise((r) => setTimeout(r, 500));
    });

    it('should complete with stats when no active rules exist', async () => {
      const result = await engine.runner.runAllRules('manual');

      expect(result).toHaveProperty('runId');
    });
  });

  // ── 4. Date-Based Rule Filtering ──────────────────────────────────────

  describe('Date-Based Rule Filtering', () => {
    it('should exclude rule with validFrom in the future from run', async () => {
      adapters.queryUsers.mockResolvedValue([
        { _id: 'u1', phone: '+111', name: 'User1' },
      ]);
      adapters.findIdentifier.mockResolvedValue({ id: 'id-1', contactId: 'contact-1' });
      adapters.sendMessage.mockResolvedValue(undefined);

      const template = await createTemplate({ bodies: ['Hi {{name}}'] });
      const rule = await createRule(template._id.toString(), {
        validFrom: new Date('2099-01-01'),
      });
      await engine.ruleService.toggleActive(rule._id.toString());

      const result = await engine.runner.runAllRules('manual');
      expect(result).toHaveProperty('runId');

      // Verify sendMessage was NOT called (rule should be filtered out)
      expect(adapters.sendMessage).not.toHaveBeenCalled();
    });

    it('should exclude rule with validTill in the past from run', async () => {
      adapters.queryUsers.mockResolvedValue([
        { _id: 'u1', phone: '+111', name: 'User1' },
      ]);
      adapters.findIdentifier.mockResolvedValue({ id: 'id-1', contactId: 'contact-1' });
      adapters.sendMessage.mockResolvedValue(undefined);

      const template = await createTemplate({ bodies: ['Hi {{name}}'] });
      const rule = await createRule(template._id.toString(), {
        validTill: new Date('2020-01-01'),
      });
      await engine.ruleService.toggleActive(rule._id.toString());

      const result = await engine.runner.runAllRules('manual');
      expect(result).toHaveProperty('runId');

      expect(adapters.sendMessage).not.toHaveBeenCalled();
    });
  });
});
