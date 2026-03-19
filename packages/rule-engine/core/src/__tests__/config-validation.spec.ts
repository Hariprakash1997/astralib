import { describe, it, expect, vi } from 'vitest';
import { validateConfig } from '../validation/config.validator';
import { ConfigValidationError } from '../errors';

function createValidConfig() {
  return {
    db: { connection: { model: vi.fn() } },
    redis: { connection: {} },
    adapters: {
      queryUsers: vi.fn(),
      resolveData: vi.fn(),
      send: vi.fn(),
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
      platforms: ['web', 'mobile'],
      audiences: ['customer', 'provider'],
      categories: ['onboarding'],
      logger: { info: vi.fn(), warn: vi.fn(), error: vi.fn() },
      options: { lockTTLMs: 30000 },
      hooks: { onRunStart: vi.fn(), onRunComplete: vi.fn() },
      collections: [],
    };
    expect(() => validateConfig(config)).not.toThrow();
  });

  describe('db validation', () => {
    it('throws ConfigValidationError when db is missing', () => {
      const config = createValidConfig();
      delete (config as any).db;
      expect(() => validateConfig(config)).toThrow(ConfigValidationError);
    });

    it('throws when db.connection has no model function', () => {
      const config = createValidConfig();
      (config as any).db.connection = {};
      expect(() => validateConfig(config)).toThrow(ConfigValidationError);
    });

    it('throws when db.connection is null', () => {
      const config = createValidConfig();
      (config as any).db.connection = null;
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
      (config as any).redis.connection = null;
      expect(() => validateConfig(config)).toThrow(ConfigValidationError);
    });
  });

  describe('adapters validation', () => {
    it('throws when adapters is missing', () => {
      const config = createValidConfig();
      delete (config as any).adapters;
      expect(() => validateConfig(config)).toThrow(ConfigValidationError);
    });

    it('throws when send adapter is missing', () => {
      const config = createValidConfig();
      delete (config as any).adapters.send;
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

    it('allows optional sendTest adapter', () => {
      const config = createValidConfig();
      (config.adapters as any).sendTest = vi.fn();
      expect(() => validateConfig(config)).not.toThrow();
    });
  });

  describe('optional fields', () => {
    it('does not throw when platforms is omitted', () => {
      expect(() => validateConfig(createValidConfig())).not.toThrow();
    });

    it('does not throw when audiences is omitted', () => {
      expect(() => validateConfig(createValidConfig())).not.toThrow();
    });

    it('does not throw when categories is omitted', () => {
      expect(() => validateConfig(createValidConfig())).not.toThrow();
    });

    it('does not throw when logger is omitted', () => {
      expect(() => validateConfig(createValidConfig())).not.toThrow();
    });

    it('does not throw when options is omitted', () => {
      expect(() => validateConfig(createValidConfig())).not.toThrow();
    });

    it('does not throw when hooks is omitted', () => {
      expect(() => validateConfig(createValidConfig())).not.toThrow();
    });

    it('does not throw when collections is omitted', () => {
      expect(() => validateConfig(createValidConfig())).not.toThrow();
    });
  });

  describe('error properties', () => {
    it('error has a field property', () => {
      const config = createValidConfig();
      delete (config as any).db;

      try {
        validateConfig(config);
        expect.unreachable('should have thrown');
      } catch (err) {
        expect(err).toBeInstanceOf(ConfigValidationError);
        const configErr = err as ConfigValidationError;
        expect(configErr.field).toBeDefined();
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
