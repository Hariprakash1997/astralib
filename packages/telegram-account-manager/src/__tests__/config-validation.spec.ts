import { describe, it, expect, vi } from 'vitest';
import { validateConfig } from '../validation/config.schema';
import { ConfigValidationError } from '../errors';

function createValidConfig() {
  return {
    db: { connection: { model: vi.fn() } },
    credentials: {
      apiId: 12345,
      apiHash: 'abc123def456',
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
      logger: { info: vi.fn(), warn: vi.fn(), error: vi.fn() },
      options: {
        maxAccounts: 10,
        connectionTimeoutMs: 5000,
        healthCheckIntervalMs: 60000,
        autoReconnect: true,
        reconnectMaxRetries: 3,
        warmup: {
          enabled: true,
          defaultSchedule: [
            { days: [1, 7], dailyLimit: 10, delayMinMs: 1000, delayMaxMs: 5000 },
          ],
        },
        quarantine: {
          monitorIntervalMs: 60000,
          defaultDurationMs: 86400000,
        },
      },
      hooks: {
        onAccountConnected: vi.fn(),
        onAccountDisconnected: vi.fn(),
        onAccountQuarantined: vi.fn(),
        onAccountReleased: vi.fn(),
        onAccountBanned: vi.fn(),
        onHealthChange: vi.fn(),
        onWarmupComplete: vi.fn(),
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

  describe('credentials validation', () => {
    it('throws when credentials is missing', () => {
      const config = createValidConfig();
      delete (config as any).credentials;
      expect(() => validateConfig(config)).toThrow(ConfigValidationError);
    });

    it('throws when credentials.apiId is missing', () => {
      const config = createValidConfig();
      delete (config as any).credentials.apiId;
      expect(() => validateConfig(config)).toThrow(ConfigValidationError);
    });

    it('throws when credentials.apiHash is missing', () => {
      const config = createValidConfig();
      delete (config as any).credentials.apiHash;
      expect(() => validateConfig(config)).toThrow(ConfigValidationError);
    });

    it('throws when credentials.apiId is zero', () => {
      const config = createValidConfig();
      config.credentials.apiId = 0;
      expect(() => validateConfig(config)).toThrow(ConfigValidationError);
    });

    it('throws when credentials.apiId is negative', () => {
      const config = createValidConfig();
      config.credentials.apiId = -1;
      expect(() => validateConfig(config)).toThrow(ConfigValidationError);
    });

    it('throws when credentials.apiHash is empty string', () => {
      const config = createValidConfig();
      config.credentials.apiHash = '';
      expect(() => validateConfig(config)).toThrow(ConfigValidationError);
    });
  });

  describe('optional fields', () => {
    it('allows logger to be omitted', () => {
      const config = createValidConfig();
      expect(() => validateConfig(config)).not.toThrow();
    });

    it('allows options to be omitted entirely', () => {
      const config = createValidConfig();
      expect(() => validateConfig(config)).not.toThrow();
    });

    it('allows hooks to be omitted entirely', () => {
      const config = createValidConfig();
      expect(() => validateConfig(config)).not.toThrow();
    });

    it('allows db.collectionPrefix to be omitted', () => {
      const config = createValidConfig();
      expect(() => validateConfig(config)).not.toThrow();
    });

    it('accepts db.collectionPrefix when provided', () => {
      const config = {
        ...createValidConfig(),
        db: { connection: { model: vi.fn() }, collectionPrefix: 'tg_' },
      };
      expect(() => validateConfig(config)).not.toThrow();
    });

    it('accepts partial options', () => {
      const config = {
        ...createValidConfig(),
        options: {
          maxAccounts: 5,
        },
      };
      expect(() => validateConfig(config)).not.toThrow();
    });
  });

  describe('options validation', () => {
    it('throws when maxAccounts is zero', () => {
      const config = {
        ...createValidConfig(),
        options: { maxAccounts: 0 },
      };
      expect(() => validateConfig(config)).toThrow(ConfigValidationError);
    });

    it('throws when maxAccounts is negative', () => {
      const config = {
        ...createValidConfig(),
        options: { maxAccounts: -1 },
      };
      expect(() => validateConfig(config)).toThrow(ConfigValidationError);
    });

    it('throws when connectionTimeoutMs is zero', () => {
      const config = {
        ...createValidConfig(),
        options: { connectionTimeoutMs: 0 },
      };
      expect(() => validateConfig(config)).toThrow(ConfigValidationError);
    });

    it('throws when reconnectMaxRetries is negative', () => {
      const config = {
        ...createValidConfig(),
        options: { reconnectMaxRetries: -1 },
      };
      expect(() => validateConfig(config)).toThrow(ConfigValidationError);
    });

    it('accepts reconnectMaxRetries of zero', () => {
      const config = {
        ...createValidConfig(),
        options: { reconnectMaxRetries: 0 },
      };
      expect(() => validateConfig(config)).not.toThrow();
    });
  });

  describe('warmup schedule validation', () => {
    it('throws when warmup schedule is empty array', () => {
      const config = {
        ...createValidConfig(),
        options: {
          warmup: { defaultSchedule: [] },
        },
      };
      expect(() => validateConfig(config)).toThrow(ConfigValidationError);
    });

    it('throws when warmup phase has negative days', () => {
      const config = {
        ...createValidConfig(),
        options: {
          warmup: {
            defaultSchedule: [
              { days: [-1, 7], dailyLimit: 10, delayMinMs: 1000, delayMaxMs: 5000 },
            ],
          },
        },
      };
      expect(() => validateConfig(config)).toThrow(ConfigValidationError);
    });

    it('throws when warmup phase dailyLimit is zero', () => {
      const config = {
        ...createValidConfig(),
        options: {
          warmup: {
            defaultSchedule: [
              { days: [0, 7], dailyLimit: 0, delayMinMs: 1000, delayMaxMs: 5000 },
            ],
          },
        },
      };
      expect(() => validateConfig(config)).toThrow(ConfigValidationError);
    });

    it('throws when warmup phase dailyLimit is negative', () => {
      const config = {
        ...createValidConfig(),
        options: {
          warmup: {
            defaultSchedule: [
              { days: [0, 7], dailyLimit: -5, delayMinMs: 1000, delayMaxMs: 5000 },
            ],
          },
        },
      };
      expect(() => validateConfig(config)).toThrow(ConfigValidationError);
    });

    it('throws when delayMinMs is negative', () => {
      const config = {
        ...createValidConfig(),
        options: {
          warmup: {
            defaultSchedule: [
              { days: [0, 7], dailyLimit: 10, delayMinMs: -1, delayMaxMs: 5000 },
            ],
          },
        },
      };
      expect(() => validateConfig(config)).toThrow(ConfigValidationError);
    });

    it('allows delayMinMs of zero', () => {
      const config = {
        ...createValidConfig(),
        options: {
          warmup: {
            defaultSchedule: [
              { days: [0, 7], dailyLimit: 10, delayMinMs: 0, delayMaxMs: 5000 },
            ],
          },
        },
      };
      expect(() => validateConfig(config)).not.toThrow();
    });
  });

  describe('quarantine options validation', () => {
    it('throws when monitorIntervalMs is zero', () => {
      const config = {
        ...createValidConfig(),
        options: {
          quarantine: { monitorIntervalMs: 0 },
        },
      };
      expect(() => validateConfig(config)).toThrow(ConfigValidationError);
    });

    it('throws when defaultDurationMs is negative', () => {
      const config = {
        ...createValidConfig(),
        options: {
          quarantine: { defaultDurationMs: -1 },
        },
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
        expect(configErr.message).toContain('Invalid TelegramAccountManagerConfig');
        expect(configErr.field).toBeTruthy();
      }
    });

    it('throws ConfigValidationError for completely invalid input', () => {
      expect(() => validateConfig(null)).toThrow(ConfigValidationError);
      expect(() => validateConfig(undefined)).toThrow(ConfigValidationError);
      expect(() => validateConfig('string')).toThrow(ConfigValidationError);
      expect(() => validateConfig(42)).toThrow(ConfigValidationError);
    });

    it('throws ConfigValidationError for empty object', () => {
      expect(() => validateConfig({})).toThrow(ConfigValidationError);
    });
  });
});
