import { describe, it, expect, vi, beforeAll, afterAll, beforeEach } from 'vitest';
import { MongoMemoryServer } from 'mongodb-memory-server';
import mongoose from 'mongoose';
import { createEmailRuleEngine } from '../index';
import type { EmailRuleEngine } from '../index';

vi.setConfig({ testTimeout: 30_000, hookTimeout: 300_000 });

// Mock ioredis module so RedisLock and any ioredis imports don't fail
vi.mock('ioredis', () => {
  return { default: vi.fn() };
});

const redisStore: Record<string, any> = {};

const mockRedis = {
  get: vi.fn(async (key: string) => redisStore[key] ?? null),
  set: vi.fn(async (key: string, value: string) => { redisStore[key] = value; return 'OK'; }),
  exists: vi.fn(async (key: string) => (key in redisStore ? 1 : 0)),
  del: vi.fn(async (key: string) => { delete redisStore[key]; return 1; }),
  hset: vi.fn(async (key: string, ...args: any[]) => {
    if (!redisStore[key]) redisStore[key] = {};
    for (let i = 0; i < args.length; i += 2) {
      redisStore[key][args[i]] = args[i + 1];
    }
    return 1;
  }),
  hget: vi.fn(async (key: string, field: string) => redisStore[key]?.[field] ?? null),
  hgetall: vi.fn(async (key: string) => redisStore[key] ?? {}),
  expire: vi.fn(async () => 1),
  eval: vi.fn(async () => 1),
};

const queryUsers = vi.fn();
const resolveData = vi.fn();
const sendEmail = vi.fn();
const selectAgent = vi.fn();
const findIdentifier = vi.fn();

let mongod: MongoMemoryServer;
let connection: mongoose.Connection;
let engine: EmailRuleEngine;

/**
 * Deactivate all rules in DB to isolate runner tests.
 */
async function deactivateAllRules() {
  await engine.models.EmailRule.updateMany({}, { $set: { isActive: false } });
}

/**
 * Clear all send records and run logs for clean runner tests.
 */
async function clearRunData() {
  await engine.models.EmailRuleSend.deleteMany({});
  await engine.models.EmailRuleRunLog.deleteMany({});
}

describe('Email Rule Engine — Integration', () => {
  beforeAll(async () => {
    mongod = await MongoMemoryServer.create();
    connection = mongoose.createConnection(mongod.getUri());

    engine = createEmailRuleEngine({
      db: { connection },
      redis: { connection: mockRedis as any },
      adapters: { queryUsers, resolveData, sendEmail, selectAgent, findIdentifier },
      platforms: ['test'],
      audiences: ['customer', 'provider'],
      categories: ['onboarding', 'engagement'],
    });
  });

  afterAll(async () => {
    if (connection) await connection.close();
    if (mongod) await mongod.stop();
  });

  beforeEach(() => {
    vi.clearAllMocks();
    // Clear redis store
    for (const key of Object.keys(redisStore)) {
      delete redisStore[key];
    }
  });

  // ─── 1. Template CRUD with real DB ───────────────────────────────

  describe('Template CRUD with real DB', () => {
    it('should create a template and save to DB with correct fields', async () => {
      const template = await engine.templateService.create({
        name: 'Welcome Email',
        slug: 'welcome-email',
        category: 'onboarding',
        audience: 'customer',
        platform: 'test',
        subjects: ['Hello {{name}}'],
        bodies: ['Hi'],
      });

      expect(template).toBeDefined();
      expect(template._id).toBeDefined();
      expect(template.name).toBe('Welcome Email');
      expect(template.slug).toBe('welcome-email');
      expect(template.subjects).toEqual(['Hello {{name}}']);
      expect(template.bodies).toEqual(['Hi']);
      expect(template.category).toBe('onboarding');
      expect(template.audience).toBe('customer');
      expect(template.platform).toBe('test');
      expect(template.version).toBe(1);
      expect(template.isActive).toBe(true);
    });

    it('should read template back by ID with all fields matching', async () => {
      const created = await engine.templateService.create({
        name: 'Read Test Template',
        slug: 'read-test-template',
        category: 'engagement',
        audience: 'provider',
        platform: 'test',
        subjects: ['Subject {{var1}}'],
        bodies: ['Body {{var2}}'],
      });

      const fetched = await engine.templateService.getById(created._id.toString());
      expect(fetched).toBeDefined();
      expect(fetched!.name).toBe('Read Test Template');
      expect(fetched!.slug).toBe('read-test-template');
      expect(fetched!.subjects).toEqual(['Subject {{var1}}']);
      expect(fetched!.bodies).toEqual(['Body {{var2}}']);
      expect(fetched!.category).toBe('engagement');
      expect(fetched!.audience).toBe('provider');
    });

    it('should update template subjects and increment version', async () => {
      const created = await engine.templateService.create({
        name: 'Update Test Template',
        slug: 'update-test-template',
        category: 'onboarding',
        audience: 'customer',
        platform: 'test',
        subjects: ['Original Subject'],
        bodies: ['Body'],
      });

      expect(created.version).toBe(1);

      const updated = await engine.templateService.update(created._id.toString(), {
        subjects: ['Updated Subject {{name}}'],
      });

      expect(updated).toBeDefined();
      expect(updated!.subjects).toEqual(['Updated Subject {{name}}']);
      expect(updated!.version).toBe(2);
    });

    it('should auto-extract variables from subjects and bodies', async () => {
      const template = await engine.templateService.create({
        name: 'Variables Test',
        slug: 'variables-test',
        category: 'onboarding',
        audience: 'customer',
        platform: 'test',
        subjects: ['Hello {{firstName}}'],
        bodies: ['Dear {{lastName}}, your code is {{code}}'],
      });

      expect(template.variables).toContain('firstName');
      expect(template.variables).toContain('lastName');
      expect(template.variables).toContain('code');
    });
  });

  // ─── 2. Rule CRUD with real DB ───────────────────────────────────

  describe('Rule CRUD with real DB', () => {
    it('should create a query-mode rule and save to DB', async () => {
      const template = await engine.templateService.create({
        name: 'Rule CRUD Template',
        slug: 'rule-crud-template',
        category: 'onboarding',
        audience: 'customer',
        platform: 'test',
        subjects: ['Hi'],
        bodies: ['Body'],
      });

      const rule = await engine.ruleService.create({
        name: 'Query Rule',
        target: {
          mode: 'query',
          role: 'customer',
          platform: 'test',
          conditions: [],
        },
        templateId: template._id.toString(),
      });

      expect(rule).toBeDefined();
      expect(rule._id).toBeDefined();
      expect(rule.name).toBe('Query Rule');
      expect(rule.target.mode).toBe('query');
      expect(rule.templateId.toString()).toBe(template._id.toString());
      expect(rule.isActive).toBe(false); // defaults to false
    });

    it('should create a list-mode rule with identifiers', async () => {
      const template = await engine.templateService.create({
        name: 'List Mode Template',
        slug: 'list-mode-template',
        category: 'onboarding',
        audience: 'customer',
        platform: 'test',
        subjects: ['Hi'],
        bodies: ['Body'],
      });

      const rule = await engine.ruleService.create({
        name: 'List Rule',
        target: {
          mode: 'list',
          identifiers: ['user1@test.com', 'user2@test.com'],
        },
        templateId: template._id.toString(),
      });

      expect(rule).toBeDefined();
      expect(rule.target.mode).toBe('list');
      expect((rule.target as any).identifiers).toEqual(['user1@test.com', 'user2@test.com']);
    });

    it('should toggle rule active/inactive', async () => {
      const template = await engine.templateService.create({
        name: 'Toggle Template',
        slug: 'toggle-template',
        category: 'onboarding',
        audience: 'customer',
        platform: 'test',
        subjects: ['Hi'],
        bodies: ['Body'],
      });

      const rule = await engine.ruleService.create({
        name: 'Toggle Rule',
        target: {
          mode: 'query',
          role: 'customer',
          platform: 'test',
          conditions: [],
        },
        templateId: template._id.toString(),
      });

      expect(rule.isActive).toBe(false);

      const toggled = await engine.ruleService.toggleActive(rule._id.toString());
      expect(toggled!.isActive).toBe(true);

      const toggledBack = await engine.ruleService.toggleActive(rule._id.toString());
      expect(toggledBack!.isActive).toBe(false);
    });
  });

  // ─── 3. Full send pipeline ──────────────────────────────────────

  describe('Full send pipeline', () => {
    it('should run all rules, create send records, and log the run', async () => {
      await deactivateAllRules();
      await clearRunData();

      const template = await engine.templateService.create({
        name: 'Pipeline Template',
        slug: 'pipeline-template',
        category: 'onboarding',
        audience: 'customer',
        platform: 'test',
        subjects: ['Hello {{name}}'],
        bodies: ['Hi {{name}}'],
      });

      const rule = await engine.ruleService.create({
        name: 'Pipeline Rule',
        target: {
          mode: 'query',
          role: 'customer',
          platform: 'test',
          conditions: [],
        },
        templateId: template._id.toString(),
        sendOnce: false,
      });

      // Activate only this rule
      await engine.ruleService.toggleActive(rule._id.toString());

      queryUsers.mockResolvedValue([
        { _id: new mongoose.Types.ObjectId(), email: 'user1@test.com', name: 'User 1' },
        { _id: new mongoose.Types.ObjectId(), email: 'user2@test.com', name: 'User 2' },
        { _id: new mongoose.Types.ObjectId(), email: 'user3@test.com', name: 'User 3' },
      ]);
      resolveData.mockReturnValue({ name: 'Test' });
      sendEmail.mockResolvedValue(undefined);
      selectAgent.mockResolvedValue({ accountId: 'acc1', email: 'sender@test.com', metadata: {} });
      findIdentifier.mockImplementation(async (email: string) => ({
        id: new mongoose.Types.ObjectId().toString(),
        contactId: new mongoose.Types.ObjectId().toString(),
      }));

      await engine.runner.runAllRules();

      // Verify sendEmail called 3 times
      expect(sendEmail).toHaveBeenCalledTimes(3);

      // Verify EmailRuleSend records created (3 records)
      const sends = await engine.models.EmailRuleSend.find({ ruleId: rule._id });
      expect(sends).toHaveLength(3);

      // Verify EmailRuleRunLog created
      const runLogs = await engine.models.EmailRuleRunLog.find({});
      expect(runLogs.length).toBeGreaterThanOrEqual(1);

      const latestLog = runLogs[runLogs.length - 1];
      expect(latestLog.totalStats.sent).toBe(3);
      expect(latestLog.rulesProcessed).toBe(1);
    });
  });

  // ─── 4. List-mode auto-disable ──────────────────────────────────

  describe('List-mode auto-disable', () => {
    it('should auto-disable a sendOnce list-mode rule after all identifiers are processed', async () => {
      await deactivateAllRules();
      await clearRunData();

      const template = await engine.templateService.create({
        name: 'Auto-disable Template',
        slug: 'auto-disable-template',
        category: 'onboarding',
        audience: 'customer',
        platform: 'test',
        subjects: ['Hi {{name}}'],
        bodies: ['Hello'],
      });

      const rule = await engine.ruleService.create({
        name: 'Auto-disable Rule',
        target: {
          mode: 'list',
          identifiers: ['alice@test.com', 'bob@test.com'],
        },
        templateId: template._id.toString(),
        sendOnce: true,
      });

      await engine.ruleService.toggleActive(rule._id.toString());

      const aliceId = new mongoose.Types.ObjectId().toString();
      const bobId = new mongoose.Types.ObjectId().toString();

      findIdentifier.mockImplementation(async (email: string) => {
        if (email === 'alice@test.com') return { id: aliceId, contactId: 'c1' };
        if (email === 'bob@test.com') return { id: bobId, contactId: 'c2' };
        return null;
      });
      resolveData.mockReturnValue({ name: 'Test' });
      sendEmail.mockResolvedValue(undefined);
      selectAgent.mockResolvedValue({ accountId: 'acc1', email: 'sender@test.com', metadata: {} });

      await engine.runner.runAllRules();

      // Verify both identifiers have send records
      const sends = await engine.models.EmailRuleSend.find({ ruleId: rule._id });
      expect(sends).toHaveLength(2);

      // Verify rule isActive is now false
      const updatedRule = await engine.models.EmailRule.findById(rule._id);
      expect(updatedRule!.isActive).toBe(false);
    });
  });

  // ─── 5. Template fields merge ───────────────────────────────────

  describe('Template fields merge', () => {
    it('should merge template fields with resolveData, where resolveData wins on conflict', async () => {
      await deactivateAllRules();
      await clearRunData();

      const template = await engine.templateService.create({
        name: 'Fields Merge Template',
        slug: 'fields-merge-template',
        category: 'onboarding',
        audience: 'customer',
        platform: 'test',
        subjects: ['Welcome {{name}}'],
        bodies: ['{{company}} - {{role}}'],
        fields: { company: 'Acme', role: 'Engineer' },
      });

      const rule = await engine.ruleService.create({
        name: 'Fields Merge Rule',
        target: {
          mode: 'query',
          role: 'customer',
          platform: 'test',
          conditions: [],
        },
        templateId: template._id.toString(),
        sendOnce: false,
      });

      await engine.ruleService.toggleActive(rule._id.toString());

      const userId = new mongoose.Types.ObjectId();
      queryUsers.mockResolvedValue([
        { _id: userId, email: 'fieldtest@test.com', name: 'John' },
      ]);
      // resolveData returns role = 'Manager', which conflicts with template fields role = 'Engineer'
      resolveData.mockReturnValue({ name: 'John', role: 'Manager' });
      sendEmail.mockResolvedValue(undefined);
      selectAgent.mockResolvedValue({ accountId: 'acc1', email: 'sender@test.com', metadata: {} });
      findIdentifier.mockResolvedValue({
        id: new mongoose.Types.ObjectId().toString(),
        contactId: new mongoose.Types.ObjectId().toString(),
      });

      await engine.runner.runAllRules();

      expect(sendEmail).toHaveBeenCalledTimes(1);

      // The templateData is { ...template.fields, ...resolveData(user) }
      // So role should be 'Manager' (resolveData wins over template fields)
      const sendCall = sendEmail.mock.calls[0][0];
      // The htmlBody is rendered via MJML + Handlebars. The rendered content should contain 'Manager' not 'Engineer'
      // Since MJML wraps content, we check the HTML includes 'Manager'
      expect(sendCall.htmlBody).toContain('Manager');
      expect(sendCall.htmlBody).toContain('Acme');
      // Ensure 'Engineer' is NOT in the rendered output (Manager overrode it)
      expect(sendCall.htmlBody).not.toContain('Engineer');
    });
  });

  // ─── 6. SendOnce deduplication ──────────────────────────────────

  describe('SendOnce deduplication', () => {
    it('should skip users on second run when sendOnce is true', async () => {
      await deactivateAllRules();
      await clearRunData();

      const template = await engine.templateService.create({
        name: 'Dedup Template',
        slug: 'dedup-template',
        category: 'onboarding',
        audience: 'customer',
        platform: 'test',
        subjects: ['Hi {{name}}'],
        bodies: ['Hello'],
      });

      const rule = await engine.ruleService.create({
        name: 'Dedup Rule',
        target: {
          mode: 'query',
          role: 'customer',
          platform: 'test',
          conditions: [],
        },
        templateId: template._id.toString(),
        sendOnce: true,
      });

      await engine.ruleService.toggleActive(rule._id.toString());

      // Use stable user IDs across runs
      const user1Id = new mongoose.Types.ObjectId();
      const user2Id = new mongoose.Types.ObjectId();
      const id1 = new mongoose.Types.ObjectId().toString();
      const id2 = new mongoose.Types.ObjectId().toString();

      queryUsers.mockResolvedValue([
        { _id: user1Id, email: 'dedup1@test.com' },
        { _id: user2Id, email: 'dedup2@test.com' },
      ]);
      resolveData.mockReturnValue({ name: 'Test' });
      sendEmail.mockResolvedValue(undefined);
      selectAgent.mockResolvedValue({ accountId: 'acc1', email: 'sender@test.com', metadata: {} });
      findIdentifier.mockImplementation(async (email: string) => {
        if (email === 'dedup1@test.com') return { id: id1, contactId: 'c1' };
        if (email === 'dedup2@test.com') return { id: id2, contactId: 'c2' };
        return null;
      });

      // First run — should send
      await engine.runner.runAllRules();
      expect(sendEmail).toHaveBeenCalledTimes(2);

      const sendsAfterFirst = await engine.models.EmailRuleSend.find({ ruleId: rule._id });
      expect(sendsAfterFirst).toHaveLength(2);

      // Clear mocks but keep implementations
      sendEmail.mockClear();

      // Ensure rule is still active for the second run
      await engine.models.EmailRule.findByIdAndUpdate(rule._id, { $set: { isActive: true } });

      // Second run — should skip all (sendOnce deduplication)
      await engine.runner.runAllRules();
      expect(sendEmail).toHaveBeenCalledTimes(0);
    });
  });
});
