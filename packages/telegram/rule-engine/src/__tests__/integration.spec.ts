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

describe('Telegram Rule Engine Integration', () => {
  let mongoServer: MongoMemoryServer;
  let connection: mongoose.Connection;
  let engine: TelegramRuleEngine;
  const consoleWarnSpy = vi.spyOn(console, 'warn').mockImplementation(() => {});

  const adapters = {
    queryUsers: vi.fn().mockResolvedValue([]),
    resolveData: vi.fn().mockReturnValue({}),
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
      categories: ['onboarding', 'engagement', 'transactional', 'promo'],
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
  });

  afterAll(async () => {
    consoleWarnSpy.mockRestore();
    if (engine) await engine.destroy();
    if (connection) await connection.close();
    if (mongoServer) await mongoServer.stop();
  });

  // ── Helpers ────────────────────────────────────────────────────────────

  let slugCounter = 0;
  function uniqueSlug(prefix = 'tmpl') {
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

  // ── 1. Template CRUD ──────────────────────────────────────────────────

  describe('Template CRUD', () => {
    it('should create a template with bodies array', async () => {
      const template = await createTemplate({
        name: 'welcome-template',
        bodies: ['Hello {{name}}!', 'Hi {{name}}, how are you?'],
      });

      expect(template._id).toBeDefined();
      expect(template.name).toBe('welcome-template');
      expect(template.bodies).toHaveLength(2);
    });

    it('should get template by ID', async () => {
      const created = await createTemplate({ name: 'get-test' });
      const found = await engine.templateService.getById(created._id.toString());

      expect(found).not.toBeNull();
      expect(found!.name).toBe('get-test');
    });

    it('should update a template', async () => {
      const created = await createTemplate({ name: 'update-test' });
      const updated = await engine.templateService.update(created._id.toString(), {
        bodies: ['Updated: {{greeting}} {{name}}'],
      });

      expect(updated).not.toBeNull();
      expect(updated!.bodies).toEqual(['Updated: {{greeting}} {{name}}']);
    });

    it('should delete a template', async () => {
      const created = await createTemplate({ name: 'delete-test' });
      const result = await engine.templateService.delete(created._id.toString());
      expect(result.deleted).toBe(true);

      const found = await engine.templateService.getById(created._id.toString());
      expect(found).toBeNull();
    });

    it('should list templates', async () => {
      await createTemplate({ name: 'list-a', category: 'promo' });
      await createTemplate({ name: 'list-b', category: 'promo' });
      await createTemplate({ name: 'list-c', category: 'transactional' });

      const all = await engine.templateService.list();
      expect(all.templates.length).toBe(3);

      const promoOnly = await engine.templateService.list({ category: 'promo' });
      expect(promoOnly.templates.length).toBe(2);
      expect(promoOnly.templates.every((t: any) => t.category === 'promo')).toBe(true);
    });
  });

  // ── 2. Rule CRUD ──────────────────────────────────────────────────────

  describe('Rule CRUD', () => {
    it('should create a rule with query target', async () => {
      const template = await createTemplate();
      const rule = await createRule(template._id.toString(), {
        target: { mode: 'query', role: 'customer', platform: 'telegram', conditions: [] },
      });

      expect(rule._id).toBeDefined();
      expect((rule.target as any).mode).toBe('query');
      expect(rule.isActive).toBe(false);
    });

    it('should create a rule with list target', async () => {
      const template = await createTemplate();
      const rule = await createRule(template._id.toString(), {
        target: { mode: 'list', identifiers: ['+1111111111', '+2222222222'] },
      });

      expect((rule.target as any).mode).toBe('list');
      expect((rule.target as any).identifiers).toEqual(['+1111111111', '+2222222222']);
    });

    it('should toggle active on a rule', async () => {
      const template = await createTemplate();
      const rule = await createRule(template._id.toString());
      expect(rule.isActive).toBe(false);

      const toggled = await engine.ruleService.toggleActive(rule._id.toString());
      expect(toggled).not.toBeNull();
      expect(toggled!.isActive).toBe(true);

      const toggledBack = await engine.ruleService.toggleActive(rule._id.toString());
      expect(toggledBack).not.toBeNull();
      expect(toggledBack!.isActive).toBe(false);
    });

    it('should list rules', async () => {
      const template = await createTemplate();
      await createRule(template._id.toString());
      await createRule(template._id.toString());

      const result = await engine.ruleService.list();
      expect(result.rules.length).toBe(2);
      expect(result.total).toBe(2);
    });

    it('should save validFrom/validTill dates', async () => {
      const template = await createTemplate();
      const validFrom = new Date('2026-01-01');
      const validTill = new Date('2026-12-31');

      const rule = await createRule(template._id.toString(), {
        validFrom,
        validTill,
      });

      const fetched = await engine.ruleService.getById(rule._id.toString());
      expect(fetched).not.toBeNull();
      expect(fetched!.validFrom).toEqual(validFrom);
      expect(fetched!.validTill).toEqual(validTill);
    });

    it('should delete a rule', async () => {
      const template = await createTemplate();
      const rule = await createRule(template._id.toString());

      const result = await engine.ruleService.delete(rule._id.toString());
      expect(result.deleted).toBe(true);

      const found = await engine.ruleService.getById(rule._id.toString());
      expect(found).toBeNull();
    });
  });

  // ── 3. Throttle Config ────────────────────────────────────────────────

  describe('Throttle Config', () => {
    it('should return default throttle config when none exists', async () => {
      const config = await engine.models.ThrottleConfig.getConfig();

      expect(config).not.toBeNull();
      expect(config.maxPerUserPerDay).toBe(1);
      expect(config.maxPerUserPerWeek).toBe(2);
      expect(config.minGapDays).toBe(3);
      expect(config.throttleWindow).toBe('rolling');
    });

    it('should update and persist throttle config', async () => {
      const config = await engine.models.ThrottleConfig.getConfig();

      await engine.models.ThrottleConfig.findByIdAndUpdate(config._id, {
        $set: {
          maxPerUserPerDay: 5,
          maxPerUserPerWeek: 10,
          minGapDays: 1,
        },
      });

      const updated = await engine.models.ThrottleConfig.findById(config._id);
      expect(updated).not.toBeNull();
      expect(updated!.maxPerUserPerDay).toBe(5);
      expect(updated!.maxPerUserPerWeek).toBe(10);
      expect(updated!.minGapDays).toBe(1);
    });
  });

  // ── 4. Send Log Tracking ──────────────────────────────────────────────

  describe('Send Log Tracking', () => {
    it('should create and persist send logs', async () => {
      const template = await createTemplate();
      const rule = await createRule(template._id.toString());

      const log = await engine.models.SendLog.logSend(
        rule._id.toString(),
        'user-1',
        'id-1',
        undefined,
        { status: 'sent', accountId: 'acc-1' },
      );

      expect(log._id).toBeDefined();
      expect(log.status).toBe('sent');
      expect(log.userId).toBe('user-1');
    });

    it('should query send logs by ruleId', async () => {
      const template = await createTemplate();
      const rule1 = await createRule(template._id.toString());
      const rule2 = await createRule(template._id.toString());

      await engine.models.SendLog.logSend(rule1._id.toString(), 'u-1', 'id-1');
      await engine.models.SendLog.logSend(rule1._id.toString(), 'u-2', 'id-2');
      await engine.models.SendLog.logSend(rule2._id.toString(), 'u-3', 'id-3');

      const rule1Logs = await engine.models.SendLog.find({ ruleId: rule1._id });
      expect(rule1Logs.length).toBe(2);

      const rule2Logs = await engine.models.SendLog.find({ ruleId: rule2._id });
      expect(rule2Logs.length).toBe(1);
    });
  });

  // ── 5. Run Log Tracking ───────────────────────────────────────────────

  describe('Run Log Tracking', () => {
    it('should create a run log with stats', async () => {
      const runLog = await engine.models.RunLog.create({
        runId: 'run-abc-001',
        runAt: new Date(),
        triggeredBy: 'manual',
        duration: 5000,
        rulesProcessed: 1,
        status: 'completed',
        totalStats: { matched: 15, sent: 10, failed: 2, skipped: 3, throttled: 0 },
        perRuleStats: [],
      });

      expect(runLog._id).toBeDefined();
      expect(runLog.runId).toBe('run-abc-001');
      expect(runLog.totalStats.sent).toBe(10);
      expect(runLog.totalStats.failed).toBe(2);
    });

    it('should query run history sorted by date descending', async () => {
      const t1 = new Date('2026-01-01T00:00:00Z');
      const t2 = new Date('2026-02-01T00:00:00Z');
      const t3 = new Date('2026-03-01T00:00:00Z');

      const baseStats = { matched: 0, sent: 5, failed: 0, skipped: 0, throttled: 0 };

      await engine.models.RunLog.create({
        runId: 'run-old', runAt: t1, triggeredBy: 'cron', duration: 1000,
        rulesProcessed: 1, status: 'completed', totalStats: baseStats, perRuleStats: [],
      });
      await engine.models.RunLog.create({
        runId: 'run-mid', runAt: t2, triggeredBy: 'cron', duration: 1000,
        rulesProcessed: 1, status: 'completed', totalStats: { ...baseStats, sent: 10 }, perRuleStats: [],
      });
      await engine.models.RunLog.create({
        runId: 'run-new', runAt: t3, triggeredBy: 'manual', duration: 2000,
        rulesProcessed: 2, status: 'completed', totalStats: { ...baseStats, sent: 20 }, perRuleStats: [],
      });

      const recent = await engine.models.RunLog.getRecent(2);
      expect(recent.length).toBe(2);
      expect(recent[0].runId).toBe('run-new');
      expect(recent[1].runId).toBe('run-mid');
    });
  });

  // ── 6. Rule Runner (lightweight) ──────────────────────────────────────

  describe('Rule Runner', () => {
    it('trigger() should return a runId and started flag', () => {
      const result = engine.runner.trigger('manual');
      expect(result).toHaveProperty('runId');
      expect(typeof result.runId).toBe('string');
      expect(result.runId.length).toBeGreaterThan(0);
      expect(result).toHaveProperty('started', true);
    });

    it('getStatus() should return progress for a triggered run', async () => {
      const { runId } = engine.runner.trigger('manual');

      // Give the background run a moment to initialize progress in Redis
      await new Promise((r) => setTimeout(r, 200));

      const status = await engine.runner.getStatus(runId);
      // Status may be null if the run completed very quickly, or present if still running
      if (status) {
        expect(status.runId).toBe(runId);
        expect(['running', 'completed', 'cancelled', 'failed']).toContain(status.status);
        expect(status.progress).toHaveProperty('sent');
        expect(status.progress).toHaveProperty('failed');
        expect(status.progress).toHaveProperty('skipped');
      }
    });

    it('cancel() should set cancel flag for an active run', async () => {
      const { runId } = engine.runner.trigger('manual');

      // Give the run a moment to set up progress
      await new Promise((r) => setTimeout(r, 200));

      const result = await engine.runner.cancel(runId);
      expect(result).toHaveProperty('ok');
    });
  });

  // ── 7. Error Log Tracking ─────────────────────────────────────────────

  describe('Error Log Tracking', () => {
    it('should create and query error logs', async () => {
      await engine.models.ErrorLog.create({
        ruleId: 'rule-1',
        ruleName: 'Test Rule',
        contactValue: '+1234567890',
        error: 'FLOOD_WAIT: Too many requests',
      });
      await engine.models.ErrorLog.create({
        ruleId: 'rule-2',
        ruleName: 'Another Rule',
        contactValue: '+0987654321',
        error: 'AUTH_KEY_UNREGISTERED: Auth key invalid',
      });

      const allErrors = await engine.models.ErrorLog.find({});
      expect(allErrors.length).toBe(2);

      const rule1Errors = await engine.models.ErrorLog.find({ ruleId: 'rule-1' });
      expect(rule1Errors.length).toBe(1);
      expect(rule1Errors[0].error).toContain('FLOOD_WAIT');
    });
  });

  // ── 8. Model Statics ─────────────────────────────────────────────────

  describe('Model Statics', () => {
    it('Template.findBySlug should return the correct template', async () => {
      const template = await createTemplate({ name: 'static-lookup' });

      const found = await engine.models.Template.findBySlug(template.slug);
      expect(found).not.toBeNull();
      expect(found!.name).toBe('static-lookup');
    });

    it('Rule.findByTemplateId should return rules for a template', async () => {
      const template = await createTemplate();
      await createRule(template._id.toString());
      await createRule(template._id.toString());

      const rules = await engine.models.Rule.findByTemplateId(template._id);
      expect(rules.length).toBe(2);
    });

    it('SendLog.findLatestForUser should return the most recent send', async () => {
      const template = await createTemplate();
      const rule = await createRule(template._id.toString());

      await engine.models.SendLog.logSend(rule._id.toString(), 'user-latest', 'id-1');
      await new Promise(r => setTimeout(r, 50));
      await engine.models.SendLog.logSend(rule._id.toString(), 'user-latest', 'id-2');

      const latest = await engine.models.SendLog.findLatestForUser(rule._id.toString(), 'user-latest');
      expect(latest).not.toBeNull();
      expect(latest!.identifierId).toBe('id-2');
    });
  });
});
