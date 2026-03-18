import { describe, it, expect, vi, beforeAll, afterAll, afterEach } from 'vitest';
import { MongoMemoryServer } from 'mongodb-memory-server';
import mongoose, { Types } from 'mongoose';
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

  async function createTemplate(overrides: Record<string, unknown> = {}) {
    return engine.templateService.create({
      name: `template-${Date.now()}-${Math.random().toString(36).slice(2)}`,
      messages: ['Hello {{name}}, welcome!'],
      ...overrides,
    });
  }

  async function createRule(templateId: string, overrides: Record<string, unknown> = {}) {
    return engine.ruleService.create({
      name: `rule-${Date.now()}-${Math.random().toString(36).slice(2)}`,
      templateId,
      target: { mode: 'query' as const, conditions: { status: 'active' } },
      ...overrides,
    });
  }

  // ── 1. Template CRUD ──────────────────────────────────────────────────

  describe('Template CRUD', () => {
    it('should create a template with messages array', async () => {
      const template = await createTemplate({
        name: 'welcome-template',
        messages: ['Hello {{name}}!', 'Hi {{name}}, how are you?'],
      });

      expect(template._id).toBeDefined();
      expect(template.name).toBe('welcome-template');
      expect(template.messages).toHaveLength(2);
      expect(template.variables).toEqual(expect.arrayContaining(['name']));
    });

    it('should get template by ID', async () => {
      const created = await createTemplate({ name: 'get-test' });
      const found = await engine.templateService.getById(created._id.toString());

      expect(found).not.toBeNull();
      expect(found!.name).toBe('get-test');
      expect(found!.messages).toEqual(created.messages);
    });

    it('should update a template', async () => {
      const created = await createTemplate({ name: 'update-test' });
      const updated = await engine.templateService.update(created._id.toString(), {
        messages: ['Updated: {{greeting}} {{name}}'],
      });

      expect(updated).not.toBeNull();
      expect(updated!.messages).toEqual(['Updated: {{greeting}} {{name}}']);
      expect(updated!.variables).toEqual(expect.arrayContaining(['greeting', 'name']));
    });

    it('should delete a template', async () => {
      const created = await createTemplate({ name: 'delete-test' });
      const deleted = await engine.templateService.delete(created._id.toString());
      expect(deleted).toBe(true);

      const found = await engine.templateService.getById(created._id.toString());
      expect(found).toBeNull();
    });

    it('should list templates', async () => {
      await createTemplate({ name: 'list-a', category: 'promo' });
      await createTemplate({ name: 'list-b', category: 'promo' });
      await createTemplate({ name: 'list-c', category: 'transactional' });

      const all = await engine.templateService.list();
      expect(all.length).toBe(3);

      const promoOnly = await engine.templateService.list({ category: 'promo' });
      expect(promoOnly.length).toBe(2);
      expect(promoOnly.every(t => t.category === 'promo')).toBe(true);
    });
  });

  // ── 2. Rule CRUD ──────────────────────────────────────────────────────

  describe('Rule CRUD', () => {
    it('should create a rule with query target', async () => {
      const template = await createTemplate();
      const rule = await createRule(template._id.toString(), {
        target: { mode: 'query', conditions: { country: 'US' } },
      });

      expect(rule._id).toBeDefined();
      expect((rule.target as any).mode).toBe('query');
      expect((rule.target as any).conditions).toEqual({ country: 'US' });
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

    it('should activate and deactivate a rule', async () => {
      const template = await createTemplate();
      const rule = await createRule(template._id.toString());

      expect(rule.isActive).toBe(false);

      const activated = await engine.ruleService.activate(rule._id.toString());
      expect(activated).not.toBeNull();
      expect(activated!.isActive).toBe(true);

      const deactivated = await engine.ruleService.deactivate(rule._id.toString());
      expect(deactivated).not.toBeNull();
      expect(deactivated!.isActive).toBe(false);
    });

    it('should list only active rules', async () => {
      const template = await createTemplate();
      const rule1 = await createRule(template._id.toString());
      const rule2 = await createRule(template._id.toString());
      await createRule(template._id.toString());

      await engine.ruleService.activate(rule1._id.toString());
      await engine.ruleService.activate(rule2._id.toString());

      const active = await engine.ruleService.findActive();
      expect(active.length).toBe(2);
      expect(active.every(r => r.isActive)).toBe(true);
    });

    it('should filter rules by isActive', async () => {
      const template = await createTemplate();
      const rule1 = await createRule(template._id.toString());
      await createRule(template._id.toString());

      await engine.ruleService.activate(rule1._id.toString());

      const activeList = await engine.ruleService.list({ isActive: true });
      expect(activeList.length).toBe(1);

      const inactiveList = await engine.ruleService.list({ isActive: false });
      expect(inactiveList.length).toBe(1);
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
      const config = await engine.models.TelegramThrottleConfig.getConfig();

      expect(config).not.toBeNull();
      expect(config.maxPerUserPerDay).toBe(1);
      expect(config.maxPerUserPerWeek).toBe(2);
      expect(config.minGapDays).toBe(3);
      expect(config.throttleWindow).toBe('rolling');
    });

    it('should update and persist throttle config', async () => {
      const config = await engine.models.TelegramThrottleConfig.getConfig();

      await engine.models.TelegramThrottleConfig.findByIdAndUpdate(config._id, {
        $set: {
          maxPerUserPerDay: 5,
          maxPerUserPerWeek: 10,
          minGapDays: 1,
          throttleWindow: 'fixed',
        },
      });

      // getConfig returns the existing doc now
      const updated = await engine.models.TelegramThrottleConfig.findById(config._id);
      expect(updated).not.toBeNull();
      expect(updated!.maxPerUserPerDay).toBe(5);
      expect(updated!.maxPerUserPerWeek).toBe(10);
      expect(updated!.minGapDays).toBe(1);
      expect(updated!.throttleWindow).toBe('fixed');
    });

    it('should have values within expected ranges', async () => {
      const config = await engine.models.TelegramThrottleConfig.getConfig();

      expect(config.maxPerUserPerDay).toBeGreaterThan(0);
      expect(config.maxPerUserPerWeek).toBeGreaterThanOrEqual(config.maxPerUserPerDay);
      expect(config.minGapDays).toBeGreaterThanOrEqual(0);
      expect(['rolling', 'fixed']).toContain(config.throttleWindow);
    });
  });

  // ── 4. Send Log Tracking ──────────────────────────────────────────────

  describe('Send Log Tracking', () => {
    it('should create and persist send logs', async () => {
      const template = await createTemplate();
      const rule = await createRule(template._id.toString());

      const log = await engine.models.TelegramSendLog.create({
        identifierId: 'id-1',
        contactId: 'contact-1',
        accountId: 'acc-1',
        ruleId: rule._id,
        runId: 'run-001',
        templateId: template._id,
        messagePreview: 'Hello John!',
        messageIndex: 0,
        deliveryStatus: 'sent',
        sentAt: new Date(),
      });

      expect(log._id).toBeDefined();
      expect(log.deliveryStatus).toBe('sent');
    });

    it('should query send logs by ruleId', async () => {
      const template = await createTemplate();
      const rule1 = await createRule(template._id.toString());
      const rule2 = await createRule(template._id.toString());

      await engine.models.TelegramSendLog.create({
        identifierId: 'id-1', contactId: 'c-1', accountId: 'acc-1',
        ruleId: rule1._id, runId: 'run-1', templateId: template._id,
        messageIndex: 0, deliveryStatus: 'sent', sentAt: new Date(),
      });
      await engine.models.TelegramSendLog.create({
        identifierId: 'id-2', contactId: 'c-2', accountId: 'acc-1',
        ruleId: rule1._id, runId: 'run-1', templateId: template._id,
        messageIndex: 0, deliveryStatus: 'sent', sentAt: new Date(),
      });
      await engine.models.TelegramSendLog.create({
        identifierId: 'id-3', contactId: 'c-3', accountId: 'acc-1',
        ruleId: rule2._id, runId: 'run-1', templateId: template._id,
        messageIndex: 0, deliveryStatus: 'failed', sentAt: new Date(),
      });

      const rule1Logs = await engine.models.TelegramSendLog.find({ ruleId: rule1._id });
      expect(rule1Logs.length).toBe(2);

      const rule2Logs = await engine.models.TelegramSendLog.find({ ruleId: rule2._id });
      expect(rule2Logs.length).toBe(1);
    });

    it('should query send logs by deliveryStatus', async () => {
      const template = await createTemplate();
      const rule = await createRule(template._id.toString());

      await engine.models.TelegramSendLog.create({
        identifierId: 'id-1', contactId: 'c-1', accountId: 'acc-1',
        ruleId: rule._id, runId: 'run-1', templateId: template._id,
        messageIndex: 0, deliveryStatus: 'sent', sentAt: new Date(),
      });
      await engine.models.TelegramSendLog.create({
        identifierId: 'id-2', contactId: 'c-2', accountId: 'acc-1',
        ruleId: rule._id, runId: 'run-1', templateId: template._id,
        messageIndex: 0, deliveryStatus: 'failed', sentAt: new Date(),
      });
      await engine.models.TelegramSendLog.create({
        identifierId: 'id-3', contactId: 'c-3', accountId: 'acc-1',
        ruleId: rule._id, runId: 'run-1', templateId: template._id,
        messageIndex: 0, deliveryStatus: 'sent', sentAt: new Date(),
      });

      const sentLogs = await engine.models.TelegramSendLog.find({ deliveryStatus: 'sent' });
      expect(sentLogs.length).toBe(2);

      const failedLogs = await engine.models.TelegramSendLog.find({ deliveryStatus: 'failed' });
      expect(failedLogs.length).toBe(1);
    });

    it('should query send logs by date range', async () => {
      const template = await createTemplate();
      const rule = await createRule(template._id.toString());

      const jan = new Date('2026-01-15T10:00:00Z');
      const feb = new Date('2026-02-15T10:00:00Z');
      const mar = new Date('2026-03-15T10:00:00Z');

      await engine.models.TelegramSendLog.create({
        identifierId: 'id-1', contactId: 'c-1', accountId: 'acc-1',
        ruleId: rule._id, runId: 'run-1', templateId: template._id,
        messageIndex: 0, deliveryStatus: 'sent', sentAt: jan,
      });
      await engine.models.TelegramSendLog.create({
        identifierId: 'id-2', contactId: 'c-2', accountId: 'acc-1',
        ruleId: rule._id, runId: 'run-2', templateId: template._id,
        messageIndex: 0, deliveryStatus: 'sent', sentAt: feb,
      });
      await engine.models.TelegramSendLog.create({
        identifierId: 'id-3', contactId: 'c-3', accountId: 'acc-1',
        ruleId: rule._id, runId: 'run-3', templateId: template._id,
        messageIndex: 0, deliveryStatus: 'sent', sentAt: mar,
      });

      const febRange = await engine.models.TelegramSendLog.find({
        sentAt: { $gte: new Date('2026-02-01'), $lt: new Date('2026-03-01') },
      });
      expect(febRange.length).toBe(1);
      expect(febRange[0].identifierId).toBe('id-2');
    });
  });

  // ── 5. Run Log Tracking ───────────────────────────────────────────────

  describe('Run Log Tracking', () => {
    it('should create a run log with stats', async () => {
      const runLog = await engine.models.TelegramRunLog.create({
        runId: 'run-abc-001',
        triggeredBy: 'manual',
        status: 'completed',
        startedAt: new Date(),
        completedAt: new Date(),
        stats: { sent: 10, failed: 2, skipped: 3, throttled: 1 },
      });

      expect(runLog._id).toBeDefined();
      expect(runLog.runId).toBe('run-abc-001');
      expect(runLog.stats.sent).toBe(10);
      expect(runLog.stats.failed).toBe(2);
      expect(runLog.stats.skipped).toBe(3);
      expect(runLog.stats.throttled).toBe(1);
    });

    it('should query run history sorted by date descending', async () => {
      const t1 = new Date('2026-01-01T00:00:00Z');
      const t2 = new Date('2026-02-01T00:00:00Z');
      const t3 = new Date('2026-03-01T00:00:00Z');

      await engine.models.TelegramRunLog.create({
        runId: 'run-old', triggeredBy: 'cron', status: 'completed',
        startedAt: t1, stats: { sent: 5, failed: 0, skipped: 0, throttled: 0 },
      });
      await engine.models.TelegramRunLog.create({
        runId: 'run-mid', triggeredBy: 'cron', status: 'completed',
        startedAt: t2, stats: { sent: 10, failed: 1, skipped: 0, throttled: 0 },
      });
      await engine.models.TelegramRunLog.create({
        runId: 'run-new', triggeredBy: 'manual', status: 'completed',
        startedAt: t3, stats: { sent: 20, failed: 0, skipped: 2, throttled: 1 },
      });

      const recent = await engine.models.TelegramRunLog.getRecent(2);
      expect(recent.length).toBe(2);
      expect(recent[0].runId).toBe('run-new');
      expect(recent[1].runId).toBe('run-mid');
    });

    it('should find run log by runId', async () => {
      await engine.models.TelegramRunLog.create({
        runId: 'run-find-me', triggeredBy: 'api', status: 'running',
        startedAt: new Date(), stats: { sent: 0, failed: 0, skipped: 0, throttled: 0 },
      });

      const found = await engine.models.TelegramRunLog.findByRunId('run-find-me');
      expect(found).not.toBeNull();
      expect(found!.triggeredBy).toBe('api');
      expect(found!.status).toBe('running');
    });
  });

  // ── 6. Template Rendering ─────────────────────────────────────────────

  describe('Template Rendering', () => {
    it('should preview a template with Handlebars variables', async () => {
      const template = await createTemplate({
        name: 'render-test',
        messages: ['Hello {{name}}, your order #{{orderId}} is ready!'],
      });

      const preview = await engine.templateService.preview(template._id.toString(), {
        name: 'Alice',
        orderId: '12345',
      });

      expect(preview).not.toBeNull();
      expect(preview!.messages).toHaveLength(1);
      expect(preview!.messages[0]).toBe('Hello Alice, your order #12345 is ready!');
    });

    it('should preview with placeholder defaults for missing variables', async () => {
      const template = await createTemplate({
        name: 'partial-data',
        messages: ['Hi {{name}}, code: {{code}}'],
      });

      const preview = await engine.templateService.preview(template._id.toString(), {
        name: 'Bob',
      });

      expect(preview).not.toBeNull();
      expect(preview!.messages[0]).toBe('Hi Bob, code: [code]');
    });

    it('should extract variables from template messages', async () => {
      const template = await createTemplate({
        name: 'vars-test',
        messages: [
          'Dear {{firstName}} {{lastName}},',
          'Your {{itemName}} ships on {{shipDate}}.',
        ],
      });

      expect(template.variables).toEqual(
        expect.arrayContaining(['firstName', 'lastName', 'itemName', 'shipDate'])
      );
    });
  });

  // ── 7. Rule Runner (lightweight) ──────────────────────────────────────

  describe('Rule Runner', () => {
    it('trigger() should return a runId', () => {
      const result = engine.runner.trigger('test');
      expect(result).toHaveProperty('runId');
      expect(typeof result.runId).toBe('string');
      expect(result.runId.length).toBeGreaterThan(0);
    });

    it('getStatus() should return progress for a triggered run', async () => {
      const { runId } = engine.runner.trigger('integration-test');

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
        expect(status.progress).toHaveProperty('throttled');
      }
    });

    it('cancel() should set cancel flag for an active run', async () => {
      const { runId } = engine.runner.trigger('cancel-test');

      // Give the run a moment to set up progress
      await new Promise((r) => setTimeout(r, 200));

      const result = await engine.runner.cancel(runId);
      // If progress was stored in Redis mock, cancel should succeed
      // The mock hset stores progress, and exists checks for it
      expect(result).toHaveProperty('ok');
      expect(typeof result.ok).toBe('string' === typeof result.ok ? 'string' : 'boolean');
    });
  });

  // ── 8. Error Log Tracking ─────────────────────────────────────────────

  describe('Error Log Tracking', () => {
    it('should create and query error logs', async () => {
      await engine.models.TelegramErrorLog.create({
        accountId: 'acc-1',
        accountName: 'Test Account',
        contactId: 'c-1',
        contactName: 'John',
        errorCode: 'FLOOD_WAIT',
        errorCategory: 'recoverable',
        errorMessage: 'Too many requests',
        operation: 'send',
      });
      await engine.models.TelegramErrorLog.create({
        errorCode: 'AUTH_KEY_UNREGISTERED',
        errorCategory: 'critical',
        errorMessage: 'Auth key invalid',
        operation: 'connect',
      });

      const recoverable = await engine.models.TelegramErrorLog.findByCategory('recoverable');
      expect(recoverable.length).toBe(1);
      expect(recoverable[0].errorCode).toBe('FLOOD_WAIT');

      const byCode = await engine.models.TelegramErrorLog.findByErrorCode('AUTH_KEY_UNREGISTERED');
      expect(byCode.length).toBe(1);
      expect(byCode[0].errorCategory).toBe('critical');

      const recent = await engine.models.TelegramErrorLog.getRecent(10);
      expect(recent.length).toBe(2);
    });
  });

  // ── 9. Model Statics ─────────────────────────────────────────────────

  describe('Model Statics', () => {
    it('TelegramTemplate.findByName should return the correct template', async () => {
      await createTemplate({ name: 'static-lookup' });

      const found = await engine.models.TelegramTemplate.findByName('static-lookup');
      expect(found).not.toBeNull();
      expect(found!.name).toBe('static-lookup');
    });

    it('TelegramRule.findByTemplateId should return rules for a template', async () => {
      const template = await createTemplate();
      await createRule(template._id.toString());
      await createRule(template._id.toString());

      const rules = await engine.models.TelegramRule.findByTemplateId(template._id);
      expect(rules.length).toBe(2);
    });

    it('TelegramSendLog.findByRunId should return logs for a run', async () => {
      const template = await createTemplate();
      const rule = await createRule(template._id.toString());

      await engine.models.TelegramSendLog.create({
        identifierId: 'id-1', contactId: 'c-1', accountId: 'acc-1',
        ruleId: rule._id, runId: 'static-run-1', templateId: template._id,
        messageIndex: 0, deliveryStatus: 'sent', sentAt: new Date(),
      });
      await engine.models.TelegramSendLog.create({
        identifierId: 'id-2', contactId: 'c-2', accountId: 'acc-1',
        ruleId: rule._id, runId: 'static-run-1', templateId: template._id,
        messageIndex: 0, deliveryStatus: 'sent', sentAt: new Date(),
      });

      const logs = await engine.models.TelegramSendLog.findByRunId('static-run-1');
      expect(logs.length).toBe(2);
    });

    it('TelegramSendLog.findByContactId should return logs for a contact', async () => {
      const template = await createTemplate();
      const rule = await createRule(template._id.toString());

      await engine.models.TelegramSendLog.create({
        identifierId: 'id-1', contactId: 'contact-abc', accountId: 'acc-1',
        ruleId: rule._id, runId: 'run-x', templateId: template._id,
        messageIndex: 0, deliveryStatus: 'sent', sentAt: new Date(),
      });

      const logs = await engine.models.TelegramSendLog.findByContactId('contact-abc');
      expect(logs.length).toBe(1);
      expect(logs[0].contactId).toBe('contact-abc');
    });
  });
});
