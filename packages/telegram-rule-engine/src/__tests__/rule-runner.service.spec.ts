import { describe, it, expect, vi, beforeEach } from 'vitest';
import { RuleRunnerService } from '../services/rule-runner.service';

vi.mock('../utils/redis-lock', () => ({
  RedisLock: vi.fn().mockImplementation(() => ({
    acquire: vi.fn().mockResolvedValue(true),
    release: vi.fn().mockResolvedValue(undefined),
  })),
}));

vi.mock('../services/template-render.service', () => ({
  TemplateRenderService: vi.fn().mockImplementation(() => ({
    compile: vi.fn().mockReturnValue({
      messageFns: [vi.fn().mockReturnValue('Rendered message')],
    }),
    render: vi.fn().mockReturnValue('Rendered message'),
    renderPreview: vi.fn().mockReturnValue('Preview'),
    extractVariables: vi.fn().mockReturnValue([]),
    validateTemplate: vi.fn().mockReturnValue({ valid: true, errors: [] }),
  })),
}));

function createMockModels() {
  return {
    TelegramRule: {
      findActive: vi.fn().mockResolvedValue([]),
      findByIdAndUpdate: vi.fn().mockResolvedValue(null),
    },
    TelegramTemplate: {
      findById: vi.fn().mockResolvedValue(null),
      find: vi.fn().mockImplementation(() => ({ lean: vi.fn().mockResolvedValue([]) })),
    },
    TelegramSendLog: {
      find: vi.fn().mockImplementation(() => ({ lean: vi.fn().mockResolvedValue([]) })),
      findOne: vi.fn().mockResolvedValue(null),
      create: vi.fn().mockResolvedValue(undefined),
    },
    TelegramRunLog: {
      create: vi.fn().mockResolvedValue(undefined),
    },
    TelegramThrottleConfig: {
      getConfig: vi.fn().mockResolvedValue({
        maxPerUserPerDay: 3,
        maxPerUserPerWeek: 10,
        minGapDays: 1,
      }),
    },
    TelegramErrorLog: {
      create: vi.fn().mockResolvedValue(undefined),
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
    db: { connection: {} as any },
    redis: { connection: createMockRedis() as any, keyPrefix: 'test:' },
    adapters: {
      queryUsers: vi.fn().mockResolvedValue([]),
      resolveData: vi.fn().mockImplementation((user: any) => user),
      sendMessage: vi.fn().mockResolvedValue(undefined),
      selectAccount: vi.fn().mockResolvedValue({ accountId: 'acc-1', phone: '+919876543210', metadata: { label: 'main' } }),
      findIdentifier: vi.fn().mockResolvedValue({ id: 'ident-1', contactId: 'contact-1' }),
      ...adapterOverrides,
    },
    logger: { info: vi.fn(), warn: vi.fn(), error: vi.fn() },
    options: {
      lockTTLMs: 30000,
      delayBetweenSendsMs: 0,
      jitterMs: 0,
      thinkingPauseProbability: 0,
      batchProgressInterval: 10,
      maxConsecutiveFailures: 3,
    },
    ...extraOverrides,
  };
}

function createService(models = createMockModels(), config = createMockConfig()) {
  return {
    service: new RuleRunnerService(
      models.TelegramRule as any,
      models.TelegramTemplate as any,
      models.TelegramSendLog as any,
      models.TelegramRunLog as any,
      models.TelegramThrottleConfig as any,
      models.TelegramErrorLog as any,
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
    target: { mode: 'query', conditions: { role: 'customer' } },
    ...overrides,
  };
}

function makeUser(overrides: Record<string, any> = {}) {
  return {
    _id: 'user-1',
    phone: '+919876543210',
    username: 'alice',
    name: 'Alice',
    ...overrides,
  };
}

describe('RuleRunnerService', () => {
  beforeEach(async () => {
    vi.clearAllMocks();
    // Always reset the RedisLock mock to default (acquire succeeds)
    const { RedisLock } = await import('../utils/redis-lock');
    (RedisLock as any).mockImplementation(() => ({
      acquire: vi.fn().mockResolvedValue(true),
      release: vi.fn().mockResolvedValue(undefined),
    }));
    // Always reset the TemplateRenderService mock
    const { TemplateRenderService } = await import('../services/template-render.service');
    (TemplateRenderService as any).mockImplementation(() => ({
      compile: vi.fn().mockReturnValue({
        messageFns: [vi.fn().mockReturnValue('Rendered message')],
      }),
      render: vi.fn().mockReturnValue('Rendered message'),
      renderPreview: vi.fn().mockReturnValue('Preview'),
      extractVariables: vi.fn().mockReturnValue([]),
      validateTemplate: vi.fn().mockReturnValue({ valid: true, errors: [] }),
    }));
  });

  describe('trigger', () => {
    it('returns a runId immediately', () => {
      const { service } = createService();
      const result = service.trigger('manual');
      expect(result.runId).toBeDefined();
      expect(typeof result.runId).toBe('string');
      expect(result.runId.length).toBeGreaterThan(0);
    });

    it('returns different runIds on each call', () => {
      const { service } = createService();
      const r1 = service.trigger();
      const r2 = service.trigger();
      expect(r1.runId).not.toBe(r2.runId);
    });
  });

  describe('runAllRules', () => {
    it('skips when lock cannot be acquired', async () => {
      const { RedisLock } = await import('../utils/redis-lock');
      (RedisLock as any).mockImplementation(() => ({
        acquire: vi.fn().mockResolvedValue(false),
        release: vi.fn().mockResolvedValue(undefined),
      }));

      const { service, models, config } = createService();
      await service.runAllRules('run-1');

      expect(models.TelegramRule.findActive).not.toHaveBeenCalled();
      expect(config.logger.warn).toHaveBeenCalledWith(expect.stringContaining('already executing'));

      (RedisLock as any).mockImplementation(() => ({
        acquire: vi.fn().mockResolvedValue(true),
        release: vi.fn().mockResolvedValue(undefined),
      }));
    });

    it('creates run log when no active rules', async () => {
      const { service, models } = createService();
      models.TelegramRule.findActive.mockResolvedValue([]);

      await service.runAllRules('run-1');

      expect(models.TelegramRunLog.create).toHaveBeenCalledWith(
        expect.objectContaining({
          runId: 'run-1',
          status: 'completed',
          stats: { sent: 0, failed: 0, skipped: 0, throttled: 0 },
        })
      );
    });

    it('skips run when outside send window', async () => {
      const config = createMockConfig({}, {
        options: {
          lockTTLMs: 30000,
          delayBetweenSendsMs: 0,
          jitterMs: 0,
          thinkingPauseProbability: 0,
          sendWindow: { startHour: 2, endHour: 3, timezone: 'UTC' },
        },
      });

      // Mock time to be outside window
      const originalDateTimeFormat = Intl.DateTimeFormat;
      vi.spyOn(Intl, 'DateTimeFormat').mockImplementation((...args: any[]) => {
        const opts = args[1] as any;
        if (opts?.hour === 'numeric') {
          return { format: () => '14' } as any;
        }
        return new originalDateTimeFormat(...(args as [any, any]));
      });

      const { service, models } = createService(undefined, config);
      await service.runAllRules('run-1');

      // Should not process rules when outside window
      expect(models.TelegramRule.findActive).not.toHaveBeenCalled();
      expect(config.logger.info).toHaveBeenCalledWith(
        expect.stringContaining('Outside send window'),
        expect.any(Object)
      );

      vi.restoreAllMocks();
    });

    it('processes query mode rules and sends messages', async () => {
      const models = createMockModels();
      const config = createMockConfig({
        queryUsers: vi.fn().mockResolvedValue([makeUser()]),
      });

      const templateDoc = {
        _id: 'template-1',
        messages: ['Hello {{name}}'],
        fields: {},
      };
      models.TelegramRule.findActive.mockResolvedValue([makeRule()]);
      models.TelegramTemplate.find.mockImplementation(() => ({
        lean: vi.fn().mockResolvedValue([templateDoc]),
      }));

      const { service } = createService(models, config);
      await service.runAllRules('run-1');

      expect(config.adapters.sendMessage).toHaveBeenCalled();
      expect(models.TelegramSendLog.create).toHaveBeenCalledWith(
        expect.objectContaining({
          deliveryStatus: 'sent',
        })
      );
    });

    it('processes list mode with dedup', async () => {
      const models = createMockModels();
      // '+91111' and '+91222' resolve to same ident-1, '+91333' resolves to ident-2
      // After raw dedup: 3 unique strings. After resolve dedup by id: 2 unique identifiers
      const config = createMockConfig({
        findIdentifier: vi.fn()
          .mockResolvedValueOnce({ id: 'ident-1', contactId: 'c-1' })
          .mockResolvedValueOnce({ id: 'ident-1', contactId: 'c-1' }) // same id as first — deduped
          .mockResolvedValueOnce({ id: 'ident-2', contactId: 'c-2' }),
      });

      const templateDoc = {
        _id: 'template-1',
        messages: ['Hello {{name}}'],
        fields: {},
      };
      models.TelegramRule.findActive.mockResolvedValue([
        makeRule({
          target: {
            mode: 'list',
            identifiers: ['+91111', '+91222', '+91333'],
          },
        }),
      ]);
      models.TelegramTemplate.find.mockImplementation(() => ({
        lean: vi.fn().mockResolvedValue([templateDoc]),
      }));

      const { service } = createService(models, config);
      await service.runAllRules('run-1');

      // findIdentifier called for all 3, but ident-1 appears twice so deduped to 2
      expect(config.adapters.findIdentifier).toHaveBeenCalledTimes(3);
      expect(config.adapters.sendMessage).toHaveBeenCalledTimes(2);
    });

    it('throttle check skips throttled users', async () => {
      const models = createMockModels();
      const config = createMockConfig({
        queryUsers: vi.fn().mockResolvedValue([makeUser()]),
      });

      const templateDoc = {
        _id: 'template-1',
        messages: ['Hello {{name}}'],
        fields: {},
      };
      models.TelegramRule.findActive.mockResolvedValue([makeRule()]);
      models.TelegramTemplate.find.mockImplementation(() => ({
        lean: vi.fn().mockResolvedValue([templateDoc]),
      }));

      // Set up throttle config with 0 daily limit
      models.TelegramThrottleConfig.getConfig.mockResolvedValue({
        maxPerUserPerDay: 0,
        maxPerUserPerWeek: 10,
        minGapDays: 0,
      });

      // Add recent send log so throttle map has data for the identifier
      models.TelegramSendLog.find.mockImplementation(() => ({
        lean: vi.fn().mockResolvedValue([{
          identifierId: 'ident-1',
          sentAt: new Date(),
        }]),
      }));

      const { service } = createService(models, config);
      await service.runAllRules('run-1');

      // Send should not have been called due to throttling
      expect(config.adapters.sendMessage).not.toHaveBeenCalled();
    });

    it('consecutive failures stops rule processing', async () => {
      const models = createMockModels();
      const sendError = new Error('Network error');
      (sendError as any).code = 'NETWORK_ERROR';

      const config = createMockConfig({
        queryUsers: vi.fn().mockResolvedValue([
          makeUser({ _id: 'u1', phone: '+91001' }),
          makeUser({ _id: 'u2', phone: '+91002' }),
          makeUser({ _id: 'u3', phone: '+91003' }),
          makeUser({ _id: 'u4', phone: '+91004' }),
        ]),
        sendMessage: vi.fn().mockRejectedValue(sendError),
        findIdentifier: vi.fn().mockImplementation((phone: string) => ({
          id: `ident-${phone}`,
          contactId: `contact-${phone}`,
        })),
      });

      config.options.maxConsecutiveFailures = 3;

      const templateDoc = {
        _id: 'template-1',
        messages: ['Hello {{name}}'],
        fields: {},
      };
      models.TelegramRule.findActive.mockResolvedValue([makeRule()]);
      models.TelegramTemplate.find.mockImplementation(() => ({
        lean: vi.fn().mockResolvedValue([templateDoc]),
      }));

      const { service } = createService(models, config);
      await service.runAllRules('run-1');

      // Should stop after 3 consecutive failures (not process 4th user)
      expect(config.adapters.sendMessage).toHaveBeenCalledTimes(3);
      expect(config.logger.warn).toHaveBeenCalledWith(
        expect.stringContaining('consecutive failures'),
      );
    });

    it('cancel flag stops execution', async () => {
      const models = createMockModels();
      const config = createMockConfig({
        queryUsers: vi.fn().mockResolvedValue([makeUser()]),
      });

      // Simulate cancel flag in Redis
      (config.redis.connection as any).exists.mockResolvedValue(1);

      const templateDoc = {
        _id: 'template-1',
        messages: ['Hello {{name}}'],
        fields: {},
      };
      models.TelegramRule.findActive.mockResolvedValue([makeRule(), makeRule({ _id: 'rule-2' })]);
      models.TelegramTemplate.find.mockImplementation(() => ({
        lean: vi.fn().mockResolvedValue([templateDoc]),
      }));

      const { service } = createService(models, config);
      const result = await service.runAllRules('run-1');

      expect(result.runId).toBe('run-1');
      // Should have checked cancel key and stopped
      expect(models.TelegramRunLog.create).toHaveBeenCalledWith(
        expect.objectContaining({
          status: 'cancelled',
        })
      );
    });

    it('progress tracking updates Redis', async () => {
      const models = createMockModels();
      const config = createMockConfig();
      models.TelegramRule.findActive.mockResolvedValue([]);

      const { service } = createService(models, config);
      await service.runAllRules('run-1');

      expect((config.redis.connection as any).hset).toHaveBeenCalled();
      expect((config.redis.connection as any).expire).toHaveBeenCalled();
    });
  });

  describe('hooks', () => {
    it('fires onRunStart hook', async () => {
      const onRunStart = vi.fn();
      const models = createMockModels();
      const config = createMockConfig({}, {
        hooks: { onRunStart },
      });
      models.TelegramRule.findActive.mockResolvedValue([]);

      const { service } = createService(models, config);
      await service.runAllRules('run-1');

      expect(onRunStart).toHaveBeenCalledWith(
        expect.objectContaining({
          rulesCount: 0,
          runId: 'run-1',
        })
      );
    });

    it('fires onRunComplete hook', async () => {
      const onRunComplete = vi.fn();
      const models = createMockModels();
      const config = createMockConfig({}, {
        hooks: { onRunComplete },
      });

      const templateDoc = {
        _id: 'template-1',
        messages: ['Hello {{name}}'],
        fields: {},
      };
      models.TelegramRule.findActive.mockResolvedValue([makeRule()]);
      models.TelegramTemplate.find.mockImplementation(() => ({
        lean: vi.fn().mockResolvedValue([templateDoc]),
      }));
      config.adapters.queryUsers.mockResolvedValue([makeUser()]);

      const { service } = createService(models, config);
      await service.runAllRules('run-1');

      expect(onRunComplete).toHaveBeenCalledWith(
        expect.objectContaining({
          runId: 'run-1',
          totalStats: expect.objectContaining({
            sent: expect.any(Number),
          }),
        })
      );
    });

    it('fires onSend hook after successful send', async () => {
      const onSend = vi.fn();
      const models = createMockModels();
      const config = createMockConfig({
        queryUsers: vi.fn().mockResolvedValue([makeUser()]),
      }, {
        hooks: { onSend },
      });

      const templateDoc = {
        _id: 'template-1',
        messages: ['Hello {{name}}'],
        fields: {},
      };
      models.TelegramRule.findActive.mockResolvedValue([makeRule()]);
      models.TelegramTemplate.find.mockImplementation(() => ({
        lean: vi.fn().mockResolvedValue([templateDoc]),
      }));

      const { service } = createService(models, config);
      await service.runAllRules('run-1');

      expect(onSend).toHaveBeenCalledWith(
        expect.objectContaining({
          status: 'sent',
          ruleId: 'rule-1',
          runId: 'run-1',
        })
      );
    });

    it('beforeSend hook modifies message', async () => {
      const beforeSend = vi.fn().mockResolvedValue({
        message: 'Modified message',
        media: undefined,
      });
      const models = createMockModels();
      const config = createMockConfig({
        queryUsers: vi.fn().mockResolvedValue([makeUser()]),
      }, {
        hooks: { beforeSend },
      });

      const templateDoc = {
        _id: 'template-1',
        messages: ['Original {{name}}'],
        fields: {},
      };
      models.TelegramRule.findActive.mockResolvedValue([makeRule()]);
      models.TelegramTemplate.find.mockImplementation(() => ({
        lean: vi.fn().mockResolvedValue([templateDoc]),
      }));

      const { service } = createService(models, config);
      await service.runAllRules('run-1');

      expect(beforeSend).toHaveBeenCalled();
      expect(config.adapters.sendMessage).toHaveBeenCalledWith(
        expect.objectContaining({
          message: 'Modified message',
        })
      );
    });
  });

  describe('error categorization', () => {
    it('logs errors with categorization on send failure', async () => {
      const models = createMockModels();
      const sendError = new Error('Auth key expired');
      (sendError as any).code = 'AUTH_KEY_UNREGISTERED';

      const config = createMockConfig({
        queryUsers: vi.fn().mockResolvedValue([makeUser()]),
        sendMessage: vi.fn().mockRejectedValue(sendError),
      });
      config.options.maxConsecutiveFailures = 5;

      const templateDoc = {
        _id: 'template-1',
        messages: ['Hello {{name}}'],
        fields: {},
      };
      models.TelegramRule.findActive.mockResolvedValue([makeRule()]);
      models.TelegramTemplate.find.mockImplementation(() => ({
        lean: vi.fn().mockResolvedValue([templateDoc]),
      }));

      const { service } = createService(models, config);
      await service.runAllRules('run-1');

      expect(models.TelegramSendLog.create).toHaveBeenCalledWith(
        expect.objectContaining({
          deliveryStatus: 'failed',
          errorInfo: expect.objectContaining({
            code: 'AUTH_KEY_UNREGISTERED',
            category: 'critical',
          }),
        })
      );

      expect(models.TelegramErrorLog.create).toHaveBeenCalledWith(
        expect.objectContaining({
          errorCode: 'AUTH_KEY_UNREGISTERED',
          errorCategory: 'critical',
        })
      );
    });
  });

  describe('getStatus', () => {
    it('returns null when no progress data exists', async () => {
      const config = createMockConfig();
      (config.redis.connection as any).hgetall.mockResolvedValue({});

      const { service } = createService(undefined, config);
      const status = await service.getStatus('run-1');

      expect(status).toBeNull();
    });

    it('returns status data when progress exists', async () => {
      const config = createMockConfig();
      (config.redis.connection as any).hgetall.mockResolvedValue({
        runId: 'run-1',
        status: 'running',
        currentRule: 'Test Rule',
        progress: JSON.stringify({ rulesTotal: 2, rulesCompleted: 1, sent: 5, failed: 0, skipped: 1, throttled: 0 }),
        startedAt: '2025-01-01T00:00:00Z',
        elapsed: '5000',
      });

      const { service } = createService(undefined, config);
      const status = await service.getStatus('run-1');

      expect(status).not.toBeNull();
      expect(status!.runId).toBe('run-1');
      expect(status!.status).toBe('running');
      expect(status!.currentRule).toBe('Test Rule');
      expect(status!.progress.sent).toBe(5);
      expect(status!.elapsed).toBe(5000);
    });
  });

  describe('cancel', () => {
    it('returns ok:false when run does not exist', async () => {
      const config = createMockConfig();
      (config.redis.connection as any).exists.mockResolvedValue(0);

      const { service } = createService(undefined, config);
      const result = await service.cancel('run-1');

      expect(result.ok).toBe(false);
    });

    it('sets cancel key when run exists', async () => {
      const config = createMockConfig();
      (config.redis.connection as any).exists.mockResolvedValue(1);

      const { service } = createService(undefined, config);
      const result = await service.cancel('run-1');

      expect(result.ok).toBe(true);
      expect((config.redis.connection as any).set).toHaveBeenCalledWith(
        'test:run:run-1:cancel',
        '1',
        'EX',
        3600
      );
    });
  });

  describe('buildThrottleMap', () => {
    it('builds throttle map from recent sends', () => {
      const { service } = createService();
      const now = new Date();
      const recentSends = [
        { identifierId: 'id-1', sentAt: now },
        { identifierId: 'id-1', sentAt: new Date(now.getTime() - 3600000) },
        { identifierId: 'id-2', sentAt: now },
      ];

      const map = service.buildThrottleMap(recentSends);

      expect(map.get('id-1')).toBeDefined();
      expect(map.get('id-1')!.thisWeek).toBe(2);
      expect(map.get('id-2')).toBeDefined();
      expect(map.get('id-2')!.thisWeek).toBe(1);
    });

    it('returns empty map for no sends', () => {
      const { service } = createService();
      const map = service.buildThrottleMap([]);
      expect(map.size).toBe(0);
    });

    it('skips entries without identifierId', () => {
      const { service } = createService();
      const map = service.buildThrottleMap([
        { identifierId: '', sentAt: new Date() },
        { sentAt: new Date() },
      ]);
      expect(map.size).toBe(0);
    });
  });
});
