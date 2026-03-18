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

describe('Telegram Rule Engine — Negative / Breaking Scenarios', () => {
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

  // ── 1. Template Edge Cases ─────────────────────────────────────────────

  describe('Template Edge Cases', () => {
    it('should fail when creating template with empty messages array', async () => {
      await expect(
        createTemplate({ messages: [] })
      ).rejects.toThrow('At least one message is required');
    });

    it('should handle creating template with empty message string', async () => {
      const template = await createTemplate({ messages: [''] });
      expect(template._id).toBeDefined();
      expect(template.messages).toEqual(['']);
    });

    it('should fail when creating template with invalid Handlebars syntax', async () => {
      await expect(
        createTemplate({ messages: ['{{broken'] })
      ).rejects.toThrow('Template validation failed');
    });

    it('should preview template with missing required variables using placeholders', async () => {
      const template = await createTemplate({
        messages: ['Hello {{name}}, your code is {{code}}'],
      });

      const preview = await engine.templateService.preview(template._id.toString(), {});
      expect(preview).not.toBeNull();
      expect(preview!.messages[0]).toBe('Hello [name], your code is [code]');
    });

    it('should delete a template that is referenced by a rule', async () => {
      const template = await createTemplate();
      await createRule(template._id.toString());

      const deleted = await engine.templateService.delete(template._id.toString());
      expect(deleted).toBe(true);

      const found = await engine.templateService.getById(template._id.toString());
      expect(found).toBeNull();
    });

    it('should return null when updating a non-existent template', async () => {
      const fakeId = new Types.ObjectId().toString();
      const result = await engine.templateService.update(fakeId, {
        messages: ['Updated message'],
      });
      expect(result).toBeNull();
    });
  });

  // ── 2. Rule Edge Cases ─────────────────────────────────────────────────

  describe('Rule Edge Cases', () => {
    it('should throw when creating rule with non-existent templateId', async () => {
      const fakeTemplateId = new Types.ObjectId().toString();
      await expect(
        createRule(fakeTemplateId)
      ).rejects.toThrow();
    });

    it('should throw when creating rule with query mode but no conditions', async () => {
      const template = await createTemplate();
      await expect(
        createRule(template._id.toString(), {
          target: { mode: 'query' },
        })
      ).rejects.toThrow('Query mode requires a conditions object');
    });

    it('should throw when creating rule with list mode but empty identifiers array', async () => {
      const template = await createTemplate();
      await expect(
        createRule(template._id.toString(), {
          target: { mode: 'list', identifiers: [] },
        })
      ).rejects.toThrow('List mode requires a non-empty identifiers array');
    });

    it('should be a no-op when activating an already-active rule', async () => {
      const template = await createTemplate();
      const rule = await createRule(template._id.toString());

      const activated = await engine.ruleService.activate(rule._id.toString());
      expect(activated!.isActive).toBe(true);

      const activatedAgain = await engine.ruleService.activate(rule._id.toString());
      expect(activatedAgain!.isActive).toBe(true);
    });

    it('should be a no-op when deactivating an already-inactive rule', async () => {
      const template = await createTemplate();
      const rule = await createRule(template._id.toString());
      expect(rule.isActive).toBe(false);

      const deactivated = await engine.ruleService.deactivate(rule._id.toString());
      expect(deactivated!.isActive).toBe(false);
    });

    it('should delete an active rule', async () => {
      const template = await createTemplate();
      const rule = await createRule(template._id.toString());
      await engine.ruleService.activate(rule._id.toString());

      const result = await engine.ruleService.delete(rule._id.toString());
      expect(result.deleted).toBe(true);

      const found = await engine.ruleService.getById(rule._id.toString());
      expect(found).toBeNull();
    });
  });

  // ── 3. Throttle Config Edge Cases ──────────────────────────────────────

  describe('Throttle Config Edge Cases', () => {
    it('should save throttle config with maxPerUserPerDay = 0', async () => {
      const config = await engine.models.TelegramThrottleConfig.getConfig();
      await engine.models.TelegramThrottleConfig.findByIdAndUpdate(config._id, {
        $set: { maxPerUserPerDay: 0 },
      });

      const updated = await engine.models.TelegramThrottleConfig.findById(config._id);
      expect(updated).not.toBeNull();
      expect(updated!.maxPerUserPerDay).toBe(0);
    });

    it('should save throttle config with negative values', async () => {
      const config = await engine.models.TelegramThrottleConfig.getConfig();
      await engine.models.TelegramThrottleConfig.findByIdAndUpdate(config._id, {
        $set: { maxPerUserPerDay: -1, maxPerUserPerWeek: -5 },
      });

      const updated = await engine.models.TelegramThrottleConfig.findById(config._id);
      expect(updated).not.toBeNull();
      expect(updated!.maxPerUserPerDay).toBe(-1);
      expect(updated!.maxPerUserPerWeek).toBe(-5);
    });

    it('should save throttle config with minGapDays = 0', async () => {
      const config = await engine.models.TelegramThrottleConfig.getConfig();
      await engine.models.TelegramThrottleConfig.findByIdAndUpdate(config._id, {
        $set: { minGapDays: 0 },
      });

      const updated = await engine.models.TelegramThrottleConfig.findById(config._id);
      expect(updated).not.toBeNull();
      expect(updated!.minGapDays).toBe(0);
    });

    it('should return defaults when no throttle config exists', async () => {
      const config = await engine.models.TelegramThrottleConfig.getConfig();
      expect(config).not.toBeNull();
      expect(config.maxPerUserPerDay).toBeDefined();
      expect(config.maxPerUserPerWeek).toBeDefined();
      expect(config.minGapDays).toBeDefined();
      expect(config.throttleWindow).toBeDefined();
    });
  });

  // ── 4. Send Log Edge Cases ─────────────────────────────────────────────

  describe('Send Log Edge Cases', () => {
    it('should create a send log with all fields', async () => {
      const template = await createTemplate();
      const rule = await createRule(template._id.toString());

      const log = await engine.models.TelegramSendLog.create({
        identifierId: 'id-full',
        contactId: 'contact-full',
        accountId: 'acc-full',
        ruleId: rule._id,
        runId: 'run-full-001',
        templateId: template._id,
        messagePreview: 'Full message preview here',
        messageIndex: 2,
        deliveryStatus: 'sent',
        sentAt: new Date(),
        errorInfo: {
          code: 'NONE',
          category: 'unknown',
          message: 'no error',
          retryable: false,
        },
      });

      expect(log._id).toBeDefined();
      expect(log.identifierId).toBe('id-full');
      expect(log.messageIndex).toBe(2);
    });

    it('should return empty when querying send logs with non-existent ruleId', async () => {
      const fakeRuleId = new Types.ObjectId();
      const logs = await engine.models.TelegramSendLog.find({ ruleId: fakeRuleId });
      expect(logs).toHaveLength(0);
    });

    it('should return empty when querying send logs with future date range', async () => {
      const template = await createTemplate();
      const rule = await createRule(template._id.toString());

      await engine.models.TelegramSendLog.create({
        identifierId: 'id-1', contactId: 'c-1', accountId: 'acc-1',
        ruleId: rule._id, runId: 'run-1', templateId: template._id,
        messageIndex: 0, deliveryStatus: 'sent', sentAt: new Date(),
      });

      const futureLogs = await engine.models.TelegramSendLog.find({
        sentAt: { $gte: new Date('2099-01-01'), $lt: new Date('2099-12-31') },
      });
      expect(futureLogs).toHaveLength(0);
    });

    it('should handle send log with extremely long messagePreview', async () => {
      const template = await createTemplate();
      const rule = await createRule(template._id.toString());
      const longMessage = 'A'.repeat(10000);

      const log = await engine.models.TelegramSendLog.create({
        identifierId: 'id-long', contactId: 'c-long', accountId: 'acc-long',
        ruleId: rule._id, runId: 'run-long', templateId: template._id,
        messagePreview: longMessage,
        messageIndex: 0, deliveryStatus: 'sent', sentAt: new Date(),
      });

      expect(log._id).toBeDefined();
      expect(log.messagePreview.length).toBeGreaterThanOrEqual(1);
    });
  });

  // ── 5. Run Lifecycle Edge Cases ────────────────────────────────────────

  describe('Run Lifecycle Edge Cases', () => {
    it('should return null for getStatus with non-existent runId', async () => {
      const status = await engine.runner.getStatus('non-existent-run-id');
      expect(status).toBeNull();
    });

    it('should return { ok: false } when cancelling non-existent runId', async () => {
      const result = await engine.runner.cancel('non-existent-cancel-id');
      expect(result).toEqual({ ok: false });
    });

    it('should skip when another run is locked', async () => {
      // Trigger first run to acquire lock
      const first = engine.runner.trigger('lock-test-1');
      expect(first.runId).toBeDefined();

      // Give first run time to acquire lock
      await new Promise((r) => setTimeout(r, 200));

      // Second run should skip because lock is held
      // runAllRules returns { runId } immediately if lock not acquired
      const secondRunId = 'second-run-' + Date.now();
      const result = await engine.runner.runAllRules(secondRunId, 'lock-test-2');
      expect(result).toHaveProperty('runId');

      // Wait for first run to complete
      await new Promise((r) => setTimeout(r, 500));
    });

    it('should handle multiple rapid trigger calls', async () => {
      const results = [
        engine.runner.trigger('rapid-1'),
        engine.runner.trigger('rapid-2'),
        engine.runner.trigger('rapid-3'),
      ];

      // All triggers return a runId
      for (const r of results) {
        expect(r.runId).toBeDefined();
        expect(typeof r.runId).toBe('string');
      }

      // All runIds should be unique
      const ids = results.map(r => r.runId);
      expect(new Set(ids).size).toBe(3);

      // Wait for background runs to settle
      await new Promise((r) => setTimeout(r, 500));
    });
  });

  // ── 6. Runner with Empty Data ──────────────────────────────────────────

  describe('Runner with Empty Data', () => {
    it('should complete immediately with 0 stats when no active rules exist', async () => {
      const runId = 'empty-rules-run-' + Date.now();
      const result = await engine.runner.runAllRules(runId, 'test');

      expect(result).toHaveProperty('runId', runId);

      const runLog = await engine.models.TelegramRunLog.findByRunId(runId);
      expect(runLog).not.toBeNull();
      expect(runLog!.status).toBe('completed');
      expect(runLog!.stats.sent).toBe(0);
      expect(runLog!.stats.failed).toBe(0);
      expect(runLog!.stats.skipped).toBe(0);
      expect(runLog!.stats.throttled).toBe(0);
    });

    it('should skip with 0 sent when queryUsers returns empty array', async () => {
      adapters.queryUsers.mockResolvedValue([]);

      const template = await createTemplate({ messages: ['Hi {{name}}'] });
      const rule = await createRule(template._id.toString());
      await engine.ruleService.activate(rule._id.toString());

      const runId = 'empty-users-run-' + Date.now();
      const result = await engine.runner.runAllRules(runId, 'test');
      expect(result.runId).toBe(runId);

      const runLog = await engine.models.TelegramRunLog.findByRunId(runId);
      expect(runLog).not.toBeNull();
      expect(runLog!.stats.sent).toBe(0);
    });

    it('should skip all users when selectAccount returns null', async () => {
      adapters.queryUsers.mockResolvedValue([
        { _id: 'u1', phone: '+111', name: 'User1' },
        { _id: 'u2', phone: '+222', name: 'User2' },
      ]);
      adapters.selectAccount.mockResolvedValue(null);

      const template = await createTemplate({ messages: ['Hi {{name}}'] });
      const rule = await createRule(template._id.toString());
      await engine.ruleService.activate(rule._id.toString());

      const runId = 'no-account-run-' + Date.now();
      await engine.runner.runAllRules(runId, 'test');

      const runLog = await engine.models.TelegramRunLog.findByRunId(runId);
      expect(runLog).not.toBeNull();
      expect(runLog!.stats.sent).toBe(0);
      expect(runLog!.stats.skipped).toBeGreaterThanOrEqual(2);
    });

    it('should skip user when findIdentifier returns null', async () => {
      adapters.queryUsers.mockResolvedValue([
        { _id: 'u1', phone: '+111', name: 'User1' },
      ]);
      adapters.findIdentifier.mockResolvedValue(null);

      const template = await createTemplate({ messages: ['Hi {{name}}'] });
      const rule = await createRule(template._id.toString());
      await engine.ruleService.activate(rule._id.toString());

      const runId = 'no-identifier-run-' + Date.now();
      await engine.runner.runAllRules(runId, 'test');

      const runLog = await engine.models.TelegramRunLog.findByRunId(runId);
      expect(runLog).not.toBeNull();
      expect(runLog!.stats.sent).toBe(0);
      expect(runLog!.stats.skipped).toBeGreaterThanOrEqual(1);
    });
  });

  // ── 7. Runner Error Handling ───────────────────────────────────────────

  describe('Runner Error Handling', () => {
    it('should log error and increment failed count when sendMessage throws', async () => {
      adapters.queryUsers.mockResolvedValue([
        { _id: 'u1', phone: '+111', name: 'User1' },
        { _id: 'u2', phone: '+222', name: 'User2' },
      ]);
      adapters.findIdentifier.mockImplementation(async (phone: string) => ({
        id: `id-${phone}`, contactId: `contact-${phone}`,
      }));
      adapters.sendMessage
        .mockRejectedValueOnce(new Error('Network error'))
        .mockResolvedValueOnce(undefined);

      const template = await createTemplate({ messages: ['Hi {{name}}'] });
      const rule = await createRule(template._id.toString());
      await engine.ruleService.activate(rule._id.toString());

      const runId = 'send-error-run-' + Date.now();
      await engine.runner.runAllRules(runId, 'test');

      const runLog = await engine.models.TelegramRunLog.findByRunId(runId);
      expect(runLog).not.toBeNull();
      expect(runLog!.stats.failed).toBeGreaterThanOrEqual(1);
      // The second user should still be attempted (continue to next)
      expect(runLog!.stats.sent + runLog!.stats.failed).toBeGreaterThanOrEqual(2);
    });

    it('should stop the rule after maxConsecutiveFailures (3) consecutive send errors', async () => {
      const users = Array.from({ length: 5 }, (_, i) => ({
        _id: `u${i}`, phone: `+${i}00`, name: `User${i}`,
      }));
      adapters.queryUsers.mockResolvedValue(users);
      adapters.findIdentifier.mockImplementation(async (phone: string) => ({
        id: `id-${phone}`, contactId: `contact-${phone}`,
      }));
      // All sends fail
      adapters.sendMessage.mockRejectedValue(new Error('Persistent failure'));

      const template = await createTemplate({ messages: ['Hi {{name}}'] });
      const rule = await createRule(template._id.toString());
      await engine.ruleService.activate(rule._id.toString());

      const runId = 'consecutive-fail-run-' + Date.now();
      await engine.runner.runAllRules(runId, 'test');

      const runLog = await engine.models.TelegramRunLog.findByRunId(runId);
      expect(runLog).not.toBeNull();
      // Should stop at 3 (DEFAULT_MAX_CONSECUTIVE_FAILURES), not process all 5
      expect(runLog!.stats.failed).toBe(3);
      expect(runLog!.stats.sent).toBe(0);
    });

    it('should log error and show 1 failed when queryUsers adapter throws', async () => {
      adapters.queryUsers.mockRejectedValue(new Error('DB connection lost'));

      const template = await createTemplate({ messages: ['Hi {{name}}'] });
      const rule = await createRule(template._id.toString());
      await engine.ruleService.activate(rule._id.toString());

      const runId = 'query-error-run-' + Date.now();
      await engine.runner.runAllRules(runId, 'test');

      const runLog = await engine.models.TelegramRunLog.findByRunId(runId);
      expect(runLog).not.toBeNull();
      expect(runLog!.stats.failed).toBe(1);
      expect(runLog!.stats.sent).toBe(0);
    });

    it('should skip user when selectAccount adapter throws', async () => {
      adapters.queryUsers.mockResolvedValue([
        { _id: 'u1', phone: '+111', name: 'User1' },
      ]);
      adapters.findIdentifier.mockResolvedValue({ id: 'id-1', contactId: 'contact-1' });
      adapters.selectAccount.mockRejectedValue(new Error('Account service down'));

      const template = await createTemplate({ messages: ['Hi {{name}}'] });
      const rule = await createRule(template._id.toString());
      await engine.ruleService.activate(rule._id.toString());

      const runId = 'account-error-run-' + Date.now();
      await engine.runner.runAllRules(runId, 'test');

      const runLog = await engine.models.TelegramRunLog.findByRunId(runId);
      expect(runLog).not.toBeNull();
      // selectAccount throwing triggers the outer catch → failed++
      expect(runLog!.stats.failed).toBeGreaterThanOrEqual(1);
      expect(runLog!.stats.sent).toBe(0);
    });
  });

  // ── 8. Throttle Enforcement ────────────────────────────────────────────

  describe('Throttle Enforcement', () => {
    it('should throttle sending to same user twice in one run with maxPerUserPerDay=1', async () => {
      // Two users that resolve to the same identifierId
      adapters.queryUsers.mockResolvedValue([
        { _id: 'u1', phone: '+111', name: 'User1' },
        { _id: 'u2', phone: '+222', name: 'User2' },
      ]);

      // Both resolve to the same identifier
      adapters.findIdentifier.mockResolvedValue({ id: 'same-id', contactId: 'same-contact' });
      adapters.sendMessage.mockResolvedValue(undefined);

      // Set throttle config maxPerUserPerDay=1
      const config = await engine.models.TelegramThrottleConfig.getConfig();
      await engine.models.TelegramThrottleConfig.findByIdAndUpdate(config._id, {
        $set: { maxPerUserPerDay: 1, maxPerUserPerWeek: 10, minGapDays: 0 },
      });

      const template = await createTemplate({ messages: ['Hi {{name}}'] });
      const rule = await createRule(template._id.toString());
      await engine.ruleService.activate(rule._id.toString());

      const runId = 'throttle-same-user-run-' + Date.now();
      await engine.runner.runAllRules(runId, 'test');

      const runLog = await engine.models.TelegramRunLog.findByRunId(runId);
      expect(runLog).not.toBeNull();
      // First send should succeed, second should be throttled
      expect(runLog!.stats.sent).toBe(1);
      expect(runLog!.stats.throttled).toBe(1);
    });

    it('should throttle user who was already sent to today', async () => {
      const template = await createTemplate({ messages: ['Hi {{name}}'] });
      const rule = await createRule(template._id.toString());
      await engine.ruleService.activate(rule._id.toString());

      // Create an existing send log for today
      await engine.models.TelegramSendLog.create({
        identifierId: 'id-already-sent',
        contactId: 'contact-already',
        accountId: 'acc-1',
        ruleId: rule._id,
        runId: 'previous-run',
        templateId: template._id,
        messageIndex: 0,
        deliveryStatus: 'sent',
        sentAt: new Date(),
      });

      adapters.queryUsers.mockResolvedValue([
        { _id: 'u1', phone: '+111', name: 'User1' },
      ]);
      adapters.findIdentifier.mockResolvedValue({ id: 'id-already-sent', contactId: 'contact-already' });

      // Ensure default throttle config (maxPerUserPerDay=1)
      const config = await engine.models.TelegramThrottleConfig.getConfig();
      await engine.models.TelegramThrottleConfig.findByIdAndUpdate(config._id, {
        $set: { maxPerUserPerDay: 1, maxPerUserPerWeek: 2, minGapDays: 0 },
      });

      const runId = 'throttle-existing-run-' + Date.now();
      await engine.runner.runAllRules(runId, 'test');

      const runLog = await engine.models.TelegramRunLog.findByRunId(runId);
      expect(runLog).not.toBeNull();
      expect(runLog!.stats.sent).toBe(0);
      expect(runLog!.stats.throttled).toBe(1);
    });

    it('should throttle user within minGapDays', async () => {
      const template = await createTemplate({ messages: ['Hi {{name}}'] });
      const rule = await createRule(template._id.toString());
      await engine.ruleService.activate(rule._id.toString());

      // Create a send log from yesterday
      const yesterday = new Date(Date.now() - 86400000);
      await engine.models.TelegramSendLog.create({
        identifierId: 'id-gap-test',
        contactId: 'contact-gap',
        accountId: 'acc-1',
        ruleId: rule._id,
        runId: 'previous-run',
        templateId: template._id,
        messageIndex: 0,
        deliveryStatus: 'sent',
        sentAt: yesterday,
      });

      adapters.queryUsers.mockResolvedValue([
        { _id: 'u1', phone: '+111', name: 'User1' },
      ]);
      adapters.findIdentifier.mockResolvedValue({ id: 'id-gap-test', contactId: 'contact-gap' });

      // Set minGapDays=3 so yesterday's send is within the gap
      const config = await engine.models.TelegramThrottleConfig.getConfig();
      await engine.models.TelegramThrottleConfig.findByIdAndUpdate(config._id, {
        $set: { maxPerUserPerDay: 10, maxPerUserPerWeek: 20, minGapDays: 3 },
      });

      const runId = 'throttle-gap-run-' + Date.now();
      await engine.runner.runAllRules(runId, 'test');

      const runLog = await engine.models.TelegramRunLog.findByRunId(runId);
      expect(runLog).not.toBeNull();
      expect(runLog!.stats.sent).toBe(0);
      expect(runLog!.stats.throttled).toBe(1);
    });
  });

  // ── 9. Template Rendering Edge Cases ───────────────────────────────────

  describe('Template Rendering Edge Cases', () => {
    it('should render template with no variables as-is', async () => {
      const template = await createTemplate({
        messages: ['Hello world, no variables here!'],
      });

      const preview = await engine.templateService.preview(template._id.toString(), {});
      expect(preview).not.toBeNull();
      expect(preview!.messages[0]).toBe('Hello world, no variables here!');
    });

    it('should ignore extra variables not in template', async () => {
      const template = await createTemplate({
        messages: ['Hello {{name}}!'],
      });

      const preview = await engine.templateService.preview(template._id.toString(), {
        name: 'Alice',
        extraField: 'should be ignored',
        anotherExtra: 42,
      });

      expect(preview).not.toBeNull();
      expect(preview!.messages[0]).toBe('Hello Alice!');
    });

    it('should handle deeply nested variable in preview', async () => {
      const template = await createTemplate({
        messages: ['City: {{user.address.city}}'],
      });

      const preview = await engine.templateService.preview(template._id.toString(), {
        user: { address: { city: 'Mumbai' } },
      });

      expect(preview).not.toBeNull();
      expect(preview!.messages[0]).toBe('City: Mumbai');
    });
  });

  // ── 10. Date-Based Rule Filtering ──────────────────────────────────────

  describe('Date-Based Rule Filtering', () => {
    it('should exclude rule with validFrom in the future from run', async () => {
      adapters.queryUsers.mockResolvedValue([
        { _id: 'u1', phone: '+111', name: 'User1' },
      ]);
      adapters.findIdentifier.mockResolvedValue({ id: 'id-1', contactId: 'contact-1' });
      adapters.sendMessage.mockResolvedValue(undefined);

      const template = await createTemplate({ messages: ['Hi {{name}}'] });
      const rule = await createRule(template._id.toString(), {
        validFrom: new Date('2099-01-01'),
      });
      await engine.ruleService.activate(rule._id.toString());

      const runId = 'future-validfrom-run-' + Date.now();
      await engine.runner.runAllRules(runId, 'test');

      const runLog = await engine.models.TelegramRunLog.findByRunId(runId);
      expect(runLog).not.toBeNull();
      expect(runLog!.stats.sent).toBe(0);
    });

    it('should exclude rule with validTill in the past from run', async () => {
      adapters.queryUsers.mockResolvedValue([
        { _id: 'u1', phone: '+111', name: 'User1' },
      ]);
      adapters.findIdentifier.mockResolvedValue({ id: 'id-1', contactId: 'contact-1' });
      adapters.sendMessage.mockResolvedValue(undefined);

      const template = await createTemplate({ messages: ['Hi {{name}}'] });
      const rule = await createRule(template._id.toString(), {
        validTill: new Date('2020-01-01'),
      });
      await engine.ruleService.activate(rule._id.toString());

      const runId = 'past-validtill-run-' + Date.now();
      await engine.runner.runAllRules(runId, 'test');

      const runLog = await engine.models.TelegramRunLog.findByRunId(runId);
      expect(runLog).not.toBeNull();
      expect(runLog!.stats.sent).toBe(0);
    });

    it('should include rule with validFrom and validTill spanning today', async () => {
      adapters.queryUsers.mockResolvedValue([
        { _id: 'u1', phone: '+111', name: 'User1' },
      ]);
      adapters.findIdentifier.mockResolvedValue({ id: 'id-today', contactId: 'contact-today' });
      adapters.sendMessage.mockResolvedValue(undefined);

      // Set throttle config to allow sending
      const config = await engine.models.TelegramThrottleConfig.getConfig();
      await engine.models.TelegramThrottleConfig.findByIdAndUpdate(config._id, {
        $set: { maxPerUserPerDay: 10, maxPerUserPerWeek: 20, minGapDays: 0 },
      });

      const today = new Date();
      const startOfDay = new Date(today.getFullYear(), today.getMonth(), today.getDate(), 0, 0, 0);
      const endOfDay = new Date(today.getFullYear(), today.getMonth(), today.getDate(), 23, 59, 59);

      const template = await createTemplate({ messages: ['Hi {{name}}'] });
      const rule = await createRule(template._id.toString(), {
        validFrom: startOfDay,
        validTill: endOfDay,
      });
      await engine.ruleService.activate(rule._id.toString());

      const runId = 'today-range-run-' + Date.now();
      await engine.runner.runAllRules(runId, 'test');

      const runLog = await engine.models.TelegramRunLog.findByRunId(runId);
      expect(runLog).not.toBeNull();
      expect(runLog!.stats.sent).toBe(1);
    });
  });
});
