import { describe, it, expect, vi, beforeAll, afterAll, beforeEach } from 'vitest';
import mongoose from 'mongoose';
import { MongoMemoryServer } from 'mongodb-memory-server';
import { createRuleEngine } from '../index';
import type { RuleEngine } from '../index';

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
const send = vi.fn();
const selectAgent = vi.fn();
const findIdentifier = vi.fn();

const collections = [
  {
    name: 'users',
    label: 'Users',
    fields: [
      { name: 'name', type: 'string' as const },
      { name: 'email', type: 'string' as const },
      { name: 'age', type: 'number' as const },
      { name: 'status', type: 'string' as const, enumValues: ['active', 'inactive'] },
    ],
    joins: [
      { from: 'subscriptions', localField: '_id', foreignField: 'userId', as: 'subscription' },
    ],
  },
  {
    name: 'subscriptions',
    label: 'Subscriptions',
    fields: [
      { name: 'plan', type: 'string' as const },
      { name: 'active', type: 'boolean' as const },
    ],
  },
];

let mongod: MongoMemoryServer;
let connection: mongoose.Connection;
let engine: RuleEngine;

async function deactivateAllRules() {
  await engine.models.Rule.updateMany({}, { $set: { isActive: false } });
}

async function clearRunData() {
  await engine.models.SendLog.deleteMany({});
  await engine.models.RunLog.deleteMany({});
}

describe('Rule Engine — Integration', () => {
  beforeAll(async () => {
    mongod = await MongoMemoryServer.create();
    connection = mongoose.createConnection(mongod.getUri());

    engine = createRuleEngine({
      db: { connection },
      redis: { connection: mockRedis as any },
      adapters: { queryUsers, resolveData, send, selectAgent, findIdentifier },
      platforms: ['email', 'telegram'],
      audiences: ['customer', 'provider'],
      categories: ['onboarding', 'engagement'],
      collections,
    });
  });

  afterAll(async () => {
    if (connection) await connection.close();
    if (mongod) await mongod.stop();
  });

  beforeEach(() => {
    vi.clearAllMocks();
    for (const key of Object.keys(redisStore)) {
      delete redisStore[key];
    }
  });

  // ─── 1. Template CRUD ─────────────────────────────────────────────

  describe('Template CRUD', () => {
    it('should create a template and save to DB with correct fields', async () => {
      const template = await engine.services.template.create({
        name: 'Welcome Message',
        slug: 'welcome-msg',
        category: 'onboarding',
        audience: 'customer',
        platform: 'email',
        subjects: ['Hello {{name}}'],
        bodies: ['Hi {{name}}, welcome!'],
      });

      expect(template).toBeDefined();
      expect(template._id).toBeDefined();
      expect(template.name).toBe('Welcome Message');
      expect(template.slug).toBe('welcome-msg');
      expect(template.subjects).toEqual(['Hello {{name}}']);
      expect(template.bodies).toEqual(['Hi {{name}}, welcome!']);
      expect(template.category).toBe('onboarding');
      expect(template.audience).toBe('customer');
      expect(template.platform).toBe('email');
      expect(template.version).toBe(1);
      expect(template.isActive).toBe(true);
    });

    it('should read template back by ID with all fields matching', async () => {
      const created = await engine.services.template.create({
        name: 'Read Test',
        slug: 'read-test',
        category: 'engagement',
        audience: 'provider',
        platform: 'telegram',
        subjects: ['Subject {{var1}}'],
        bodies: ['Body {{var2}}'],
      });

      const fetched = await engine.services.template.getById(created._id.toString());
      expect(fetched).toBeDefined();
      expect(fetched!.name).toBe('Read Test');
      expect(fetched!.slug).toBe('read-test');
      expect(fetched!.subjects).toEqual(['Subject {{var1}}']);
      expect(fetched!.bodies).toEqual(['Body {{var2}}']);
      expect(fetched!.category).toBe('engagement');
      expect(fetched!.audience).toBe('provider');
      expect(fetched!.platform).toBe('telegram');
    });

    it('should update template subjects and increment version', async () => {
      const created = await engine.services.template.create({
        name: 'Update Test',
        slug: 'update-test',
        category: 'onboarding',
        audience: 'customer',
        platform: 'email',
        subjects: ['Original Subject'],
        bodies: ['Body'],
      });

      expect(created.version).toBe(1);

      const updated = await engine.services.template.update(created._id.toString(), {
        subjects: ['Updated Subject {{name}}'],
      });

      expect(updated).toBeDefined();
      expect(updated!.subjects).toEqual(['Updated Subject {{name}}']);
      expect(updated!.version).toBe(2);
    });

    it('should not bump version on non-content update', async () => {
      const created = await engine.services.template.create({
        name: 'No Version Bump',
        slug: 'no-version-bump',
        category: 'onboarding',
        audience: 'customer',
        platform: 'email',
        subjects: ['Hi'],
        bodies: ['Body'],
      });

      const updated = await engine.services.template.update(created._id.toString(), {
        name: 'Updated Name Only',
      });

      expect(updated!.name).toBe('Updated Name Only');
      expect(updated!.version).toBe(1);
    });

    it('should delete a template', async () => {
      const created = await engine.services.template.create({
        name: 'Delete Me',
        slug: 'delete-me',
        category: 'onboarding',
        audience: 'customer',
        platform: 'email',
        subjects: ['Hi'],
        bodies: ['Body'],
      });

      const result = await engine.services.template.delete(created._id.toString());
      expect(result.deleted).toBe(true);

      const fetched = await engine.services.template.getById(created._id.toString());
      expect(fetched).toBeNull();
    });

    it('should toggle template active/inactive', async () => {
      const created = await engine.services.template.create({
        name: 'Toggle Template',
        slug: 'toggle-template',
        category: 'onboarding',
        audience: 'customer',
        platform: 'email',
        subjects: ['Hi'],
        bodies: ['Body'],
      });

      expect(created.isActive).toBe(true);

      const toggled = await engine.services.template.toggleActive(created._id.toString());
      expect(toggled!.isActive).toBe(false);

      const toggledBack = await engine.services.template.toggleActive(created._id.toString());
      expect(toggledBack!.isActive).toBe(true);
    });

    it('should clone a template', async () => {
      const source = await engine.services.template.create({
        name: 'Clone Source',
        slug: 'clone-source',
        category: 'onboarding',
        audience: 'customer',
        platform: 'email',
        subjects: ['Clone Subject'],
        bodies: ['Clone Body'],
      });

      const cloned = await engine.services.template.clone(source._id.toString(), 'Cloned Template');
      expect(cloned.name).toBe('Cloned Template');
      expect(cloned.slug).toContain('clone-source-copy-');
      expect(cloned.isActive).toBe(false);
      expect(cloned.version).toBe(1);
      expect(cloned.bodies).toEqual(['Clone Body']);
      expect(cloned._id.toString()).not.toBe(source._id.toString());
    });

    it('should throw DuplicateSlugError when creating two templates with same slug', async () => {
      const slug = `dup-slug-${Date.now()}`;
      await engine.services.template.create({
        name: 'First', slug,
        category: 'onboarding', audience: 'customer', platform: 'email',
        subjects: ['Hi'], bodies: ['Body'],
      });

      await expect(
        engine.services.template.create({
          name: 'Second', slug,
          category: 'onboarding', audience: 'customer', platform: 'email',
          subjects: ['Hi'], bodies: ['Body'],
        }),
      ).rejects.toThrow(`Template with slug "${slug}" already exists`);
    });
  });

  // ─── 2. Template with collection/joins ─────────────────────────────

  describe('Template with collection/joins', () => {
    it('should create template with collectionName and joins', async () => {
      const template = await engine.services.template.create({
        name: 'Collection Template',
        slug: 'collection-template',
        category: 'onboarding',
        audience: 'customer',
        platform: 'email',
        subjects: ['Hi {{name}}'],
        bodies: ['Hello'],
        collectionName: 'users',
        joins: ['subscription'],
      });

      expect(template.collectionName).toBe('users');
      expect(template.joins).toEqual(['subscription']);

      const fetched = await engine.services.template.getById(template._id.toString());
      expect(fetched!.collectionName).toBe('users');
      expect((fetched as any).joins).toEqual(['subscription']);
    });

    it('should reject invalid collectionName', async () => {
      await expect(
        engine.services.template.create({
          name: 'Bad Collection',
          slug: 'bad-collection',
          category: 'onboarding',
          audience: 'customer',
          platform: 'email',
          subjects: ['Hi'],
          bodies: ['Body'],
          collectionName: 'nonexistent',
        }),
      ).rejects.toThrow('Collection "nonexistent" is not registered');
    });

    it('should reject invalid join aliases', async () => {
      await expect(
        engine.services.template.create({
          name: 'Bad Joins',
          slug: 'bad-joins',
          category: 'onboarding',
          audience: 'customer',
          platform: 'email',
          subjects: ['Hi'],
          bodies: ['Body'],
          collectionName: 'users',
          joins: ['nonexistent_join'],
        }),
      ).rejects.toThrow('Invalid joins');
    });

    it('should allow template without collection (optional)', async () => {
      const template = await engine.services.template.create({
        name: 'No Collection',
        slug: 'no-collection',
        category: 'onboarding',
        audience: 'customer',
        platform: 'email',
        subjects: ['Hi'],
        bodies: ['Body'],
      });

      expect(template.collectionName).toBeUndefined();
    });
  });

  // ─── 3. Rule CRUD (query mode) ────────────────────────────────────

  describe('Rule CRUD (query mode)', () => {
    it('should create a query-mode rule linked to a template', async () => {
      const template = await engine.services.template.create({
        name: 'Rule Query Template',
        slug: 'rule-query-template',
        category: 'onboarding',
        audience: 'customer',
        platform: 'email',
        subjects: ['Hi'],
        bodies: ['Body'],
        collectionName: 'users',
        joins: ['subscription'],
      });

      const rule = await engine.services.rule.create({
        name: 'Query Rule',
        platform: 'email',
        target: {
          mode: 'query',
          role: 'customer',
          platform: 'email',
          conditions: [
            { field: 'age', operator: 'gte' as any, value: 18 },
          ],
        },
        templateId: template._id.toString(),
      });

      expect(rule).toBeDefined();
      expect(rule._id).toBeDefined();
      expect(rule.name).toBe('Query Rule');
      expect(rule.target.mode).toBe('query');
      expect(rule.templateId.toString()).toBe(template._id.toString());
      expect(rule.isActive).toBe(false);
      expect(rule.ruleType).toBe('automated');
    });

    it('should validate conditions against template collection', async () => {
      const template = await engine.services.template.create({
        name: 'Condition Validate Template',
        slug: 'condition-validate-template',
        category: 'onboarding',
        audience: 'customer',
        platform: 'email',
        subjects: ['Hi'],
        bodies: ['Body'],
        collectionName: 'users',
        joins: ['subscription'],
      });

      // Valid condition on base collection field
      const rule = await engine.services.rule.create({
        name: 'Valid Condition Rule',
        platform: 'email',
        target: {
          mode: 'query',
          role: 'customer',
          platform: 'email',
          conditions: [
            { field: 'name', operator: 'eq' as any, value: 'test' },
          ],
        },
        templateId: template._id.toString(),
      });
      expect(rule).toBeDefined();

      // Valid condition on joined collection field
      const rule2 = await engine.services.rule.create({
        name: 'Valid Join Condition',
        platform: 'email',
        target: {
          mode: 'query',
          role: 'customer',
          platform: 'email',
          conditions: [
            { field: 'subscription.plan', operator: 'eq' as any, value: 'pro' },
          ],
        },
        templateId: template._id.toString(),
      });
      expect(rule2).toBeDefined();
    });

    it('should throw TemplateNotFoundError for non-existent templateId', async () => {
      const fakeId = new mongoose.Types.ObjectId().toString();
      await expect(
        engine.services.rule.create({
          name: 'Bad Template Rule',
          platform: 'email',
          target: { mode: 'query', role: 'customer', platform: 'email', conditions: [] },
          templateId: fakeId,
        }),
      ).rejects.toThrow('Template not found');
    });
  });

  // ─── 4. Rule CRUD (list mode) ─────────────────────────────────────

  describe('Rule CRUD (list mode)', () => {
    it('should create a list-mode rule with identifiers', async () => {
      const template = await engine.services.template.create({
        name: 'List Mode Template',
        slug: 'list-mode-template',
        category: 'onboarding',
        audience: 'customer',
        platform: 'email',
        subjects: ['Hi'],
        bodies: ['Body'],
      });

      const rule = await engine.services.rule.create({
        name: 'List Rule',
        platform: 'email',
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

    it('should reject list-mode rule with empty identifiers', async () => {
      const template = await engine.services.template.create({
        name: 'Empty List Template',
        slug: 'empty-list-template',
        category: 'onboarding',
        audience: 'customer',
        platform: 'email',
        subjects: ['Hi'],
        bodies: ['Body'],
      });

      await expect(
        engine.services.rule.create({
          name: 'Empty List Rule',
          platform: 'email',
          target: { mode: 'list', identifiers: [] },
          templateId: template._id.toString(),
        }),
      ).rejects.toThrow('target.identifiers must be a non-empty array');
    });

    it('should toggle rule active/inactive', async () => {
      const template = await engine.services.template.create({
        name: 'Toggle Rule Template',
        slug: 'toggle-rule-template',
        category: 'onboarding',
        audience: 'customer',
        platform: 'email',
        subjects: ['Hi'],
        bodies: ['Body'],
      });

      const rule = await engine.services.rule.create({
        name: 'Toggle Rule',
        platform: 'email',
        target: { mode: 'query', role: 'customer', platform: 'email', conditions: [] },
        templateId: template._id.toString(),
      });

      expect(rule.isActive).toBe(false);

      const toggled = await engine.services.rule.toggleActive(rule._id.toString());
      expect(toggled!.isActive).toBe(true);

      const toggledBack = await engine.services.rule.toggleActive(rule._id.toString());
      expect(toggledBack!.isActive).toBe(false);
    });
  });

  // ─── 5. Rule condition validation ─────────────────────────────────

  describe('Rule condition validation', () => {
    it('should reject conditions referencing fields not in template collection', async () => {
      const template = await engine.services.template.create({
        name: 'Condition Reject Template',
        slug: 'condition-reject-template',
        category: 'onboarding',
        audience: 'customer',
        platform: 'email',
        subjects: ['Hi'],
        bodies: ['Body'],
        collectionName: 'users',
        joins: [],
      });

      await expect(
        engine.services.rule.create({
          name: 'Invalid Field Rule',
          platform: 'email',
          target: {
            mode: 'query',
            role: 'customer',
            platform: 'email',
            conditions: [
              { field: 'nonexistent_field', operator: 'eq' as any, value: 'test' },
            ],
          },
          templateId: template._id.toString(),
        }),
      ).rejects.toThrow('Invalid conditions');
    });

    it('should reject conditions referencing join fields when joins are not active', async () => {
      const template = await engine.services.template.create({
        name: 'No Joins Template',
        slug: 'no-joins-template',
        category: 'onboarding',
        audience: 'customer',
        platform: 'email',
        subjects: ['Hi'],
        bodies: ['Body'],
        collectionName: 'users',
        joins: [],  // no joins active
      });

      await expect(
        engine.services.rule.create({
          name: 'Join Field Without Join',
          platform: 'email',
          target: {
            mode: 'query',
            role: 'customer',
            platform: 'email',
            conditions: [
              { field: 'subscription.plan', operator: 'eq' as any, value: 'pro' },
            ],
          },
          templateId: template._id.toString(),
        }),
      ).rejects.toThrow('Invalid conditions');
    });

    it('should accept valid conditions against base collection fields', async () => {
      const template = await engine.services.template.create({
        name: 'Valid Fields Template',
        slug: 'valid-fields-template',
        category: 'onboarding',
        audience: 'customer',
        platform: 'email',
        subjects: ['Hi'],
        bodies: ['Body'],
        collectionName: 'users',
      });

      const rule = await engine.services.rule.create({
        name: 'Valid Fields Rule',
        platform: 'email',
        target: {
          mode: 'query',
          role: 'customer',
          platform: 'email',
          conditions: [
            { field: 'age', operator: 'gte' as any, value: 18 },
            { field: 'status', operator: 'eq' as any, value: 'active' },
          ],
        },
        templateId: template._id.toString(),
      });

      expect(rule).toBeDefined();
    });
  });

  // ─── 6. Full send pipeline ────────────────────────────────────────

  describe('Full send pipeline', () => {
    it('should run all rules, call send adapter, create send logs and run log', async () => {
      await deactivateAllRules();
      await clearRunData();

      const template = await engine.services.template.create({
        name: 'Pipeline Template',
        slug: 'pipeline-template',
        category: 'onboarding',
        audience: 'customer',
        platform: 'email',
        subjects: ['Hello {{name}}'],
        bodies: ['Hi {{name}}'],
      });

      const rule = await engine.services.rule.create({
        name: 'Pipeline Rule',
        platform: 'email',
        target: {
          mode: 'query',
          role: 'customer',
          platform: 'email',
          conditions: [],
        },
        templateId: template._id.toString(),
        sendOnce: false,
      });

      await engine.services.rule.toggleActive(rule._id.toString());

      const user1Id = new mongoose.Types.ObjectId();
      const user2Id = new mongoose.Types.ObjectId();
      const user3Id = new mongoose.Types.ObjectId();

      queryUsers.mockResolvedValue([
        { _id: user1Id, contactValue: 'user1@test.com', name: 'User 1' },
        { _id: user2Id, contactValue: 'user2@test.com', name: 'User 2' },
        { _id: user3Id, contactValue: 'user3@test.com', name: 'User 3' },
      ]);
      resolveData.mockReturnValue({ name: 'Test' });
      send.mockResolvedValue(undefined);
      selectAgent.mockResolvedValue({ accountId: 'acc1', contactValue: 'sender@test.com', metadata: {} });
      findIdentifier.mockImplementation(async (cv: string) => ({
        id: new mongoose.Types.ObjectId().toString(),
        contactId: new mongoose.Types.ObjectId().toString(),
      }));

      await engine.services.runner.runAllRules();

      // Verify send adapter called 3 times
      expect(send).toHaveBeenCalledTimes(3);

      // Verify send was called with correct params shape
      const sendCall = send.mock.calls[0][0];
      expect(sendCall).toHaveProperty('identifierId');
      expect(sendCall).toHaveProperty('contactId');
      expect(sendCall).toHaveProperty('accountId');
      expect(sendCall).toHaveProperty('body');
      expect(sendCall).toHaveProperty('ruleId');
      expect(sendCall).toHaveProperty('autoApprove');

      // Verify SendLog records created
      const sends = await engine.models.SendLog.find({ ruleId: rule._id });
      expect(sends).toHaveLength(3);

      // Verify RunLog created
      const runLogs = await engine.models.RunLog.find({});
      expect(runLogs.length).toBeGreaterThanOrEqual(1);

      const latestLog = runLogs[runLogs.length - 1];
      expect(latestLog.totalStats.sent).toBe(3);
      expect(latestLog.rulesProcessed).toBe(1);
      // Verify stats shape has throttled/failed
      expect(latestLog.totalStats).toHaveProperty('throttled');
      expect(latestLog.totalStats).toHaveProperty('failed');
    });
  });

  // ─── 7. List-mode send ────────────────────────────────────────────

  describe('List-mode send', () => {
    it('should process identifiers in list mode', async () => {
      await deactivateAllRules();
      await clearRunData();

      const template = await engine.services.template.create({
        name: 'List Send Template',
        slug: 'list-send-template',
        category: 'onboarding',
        audience: 'customer',
        platform: 'email',
        subjects: ['Hi {{name}}'],
        bodies: ['Hello'],
      });

      const rule = await engine.services.rule.create({
        name: 'List Send Rule',
        platform: 'email',
        target: {
          mode: 'list',
          identifiers: ['alice@test.com', 'bob@test.com'],
        },
        templateId: template._id.toString(),
        sendOnce: true,
      });

      await engine.services.rule.toggleActive(rule._id.toString());

      const aliceId = new mongoose.Types.ObjectId().toString();
      const bobId = new mongoose.Types.ObjectId().toString();

      findIdentifier.mockImplementation(async (cv: string) => {
        if (cv === 'alice@test.com') return { id: aliceId, contactId: 'c1' };
        if (cv === 'bob@test.com') return { id: bobId, contactId: 'c2' };
        return null;
      });
      resolveData.mockReturnValue({ name: 'Test' });
      send.mockResolvedValue(undefined);
      selectAgent.mockResolvedValue({ accountId: 'acc1', contactValue: 'sender@test.com', metadata: {} });

      await engine.services.runner.runAllRules();

      // Verify both identifiers processed
      expect(send).toHaveBeenCalledTimes(2);

      const sends = await engine.models.SendLog.find({ ruleId: rule._id });
      expect(sends).toHaveLength(2);

      // Verify sendOnce list-mode rule auto-disables after all identifiers processed
      const updatedRule = await engine.models.Rule.findById(rule._id);
      expect(updatedRule!.isActive).toBe(false);
    });
  });

  // ─── 8. SendOnce deduplication ────────────────────────────────────

  describe('SendOnce deduplication', () => {
    it('should skip users on second run when sendOnce is true', async () => {
      await deactivateAllRules();
      await clearRunData();

      const template = await engine.services.template.create({
        name: 'Dedup Template',
        slug: 'dedup-template',
        category: 'onboarding',
        audience: 'customer',
        platform: 'email',
        subjects: ['Hi {{name}}'],
        bodies: ['Hello'],
      });

      const rule = await engine.services.rule.create({
        name: 'Dedup Rule',
        platform: 'email',
        target: {
          mode: 'query',
          role: 'customer',
          platform: 'email',
          conditions: [],
        },
        templateId: template._id.toString(),
        sendOnce: true,
      });

      await engine.services.rule.toggleActive(rule._id.toString());

      const user1Id = new mongoose.Types.ObjectId();
      const user2Id = new mongoose.Types.ObjectId();
      const id1 = new mongoose.Types.ObjectId().toString();
      const id2 = new mongoose.Types.ObjectId().toString();

      queryUsers.mockResolvedValue([
        { _id: user1Id, contactValue: 'dedup1@test.com' },
        { _id: user2Id, contactValue: 'dedup2@test.com' },
      ]);
      resolveData.mockReturnValue({ name: 'Test' });
      send.mockResolvedValue(undefined);
      selectAgent.mockResolvedValue({ accountId: 'acc1', contactValue: 'sender@test.com', metadata: {} });
      findIdentifier.mockImplementation(async (cv: string) => {
        if (cv === 'dedup1@test.com') return { id: id1, contactId: 'c1' };
        if (cv === 'dedup2@test.com') return { id: id2, contactId: 'c2' };
        return null;
      });

      // First run — should send
      await engine.services.runner.runAllRules();
      expect(send).toHaveBeenCalledTimes(2);

      const sendsAfterFirst = await engine.models.SendLog.find({ ruleId: rule._id });
      expect(sendsAfterFirst).toHaveLength(2);

      // Clear send mock but keep implementations
      send.mockClear();

      // Ensure rule is still active
      await engine.models.Rule.findByIdAndUpdate(rule._id, { $set: { isActive: true } });

      // Second run — should skip all (sendOnce)
      await engine.services.runner.runAllRules();
      expect(send).toHaveBeenCalledTimes(0);
    });
  });

  // ─── 9. Throttle enforcement ──────────────────────────────────────

  describe('Throttle enforcement', () => {
    it('should skip user on second run when throttle maxPerUserPerDay is 1', async () => {
      await deactivateAllRules();
      await clearRunData();

      // Set throttle config: allow only 1 per user per day, no min gap
      await engine.models.ThrottleConfig.findOneAndUpdate(
        {},
        { maxPerUserPerDay: 1, maxPerUserPerWeek: 7, minGapDays: 0 },
        { upsert: true },
      );

      const template = await engine.services.template.create({
        name: 'Throttle Test',
        slug: 'throttle-test',
        category: 'engagement',
        audience: 'customer',
        platform: 'email',
        subjects: ['Throttle'],
        bodies: ['Throttle body'],
      });

      const rule = await engine.services.rule.create({
        name: 'Throttle Rule',
        platform: 'email',
        templateId: template._id.toString(),
        target: { mode: 'list', identifiers: ['throttle@example.com'] },
        ruleType: 'automated' as any,
        sendOnce: false,
      });

      await engine.services.rule.toggleActive(rule._id.toString());

      const stableId = new mongoose.Types.ObjectId().toString();
      findIdentifier.mockImplementation(async () => ({
        id: stableId,
        contactId: new mongoose.Types.ObjectId().toString(),
      }));
      resolveData.mockReturnValue({});
      send.mockResolvedValue(undefined);
      selectAgent.mockResolvedValue({ accountId: 'acc1', contactValue: 'sender@test.com', metadata: {} });

      send.mockClear();

      // First run should send
      await engine.services.runner.runAllRules('manual');
      expect(send).toHaveBeenCalledTimes(1);

      send.mockClear();

      // Second run should be throttled
      await engine.services.runner.runAllRules('manual');
      expect(send).not.toHaveBeenCalled();
    });
  });

  // ─── 10. Platform filtering ───────────────────────────────────────

  describe('Platform filtering', () => {
    it('should filter templates by platform', async () => {
      // Create templates on different platforms
      await engine.services.template.create({
        name: 'Email Only',
        slug: `email-only-${Date.now()}`,
        category: 'onboarding',
        audience: 'customer',
        platform: 'email',
        subjects: ['Hi'],
        bodies: ['Body'],
      });

      await engine.services.template.create({
        name: 'Telegram Only',
        slug: `telegram-only-${Date.now()}`,
        category: 'onboarding',
        audience: 'customer',
        platform: 'telegram',
        subjects: ['Hi'],
        bodies: ['Body'],
      });

      const emailTemplates = await engine.services.template.list({ platform: 'email' });
      const telegramTemplates = await engine.services.template.list({ platform: 'telegram' });

      // All email templates should have platform 'email'
      for (const t of emailTemplates.templates) {
        expect(t.platform).toBe('email');
      }

      // All telegram templates should have platform 'telegram'
      for (const t of telegramTemplates.templates) {
        expect(t.platform).toBe('telegram');
      }

      // Both sets should have at least one template
      expect(emailTemplates.templates.length).toBeGreaterThanOrEqual(1);
      expect(telegramTemplates.templates.length).toBeGreaterThanOrEqual(1);
    });

    it('should store platform on rules', async () => {
      const template = await engine.services.template.create({
        name: 'Platform Rule Template',
        slug: `platform-rule-${Date.now()}`,
        category: 'onboarding',
        audience: 'customer',
        platform: 'telegram',
        subjects: ['Hi'],
        bodies: ['Body'],
      });

      const rule = await engine.services.rule.create({
        name: 'Telegram Rule',
        platform: 'telegram',
        target: { mode: 'query', role: 'customer', platform: 'telegram', conditions: [] },
        templateId: template._id.toString(),
      });

      expect(rule.platform).toBe('telegram');

      const fetched = await engine.services.rule.getById(rule._id.toString());
      expect(fetched!.platform).toBe('telegram');
    });
  });

  // ─── 11. Preview conditions ───────────────────────────────────────

  describe('Preview conditions', () => {
    it('should preview conditions against a collection', async () => {
      queryUsers.mockResolvedValue([
        { _id: new mongoose.Types.ObjectId(), contactValue: 'match1@test.com', name: 'Match 1' },
        { _id: new mongoose.Types.ObjectId(), contactValue: 'match2@test.com', name: 'Match 2' },
      ]);

      const result = await engine.services.rule.previewConditions({
        collectionName: 'users',
        joins: ['subscription'],
        conditions: [
          { field: 'age', operator: 'gte' as any, value: 18 },
        ],
      });

      expect(result.matchedCount).toBe(2);
      expect(result.sample).toHaveLength(2);
      expect(queryUsers).toHaveBeenCalled();
    });

    it('should reject preview with invalid collection', async () => {
      await expect(
        engine.services.rule.previewConditions({
          collectionName: 'nonexistent',
          conditions: [{ field: 'x', operator: 'eq' as any, value: 1 }],
        }),
      ).rejects.toThrow('Collection "nonexistent" not found');
    });

    it('should reject preview with invalid conditions', async () => {
      await expect(
        engine.services.rule.previewConditions({
          collectionName: 'users',
          conditions: [{ field: 'bogus_field', operator: 'eq' as any, value: 1 }],
        }),
      ).rejects.toThrow('Invalid conditions');
    });
  });

  // ─── 12. Negative scenarios ───────────────────────────────────────

  describe('Negative scenarios', () => {
    it('should throw when creating template with empty bodies', async () => {
      await expect(
        engine.services.template.create({
          name: 'Empty Bodies',
          slug: 'empty-bodies',
          category: 'onboarding',
          audience: 'customer',
          platform: 'email',
          subjects: ['Subject'],
          bodies: [],
        }),
      ).rejects.toThrow('At least one body is required');
    });

    it('should complete without error when no active rules exist', async () => {
      await deactivateAllRules();
      await clearRunData();

      await engine.services.runner.runAllRules();

      const runLogs = await engine.models.RunLog.find({}).sort({ runAt: -1 });
      expect(runLogs.length).toBeGreaterThanOrEqual(1);
      const latest = runLogs[0];
      expect(latest.rulesProcessed).toBe(0);
      expect(latest.totalStats.sent).toBe(0);
    });

    it('should skip rule when template is deleted before run', async () => {
      await deactivateAllRules();
      await clearRunData();

      const template = await engine.services.template.create({
        name: 'Deleted Template',
        slug: 'deleted-template',
        category: 'onboarding',
        audience: 'customer',
        platform: 'email',
        subjects: ['Hi'],
        bodies: ['Body'],
      });

      const rule = await engine.services.rule.create({
        name: 'Rule For Deleted Template',
        platform: 'email',
        target: { mode: 'list', identifiers: ['skip@test.com'] },
        templateId: template._id.toString(),
      });

      await engine.services.rule.toggleActive(rule._id.toString());

      // Delete template from DB
      await engine.models.Template.findByIdAndDelete(template._id);

      send.mockClear();
      await engine.services.runner.runAllRules();

      // send should not have been called — runner handles missing template gracefully
      expect(send).not.toHaveBeenCalled();
    });

    it('should reject template with extremely long slug', async () => {
      const longSlug = 'a'.repeat(1000);
      await expect(
        engine.services.template.create({
          name: 'Long Slug',
          slug: longSlug,
          category: 'onboarding',
          audience: 'customer',
          platform: 'email',
          subjects: ['Hi'],
          bodies: ['Body'],
        }),
      ).rejects.toThrow(/maximum allowed length/);
    });

    it('should reject rule condition with invalid operator', async () => {
      const template = await engine.services.template.create({
        name: 'Invalid Op Template',
        slug: `invalid-op-${Date.now()}`,
        category: 'onboarding',
        audience: 'customer',
        platform: 'email',
        subjects: ['Hi'],
        bodies: ['Body'],
      });

      await expect(
        engine.services.rule.create({
          name: 'Invalid Op Rule',
          platform: 'email',
          target: {
            mode: 'query',
            role: 'customer',
            platform: 'email',
            conditions: [{ field: 'x', operator: 'INVALID' as any, value: 1 }],
          },
          templateId: template._id.toString(),
        }),
      ).rejects.toThrow();
    });

    it('should not activate rule when linked template is inactive', async () => {
      const template = await engine.services.template.create({
        name: 'Inactive Template Check',
        slug: `inactive-tpl-${Date.now()}`,
        category: 'onboarding',
        audience: 'customer',
        platform: 'email',
        subjects: ['Hi'],
        bodies: ['Body'],
      });

      const rule = await engine.services.rule.create({
        name: 'Cannot Activate',
        platform: 'email',
        target: { mode: 'query', role: 'customer', platform: 'email', conditions: [] },
        templateId: template._id.toString(),
      });

      // Deactivate template
      await engine.services.template.toggleActive(template._id.toString());

      await expect(
        engine.services.rule.toggleActive(rule._id.toString()),
      ).rejects.toThrow('Cannot activate rule: linked template is inactive');
    });
  });
});
