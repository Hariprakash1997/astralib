import { describe, it, expect, vi, beforeEach } from 'vitest';
import { RuleRunnerService } from '../services/rule-runner.service';
import { RULE_TYPE, RUN_TRIGGER } from '../constants';

vi.mock('@astralibx/core', async () => {
  const actual = await vi.importActual('@astralibx/core');
  return {
    ...actual,
    RedisLock: vi.fn().mockImplementation(() => ({
      acquire: vi.fn().mockResolvedValue(true),
      release: vi.fn().mockResolvedValue(undefined),
    })),
  };
});

vi.mock('../services/template-render.service', () => ({
  TemplateRenderService: vi.fn().mockImplementation(() => ({
    compileBatchVariants: vi.fn().mockReturnValue({
      subjectFns: [vi.fn().mockReturnValue('Rendered Subject')],
      bodyFns: [vi.fn().mockReturnValue('<p>Rendered Body</p>')],
      textBodyFn: vi.fn().mockReturnValue('Rendered Text'),
    }),
  })),
}));


function createChainableMock(resolvedValue: any[] = []) {
  const mock: any = {
    lean: vi.fn().mockResolvedValue(resolvedValue),
    sort: vi.fn().mockReturnThis(),
    limit: vi.fn().mockReturnThis(),
  };
  return mock;
}

function createMockModels() {
  return {
    Rule: {
      findActive: vi.fn().mockResolvedValue([]),
      findByIdAndUpdate: vi.fn().mockResolvedValue(null),
    },
    Template: {
      findById: vi.fn().mockResolvedValue(null),
      find: vi.fn().mockImplementation(() => ({ lean: vi.fn().mockResolvedValue([]) })),
    },
    SendLog: {
      find: vi.fn().mockImplementation(() => createChainableMock([])),
      logSend: vi.fn().mockResolvedValue(undefined),
    },
    RunLog: {
      create: vi.fn().mockResolvedValue(undefined),
    },
    ErrorLog: {
      create: vi.fn().mockResolvedValue(undefined),
    },
    ThrottleConfig: {
      getConfig: vi.fn().mockResolvedValue({
        maxPerUserPerDay: 3,
        maxPerUserPerWeek: 10,
        minGapDays: 1,
      }),
    },
  };
}

function createMockRedis() {
  return {
    hset: vi.fn().mockResolvedValue(1),
    hget: vi.fn().mockResolvedValue(null),
    hgetall: vi.fn().mockResolvedValue({}),
    expire: vi.fn().mockResolvedValue(1),
    exists: vi.fn().mockResolvedValue(0),
    set: vi.fn().mockResolvedValue('OK'),
  };
}

function createMockConfig(adapterOverrides: Record<string, any> = {}, extraOverrides: Record<string, any> = {}) {
  return {
    db: { connection: {} as any, collectionPrefix: '' },
    redis: { connection: createMockRedis() as any, keyPrefix: 'test:' },
    adapters: {
      queryUsers: vi.fn().mockResolvedValue([]),
      resolveData: vi.fn().mockImplementation((user: any) => user),
      send: vi.fn().mockResolvedValue(undefined),
      selectAgent: vi.fn().mockResolvedValue({ accountId: 'acc-1', contactValue: 'agent@example.com', metadata: { team: 'support' } }),
      findIdentifier: vi.fn().mockResolvedValue({ id: 'ident-1', contactId: 'contact-1' }),
      ...adapterOverrides,
    },
    logger: { info: vi.fn(), warn: vi.fn(), error: vi.fn() },
    options: { lockTTLMs: 30000 },
    ...extraOverrides,
  };
}

function createService(models = createMockModels(), config = createMockConfig()) {
  return {
    service: new RuleRunnerService(
      models.Rule as any,
      models.Template as any,
      models.SendLog as any,
      models.RunLog as any,
      models.ErrorLog as any,
      models.ThrottleConfig as any,
      config as any
    ),
    models,
    config,
  };
}

function makeRule(overrides: Record<string, any> = {}) {
  return {
    _id: 'rule-1',
    name: 'Test Rule',
    templateId: 'template-1',
    isActive: true,
    sendOnce: false,
    autoApprove: true,
    bypassThrottle: false,
    ruleType: RULE_TYPE.Automated,
    target: { mode: 'query', role: 'customer', platform: 'w1', conditions: [] },
    ...overrides,
  };
}

function makeUser(overrides: Record<string, any> = {}) {
  return {
    _id: 'user-1',
    contactValue: 'alice@example.com',
    name: 'Alice',
    ...overrides,
  };
}

describe('RuleRunnerService', () => {
  beforeEach(async () => {
    vi.clearAllMocks();
    // Re-establish mock implementations for RedisLock after clearAllMocks wipes them
    const { RedisLock } = await import('@astralibx/core');
    (RedisLock as any).mockImplementation(() => ({
      acquire: vi.fn().mockResolvedValue(true),
      release: vi.fn().mockResolvedValue(undefined),
    }));
    // Re-establish TemplateRenderService mock
    const { TemplateRenderService } = await import('../services/template-render.service');
    (TemplateRenderService as any).mockImplementation(() => ({
      compileBatchVariants: vi.fn().mockReturnValue({
        subjectFns: [vi.fn().mockReturnValue('Rendered Subject')],
        bodyFns: [vi.fn().mockReturnValue('<p>Rendered Body</p>')],
        textBodyFn: vi.fn().mockReturnValue('Rendered Text'),
      }),
    }));
  });

  describe('runAllRules', () => {
    it('skips when lock cannot be acquired', async () => {
      const { RedisLock } = await import('@astralibx/core');
      (RedisLock as any).mockImplementation(() => ({
        acquire: vi.fn().mockResolvedValue(false),
        release: vi.fn().mockResolvedValue(undefined),
      }));

      const { service, models, config } = createService();
      await service.runAllRules();

      expect(models.Rule.findActive).not.toHaveBeenCalled();
      expect(config.logger.warn).toHaveBeenCalledWith(expect.stringContaining('already executing'));

      (RedisLock as any).mockImplementation(() => ({
        acquire: vi.fn().mockResolvedValue(true),
        release: vi.fn().mockResolvedValue(undefined),
      }));
    });

    it('creates empty run log when no active rules', async () => {
      const { service, models } = createService();
      models.Rule.findActive.mockResolvedValue([]);

      await service.runAllRules();

      expect(models.RunLog.create).toHaveBeenCalledWith(
        expect.objectContaining({
          rulesProcessed: 0,
          totalStats: { matched: 0, sent: 0, skipped: 0, throttled: 0, failed: 0 },
        })
      );
    });

    it('processes active rules and creates run log with stats', async () => {
      const models = createMockModels();
      const config = createMockConfig({
        queryUsers: vi.fn().mockResolvedValue([makeUser()]),
      });

      const templateDoc = {
        _id: 'template-1',
        subjects: ['Hi {{name}}'],
        bodies: ['<p>Hello</p>'],
      };
      models.Rule.findActive.mockResolvedValue([makeRule()]);
      models.Template.findById.mockResolvedValue(templateDoc);
      models.Template.find.mockImplementation(() => ({ lean: vi.fn().mockResolvedValue([templateDoc]) }));
      models.SendLog.find.mockImplementation(() => createChainableMock([]));

      const { service } = createService(models, config);
      await service.runAllRules();

      expect(models.RunLog.create).toHaveBeenCalledWith(
        expect.objectContaining({
          rulesProcessed: 1,
          perRuleStats: expect.arrayContaining([
            expect.objectContaining({ ruleId: 'rule-1', ruleName: 'Test Rule' }),
          ]),
        })
      );
    });

    it('releases lock even when error occurs (finally block)', async () => {
      const { RedisLock } = await import('@astralibx/core');
      const mockRelease = vi.fn().mockResolvedValue(undefined);
      (RedisLock as any).mockImplementation(() => ({
        acquire: vi.fn().mockResolvedValue(true),
        release: mockRelease,
      }));

      const models = createMockModels();
      models.ThrottleConfig.getConfig.mockRejectedValue(new Error('DB down'));

      const config = createMockConfig();
      const service = new RuleRunnerService(
        models.Rule as any,
        models.Template as any,
        models.SendLog as any,
        models.RunLog as any,
        models.ErrorLog as any,
        models.ThrottleConfig as any,
        config as any
      );

      await expect(service.runAllRules()).rejects.toThrow('DB down');
      expect(mockRelease).toHaveBeenCalled();
    });
  });

  describe('executeRule', () => {
    it('returns error stats when template not found', async () => {
      const models = createMockModels();
      models.Template.findById.mockResolvedValue(null);
      const { service } = createService(models);

      const stats = await service.executeRule(makeRule(), new Map(), {});
      expect(stats).toEqual({ matched: 0, sent: 0, skipped: 0, throttled: 0, failed: 1 });
    });

    it('returns error stats when queryUsers fails', async () => {
      const models = createMockModels();
      models.Template.findById.mockResolvedValue({ subjects: ['Hi'], bodies: ['<p>Hi</p>'] });
      const config = createMockConfig({
        queryUsers: vi.fn().mockRejectedValue(new Error('query failed')),
      });
      const { service } = createService(models, config);

      const stats = await service.executeRule(makeRule(), new Map(), {});
      expect(stats.failed).toBe(1);
    });

    it('returns {matched:0} when no users match', async () => {
      const models = createMockModels();
      models.Template.findById.mockResolvedValue({ subjects: ['Hi'], bodies: ['<p>Hi</p>'] });
      const config = createMockConfig({
        queryUsers: vi.fn().mockResolvedValue([]),
      });
      const { service } = createService(models, config);

      const stats = await service.executeRule(makeRule(), new Map(), {});
      expect(stats.matched).toBe(0);
      expect(stats.sent).toBe(0);
    });

    it('skips users without contactValue or userId', async () => {
      const models = createMockModels();
      models.Template.findById.mockResolvedValue({ subjects: ['Hi'], bodies: ['<p>Hi</p>'] });
      models.SendLog.find.mockImplementation(() => createChainableMock([]));
      const config = createMockConfig({
        queryUsers: vi.fn().mockResolvedValue([
          { _id: null, contactValue: 'a@b.com' },
          { _id: 'u1', contactValue: '' },
          { _id: undefined, contactValue: undefined },
        ]),
      });
      const { service } = createService(models, config);

      const stats = await service.executeRule(makeRule(), new Map(), {});
      expect(stats.matched).toBe(3);
      expect(stats.skipped).toBe(3);
      expect(stats.sent).toBe(0);
    });

    it('skips users already sent (sendOnce=true)', async () => {
      const models = createMockModels();
      models.Template.findById.mockResolvedValue({ subjects: ['Hi'], bodies: ['<p>Hi</p>'] });
      models.SendLog.find.mockImplementation(() => createChainableMock([
        { userId: 'user-1', ruleId: 'rule-1', sentAt: new Date() },
      ]));
      const config = createMockConfig({
        queryUsers: vi.fn().mockResolvedValue([makeUser()]),
      });
      const { service } = createService(models, config);

      const rule = makeRule({ sendOnce: true });
      const stats = await service.executeRule(rule, new Map(), {});
      expect(stats.skipped).toBe(1);
      expect(stats.sent).toBe(0);
    });

    it('allows resend when resendAfterDays has elapsed', async () => {
      const models = createMockModels();
      models.Template.findById.mockResolvedValue({ subjects: ['Hi'], bodies: ['<p>Hi</p>'] });

      const oldDate = new Date(Date.now() - 10 * 86400000);
      models.SendLog.find.mockImplementation(() => createChainableMock([
        { userId: 'user-1', ruleId: 'rule-1', sentAt: oldDate },
      ]));
      const config = createMockConfig({
        queryUsers: vi.fn().mockResolvedValue([makeUser()]),
      });
      const { service } = createService(models, config);

      const rule = makeRule({ sendOnce: true, resendAfterDays: 5 });
      const throttleConfig = { maxPerUserPerDay: 10, maxPerUserPerWeek: 50, minGapDays: 0 };
      const stats = await service.executeRule(rule, new Map(), throttleConfig);
      expect(stats.sent).toBe(1);
    });

    it('skips users without identifier', async () => {
      const models = createMockModels();
      models.Template.findById.mockResolvedValue({ subjects: ['Hi'], bodies: ['<p>Hi</p>'] });
      models.SendLog.find.mockImplementation(() => createChainableMock([]));
      const config = createMockConfig({
        queryUsers: vi.fn().mockResolvedValue([makeUser()]),
        findIdentifier: vi.fn().mockResolvedValue(null),
      });
      const { service } = createService(models, config);

      const stats = await service.executeRule(makeRule(), new Map(), {});
      expect(stats.skipped).toBe(1);
      expect(stats.sent).toBe(0);
    });

    it('skips users when selectAgent returns null', async () => {
      const models = createMockModels();
      models.Template.findById.mockResolvedValue({ subjects: ['Hi'], bodies: ['<p>Hi</p>'] });
      models.SendLog.find.mockImplementation(() => createChainableMock([]));
      const config = createMockConfig({
        queryUsers: vi.fn().mockResolvedValue([makeUser()]),
        selectAgent: vi.fn().mockResolvedValue(null),
      });
      const { service } = createService(models, config);

      const throttleConfig = { maxPerUserPerDay: 10, maxPerUserPerWeek: 50, minGapDays: 0 };
      const stats = await service.executeRule(makeRule(), new Map(), throttleConfig);
      expect(stats.skipped).toBe(1);
      expect(stats.sent).toBe(0);
    });

    it('calls send adapter with correct params for successful send', async () => {
      const models = createMockModels();
      models.Template.findById.mockResolvedValue({ subjects: ['Hi'], bodies: ['<p>Hi</p>'] });
      models.SendLog.find.mockImplementation(() => createChainableMock([]));
      const config = createMockConfig({
        queryUsers: vi.fn().mockResolvedValue([makeUser()]),
      });
      const { service } = createService(models, config);

      const throttleConfig = { maxPerUserPerDay: 10, maxPerUserPerWeek: 50, minGapDays: 0 };
      await service.executeRule(makeRule(), new Map(), throttleConfig);

      expect(config.adapters.send).toHaveBeenCalledWith(
        expect.objectContaining({
          identifierId: 'ident-1',
          contactId: 'contact-1',
          accountId: 'acc-1',
          subject: 'Rendered Subject',
          body: '<p>Rendered Body</p>',
          ruleId: 'rule-1',
          autoApprove: true,
        })
      );
    });

    it('logs send after successful send', async () => {
      const models = createMockModels();
      models.Template.findById.mockResolvedValue({ subjects: ['Hi'], bodies: ['<p>Hi</p>'] });
      models.SendLog.find.mockImplementation(() => createChainableMock([]));
      const config = createMockConfig({
        queryUsers: vi.fn().mockResolvedValue([makeUser()]),
      });
      const { service } = createService(models, config);

      const throttleConfig = { maxPerUserPerDay: 10, maxPerUserPerWeek: 50, minGapDays: 0 };
      await service.executeRule(makeRule(), new Map(), throttleConfig);

      expect(models.SendLog.logSend).toHaveBeenCalledWith(
        'rule-1', 'user-1', 'ident-1',
        undefined,
        expect.objectContaining({ status: 'sent' })
      );
    });

    it('increments throttle map after send', async () => {
      const models = createMockModels();
      models.Template.findById.mockResolvedValue({ subjects: ['Hi'], bodies: ['<p>Hi</p>'] });
      models.SendLog.find.mockImplementation(() => createChainableMock([]));
      const config = createMockConfig({
        queryUsers: vi.fn().mockResolvedValue([makeUser()]),
      });
      const { service } = createService(models, config);

      const throttleMap = new Map();
      const throttleConfig = { maxPerUserPerDay: 10, maxPerUserPerWeek: 50, minGapDays: 0 };
      await service.executeRule(makeRule(), throttleMap, throttleConfig);

      const userThrottle = throttleMap.get('user-1');
      expect(userThrottle).toBeDefined();
      expect(userThrottle.today).toBe(1);
      expect(userThrottle.thisWeek).toBe(1);
      expect(userThrottle.lastSentDate).toBeInstanceOf(Date);
    });

    it('updates rule stats after execution', async () => {
      const models = createMockModels();
      models.Template.findById.mockResolvedValue({ subjects: ['Hi'], bodies: ['<p>Hi</p>'] });
      models.SendLog.find.mockImplementation(() => createChainableMock([]));
      const config = createMockConfig({
        queryUsers: vi.fn().mockResolvedValue([makeUser()]),
      });
      const { service } = createService(models, config);

      const throttleConfig = { maxPerUserPerDay: 10, maxPerUserPerWeek: 50, minGapDays: 0 };
      await service.executeRule(makeRule(), new Map(), throttleConfig);

      expect(models.Rule.findByIdAndUpdate).toHaveBeenCalledWith(
        'rule-1',
        expect.objectContaining({
          $set: expect.objectContaining({ lastRunStats: expect.any(Object) }),
          $inc: expect.objectContaining({ totalSent: 1 }),
        })
      );
    });

    it('logs to ErrorLog when send adapter throws', async () => {
      const models = createMockModels();
      models.Template.findById.mockResolvedValue({ subjects: ['Hi'], bodies: ['<p>Hi</p>'] });
      models.SendLog.find.mockImplementation(() => createChainableMock([]));
      const config = createMockConfig({
        queryUsers: vi.fn().mockResolvedValue([makeUser()]),
        send: vi.fn().mockRejectedValue(new Error('send failed')),
      });
      const { service } = createService(models, config);

      const throttleConfig = { maxPerUserPerDay: 10, maxPerUserPerWeek: 50, minGapDays: 0 };
      const stats = await service.executeRule(makeRule(), new Map(), throttleConfig);

      expect(stats.failed).toBe(1);
      expect(stats.sent).toBe(0);
      expect(models.ErrorLog.create).toHaveBeenCalledWith(
        expect.objectContaining({
          ruleId: 'rule-1',
          ruleName: 'Test Rule',
          error: 'send failed',
        })
      );
    });
  });

  describe('template collection context (executeQueryMode)', () => {
    it('passes activeJoins to queryUsers when template has collectionName and joins', async () => {
      const models = createMockModels();
      const templateDoc = {
        _id: 'template-1',
        subjects: ['Hi'],
        bodies: ['<p>Hi</p>'],
        collectionName: 'users',
        joins: ['orders'],
      };
      models.Template.findById.mockResolvedValue(templateDoc);
      models.Template.find.mockImplementation(() => ({ lean: vi.fn().mockResolvedValue([templateDoc]) }));
      models.SendLog.find.mockImplementation(() => createChainableMock([]));

      const ordersJoin = { as: 'orders', from: 'orders', localField: '_id', foreignField: 'userId' };
      const collectionSchema = {
        name: 'users',
        fields: [],
        joins: [ordersJoin],
      };

      const config = createMockConfig(
        { queryUsers: vi.fn().mockResolvedValue([makeUser()]) },
        { collections: [collectionSchema] }
      );
      const { service } = createService(models, config);

      const throttleConfig = { maxPerUserPerDay: 10, maxPerUserPerWeek: 50, minGapDays: 0 };
      await service.executeRule(makeRule(), new Map(), throttleConfig);

      expect(config.adapters.queryUsers).toHaveBeenCalledWith(
        expect.anything(),
        expect.any(Number),
        expect.objectContaining({
          collectionSchema: expect.objectContaining({ name: 'users' }),
          activeJoins: expect.arrayContaining([
            expect.objectContaining({ as: 'orders' }),
          ]),
        })
      );
    });

    it('passes no collection context when template has no collectionName', async () => {
      const models = createMockModels();
      const templateDoc = {
        _id: 'template-1',
        subjects: ['Hi'],
        bodies: ['<p>Hi</p>'],
      };
      models.Template.findById.mockResolvedValue(templateDoc);
      models.Template.find.mockImplementation(() => ({ lean: vi.fn().mockResolvedValue([templateDoc]) }));
      models.SendLog.find.mockImplementation(() => createChainableMock([]));

      const config = createMockConfig({
        queryUsers: vi.fn().mockResolvedValue([makeUser()]),
      });
      const { service } = createService(models, config);

      const throttleConfig = { maxPerUserPerDay: 10, maxPerUserPerWeek: 50, minGapDays: 0 };
      await service.executeRule(makeRule(), new Map(), throttleConfig);

      expect(config.adapters.queryUsers).toHaveBeenCalledWith(
        expect.anything(),
        expect.any(Number),
        undefined
      );
    });

    it('passes no collection context when template collectionName not found in config', async () => {
      const models = createMockModels();
      const templateDoc = {
        _id: 'template-1',
        subjects: ['Hi'],
        bodies: ['<p>Hi</p>'],
        collectionName: 'nonexistent',
      };
      models.Template.findById.mockResolvedValue(templateDoc);
      models.Template.find.mockImplementation(() => ({ lean: vi.fn().mockResolvedValue([templateDoc]) }));
      models.SendLog.find.mockImplementation(() => createChainableMock([]));

      const config = createMockConfig(
        { queryUsers: vi.fn().mockResolvedValue([makeUser()]) },
        { collections: [{ name: 'other', fields: [], joins: [] }] }
      );
      const { service } = createService(models, config);

      const throttleConfig = { maxPerUserPerDay: 10, maxPerUserPerWeek: 50, minGapDays: 0 };
      await service.executeRule(makeRule(), new Map(), throttleConfig);

      expect(config.adapters.queryUsers).toHaveBeenCalledWith(
        expect.anything(),
        expect.any(Number),
        undefined
      );
    });

    it('only includes joins whose alias is listed in template.joins', async () => {
      const models = createMockModels();
      const templateDoc = {
        _id: 'template-1',
        subjects: ['Hi'],
        bodies: ['<p>Hi</p>'],
        collectionName: 'users',
        joins: ['orders'], // only orders, not profile
      };
      models.Template.findById.mockResolvedValue(templateDoc);
      models.Template.find.mockImplementation(() => ({ lean: vi.fn().mockResolvedValue([templateDoc]) }));
      models.SendLog.find.mockImplementation(() => createChainableMock([]));

      const ordersJoin = { as: 'orders', from: 'orders', localField: '_id', foreignField: 'userId' };
      const profileJoin = { as: 'profile', from: 'profiles', localField: '_id', foreignField: 'userId' };
      const collectionSchema = {
        name: 'users',
        fields: [],
        joins: [ordersJoin, profileJoin],
      };

      const config = createMockConfig(
        { queryUsers: vi.fn().mockResolvedValue([makeUser()]) },
        { collections: [collectionSchema] }
      );
      const { service } = createService(models, config);

      const throttleConfig = { maxPerUserPerDay: 10, maxPerUserPerWeek: 50, minGapDays: 0 };
      await service.executeRule(makeRule(), new Map(), throttleConfig);

      const callArgs = config.adapters.queryUsers.mock.calls[0];
      const context = callArgs[2];
      expect(context.activeJoins).toHaveLength(1);
      expect(context.activeJoins[0].as).toBe('orders');
    });
  });

  describe('buildThrottleMap', () => {
    it('builds correct today/thisWeek/lastSentDate from recent sends', () => {
      const { service } = createService();
      const todayEarlier = new Date();
      todayEarlier.setHours(todayEarlier.getHours() - 1);
      const yesterday = new Date(Date.now() - 86400000);
      const now = new Date();

      const recentSends = [
        { userId: 'u1', sentAt: todayEarlier },
        { userId: 'u1', sentAt: yesterday },
        { userId: 'u2', sentAt: now },
      ];

      const map = service.buildThrottleMap(recentSends);

      const u1 = map.get('u1')!;
      expect(u1.thisWeek).toBe(2);
      expect(u1.today).toBe(1);
      expect(u1.lastSentDate!.getTime()).toBe(todayEarlier.getTime());

      const u2 = map.get('u2')!;
      expect(u2.thisWeek).toBe(1);
      expect(u2.today).toBe(1);
      expect(u2.lastSentDate).toEqual(now);
    });
  });

  describe('list-mode targeting', () => {
    function makeListRule(overrides: Record<string, any> = {}) {
      return makeRule({
        target: { mode: 'list', identifiers: ['alice@example.com', 'bob@example.com'] },
        ...overrides,
      });
    }

    it('does not call queryUsers when target.mode is list', async () => {
      const models = createMockModels();
      models.Template.findById.mockResolvedValue({ subjects: ['Hi'], bodies: ['<p>Hi</p>'] });
      models.SendLog.find.mockImplementation(() => createChainableMock([]));
      const config = createMockConfig({
        findIdentifier: vi.fn().mockResolvedValue({ id: 'ident-1', contactId: 'contact-1' }),
      });
      const { service } = createService(models, config);

      const throttleConfig = { maxPerUserPerDay: 10, maxPerUserPerWeek: 50, minGapDays: 0 };
      await service.executeRule(makeListRule(), new Map(), throttleConfig);

      expect(config.adapters.queryUsers).not.toHaveBeenCalled();
    });

    it('calls findIdentifier for each contact value in the list', async () => {
      const models = createMockModels();
      models.Template.findById.mockResolvedValue({ subjects: ['Hi'], bodies: ['<p>Hi</p>'] });
      models.SendLog.find.mockImplementation(() => createChainableMock([]));
      const config = createMockConfig({
        findIdentifier: vi.fn()
          .mockResolvedValueOnce({ id: 'ident-a', contactId: 'contact-a' })
          .mockResolvedValueOnce({ id: 'ident-b', contactId: 'contact-b' }),
      });
      const { service } = createService(models, config);

      const throttleConfig = { maxPerUserPerDay: 10, maxPerUserPerWeek: 50, minGapDays: 0 };
      await service.executeRule(makeListRule(), new Map(), throttleConfig);

      expect(config.adapters.findIdentifier).toHaveBeenCalledWith('alice@example.com');
      expect(config.adapters.findIdentifier).toHaveBeenCalledWith('bob@example.com');
    });

    it('deduplicates when sendOnce is true and same identifier appears twice', async () => {
      const models = createMockModels();
      models.Template.findById.mockResolvedValue({ subjects: ['Hi'], bodies: ['<p>Hi</p>'] });
      const sameId = 'ident-same';
      models.SendLog.find.mockImplementation(() => createChainableMock([
        { userId: sameId, ruleId: 'rule-1', sentAt: new Date() },
      ]));
      const config = createMockConfig({
        findIdentifier: vi.fn().mockResolvedValue({ id: sameId, contactId: 'contact-1' }),
      });
      const { service } = createService(models, config);

      const rule = makeListRule({ sendOnce: true });
      const throttleConfig = { maxPerUserPerDay: 10, maxPerUserPerWeek: 50, minGapDays: 0 };
      const stats = await service.executeRule(rule, new Map(), throttleConfig);

      expect(stats.sent).toBe(0);
      expect(stats.skipped).toBeGreaterThanOrEqual(1);
    });

    it('limits identifiers processed by maxPerRun', async () => {
      const models = createMockModels();
      models.Template.findById.mockResolvedValue({ subjects: ['Hi'], bodies: ['<p>Hi</p>'] });
      models.SendLog.find.mockImplementation(() => createChainableMock([]));
      const config = createMockConfig({
        findIdentifier: vi.fn().mockResolvedValue({ id: 'ident-1', contactId: 'contact-1' }),
      });
      const { service } = createService(models, config);

      const rule = makeListRule({
        target: {
          mode: 'list',
          identifiers: ['a@test.com', 'b@test.com', 'c@test.com', 'd@test.com', 'e@test.com'],
        },
        maxPerRun: 2,
      });
      const throttleConfig = { maxPerUserPerDay: 10, maxPerUserPerWeek: 50, minGapDays: 0 };
      const stats = await service.executeRule(rule, new Map(), throttleConfig);

      expect(stats.matched).toBe(2);
    });

    it('skips invalid identifiers when findIdentifier returns null', async () => {
      const models = createMockModels();
      models.Template.findById.mockResolvedValue({ subjects: ['Hi'], bodies: ['<p>Hi</p>'] });
      models.SendLog.find.mockImplementation(() => createChainableMock([]));
      const config = createMockConfig({
        findIdentifier: vi.fn()
          .mockResolvedValueOnce(null)
          .mockResolvedValueOnce({ id: 'ident-b', contactId: 'contact-b' }),
      });
      const { service } = createService(models, config);

      const throttleConfig = { maxPerUserPerDay: 10, maxPerUserPerWeek: 50, minGapDays: 0 };
      const stats = await service.executeRule(makeListRule(), new Map(), throttleConfig);

      expect(stats.skipped).toBeGreaterThanOrEqual(1);
      expect(stats.sent).toBeLessThanOrEqual(1);
    });
  });

  describe('run ID, status, and cancel', () => {
    it('runAllRules returns { runId: string }', async () => {
      const { service } = createService();

      const result = await service.runAllRules();
      expect(result).toHaveProperty('runId');
      expect(typeof result.runId).toBe('string');
      expect(result.runId.length).toBeGreaterThan(0);
    });

    it('trigger returns { runId } immediately (non-blocking)', () => {
      const { service } = createService();

      const result = service.trigger();
      expect(result).toHaveProperty('runId');
      expect(typeof result.runId).toBe('string');
      expect(result).toHaveProperty('started', true);
    });

    it('getStatus reads from Redis and returns progress', async () => {
      const models = createMockModels();
      const config = createMockConfig();
      (config.redis.connection as any).hgetall.mockResolvedValue({
        runId: 'test-run-id',
        status: 'running',
        currentRule: 'Test Rule',
        progress: JSON.stringify({ rulesTotal: 5, rulesCompleted: 2, sent: 10, failed: 1, skipped: 3, invalid: 0 }),
        startedAt: '2025-01-01T00:00:00.000Z',
        elapsed: '5000',
      });
      const { service } = createService(models, config);

      const status = await service.getStatus('test-run-id');
      expect(status).not.toBeNull();
      expect(status!.runId).toBe('test-run-id');
      expect(status!.status).toBe('running');
      expect(status!.currentRule).toBe('Test Rule');
      expect(status!.progress.rulesTotal).toBe(5);
      expect(status!.progress.sent).toBe(10);
      expect(status!.elapsed).toBe(5000);
    });

    it('getStatus returns null when no data in Redis', async () => {
      const models = createMockModels();
      const config = createMockConfig();
      (config.redis.connection as any).hgetall.mockResolvedValue({});
      const { service } = createService(models, config);

      const status = await service.getStatus('nonexistent');
      expect(status).toBeNull();
    });

    it('cancel sets a Redis key', async () => {
      const models = createMockModels();
      const config = createMockConfig();
      (config.redis.connection as any).exists.mockResolvedValue(1);
      const { service } = createService(models, config);

      const result = await service.cancel('test-run-id');
      expect(result).toEqual({ ok: true });
      expect((config.redis.connection as any).set).toHaveBeenCalledWith(
        'test:run:test-run-id:cancel', '1', 'EX', 3600
      );
    });

    it('cancel returns { ok: false } when run does not exist', async () => {
      const models = createMockModels();
      const config = createMockConfig();
      (config.redis.connection as any).exists.mockResolvedValue(0);
      const { service } = createService(models, config);

      const result = await service.cancel('nonexistent');
      expect(result).toEqual({ ok: false });
    });

    it('cancel flag stops processing mid-run', async () => {
      const models = createMockModels();
      const config = createMockConfig({
        queryUsers: vi.fn().mockResolvedValue([
          makeUser({ _id: 'u1', contactValue: 'u1@test.com' }),
          makeUser({ _id: 'u2', contactValue: 'u2@test.com' }),
        ]),
      });

      const rule1 = makeRule({ _id: 'rule-1', name: 'Rule 1' });
      const rule2 = makeRule({ _id: 'rule-2', name: 'Rule 2' });
      models.Rule.findActive.mockResolvedValue([rule1, rule2]);
      models.Template.findById.mockResolvedValue({ subjects: ['Hi'], bodies: ['<p>Hi</p>'] });
      models.Template.find.mockImplementation(() => ({
        lean: vi.fn().mockResolvedValue([{ _id: 'template-1', subjects: ['Hi'], bodies: ['<p>Hi</p>'] }]),
      }));
      models.SendLog.find.mockImplementation(() => createChainableMock([]));

      let callCount = 0;
      (config.redis.connection as any).exists.mockImplementation(() => {
        callCount++;
        return callCount > 1 ? 1 : 0;
      });

      const { service } = createService(models, config);
      const result = await service.runAllRules();

      expect(result).toHaveProperty('runId');
    });
  });

  describe('throttle enforcement', () => {
    function setupForThrottle(
      ruleOverrides: Record<string, any> = {},
      throttleMapEntries: [string, any][] = [],
      throttleConfig: any = { maxPerUserPerDay: 3, maxPerUserPerWeek: 10, minGapDays: 1 }
    ) {
      const models = createMockModels();
      models.Template.findById.mockResolvedValue({ subjects: ['Hi'], bodies: ['<p>Hi</p>'] });
      models.SendLog.find.mockImplementation(() => createChainableMock([]));
      const config = createMockConfig({
        queryUsers: vi.fn().mockResolvedValue([makeUser()]),
      });
      const { service } = createService(models, config);

      const throttleMap = new Map(throttleMapEntries);
      const rule = makeRule(ruleOverrides);

      return { service, rule, throttleMap, throttleConfig, config };
    }

    it('bypasses for transactional rule type', async () => {
      const { service, rule, throttleMap } = setupForThrottle(
        { ruleType: RULE_TYPE.Transactional },
        [['user-1', { today: 100, thisWeek: 200, lastSentDate: new Date() }]],
        { maxPerUserPerDay: 1, maxPerUserPerWeek: 1, minGapDays: 100 }
      );

      const stats = await service.executeRule(rule, throttleMap, { maxPerUserPerDay: 1, maxPerUserPerWeek: 1, minGapDays: 100 });
      expect(stats.sent).toBe(1);
      expect(stats.throttled).toBe(0);
    });

    it('bypasses when bypassThrottle is true', async () => {
      const { service, rule, throttleMap } = setupForThrottle(
        { bypassThrottle: true },
        [['user-1', { today: 100, thisWeek: 200, lastSentDate: new Date() }]]
      );

      const stats = await service.executeRule(rule, throttleMap, { maxPerUserPerDay: 1, maxPerUserPerWeek: 1, minGapDays: 100 });
      expect(stats.sent).toBe(1);
      expect(stats.throttled).toBe(0);
    });

    it('blocks and increments throttled when daily limit reached', async () => {
      const { service, rule, throttleMap } = setupForThrottle(
        {},
        [['user-1', { today: 3, thisWeek: 3, lastSentDate: new Date(Date.now() - 2 * 86400000) }]]
      );

      const stats = await service.executeRule(rule, throttleMap, { maxPerUserPerDay: 3, maxPerUserPerWeek: 50, minGapDays: 0 });
      expect(stats.throttled).toBe(1);
      expect(stats.sent).toBe(0);
    });

    it('blocks and increments throttled when weekly limit reached', async () => {
      const { service, rule, throttleMap } = setupForThrottle(
        {},
        [['user-1', { today: 0, thisWeek: 10, lastSentDate: new Date(Date.now() - 2 * 86400000) }]]
      );

      const stats = await service.executeRule(rule, throttleMap, { maxPerUserPerDay: 50, maxPerUserPerWeek: 10, minGapDays: 0 });
      expect(stats.throttled).toBe(1);
      expect(stats.sent).toBe(0);
    });

    it('blocks and increments throttled when min gap days not met', async () => {
      const recentDate = new Date(Date.now() - 0.5 * 86400000);
      const { service, rule, throttleMap } = setupForThrottle(
        {},
        [['user-1', { today: 0, thisWeek: 0, lastSentDate: recentDate }]]
      );

      const stats = await service.executeRule(rule, throttleMap, { maxPerUserPerDay: 50, maxPerUserPerWeek: 50, minGapDays: 2 });
      expect(stats.throttled).toBe(1);
      expect(stats.sent).toBe(0);
    });
  });

  describe('send window enforcement', () => {
    it('skips run when outside send window', async () => {
      const models = createMockModels();
      models.ThrottleConfig.getConfig.mockResolvedValue({
        maxPerUserPerDay: 3,
        maxPerUserPerWeek: 10,
        minGapDays: 1,
        sendWindow: { startHour: 9, endHour: 17, timezone: 'UTC' },
      });

      const config = createMockConfig();
      // Mock Date to return a time outside the window (e.g., hour 20)
      const originalDateTimeFormat = Intl.DateTimeFormat;
      const mockFormat = vi.fn().mockReturnValue('20');
      vi.spyOn(Intl, 'DateTimeFormat').mockImplementation((_locale?: any, opts?: any) => {
        if (opts?.hour) {
          return { format: mockFormat } as any;
        }
        return new originalDateTimeFormat(_locale, opts);
      });

      const { service } = createService(models, config);
      const result = await service.runAllRules();

      expect(result).toHaveProperty('runId');
      expect(models.Rule.findActive).not.toHaveBeenCalled();

      vi.restoreAllMocks();
    });
  });

  describe('rule validity dates (validFrom / validTill)', () => {
    it('skips rule with validFrom in the future', async () => {
      const models = createMockModels();
      const futureDate = new Date(Date.now() + 7 * 86400000);
      models.Rule.findActive.mockResolvedValue([makeRule({ validFrom: futureDate.toISOString() })]);
      models.Template.find.mockImplementation(() => ({ lean: vi.fn().mockResolvedValue([]) }));

      const config = createMockConfig();
      const { service } = createService(models, config);
      await service.runAllRules();

      expect(models.RunLog.create).toHaveBeenCalledWith(
        expect.objectContaining({
          rulesProcessed: 0,
          totalStats: { matched: 0, sent: 0, skipped: 0, throttled: 0, failed: 0 },
        })
      );
    });

    it('skips rule with validTill in the past', async () => {
      const models = createMockModels();
      const pastDate = new Date(Date.now() - 7 * 86400000);
      models.Rule.findActive.mockResolvedValue([makeRule({ validTill: pastDate.toISOString() })]);
      models.Template.find.mockImplementation(() => ({ lean: vi.fn().mockResolvedValue([]) }));

      const config = createMockConfig();
      const { service } = createService(models, config);
      await service.runAllRules();

      expect(models.RunLog.create).toHaveBeenCalledWith(
        expect.objectContaining({
          rulesProcessed: 0,
          totalStats: { matched: 0, sent: 0, skipped: 0, throttled: 0, failed: 0 },
        })
      );
    });

    it('processes rule within validity window (validFrom in past, validTill in future)', async () => {
      const models = createMockModels();
      const pastDate = new Date(Date.now() - 7 * 86400000);
      const futureDate = new Date(Date.now() + 7 * 86400000);
      const config = createMockConfig({
        queryUsers: vi.fn().mockResolvedValue([makeUser()]),
      });

      const templateDoc = { _id: 'template-1', subjects: ['Hi'], bodies: ['<p>Hi</p>'] };
      models.Rule.findActive.mockResolvedValue([makeRule({ validFrom: pastDate.toISOString(), validTill: futureDate.toISOString() })]);
      models.Template.findById.mockResolvedValue(templateDoc);
      models.Template.find.mockImplementation(() => ({ lean: vi.fn().mockResolvedValue([templateDoc]) }));
      models.SendLog.find.mockImplementation(() => createChainableMock([]));

      const { service } = createService(models, config);
      await service.runAllRules();

      expect(models.RunLog.create).toHaveBeenCalledWith(
        expect.objectContaining({
          rulesProcessed: 1,
          perRuleStats: expect.arrayContaining([
            expect.objectContaining({ ruleId: 'rule-1' }),
          ]),
        })
      );
    });

    it('processes rule with no validFrom/validTill (always valid)', async () => {
      const models = createMockModels();
      const config = createMockConfig({
        queryUsers: vi.fn().mockResolvedValue([makeUser()]),
      });

      const templateDoc = { _id: 'template-1', subjects: ['Hi'], bodies: ['<p>Hi</p>'] };
      models.Rule.findActive.mockResolvedValue([makeRule()]);
      models.Template.findById.mockResolvedValue(templateDoc);
      models.Template.find.mockImplementation(() => ({ lean: vi.fn().mockResolvedValue([templateDoc]) }));
      models.SendLog.find.mockImplementation(() => createChainableMock([]));

      const { service } = createService(models, config);
      await service.runAllRules();

      expect(models.RunLog.create).toHaveBeenCalledWith(
        expect.objectContaining({ rulesProcessed: 1 })
      );
    });
  });

  describe('stats tracking with unified shape', () => {
    it('stats shape includes matched, sent, skipped, throttled, failed', async () => {
      const models = createMockModels();
      models.Template.findById.mockResolvedValue({ subjects: ['Hi'], bodies: ['<p>Hi</p>'] });
      models.SendLog.find.mockImplementation(() => createChainableMock([]));
      const config = createMockConfig({
        queryUsers: vi.fn().mockResolvedValue([makeUser()]),
      });
      const { service } = createService(models, config);

      const throttleConfig = { maxPerUserPerDay: 10, maxPerUserPerWeek: 50, minGapDays: 0 };
      const stats = await service.executeRule(makeRule(), new Map(), throttleConfig);

      expect(stats).toHaveProperty('matched');
      expect(stats).toHaveProperty('sent');
      expect(stats).toHaveProperty('skipped');
      expect(stats).toHaveProperty('throttled');
      expect(stats).toHaveProperty('failed');
      expect(stats).not.toHaveProperty('skippedByThrottle');
      expect(stats).not.toHaveProperty('errorCount');
    });

    it('run log totalStats uses throttled and failed keys', async () => {
      const models = createMockModels();
      models.Rule.findActive.mockResolvedValue([]);

      const config = createMockConfig();
      const { service } = createService(models, config);
      await service.runAllRules();

      const createCall = models.RunLog.create.mock.calls[0][0];
      expect(createCall.totalStats).toHaveProperty('throttled');
      expect(createCall.totalStats).toHaveProperty('failed');
      expect(createCall.totalStats).not.toHaveProperty('skippedByThrottle');
      expect(createCall.totalStats).not.toHaveProperty('errorCount');
    });
  });

  describe('beforeSend hook', () => {
    it('calls hook with correct params and uses returned values in send adapter', async () => {
      const beforeSend = vi.fn().mockResolvedValue({
        body: '<p>Modified Body</p>',
        textBody: 'Modified Text',
        subject: 'Modified Subject',
      });

      const models = createMockModels();
      models.Template.findById.mockResolvedValue({ subjects: ['Hi'], bodies: ['<p>Hi</p>'] });
      models.SendLog.find.mockImplementation(() => createChainableMock([]));
      const config = createMockConfig(
        { queryUsers: vi.fn().mockResolvedValue([makeUser()]) },
        { hooks: { beforeSend } }
      );
      const { service } = createService(models, config);

      const throttleConfig = { maxPerUserPerDay: 10, maxPerUserPerWeek: 50, minGapDays: 0 };
      await service.executeRule(makeRule(), new Map(), throttleConfig);

      expect(beforeSend).toHaveBeenCalledWith(
        expect.objectContaining({
          body: expect.any(String),
          subject: expect.any(String),
          account: expect.objectContaining({
            id: 'acc-1',
            contactValue: 'agent@example.com',
          }),
          user: expect.objectContaining({
            id: expect.any(String),
            contactValue: 'alice@example.com',
          }),
          context: expect.objectContaining({
            ruleId: expect.any(String),
            templateId: expect.any(String),
            runId: expect.any(String),
          }),
        })
      );

      expect(config.adapters.send).toHaveBeenCalledWith(
        expect.objectContaining({
          subject: 'Modified Subject',
          body: '<p>Modified Body</p>',
          textBody: 'Modified Text',
        })
      );
    });

    it('catches hook errors and increments stats.failed', async () => {
      const beforeSend = vi.fn().mockRejectedValue(new Error('hook boom'));

      const models = createMockModels();
      models.Template.findById.mockResolvedValue({ subjects: ['Hi'], bodies: ['<p>Hi</p>'] });
      models.SendLog.find.mockImplementation(() => createChainableMock([]));
      const config = createMockConfig(
        { queryUsers: vi.fn().mockResolvedValue([makeUser()]) },
        { hooks: { beforeSend } }
      );
      const { service } = createService(models, config);

      const throttleConfig = { maxPerUserPerDay: 10, maxPerUserPerWeek: 50, minGapDays: 0 };
      const stats = await service.executeRule(makeRule(), new Map(), throttleConfig);

      expect(stats.failed).toBe(1);
      expect(stats.sent).toBe(0);
      expect(config.adapters.send).not.toHaveBeenCalled();
      expect(config.logger.error).toHaveBeenCalledWith(expect.stringContaining('beforeSend hook failed'));
    });
  });

  describe('auto-disable list-mode rules when exhausted', () => {
    function makeListRule(overrides: Record<string, any> = {}) {
      return makeRule({
        target: { mode: 'list', identifiers: ['alice@example.com', 'bob@example.com'] },
        sendOnce: true,
        ...overrides,
      });
    }

    it('sets isActive to false when all identifiers have been sent', async () => {
      const models = createMockModels();
      models.Template.findById.mockResolvedValue({ subjects: ['Hi'], bodies: ['<p>Hi</p>'] });
      models.SendLog.find.mockImplementation((query: any) => {
        if (query.userId) {
          return createChainableMock([
            { userId: 'ident-a', ruleId: 'rule-1', sentAt: new Date() },
            { userId: 'ident-b', ruleId: 'rule-1', sentAt: new Date() },
          ]);
        }
        return createChainableMock([
          { userId: 'ident-a', ruleId: 'rule-1', sentAt: new Date(), status: 'sent' },
          { userId: 'ident-b', ruleId: 'rule-1', sentAt: new Date(), status: 'sent' },
        ]);
      });
      const config = createMockConfig({
        findIdentifier: vi.fn()
          .mockResolvedValueOnce({ id: 'ident-a', contactId: 'contact-a' })
          .mockResolvedValueOnce({ id: 'ident-b', contactId: 'contact-b' }),
      });
      const { service } = createService(models, config);

      const throttleConfig = { maxPerUserPerDay: 10, maxPerUserPerWeek: 50, minGapDays: 0 };
      await service.executeRule(makeListRule(), new Map(), throttleConfig);

      expect(models.Rule.findByIdAndUpdate).toHaveBeenCalledWith(
        'rule-1',
        { $set: { isActive: false } }
      );
    });

    it('stays active when some identifiers were throttled', async () => {
      const models = createMockModels();
      models.Template.findById.mockResolvedValue({ subjects: ['Hi'], bodies: ['<p>Hi</p>'] });
      models.SendLog.find.mockImplementation((query: any) => {
        if (query.userId) {
          return createChainableMock([]);
        }
        return createChainableMock([
          { userId: 'ident-a', ruleId: 'rule-1', sentAt: new Date(), status: 'sent' },
          { userId: 'ident-b', ruleId: 'rule-1', sentAt: new Date(), status: 'throttled' },
        ]);
      });
      const config = createMockConfig({
        findIdentifier: vi.fn()
          .mockResolvedValueOnce({ id: 'ident-a', contactId: 'contact-a' })
          .mockResolvedValueOnce({ id: 'ident-b', contactId: 'contact-b' }),
      });
      const { service } = createService(models, config);

      const throttleConfig = { maxPerUserPerDay: 10, maxPerUserPerWeek: 50, minGapDays: 0 };
      await service.executeRule(makeListRule(), new Map(), throttleConfig);

      const allCalls = models.Rule.findByIdAndUpdate.mock.calls;
      const disableCall = allCalls.find((call: any[]) =>
        call[1]?.$set?.isActive === false
      );
      expect(disableCall).toBeUndefined();
    });

    it('does not auto-disable when sendOnce is false', async () => {
      const models = createMockModels();
      models.Template.findById.mockResolvedValue({ subjects: ['Hi'], bodies: ['<p>Hi</p>'] });
      models.SendLog.find.mockImplementation(() => createChainableMock([]));
      const config = createMockConfig({
        findIdentifier: vi.fn().mockResolvedValue({ id: 'ident-1', contactId: 'contact-1' }),
      });
      const { service } = createService(models, config);

      const rule = makeListRule({ sendOnce: false });
      const throttleConfig = { maxPerUserPerDay: 10, maxPerUserPerWeek: 50, minGapDays: 0 };
      await service.executeRule(rule, new Map(), throttleConfig);

      const allCalls = models.Rule.findByIdAndUpdate.mock.calls;
      const disableCall = allCalls.find((call: any[]) =>
        call[1]?.$set?.isActive === false
      );
      expect(disableCall).toBeUndefined();
    });
  });

  describe('validity date boundary tests', () => {
    it('excludes rule with validTill slightly in the past', async () => {
      const models = createMockModels();
      const slightlyPast = new Date(Date.now() - 1);
      models.Rule.findActive.mockResolvedValue([makeRule({ validTill: slightlyPast.toISOString() })]);
      models.Template.find.mockImplementation(() => ({ lean: vi.fn().mockResolvedValue([]) }));

      const config = createMockConfig();
      const { service } = createService(models, config);
      await service.runAllRules();

      expect(models.RunLog.create).toHaveBeenCalledWith(
        expect.objectContaining({
          rulesProcessed: 0,
          totalStats: { matched: 0, sent: 0, skipped: 0, throttled: 0, failed: 0 },
        })
      );
    });

    it('includes rule with validFrom slightly in the past', async () => {
      const models = createMockModels();
      const slightlyPast = new Date(Date.now() - 1);
      const config = createMockConfig({
        queryUsers: vi.fn().mockResolvedValue([makeUser()]),
      });

      const templateDoc = { _id: 'template-1', subjects: ['Hi'], bodies: ['<p>Hi</p>'] };
      models.Rule.findActive.mockResolvedValue([makeRule({ validFrom: slightlyPast.toISOString() })]);
      models.Template.findById.mockResolvedValue(templateDoc);
      models.Template.find.mockImplementation(() => ({ lean: vi.fn().mockResolvedValue([templateDoc]) }));
      models.SendLog.find.mockImplementation(() => createChainableMock([]));

      const { service } = createService(models, config);
      await service.runAllRules();

      expect(models.RunLog.create).toHaveBeenCalledWith(
        expect.objectContaining({ rulesProcessed: 1 })
      );
    });
  });
});
