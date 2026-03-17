import { describe, it, expect, vi } from 'vitest';
import { validateConfig } from '../validation/config.schema';
import { ConfigValidationError } from '../errors';

function createValidConfig() {
  return {
    db: { connection: { model: vi.fn() } },
    redis: { connection: { set: vi.fn() } },
    adapters: {
      queryUsers: vi.fn(),
      resolveData: vi.fn(),
      sendMessage: vi.fn(),
      selectAccount: vi.fn(),
      findIdentifier: vi.fn(),
    },
  };
}

describe('validateConfig', () => {
  it('passes with a valid minimal config', () => {
    expect(() => validateConfig(createValidConfig())).not.toThrow();
  });

  it('passes with all optional fields provided', () => {
    const config = {
      ...createValidConfig(),
      platforms: ['telegram-web', 'telegram-desktop'],
      audiences: ['customer', 'provider'],
      categories: ['onboarding'],
      logger: { info: vi.fn(), warn: vi.fn(), error: vi.fn() },
      options: {
        lockTTLMs: 30000,
        defaultMaxPerRun: 100,
        sendWindow: { startHour: 9, endHour: 18, timezone: 'Asia/Kolkata' },
        delayBetweenSendsMs: 500,
        jitterMs: 100,
        maxConsecutiveFailures: 5,
        thinkingPauseProbability: 0.3,
        batchProgressInterval: 20,
      },
      hooks: {
        onRunStart: vi.fn(),
        onRuleStart: vi.fn(),
        onSend: vi.fn(),
        onRuleComplete: vi.fn(),
        onRunComplete: vi.fn(),
        beforeSend: vi.fn(),
      },
    };
    expect(() => validateConfig(config)).not.toThrow();
  });

  describe('db validation', () => {
    it('throws ConfigValidationError when db is missing', () => {
      const config = createValidConfig();
      delete (config as any).db;
      expect(() => validateConfig(config)).toThrow(ConfigValidationError);
    });

    it('throws when db.connection is null', () => {
      const config = createValidConfig();
      config.db.connection = null as any;
      expect(() => validateConfig(config)).toThrow(ConfigValidationError);
    });

    it('throws when db.connection is undefined', () => {
      const config = createValidConfig();
      config.db.connection = undefined as any;
      expect(() => validateConfig(config)).toThrow(ConfigValidationError);
    });
  });

  describe('redis validation', () => {
    it('throws when redis is missing', () => {
      const config = createValidConfig();
      delete (config as any).redis;
      expect(() => validateConfig(config)).toThrow(ConfigValidationError);
    });

    it('throws when redis.connection is null', () => {
      const config = createValidConfig();
      config.redis.connection = null as any;
      expect(() => validateConfig(config)).toThrow(ConfigValidationError);
    });
  });

  describe('adapters validation', () => {
    it('throws when adapters is missing', () => {
      const config = createValidConfig();
      delete (config as any).adapters;
      expect(() => validateConfig(config)).toThrow(ConfigValidationError);
    });

    it('throws when queryUsers adapter is missing', () => {
      const config = createValidConfig();
      delete (config as any).adapters.queryUsers;
      expect(() => validateConfig(config)).toThrow(ConfigValidationError);
    });

    it('throws when resolveData adapter is missing', () => {
      const config = createValidConfig();
      delete (config as any).adapters.resolveData;
      expect(() => validateConfig(config)).toThrow(ConfigValidationError);
    });

    it('throws when sendMessage adapter is missing', () => {
      const config = createValidConfig();
      delete (config as any).adapters.sendMessage;
      expect(() => validateConfig(config)).toThrow(ConfigValidationError);
    });

    it('throws when selectAccount adapter is missing', () => {
      const config = createValidConfig();
      delete (config as any).adapters.selectAccount;
      expect(() => validateConfig(config)).toThrow(ConfigValidationError);
    });

    it('throws when findIdentifier adapter is missing', () => {
      const config = createValidConfig();
      delete (config as any).adapters.findIdentifier;
      expect(() => validateConfig(config)).toThrow(ConfigValidationError);
    });

    it('throws when an adapter is not a function', () => {
      const config = createValidConfig();
      (config.adapters as any).sendMessage = 'not-a-function';
      expect(() => validateConfig(config)).toThrow(ConfigValidationError);
    });
  });

  describe('options validation', () => {
    it('allows options to be omitted entirely', () => {
      const config = createValidConfig();
      expect(() => validateConfig(config)).not.toThrow();
    });

    it('throws when lockTTLMs is a string', () => {
      const config = {
        ...createValidConfig(),
        options: { lockTTLMs: 'not-a-number' },
      };
      expect(() => validateConfig(config)).toThrow(ConfigValidationError);
    });

    it('throws when lockTTLMs is negative', () => {
      const config = {
        ...createValidConfig(),
        options: { lockTTLMs: -1 },
      };
      expect(() => validateConfig(config)).toThrow(ConfigValidationError);
    });

    it('throws when lockTTLMs is zero', () => {
      const config = {
        ...createValidConfig(),
        options: { lockTTLMs: 0 },
      };
      expect(() => validateConfig(config)).toThrow(ConfigValidationError);
    });

    it('throws when thinkingPauseProbability is greater than 1', () => {
      const config = {
        ...createValidConfig(),
        options: { thinkingPauseProbability: 1.5 },
      };
      expect(() => validateConfig(config)).toThrow(ConfigValidationError);
    });

    it('throws when thinkingPauseProbability is negative', () => {
      const config = {
        ...createValidConfig(),
        options: { thinkingPauseProbability: -0.1 },
      };
      expect(() => validateConfig(config)).toThrow(ConfigValidationError);
    });

    it('allows thinkingPauseProbability at 0', () => {
      const config = {
        ...createValidConfig(),
        options: { thinkingPauseProbability: 0 },
      };
      expect(() => validateConfig(config)).not.toThrow();
    });

    it('allows thinkingPauseProbability at 1', () => {
      const config = {
        ...createValidConfig(),
        options: { thinkingPauseProbability: 1 },
      };
      expect(() => validateConfig(config)).not.toThrow();
    });

    it('throws when defaultMaxPerRun is zero', () => {
      const config = {
        ...createValidConfig(),
        options: { defaultMaxPerRun: 0 },
      };
      expect(() => validateConfig(config)).toThrow(ConfigValidationError);
    });

    it('throws when delayBetweenSendsMs is negative', () => {
      const config = {
        ...createValidConfig(),
        options: { delayBetweenSendsMs: -100 },
      };
      expect(() => validateConfig(config)).toThrow(ConfigValidationError);
    });

    it('allows delayBetweenSendsMs at 0', () => {
      const config = {
        ...createValidConfig(),
        options: { delayBetweenSendsMs: 0 },
      };
      expect(() => validateConfig(config)).not.toThrow();
    });
  });

  describe('error message formatting', () => {
    it('includes field path in the error', () => {
      const config = createValidConfig();
      config.db.connection = null as any;

      try {
        validateConfig(config);
        expect.unreachable('should have thrown');
      } catch (err) {
        expect(err).toBeInstanceOf(ConfigValidationError);
        const configErr = err as ConfigValidationError;
        expect(configErr.message).toContain('Invalid TelegramRuleEngineConfig');
        expect(configErr.field).toBeTruthy();
      }
    });

    it('throws ConfigValidationError for completely invalid input', () => {
      expect(() => validateConfig(null)).toThrow(ConfigValidationError);
      expect(() => validateConfig(undefined)).toThrow(ConfigValidationError);
      expect(() => validateConfig('string')).toThrow(ConfigValidationError);
      expect(() => validateConfig(42)).toThrow(ConfigValidationError);
    });
  });
});
