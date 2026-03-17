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
      sendEmail: vi.fn(),
      selectAgent: vi.fn(),
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
      platforms: ['w1', 'w2'],
      audiences: ['customer', 'provider'],
      categories: ['onboarding'],
      logger: { info: vi.fn(), warn: vi.fn(), error: vi.fn() },
      options: {
        lockTTLMs: 30000,
        defaultMaxPerRun: 100,
        sendWindow: { startHour: 9, endHour: 18, timezone: 'Asia/Kolkata' },
        delayBetweenSendsMs: 500,
        jitterMs: 100,
      },
      hooks: {
        onRunStart: vi.fn(),
        onRuleStart: vi.fn(),
        onSend: vi.fn(),
        onRuleComplete: vi.fn(),
        onRunComplete: vi.fn(),
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

    it('throws when sendEmail adapter is missing', () => {
      const config = createValidConfig();
      delete (config as any).adapters.sendEmail;
      expect(() => validateConfig(config)).toThrow(ConfigValidationError);
    });

    it('throws when selectAgent adapter is missing', () => {
      const config = createValidConfig();
      delete (config as any).adapters.selectAgent;
      expect(() => validateConfig(config)).toThrow(ConfigValidationError);
    });

    it('throws when findIdentifier adapter is missing', () => {
      const config = createValidConfig();
      delete (config as any).adapters.findIdentifier;
      expect(() => validateConfig(config)).toThrow(ConfigValidationError);
    });

    it('allows optional sendTestEmail adapter', () => {
      const config = createValidConfig();
      expect(() => validateConfig(config)).not.toThrow();

      (config.adapters as any).sendTestEmail = vi.fn();
      expect(() => validateConfig(config)).not.toThrow();
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
        expect(configErr.message).toContain('Invalid EmailRuleEngineConfig');
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
