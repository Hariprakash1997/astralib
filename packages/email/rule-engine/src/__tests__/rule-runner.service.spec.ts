import { describe, it, expect, vi, beforeEach } from 'vitest';
import { RuleRunnerService } from '../services/rule-runner.service';
import { EMAIL_TYPE, RUN_TRIGGER } from '../constants';

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
    compileBatch: vi.fn().mockReturnValue({
      subjectFn: vi.fn(),
      bodyFn: vi.fn(),
      textBodyFn: vi.fn(),
    }),
    compileBatchVariants: vi.fn().mockReturnValue({
      subjectFns: [vi.fn().mockReturnValue('Rendered Subject')],
      bodyFns: [vi.fn().mockReturnValue('<p>Rendered HTML</p>')],
      textBodyFn: vi.fn().mockReturnValue('Rendered Text'),
    }),
    renderFromCompiled: vi.fn().mockReturnValue({
      subject: 'Rendered Subject',
      html: '<p>Rendered HTML</p>',
      text: 'Rendered Text',
    }),
    htmlToText: vi.fn().mockReturnValue('Rendered Text'),
  })),
}));

function createChainableMock(resolvedValue: any[] = []) {
  const mock: any = {
    lean: vi.fn().mockResolvedValue(resolvedValue),
    sort: vi.fn().mockReturnThis(),
  };
  return mock;
}

function createMockModels() {
  return {
    EmailRule: {
      findActive: vi.fn().mockResolvedValue([]),
      findByIdAndUpdate: vi.fn().mockResolvedValue(null),
    },
    EmailTemplate: {
      findById: vi.fn().mockResolvedValue(null),
      find: vi.fn().mockImplementation(() => ({ lean: vi.fn().mockResolvedValue([]) })),
    },
    EmailRuleSend: {
      find: vi.fn().mockImplementation(() => createChainableMock([])),
      logSend: vi.fn().mockResolvedValue(undefined),
    },
    EmailRuleRunLog: {
      create: vi.fn().mockResolvedValue(undefined),
    },
    EmailThrottleConfig: {
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
      sendEmail: vi.fn().mockResolvedValue(undefined),
      selectAgent: vi.fn().mockResolvedValue({ accountId: 'acc-1', email: 'agent@example.com', metadata: { team: 'support' } }),
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
      models.EmailRule as any,
      models.EmailTemplate as any,
      models.EmailRuleSend as any,
      models.EmailRuleRunLog as any,
      models.EmailThrottleConfig as any,
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
    emailType: EMAIL_TYPE.Automated,
    target: { mode: 'query', role: 'customer', platform: 'w1', conditions: [] },
    ...overrides,
  };
}

function makeUser(overrides: Record<string, any> = {}) {
  return {
    _id: 'user-1',
    email: 'alice@example.com',
    name: 'Alice',
    ...overrides,
  };
}

describe('RuleRunnerService', () => {
  beforeEach(() => {
    vi.clearAllMocks();
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

      expect(models.EmailRule.findActive).not.toHaveBeenCalled();
      expect(config.logger.warn).toHaveBeenCalledWith(expect.stringContaining('already executing'));

      (RedisLock as any).mockImplementation(() => ({
        acquire: vi.fn().mockResolvedValue(true),
        release: vi.fn().mockResolvedValue(undefined),
      }));
    });

    it('creates empty run log when no active rules', async () => {
      const { service, models } = createService();
      models.EmailRule.findActive.mockResolvedValue([]);

      await service.runAllRules();

      expect(models.EmailRuleRunLog.create).toHaveBeenCalledWith(
        expect.objectContaining({
          rulesProcessed: 0,
          totalStats: { matched: 0, sent: 0, skipped: 0, skippedByThrottle: 0, errorCount: 0 },
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
        textBody: undefined,
      };
      models.EmailRule.findActive.mockResolvedValue([makeRule()]);
      models.EmailTemplate.findById.mockResolvedValue(templateDoc);
      models.EmailTemplate.find.mockImplementation(() => ({ lean: vi.fn().mockResolvedValue([templateDoc]) }));
      models.EmailRuleSend.find.mockImplementation(() => createChainableMock([]));

      const { service } = createService(models, config);
      await service.runAllRules();

      expect(models.EmailRuleRunLog.create).toHaveBeenCalledWith(
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
      models.EmailThrottleConfig.getConfig.mockRejectedValue(new Error('DB down'));

      const config = createMockConfig();
      const service = new RuleRunnerService(
        models.EmailRule as any,
        models.EmailTemplate as any,
        models.EmailRuleSend as any,
        models.EmailRuleRunLog as any,
        models.EmailThrottleConfig as any,
        config as any
      );

      await expect(service.runAllRules()).rejects.toThrow('DB down');
      expect(mockRelease).toHaveBeenCalled();
    });
  });

  describe('executeRule', () => {
    it('returns error stats when template not found', async () => {
      const models = createMockModels();
      models.EmailTemplate.findById.mockResolvedValue(null);
      const { service } = createService(models);

      const stats = await service.executeRule(makeRule(), new Map(), {});
      expect(stats).toEqual({ matched: 0, sent: 0, skipped: 0, skippedByThrottle: 0, errorCount: 1 });
    });

    it('returns error stats when queryUsers fails', async () => {
      const models = createMockModels();
      models.EmailTemplate.findById.mockResolvedValue({ subjects: ['Hi'], bodies: ['<p>Hi</p>'] });
      const config = createMockConfig({
        queryUsers: vi.fn().mockRejectedValue(new Error('query failed')),
      });
      const { service } = createService(models, config);

      const stats = await service.executeRule(makeRule(), new Map(), {});
      expect(stats.errorCount).toBe(1);
    });

    it('returns {matched:0} when no users match', async () => {
      const models = createMockModels();
      models.EmailTemplate.findById.mockResolvedValue({ subjects: ['Hi'], bodies: ['<p>Hi</p>'] });
      const config = createMockConfig({
        queryUsers: vi.fn().mockResolvedValue([]),
      });
      const { service } = createService(models, config);

      const stats = await service.executeRule(makeRule(), new Map(), {});
      expect(stats.matched).toBe(0);
      expect(stats.sent).toBe(0);
    });

    it('skips users without email or userId', async () => {
      const models = createMockModels();
      models.EmailTemplate.findById.mockResolvedValue({ subjects: ['Hi'], bodies: ['<p>Hi</p>'] });
      models.EmailRuleSend.find.mockImplementation(() => createChainableMock([]));
      const config = createMockConfig({
        queryUsers: vi.fn().mockResolvedValue([
          { _id: null, email: 'a@b.com' },
          { _id: 'u1', email: '' },
          { _id: undefined, email: undefined },
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
      models.EmailTemplate.findById.mockResolvedValue({ subjects: ['Hi'], bodies: ['<p>Hi</p>'] });
      models.EmailRuleSend.find.mockImplementation(() => createChainableMock([
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
      models.EmailTemplate.findById.mockResolvedValue({ subjects: ['Hi'], bodies: ['<p>Hi</p>'] });

      const oldDate = new Date(Date.now() - 10 * 86400000);
      models.EmailRuleSend.find.mockImplementation(() => createChainableMock([
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
      models.EmailTemplate.findById.mockResolvedValue({ subjects: ['Hi'], bodies: ['<p>Hi</p>'] });
      models.EmailRuleSend.find.mockImplementation(() => createChainableMock([]));
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
      models.EmailTemplate.findById.mockResolvedValue({ subjects: ['Hi'], bodies: ['<p>Hi</p>'] });
      models.EmailRuleSend.find.mockImplementation(() => createChainableMock([]));
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

    it('calls sendEmail with correct params for successful send', async () => {
      const models = createMockModels();
      models.EmailTemplate.findById.mockResolvedValue({ subjects: ['Hi'], bodies: ['<p>Hi</p>'] });
      models.EmailRuleSend.find.mockImplementation(() => createChainableMock([]));
      const config = createMockConfig({
        queryUsers: vi.fn().mockResolvedValue([makeUser()]),
      });
      const { service } = createService(models, config);

      const throttleConfig = { maxPerUserPerDay: 10, maxPerUserPerWeek: 50, minGapDays: 0 };
      await service.executeRule(makeRule(), new Map(), throttleConfig);

      expect(config.adapters.sendEmail).toHaveBeenCalledWith(
        expect.objectContaining({
          identifierId: 'ident-1',
          contactId: 'contact-1',
          accountId: 'acc-1',
          subject: 'Rendered Subject',
          htmlBody: '<p>Rendered HTML</p>',
          textBody: 'Rendered Text',
          ruleId: 'rule-1',
          autoApprove: true,
        })
      );
    });

    it('logs send after successful email', async () => {
      const models = createMockModels();
      models.EmailTemplate.findById.mockResolvedValue({ subjects: ['Hi'], bodies: ['<p>Hi</p>'] });
      models.EmailRuleSend.find.mockImplementation(() => createChainableMock([]));
      const config = createMockConfig({
        queryUsers: vi.fn().mockResolvedValue([makeUser()]),
      });
      const { service } = createService(models, config);

      const throttleConfig = { maxPerUserPerDay: 10, maxPerUserPerWeek: 50, minGapDays: 0 };
      await service.executeRule(makeRule(), new Map(), throttleConfig);

      expect(models.EmailRuleSend.logSend).toHaveBeenCalledWith(
        'rule-1', 'user-1', 'ident-1',
        undefined,
        expect.objectContaining({ status: 'sent' })
      );
    });

    it('increments throttle map after send', async () => {
      const models = createMockModels();
      models.EmailTemplate.findById.mockResolvedValue({ subjects: ['Hi'], bodies: ['<p>Hi</p>'] });
      models.EmailRuleSend.find.mockImplementation(() => createChainableMock([]));
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
      models.EmailTemplate.findById.mockResolvedValue({ subjects: ['Hi'], bodies: ['<p>Hi</p>'] });
      models.EmailRuleSend.find.mockImplementation(() => createChainableMock([]));
      const config = createMockConfig({
        queryUsers: vi.fn().mockResolvedValue([makeUser()]),
      });
      const { service } = createService(models, config);

      const throttleConfig = { maxPerUserPerDay: 10, maxPerUserPerWeek: 50, minGapDays: 0 };
      await service.executeRule(makeRule(), new Map(), throttleConfig);

      expect(models.EmailRule.findByIdAndUpdate).toHaveBeenCalledWith(
        'rule-1',
        expect.objectContaining({
          $set: expect.objectContaining({ lastRunStats: expect.any(Object) }),
          $inc: expect.objectContaining({ totalSent: 1 }),
        })
      );
    });
  });

  describe('buildThrottleMap', () => {
    it('builds correct today/thisWeek/lastSentDate from recent sends', () => {
      const { service } = createService();
      const now = new Date();
      const todayEarlier = new Date();
      todayEarlier.setHours(todayEarlier.getHours() - 1);
      const yesterday = new Date(Date.now() - 86400000);

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

  describe('A/B variant selection', () => {
    it('passes subjectIndex and bodyIndex to logSend', async () => {
      const models = createMockModels();
      models.EmailTemplate.findById.mockResolvedValue({ subjects: ['Hi {{name}}'], bodies: ['<p>Hi</p>'] });
      models.EmailRuleSend.find.mockImplementation(() => createChainableMock([]));
      const config = createMockConfig({
        queryUsers: vi.fn().mockResolvedValue([makeUser()]),
      });
      const { service } = createService(models, config);

      const throttleConfig = { maxPerUserPerDay: 10, maxPerUserPerWeek: 50, minGapDays: 0 };
      await service.executeRule(makeRule(), new Map(), throttleConfig);

      expect(models.EmailRuleSend.logSend).toHaveBeenCalledWith(
        'rule-1', 'user-1', 'ident-1',
        undefined,
        expect.objectContaining({ subjectIndex: expect.any(Number), bodyIndex: expect.any(Number) })
      );
    });

    it('works with single-element arrays (index 0)', async () => {
      const models = createMockModels();
      models.EmailTemplate.findById.mockResolvedValue({ subjects: ['Only subject'], bodies: ['<p>Only body</p>'] });
      models.EmailRuleSend.find.mockImplementation(() => createChainableMock([]));
      const config = createMockConfig({
        queryUsers: vi.fn().mockResolvedValue([makeUser()]),
      });
      const { service } = createService(models, config);

      const throttleConfig = { maxPerUserPerDay: 10, maxPerUserPerWeek: 50, minGapDays: 0 };
      await service.executeRule(makeRule(), new Map(), throttleConfig);

      expect(models.EmailRuleSend.logSend).toHaveBeenCalledWith(
        'rule-1', 'user-1', 'ident-1',
        undefined,
        expect.objectContaining({ subjectIndex: 0, bodyIndex: 0 })
      );
    });

    it('picks variant and uses rendered output in sendEmail', async () => {
      const models = createMockModels();
      models.EmailTemplate.findById.mockResolvedValue({
        subjects: ['Subject A', 'Subject B'],
        bodies: ['<p>Body A</p>', '<p>Body B</p>'],
      });
      models.EmailRuleSend.find.mockImplementation(() => createChainableMock([]));
      const config = createMockConfig({
        queryUsers: vi.fn().mockResolvedValue([makeUser()]),
      });
      const { service } = createService(models, config);

      const throttleConfig = { maxPerUserPerDay: 10, maxPerUserPerWeek: 50, minGapDays: 0 };
      await service.executeRule(makeRule(), new Map(), throttleConfig);

      expect(config.adapters.sendEmail).toHaveBeenCalledWith(
        expect.objectContaining({
          subject: 'Rendered Subject',
          htmlBody: '<p>Rendered HTML</p>',
          textBody: 'Rendered Text',
        })
      );
    });
  });

  describe('beforeSend hook', () => {
    it('calls hook with correct params and uses returned values in sendEmail', async () => {
      const beforeSend = vi.fn().mockResolvedValue({
        htmlBody: '<p>Modified HTML</p>',
        textBody: 'Modified Text',
        subject: 'Modified Subject',
      });

      const models = createMockModels();
      models.EmailTemplate.findById.mockResolvedValue({ subjects: ['Hi'], bodies: ['<p>Hi</p>'] });
      models.EmailRuleSend.find.mockImplementation(() => createChainableMock([]));
      const config = createMockConfig(
        { queryUsers: vi.fn().mockResolvedValue([makeUser()]) },
        { hooks: { beforeSend } }
      );
      const { service } = createService(models, config);

      const throttleConfig = { maxPerUserPerDay: 10, maxPerUserPerWeek: 50, minGapDays: 0 };
      await service.executeRule(makeRule(), new Map(), throttleConfig);

      expect(beforeSend).toHaveBeenCalledWith(
        expect.objectContaining({
          htmlBody: expect.any(String),
          textBody: expect.any(String),
          subject: expect.any(String),
          account: expect.objectContaining({
            id: 'acc-1',
            email: 'agent@example.com',
            metadata: { team: 'support' },
          }),
          user: expect.objectContaining({
            id: expect.any(String),
            email: 'alice@example.com',
          }),
          context: expect.objectContaining({
            ruleId: expect.any(String),
            templateId: expect.any(String),
            runId: expect.any(String),
          }),
        })
      );

      expect(config.adapters.sendEmail).toHaveBeenCalledWith(
        expect.objectContaining({
          subject: 'Modified Subject',
          htmlBody: '<p>Modified HTML</p>',
          textBody: 'Modified Text',
        })
      );
    });

    it('sends rendering output directly when no hook is configured', async () => {
      const models = createMockModels();
      models.EmailTemplate.findById.mockResolvedValue({ subjects: ['Hi'], bodies: ['<p>Hi</p>'] });
      models.EmailRuleSend.find.mockImplementation(() => createChainableMock([]));
      const config = createMockConfig({
        queryUsers: vi.fn().mockResolvedValue([makeUser()]),
      });
      const { service } = createService(models, config);

      const throttleConfig = { maxPerUserPerDay: 10, maxPerUserPerWeek: 50, minGapDays: 0 };
      await service.executeRule(makeRule(), new Map(), throttleConfig);

      expect(config.adapters.sendEmail).toHaveBeenCalledWith(
        expect.objectContaining({
          subject: 'Rendered Subject',
          htmlBody: '<p>Rendered HTML</p>',
          textBody: 'Rendered Text',
        })
      );
    });

    it('catches hook errors and skips user with stats.errorCount++', async () => {
      const beforeSend = vi.fn().mockRejectedValue(new Error('hook boom'));

      const models = createMockModels();
      models.EmailTemplate.findById.mockResolvedValue({ subjects: ['Hi'], bodies: ['<p>Hi</p>'] });
      models.EmailRuleSend.find.mockImplementation(() => createChainableMock([]));
      const config = createMockConfig(
        { queryUsers: vi.fn().mockResolvedValue([makeUser()]) },
        { hooks: { beforeSend } }
      );
      const { service } = createService(models, config);

      const throttleConfig = { maxPerUserPerDay: 10, maxPerUserPerWeek: 50, minGapDays: 0 };
      const stats = await service.executeRule(makeRule(), new Map(), throttleConfig);

      expect(stats.errorCount).toBe(1);
      expect(stats.sent).toBe(0);
      expect(config.adapters.sendEmail).not.toHaveBeenCalled();
      expect(config.logger.error).toHaveBeenCalledWith(expect.stringContaining('beforeSend hook failed'));
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
      models.EmailTemplate.findById.mockResolvedValue({ subjects: ['Hi'], bodies: ['<p>Hi</p>'] });
      models.EmailRuleSend.find.mockImplementation(() => createChainableMock([]));
      const config = createMockConfig({
        findIdentifier: vi.fn().mockResolvedValue({ id: 'ident-1', contactId: 'contact-1' }),
      });
      const { service } = createService(models, config);

      const throttleConfig = { maxPerUserPerDay: 10, maxPerUserPerWeek: 50, minGapDays: 0 };
      await service.executeRule(makeListRule(), new Map(), throttleConfig);

      expect(config.adapters.queryUsers).not.toHaveBeenCalled();
    });

    it('calls findIdentifier for each email in the list', async () => {
      const models = createMockModels();
      models.EmailTemplate.findById.mockResolvedValue({ subjects: ['Hi'], bodies: ['<p>Hi</p>'] });
      models.EmailRuleSend.find.mockImplementation(() => createChainableMock([]));
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
      models.EmailTemplate.findById.mockResolvedValue({ subjects: ['Hi'], bodies: ['<p>Hi</p>'] });
      const sameId = 'ident-same';
      models.EmailRuleSend.find.mockImplementation(() => createChainableMock([
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
      models.EmailTemplate.findById.mockResolvedValue({ subjects: ['Hi'], bodies: ['<p>Hi</p>'] });
      models.EmailRuleSend.find.mockImplementation(() => createChainableMock([]));
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
      models.EmailTemplate.findById.mockResolvedValue({ subjects: ['Hi'], bodies: ['<p>Hi</p>'] });
      models.EmailRuleSend.find.mockImplementation(() => createChainableMock([]));
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
          makeUser({ _id: 'u1', email: 'u1@test.com' }),
          makeUser({ _id: 'u2', email: 'u2@test.com' }),
        ]),
      });

      const rule1 = makeRule({ _id: 'rule-1', name: 'Rule 1' });
      const rule2 = makeRule({ _id: 'rule-2', name: 'Rule 2' });
      models.EmailRule.findActive.mockResolvedValue([rule1, rule2]);
      models.EmailTemplate.findById.mockResolvedValue({ subjects: ['Hi'], bodies: ['<p>Hi</p>'] });
      models.EmailTemplate.find.mockImplementation(() => ({
        lean: vi.fn().mockResolvedValue([{ _id: 'template-1', subjects: ['Hi'], bodies: ['<p>Hi</p>'] }]),
      }));
      models.EmailRuleSend.find.mockImplementation(() => createChainableMock([]));

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

  describe('checkThrottle (via executeRule)', () => {
    function setupForThrottle(
      ruleOverrides: Record<string, any> = {},
      throttleMapEntries: [string, any][] = [],
      throttleConfig: any = { maxPerUserPerDay: 3, maxPerUserPerWeek: 10, minGapDays: 1 }
    ) {
      const models = createMockModels();
      models.EmailTemplate.findById.mockResolvedValue({ subjects: ['Hi'], bodies: ['<p>Hi</p>'] });
      models.EmailRuleSend.find.mockImplementation(() => createChainableMock([]));
      const config = createMockConfig({
        queryUsers: vi.fn().mockResolvedValue([makeUser()]),
      });
      const { service } = createService(models, config);

      const throttleMap = new Map(throttleMapEntries);
      const rule = makeRule(ruleOverrides);

      return { service, rule, throttleMap, throttleConfig, config };
    }

    it('bypasses for transactional emails', async () => {
      const { service, rule, throttleMap, config } = setupForThrottle(
        { emailType: EMAIL_TYPE.Transactional },
        [['user-1', { today: 100, thisWeek: 200, lastSentDate: new Date() }]],
        { maxPerUserPerDay: 1, maxPerUserPerWeek: 1, minGapDays: 100 }
      );

      const stats = await service.executeRule(rule, throttleMap, { maxPerUserPerDay: 1, maxPerUserPerWeek: 1, minGapDays: 100 });
      expect(stats.sent).toBe(1);
      expect(stats.skippedByThrottle).toBe(0);
    });

    it('bypasses when bypassThrottle is true', async () => {
      const { service, rule, throttleMap } = setupForThrottle(
        { bypassThrottle: true },
        [['user-1', { today: 100, thisWeek: 200, lastSentDate: new Date() }]]
      );

      const stats = await service.executeRule(rule, throttleMap, { maxPerUserPerDay: 1, maxPerUserPerWeek: 1, minGapDays: 100 });
      expect(stats.sent).toBe(1);
      expect(stats.skippedByThrottle).toBe(0);
    });

    it('blocks when daily limit reached', async () => {
      const { service, rule, throttleMap } = setupForThrottle(
        {},
        [['user-1', { today: 3, thisWeek: 3, lastSentDate: new Date(Date.now() - 2 * 86400000) }]]
      );

      const stats = await service.executeRule(rule, throttleMap, { maxPerUserPerDay: 3, maxPerUserPerWeek: 50, minGapDays: 0 });
      expect(stats.skippedByThrottle).toBe(1);
      expect(stats.sent).toBe(0);
    });

    it('blocks when weekly limit reached', async () => {
      const { service, rule, throttleMap } = setupForThrottle(
        {},
        [['user-1', { today: 0, thisWeek: 10, lastSentDate: new Date(Date.now() - 2 * 86400000) }]]
      );

      const stats = await service.executeRule(rule, throttleMap, { maxPerUserPerDay: 50, maxPerUserPerWeek: 10, minGapDays: 0 });
      expect(stats.skippedByThrottle).toBe(1);
      expect(stats.sent).toBe(0);
    });

    it('blocks when min gap days not met', async () => {
      const recentDate = new Date(Date.now() - 0.5 * 86400000);
      const { service, rule, throttleMap } = setupForThrottle(
        {},
        [['user-1', { today: 0, thisWeek: 0, lastSentDate: recentDate }]]
      );

      const stats = await service.executeRule(rule, throttleMap, { maxPerUserPerDay: 50, maxPerUserPerWeek: 50, minGapDays: 2 });
      expect(stats.skippedByThrottle).toBe(1);
      expect(stats.sent).toBe(0);
    });
  });

  describe('rule validity dates (validFrom / validTill)', () => {
    it('skips rule with validFrom in the future', async () => {
      const models = createMockModels();
      const futureDate = new Date(Date.now() + 7 * 86400000);
      models.EmailRule.findActive.mockResolvedValue([makeRule({ validFrom: futureDate.toISOString() })]);
      models.EmailTemplate.find.mockImplementation(() => ({ lean: vi.fn().mockResolvedValue([]) }));

      const config = createMockConfig();
      const { service } = createService(models, config);
      await service.runAllRules();

      expect(models.EmailRuleRunLog.create).toHaveBeenCalledWith(
        expect.objectContaining({
          rulesProcessed: 0,
          totalStats: { matched: 0, sent: 0, skipped: 0, skippedByThrottle: 0, errorCount: 0 },
        })
      );
    });

    it('skips rule with validTill in the past', async () => {
      const models = createMockModels();
      const pastDate = new Date(Date.now() - 7 * 86400000);
      models.EmailRule.findActive.mockResolvedValue([makeRule({ validTill: pastDate.toISOString() })]);
      models.EmailTemplate.find.mockImplementation(() => ({ lean: vi.fn().mockResolvedValue([]) }));

      const config = createMockConfig();
      const { service } = createService(models, config);
      await service.runAllRules();

      expect(models.EmailRuleRunLog.create).toHaveBeenCalledWith(
        expect.objectContaining({
          rulesProcessed: 0,
          totalStats: { matched: 0, sent: 0, skipped: 0, skippedByThrottle: 0, errorCount: 0 },
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
      models.EmailRule.findActive.mockResolvedValue([makeRule({ validFrom: pastDate.toISOString(), validTill: futureDate.toISOString() })]);
      models.EmailTemplate.findById.mockResolvedValue(templateDoc);
      models.EmailTemplate.find.mockImplementation(() => ({ lean: vi.fn().mockResolvedValue([templateDoc]) }));
      models.EmailRuleSend.find.mockImplementation(() => createChainableMock([]));

      const { service } = createService(models, config);
      await service.runAllRules();

      expect(models.EmailRuleRunLog.create).toHaveBeenCalledWith(
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
      models.EmailRule.findActive.mockResolvedValue([makeRule()]);
      models.EmailTemplate.findById.mockResolvedValue(templateDoc);
      models.EmailTemplate.find.mockImplementation(() => ({ lean: vi.fn().mockResolvedValue([templateDoc]) }));
      models.EmailRuleSend.find.mockImplementation(() => createChainableMock([]));

      const { service } = createService(models, config);
      await service.runAllRules();

      expect(models.EmailRuleRunLog.create).toHaveBeenCalledWith(
        expect.objectContaining({ rulesProcessed: 1 })
      );
    });

    it('processes rule with only validFrom set (in past)', async () => {
      const models = createMockModels();
      const pastDate = new Date(Date.now() - 7 * 86400000);
      const config = createMockConfig({
        queryUsers: vi.fn().mockResolvedValue([makeUser()]),
      });

      const templateDoc = { _id: 'template-1', subjects: ['Hi'], bodies: ['<p>Hi</p>'] };
      models.EmailRule.findActive.mockResolvedValue([makeRule({ validFrom: pastDate.toISOString() })]);
      models.EmailTemplate.findById.mockResolvedValue(templateDoc);
      models.EmailTemplate.find.mockImplementation(() => ({ lean: vi.fn().mockResolvedValue([templateDoc]) }));
      models.EmailRuleSend.find.mockImplementation(() => createChainableMock([]));

      const { service } = createService(models, config);
      await service.runAllRules();

      expect(models.EmailRuleRunLog.create).toHaveBeenCalledWith(
        expect.objectContaining({ rulesProcessed: 1 })
      );
    });

    it('processes rule with only validTill set (in future)', async () => {
      const models = createMockModels();
      const futureDate = new Date(Date.now() + 7 * 86400000);
      const config = createMockConfig({
        queryUsers: vi.fn().mockResolvedValue([makeUser()]),
      });

      const templateDoc = { _id: 'template-1', subjects: ['Hi'], bodies: ['<p>Hi</p>'] };
      models.EmailRule.findActive.mockResolvedValue([makeRule({ validTill: futureDate.toISOString() })]);
      models.EmailTemplate.findById.mockResolvedValue(templateDoc);
      models.EmailTemplate.find.mockImplementation(() => ({ lean: vi.fn().mockResolvedValue([templateDoc]) }));
      models.EmailRuleSend.find.mockImplementation(() => createChainableMock([]));

      const { service } = createService(models, config);
      await service.runAllRules();

      expect(models.EmailRuleRunLog.create).toHaveBeenCalledWith(
        expect.objectContaining({ rulesProcessed: 1 })
      );
    });
  });

  describe('template custom fields', () => {
    it('template fields are included in render context', async () => {
      const models = createMockModels();
      models.EmailTemplate.findById.mockResolvedValue({
        subjects: ['Hi {{companyName}}'],
        bodies: ['<p>Welcome to {{companyName}}</p>'],
        fields: { companyName: 'Acme Corp', supportUrl: 'https://support.acme.com' },
      });
      models.EmailRuleSend.find.mockImplementation(() => createChainableMock([]));

      const resolveDataMock = vi.fn().mockImplementation((user: any) => ({ name: user.name, email: user.email }));
      const config = createMockConfig({
        queryUsers: vi.fn().mockResolvedValue([makeUser()]),
        resolveData: resolveDataMock,
      });
      const { service } = createService(models, config);

      const throttleConfig = { maxPerUserPerDay: 10, maxPerUserPerWeek: 50, minGapDays: 0 };
      await service.executeRule(makeRule(), new Map(), throttleConfig);

      expect(config.adapters.sendEmail).toHaveBeenCalled();
      expect(resolveDataMock).toHaveBeenCalled();
    });

    it('candidate data from resolveData overrides template fields on key conflict', async () => {
      const { TemplateRenderService } = await import('../services/template-render.service');
      const capturedData: any[] = [];
      const mockSubjectFn = vi.fn().mockImplementation((data: any) => { capturedData.push({ ...data }); return 'Rendered Subject'; });
      (TemplateRenderService as any).mockImplementation(() => ({
        compileBatchVariants: vi.fn().mockReturnValue({
          subjectFns: [mockSubjectFn],
          bodyFns: [vi.fn().mockReturnValue('<p>Rendered HTML</p>')],
          textBodyFn: vi.fn().mockReturnValue('Rendered Text'),
        }),
        htmlToText: vi.fn().mockReturnValue('Rendered Text'),
      }));

      const models = createMockModels();
      models.EmailTemplate.findById.mockResolvedValue({
        subjects: ['Hi {{name}}'],
        bodies: ['<p>Hello</p>'],
        fields: { name: 'Default Name', extra: 'templateValue' },
      });
      models.EmailRuleSend.find.mockImplementation(() => createChainableMock([]));
      const config = createMockConfig({
        queryUsers: vi.fn().mockResolvedValue([makeUser()]),
        resolveData: vi.fn().mockImplementation((user: any) => ({ name: user.name, email: user.email })),
      });
      const { service } = createService(models, config);

      const throttleConfig = { maxPerUserPerDay: 10, maxPerUserPerWeek: 50, minGapDays: 0 };
      await service.executeRule(makeRule(), new Map(), throttleConfig);

      expect(mockSubjectFn).toHaveBeenCalled();
      const renderData = capturedData[0];
      expect(renderData.name).toBe('Alice');
      expect(renderData.extra).toBe('templateValue');

      // Restore default mock
      (TemplateRenderService as any).mockImplementation(() => ({
        compileBatch: vi.fn().mockReturnValue({ subjectFn: vi.fn(), bodyFn: vi.fn(), textBodyFn: vi.fn() }),
        compileBatchVariants: vi.fn().mockReturnValue({
          subjectFns: [vi.fn().mockReturnValue('Rendered Subject')],
          bodyFns: [vi.fn().mockReturnValue('<p>Rendered HTML</p>')],
          textBodyFn: vi.fn().mockReturnValue('Rendered Text'),
        }),
        renderFromCompiled: vi.fn().mockReturnValue({ subject: 'Rendered Subject', html: '<p>Rendered HTML</p>', text: 'Rendered Text' }),
        htmlToText: vi.fn().mockReturnValue('Rendered Text'),
      }));
    });

    it('template with no fields (undefined) works fine', async () => {
      const models = createMockModels();
      models.EmailTemplate.findById.mockResolvedValue({
        subjects: ['Hi'],
        bodies: ['<p>Hello</p>'],
      });
      models.EmailRuleSend.find.mockImplementation(() => createChainableMock([]));
      const config = createMockConfig({
        queryUsers: vi.fn().mockResolvedValue([makeUser()]),
      });
      const { service } = createService(models, config);

      const throttleConfig = { maxPerUserPerDay: 10, maxPerUserPerWeek: 50, minGapDays: 0 };
      const stats = await service.executeRule(makeRule(), new Map(), throttleConfig);
      expect(stats.sent).toBe(1);
      expect(stats.errorCount).toBe(0);
    });

    it('template with empty fields object works fine', async () => {
      const models = createMockModels();
      models.EmailTemplate.findById.mockResolvedValue({
        subjects: ['Hi'],
        bodies: ['<p>Hello</p>'],
        fields: {},
      });
      models.EmailRuleSend.find.mockImplementation(() => createChainableMock([]));
      const config = createMockConfig({
        queryUsers: vi.fn().mockResolvedValue([makeUser()]),
      });
      const { service } = createService(models, config);

      const throttleConfig = { maxPerUserPerDay: 10, maxPerUserPerWeek: 50, minGapDays: 0 };
      const stats = await service.executeRule(makeRule(), new Map(), throttleConfig);
      expect(stats.sent).toBe(1);
      expect(stats.errorCount).toBe(0);
    });

    it('template fields and resolveData both contribute to final render data', async () => {
      const { TemplateRenderService } = await import('../services/template-render.service');
      const capturedData: any[] = [];
      const mockSubjectFn = vi.fn().mockImplementation((data: any) => { capturedData.push({ ...data }); return 'Rendered Subject'; });
      (TemplateRenderService as any).mockImplementation(() => ({
        compileBatchVariants: vi.fn().mockReturnValue({
          subjectFns: [mockSubjectFn],
          bodyFns: [vi.fn().mockReturnValue('<p>Rendered HTML</p>')],
          textBodyFn: vi.fn().mockReturnValue('Rendered Text'),
        }),
        htmlToText: vi.fn().mockReturnValue('Rendered Text'),
      }));

      const models = createMockModels();
      models.EmailTemplate.findById.mockResolvedValue({
        subjects: ['Hi {{name}} from {{companyName}}'],
        bodies: ['<p>Hello</p>'],
        fields: { companyName: 'Acme Corp', footer: 'Unsubscribe here' },
      });
      models.EmailRuleSend.find.mockImplementation(() => createChainableMock([]));
      const config = createMockConfig({
        queryUsers: vi.fn().mockResolvedValue([makeUser()]),
        resolveData: vi.fn().mockImplementation((user: any) => ({ name: user.name, role: 'customer' })),
      });
      const { service } = createService(models, config);

      const throttleConfig = { maxPerUserPerDay: 10, maxPerUserPerWeek: 50, minGapDays: 0 };
      await service.executeRule(makeRule(), new Map(), throttleConfig);

      expect(mockSubjectFn).toHaveBeenCalled();
      const renderData = capturedData[0];
      expect(renderData.companyName).toBe('Acme Corp');
      expect(renderData.footer).toBe('Unsubscribe here');
      expect(renderData.name).toBe('Alice');
      expect(renderData.role).toBe('customer');

      // Restore default mock
      (TemplateRenderService as any).mockImplementation(() => ({
        compileBatch: vi.fn().mockReturnValue({ subjectFn: vi.fn(), bodyFn: vi.fn(), textBodyFn: vi.fn() }),
        compileBatchVariants: vi.fn().mockReturnValue({
          subjectFns: [vi.fn().mockReturnValue('Rendered Subject')],
          bodyFns: [vi.fn().mockReturnValue('<p>Rendered HTML</p>')],
          textBodyFn: vi.fn().mockReturnValue('Rendered Text'),
        }),
        renderFromCompiled: vi.fn().mockReturnValue({ subject: 'Rendered Subject', html: '<p>Rendered HTML</p>', text: 'Rendered Text' }),
        htmlToText: vi.fn().mockReturnValue('Rendered Text'),
      }));
    });
  });

  describe('Preheader Text', () => {
    it('injects preheader hidden div into HTML when template has preheaders', async () => {
      const { TemplateRenderService } = await import('../services/template-render.service');
      const mockBodyFn = vi.fn().mockReturnValue('<!doctype html><html><body><p>Body HTML</p></body></html>');
      const mockPreheaderFn = vi.fn().mockReturnValue('Preview text');
      (TemplateRenderService as any).mockImplementation(() => ({
        compileBatchVariants: vi.fn().mockReturnValue({
          subjectFns: [vi.fn().mockReturnValue('Subject')],
          bodyFns: [mockBodyFn],
          textBodyFn: vi.fn().mockReturnValue('Text'),
          preheaderFns: [mockPreheaderFn],
        }),
        htmlToText: vi.fn().mockReturnValue('Text'),
      }));

      const models = createMockModels();
      models.EmailTemplate.findById.mockResolvedValue({
        subjects: ['Subject'],
        bodies: ['<p>Body HTML</p>'],
        preheaders: ['Preview text'],
      });
      models.EmailRuleSend.find.mockImplementation(() => createChainableMock([]));
      const config = createMockConfig({
        queryUsers: vi.fn().mockResolvedValue([makeUser()]),
      });
      const { service } = createService(models, config);

      const throttleConfig = { maxPerUserPerDay: 10, maxPerUserPerWeek: 50, minGapDays: 0 };
      await service.executeRule(makeRule(), new Map(), throttleConfig);

      expect(config.adapters.sendEmail).toHaveBeenCalledWith(
        expect.objectContaining({
          htmlBody: expect.stringContaining('<div style="display:none;font-size:1px;color:#ffffff;line-height:1px;max-height:0px;max-width:0px;opacity:0;overflow:hidden;">Preview text</div>'),
        })
      );

      // Restore default mock
      (TemplateRenderService as any).mockImplementation(() => ({
        compileBatch: vi.fn().mockReturnValue({ subjectFn: vi.fn(), bodyFn: vi.fn(), textBodyFn: vi.fn() }),
        compileBatchVariants: vi.fn().mockReturnValue({
          subjectFns: [vi.fn().mockReturnValue('Rendered Subject')],
          bodyFns: [vi.fn().mockReturnValue('<p>Rendered HTML</p>')],
          textBodyFn: vi.fn().mockReturnValue('Rendered Text'),
        }),
        renderFromCompiled: vi.fn().mockReturnValue({ subject: 'Rendered Subject', html: '<p>Rendered HTML</p>', text: 'Rendered Text' }),
        htmlToText: vi.fn().mockReturnValue('Rendered Text'),
      }));
    });

    it('passes preheaderIndex to logSend when preheaders are present', async () => {
      const { TemplateRenderService } = await import('../services/template-render.service');
      (TemplateRenderService as any).mockImplementation(() => ({
        compileBatchVariants: vi.fn().mockReturnValue({
          subjectFns: [vi.fn().mockReturnValue('Subject')],
          bodyFns: [vi.fn().mockReturnValue('<html><body><p>Body</p></body></html>')],
          textBodyFn: vi.fn().mockReturnValue('Text'),
          preheaderFns: [
            vi.fn().mockReturnValue('Preheader A'),
            vi.fn().mockReturnValue('Preheader B'),
          ],
        }),
        htmlToText: vi.fn().mockReturnValue('Text'),
      }));

      const models = createMockModels();
      models.EmailTemplate.findById.mockResolvedValue({
        subjects: ['Subject'],
        bodies: ['<html><body><p>Body</p></body></html>'],
        preheaders: ['Preheader A', 'Preheader B'],
      });
      models.EmailRuleSend.find.mockImplementation(() => createChainableMock([]));
      const config = createMockConfig({
        queryUsers: vi.fn().mockResolvedValue([makeUser()]),
      });
      const { service } = createService(models, config);

      const throttleConfig = { maxPerUserPerDay: 10, maxPerUserPerWeek: 50, minGapDays: 0 };
      await service.executeRule(makeRule(), new Map(), throttleConfig);

      expect(models.EmailRuleSend.logSend).toHaveBeenCalledWith(
        'rule-1', 'user-1', 'ident-1',
        undefined,
        expect.objectContaining({ preheaderIndex: expect.any(Number) })
      );

      // Restore default mock
      (TemplateRenderService as any).mockImplementation(() => ({
        compileBatch: vi.fn().mockReturnValue({ subjectFn: vi.fn(), bodyFn: vi.fn(), textBodyFn: vi.fn() }),
        compileBatchVariants: vi.fn().mockReturnValue({
          subjectFns: [vi.fn().mockReturnValue('Rendered Subject')],
          bodyFns: [vi.fn().mockReturnValue('<p>Rendered HTML</p>')],
          textBodyFn: vi.fn().mockReturnValue('Rendered Text'),
        }),
        renderFromCompiled: vi.fn().mockReturnValue({ subject: 'Rendered Subject', html: '<p>Rendered HTML</p>', text: 'Rendered Text' }),
        htmlToText: vi.fn().mockReturnValue('Rendered Text'),
      }));
    });

    it('does not inject hidden div when template has no preheaders', async () => {
      const { TemplateRenderService } = await import('../services/template-render.service');
      (TemplateRenderService as any).mockImplementation(() => ({
        compileBatchVariants: vi.fn().mockReturnValue({
          subjectFns: [vi.fn().mockReturnValue('Subject')],
          bodyFns: [vi.fn().mockReturnValue('<p>Body</p>')],
          textBodyFn: vi.fn().mockReturnValue('Text'),
        }),
        htmlToText: vi.fn().mockReturnValue('Text'),
      }));

      const models = createMockModels();
      models.EmailTemplate.findById.mockResolvedValue({
        subjects: ['Subject'],
        bodies: ['<p>Body</p>'],
      });
      models.EmailRuleSend.find.mockImplementation(() => createChainableMock([]));
      const config = createMockConfig({
        queryUsers: vi.fn().mockResolvedValue([makeUser()]),
      });
      const { service } = createService(models, config);

      const throttleConfig = { maxPerUserPerDay: 10, maxPerUserPerWeek: 50, minGapDays: 0 };
      await service.executeRule(makeRule(), new Map(), throttleConfig);

      expect(config.adapters.sendEmail).toHaveBeenCalledWith(
        expect.objectContaining({
          htmlBody: expect.not.stringContaining('display:none'),
        })
      );

      // Restore default mock
      (TemplateRenderService as any).mockImplementation(() => ({
        compileBatch: vi.fn().mockReturnValue({ subjectFn: vi.fn(), bodyFn: vi.fn(), textBodyFn: vi.fn() }),
        compileBatchVariants: vi.fn().mockReturnValue({
          subjectFns: [vi.fn().mockReturnValue('Rendered Subject')],
          bodyFns: [vi.fn().mockReturnValue('<p>Rendered HTML</p>')],
          textBodyFn: vi.fn().mockReturnValue('Rendered Text'),
        }),
        renderFromCompiled: vi.fn().mockReturnValue({ subject: 'Rendered Subject', html: '<p>Rendered HTML</p>', text: 'Rendered Text' }),
        htmlToText: vi.fn().mockReturnValue('Rendered Text'),
      }));
    });

    it('resolves Handlebars variables in preheader text', async () => {
      const { TemplateRenderService } = await import('../services/template-render.service');
      const mockPreheaderFn = vi.fn().mockImplementation((data: any) => `Hi ${data.name}`);
      (TemplateRenderService as any).mockImplementation(() => ({
        compileBatchVariants: vi.fn().mockReturnValue({
          subjectFns: [vi.fn().mockReturnValue('Subject')],
          bodyFns: [vi.fn().mockReturnValue('<html><body><p>Body</p></body></html>')],
          textBodyFn: vi.fn().mockReturnValue('Text'),
          preheaderFns: [mockPreheaderFn],
        }),
        htmlToText: vi.fn().mockReturnValue('Text'),
      }));

      const models = createMockModels();
      models.EmailTemplate.findById.mockResolvedValue({
        subjects: ['Subject'],
        bodies: ['<html><body><p>Body</p></body></html>'],
        preheaders: ['Hi {{name}}'],
      });
      models.EmailRuleSend.find.mockImplementation(() => createChainableMock([]));
      const config = createMockConfig({
        queryUsers: vi.fn().mockResolvedValue([makeUser({ name: 'Alice' })]),
        resolveData: vi.fn().mockImplementation((user: any) => ({ name: user.name })),
      });
      const { service } = createService(models, config);

      const throttleConfig = { maxPerUserPerDay: 10, maxPerUserPerWeek: 50, minGapDays: 0 };
      await service.executeRule(makeRule(), new Map(), throttleConfig);

      expect(config.adapters.sendEmail).toHaveBeenCalledWith(
        expect.objectContaining({
          htmlBody: expect.stringContaining('Hi Alice'),
        })
      );

      // Restore default mock
      (TemplateRenderService as any).mockImplementation(() => ({
        compileBatch: vi.fn().mockReturnValue({ subjectFn: vi.fn(), bodyFn: vi.fn(), textBodyFn: vi.fn() }),
        compileBatchVariants: vi.fn().mockReturnValue({
          subjectFns: [vi.fn().mockReturnValue('Rendered Subject')],
          bodyFns: [vi.fn().mockReturnValue('<p>Rendered HTML</p>')],
          textBodyFn: vi.fn().mockReturnValue('Rendered Text'),
        }),
        renderFromCompiled: vi.fn().mockReturnValue({ subject: 'Rendered Subject', html: '<p>Rendered HTML</p>', text: 'Rendered Text' }),
        htmlToText: vi.fn().mockReturnValue('Rendered Text'),
      }));
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
      models.EmailTemplate.findById.mockResolvedValue({ subjects: ['Hi'], bodies: ['<p>Hi</p>'] });
      models.EmailRuleSend.find.mockImplementation((query: any) => {
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

      expect(models.EmailRule.findByIdAndUpdate).toHaveBeenCalledWith(
        'rule-1',
        { $set: { isActive: false } }
      );
    });

    it('stays active when some identifiers were throttled', async () => {
      const models = createMockModels();
      models.EmailTemplate.findById.mockResolvedValue({ subjects: ['Hi'], bodies: ['<p>Hi</p>'] });
      models.EmailRuleSend.find.mockImplementation((query: any) => {
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

      const allCalls = models.EmailRule.findByIdAndUpdate.mock.calls;
      const disableCall = allCalls.find((call: any[]) =>
        call[1]?.$set?.isActive === false
      );
      expect(disableCall).toBeUndefined();
    });

    it('stays active when some identifiers have no send record', async () => {
      const models = createMockModels();
      models.EmailTemplate.findById.mockResolvedValue({ subjects: ['Hi'], bodies: ['<p>Hi</p>'] });
      models.EmailRuleSend.find.mockImplementation((query: any) => {
        if (query.userId) {
          return createChainableMock([]);
        }
        return createChainableMock([
          { userId: 'ident-a', ruleId: 'rule-1', sentAt: new Date(), status: 'sent' },
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

      const allCalls = models.EmailRule.findByIdAndUpdate.mock.calls;
      const disableCall = allCalls.find((call: any[]) =>
        call[1]?.$set?.isActive === false
      );
      expect(disableCall).toBeUndefined();
    });

    it('does not auto-disable when sendOnce is false', async () => {
      const models = createMockModels();
      models.EmailTemplate.findById.mockResolvedValue({ subjects: ['Hi'], bodies: ['<p>Hi</p>'] });
      models.EmailRuleSend.find.mockImplementation(() => createChainableMock([]));
      const config = createMockConfig({
        findIdentifier: vi.fn().mockResolvedValue({ id: 'ident-1', contactId: 'contact-1' }),
      });
      const { service } = createService(models, config);

      const rule = makeListRule({ sendOnce: false });
      const throttleConfig = { maxPerUserPerDay: 10, maxPerUserPerWeek: 50, minGapDays: 0 };
      await service.executeRule(rule, new Map(), throttleConfig);

      const allCalls = models.EmailRule.findByIdAndUpdate.mock.calls;
      const disableCall = allCalls.find((call: any[]) =>
        call[1]?.$set?.isActive === false
      );
      expect(disableCall).toBeUndefined();
    });

    it('does not auto-disable when maxPerRun is less than total identifiers and not all are processed', async () => {
      const models = createMockModels();
      models.EmailTemplate.findById.mockResolvedValue({ subjects: ['Hi'], bodies: ['<p>Hi</p>'] });

      let findIdentifierCallCount = 0;
      const identifierMap: Record<string, { id: string; contactId: string }> = {
        'a@test.com': { id: 'ident-a', contactId: 'contact-a' },
        'b@test.com': { id: 'ident-b', contactId: 'contact-b' },
        'c@test.com': { id: 'ident-c', contactId: 'contact-c' },
        'd@test.com': { id: 'ident-d', contactId: 'contact-d' },
        'e@test.com': { id: 'ident-e', contactId: 'contact-e' },
      };

      models.EmailRuleSend.find.mockImplementation((query: any) => {
        if (query.userId) {
          return createChainableMock([]);
        }
        // Auto-disable check: only 2 sends exist (from the current batch)
        return createChainableMock([
          { userId: 'ident-a', ruleId: 'rule-1', sentAt: new Date(), status: 'sent' },
          { userId: 'ident-b', ruleId: 'rule-1', sentAt: new Date(), status: 'sent' },
        ]);
      });

      const config = createMockConfig({
        findIdentifier: vi.fn().mockImplementation((email: string) => {
          return identifierMap[email] || null;
        }),
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
      await service.executeRule(rule, new Map(), throttleConfig);

      // Rule should NOT be auto-disabled because only 2 out of 5 identifiers have send records
      const allCalls = models.EmailRule.findByIdAndUpdate.mock.calls;
      const disableCall = allCalls.find((call: any[]) =>
        call[1]?.$set?.isActive === false
      );
      expect(disableCall).toBeUndefined();
    });
  });

  describe('validity date boundary tests', () => {
    it('excludes rule with validTill equal to exactly now (strict > comparison)', async () => {
      const models = createMockModels();
      const exactlyNow = new Date();
      // validTill is set to a date slightly in the past to simulate "equal to now" boundary
      // Since Date comparison is by ms, we set validTill to 1ms before now
      const slightlyPast = new Date(Date.now() - 1);
      models.EmailRule.findActive.mockResolvedValue([makeRule({ validTill: slightlyPast.toISOString() })]);
      models.EmailTemplate.find.mockImplementation(() => ({ lean: vi.fn().mockResolvedValue([]) }));

      const config = createMockConfig();
      const { service } = createService(models, config);
      await service.runAllRules();

      expect(models.EmailRuleRunLog.create).toHaveBeenCalledWith(
        expect.objectContaining({
          rulesProcessed: 0,
          totalStats: { matched: 0, sent: 0, skipped: 0, skippedByThrottle: 0, errorCount: 0 },
        })
      );
    });

    it('includes rule with validFrom equal to exactly now (now < validFrom is false when equal)', async () => {
      const models = createMockModels();
      // Use a date slightly in the past to simulate "equal to or before now"
      const slightlyPast = new Date(Date.now() - 1);
      const config = createMockConfig({
        queryUsers: vi.fn().mockResolvedValue([makeUser()]),
      });

      const templateDoc = { _id: 'template-1', subjects: ['Hi'], bodies: ['<p>Hi</p>'] };
      models.EmailRule.findActive.mockResolvedValue([makeRule({ validFrom: slightlyPast.toISOString() })]);
      models.EmailTemplate.findById.mockResolvedValue(templateDoc);
      models.EmailTemplate.find.mockImplementation(() => ({ lean: vi.fn().mockResolvedValue([templateDoc]) }));
      models.EmailRuleSend.find.mockImplementation(() => createChainableMock([]));

      const { service } = createService(models, config);
      await service.runAllRules();

      expect(models.EmailRuleRunLog.create).toHaveBeenCalledWith(
        expect.objectContaining({ rulesProcessed: 1 })
      );
    });
  });
});
