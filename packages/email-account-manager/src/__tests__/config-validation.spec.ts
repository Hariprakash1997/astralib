import { describe, it, expect, vi } from 'vitest';
import { validateConfig } from '../validation/config.schema';
import { ConfigValidationError } from '../errors';

function createValidConfig() {
  return {
    db: { connection: { model: vi.fn() } },
    redis: { connection: { set: vi.fn() } },
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
        warmup: {
          defaultSchedule: [
            { days: [0, 7], dailyLimit: 10, delayMinMs: 1000, delayMaxMs: 5000 },
          ],
        },
        healthDefaults: {
          minScore: 50,
          maxBounceRate: 5,
          maxConsecutiveErrors: 3,
        },
        ses: {
          enabled: true,
          validateSignature: true,
          allowedTopicArns: ['arn:aws:sns:us-east-1:123456789:topic'],
        },
        unsubscribe: {
          builtin: {
            enabled: true,
            secret: 'my-secret-key',
            baseUrl: 'https://example.com/unsubscribe',
            tokenExpiryDays: 30,
          },
          generateUrl: vi.fn(),
        },
        queues: {
          sendQueueName: 'email-send',
          approvalQueueName: 'email-approval',
        },
      },
      hooks: {
        onAccountDisabled: vi.fn(),
        onWarmupComplete: vi.fn(),
        onHealthDegraded: vi.fn(),
        onSend: vi.fn(),
        onSendError: vi.fn(),
        onBounce: vi.fn(),
        onUnsubscribe: vi.fn(),
        onDelivery: vi.fn(),
        onComplaint: vi.fn(),
        onOpen: vi.fn(),
        onClick: vi.fn(),
        onDraftCreated: vi.fn(),
        onDraftApproved: vi.fn(),
        onDraftRejected: vi.fn(),
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

    it('throws when redis.connection is undefined', () => {
      const config = createValidConfig();
      config.redis.connection = undefined as any;
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

    it('allows redis.keyPrefix to be omitted', () => {
      const config = createValidConfig();
      expect(() => validateConfig(config)).not.toThrow();
    });

    it('accepts db.collectionPrefix when provided', () => {
      const config = {
        ...createValidConfig(),
        db: { connection: { model: vi.fn() }, collectionPrefix: 'alx_' },
      };
      expect(() => validateConfig(config)).not.toThrow();
    });

    it('accepts redis.keyPrefix when provided', () => {
      const config = {
        ...createValidConfig(),
        redis: { connection: { set: vi.fn() }, keyPrefix: 'alx:' },
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

  describe('health defaults validation', () => {
    it('throws when minScore exceeds 100', () => {
      const config = {
        ...createValidConfig(),
        options: {
          healthDefaults: { minScore: 101 },
        },
      };
      expect(() => validateConfig(config)).toThrow(ConfigValidationError);
    });

    it('throws when minScore is negative', () => {
      const config = {
        ...createValidConfig(),
        options: {
          healthDefaults: { minScore: -1 },
        },
      };
      expect(() => validateConfig(config)).toThrow(ConfigValidationError);
    });

    it('throws when maxBounceRate exceeds 100', () => {
      const config = {
        ...createValidConfig(),
        options: {
          healthDefaults: { maxBounceRate: 101 },
        },
      };
      expect(() => validateConfig(config)).toThrow(ConfigValidationError);
    });

    it('throws when maxConsecutiveErrors is zero', () => {
      const config = {
        ...createValidConfig(),
        options: {
          healthDefaults: { maxConsecutiveErrors: 0 },
        },
      };
      expect(() => validateConfig(config)).toThrow(ConfigValidationError);
    });

    it('throws when maxConsecutiveErrors is negative', () => {
      const config = {
        ...createValidConfig(),
        options: {
          healthDefaults: { maxConsecutiveErrors: -1 },
        },
      };
      expect(() => validateConfig(config)).toThrow(ConfigValidationError);
    });

    it('accepts valid health defaults at boundary values', () => {
      const config = {
        ...createValidConfig(),
        options: {
          healthDefaults: {
            minScore: 0,
            maxBounceRate: 0,
            maxConsecutiveErrors: 1,
          },
        },
      };
      expect(() => validateConfig(config)).not.toThrow();
    });

    it('accepts maxScore at 100', () => {
      const config = {
        ...createValidConfig(),
        options: {
          healthDefaults: { minScore: 100 },
        },
      };
      expect(() => validateConfig(config)).not.toThrow();
    });
  });

  describe('SES options validation', () => {
    it('throws when ses.enabled is not a boolean', () => {
      const config = {
        ...createValidConfig(),
        options: {
          ses: { enabled: 'yes' },
        },
      };
      expect(() => validateConfig(config)).toThrow(ConfigValidationError);
    });

    it('accepts SES with only required enabled field', () => {
      const config = {
        ...createValidConfig(),
        options: {
          ses: { enabled: false },
        },
      };
      expect(() => validateConfig(config)).not.toThrow();
    });
  });

  describe('unsubscribe options validation', () => {
    it('throws when builtin secret is empty string', () => {
      const config = {
        ...createValidConfig(),
        options: {
          unsubscribe: {
            builtin: {
              enabled: true,
              secret: '',
              baseUrl: 'https://example.com',
            },
          },
        },
      };
      expect(() => validateConfig(config)).toThrow(ConfigValidationError);
    });

    it('throws when builtin baseUrl is not a valid URL', () => {
      const config = {
        ...createValidConfig(),
        options: {
          unsubscribe: {
            builtin: {
              enabled: true,
              secret: 'my-secret',
              baseUrl: 'not-a-url',
            },
          },
        },
      };
      expect(() => validateConfig(config)).toThrow(ConfigValidationError);
    });

    it('throws when tokenExpiryDays is zero', () => {
      const config = {
        ...createValidConfig(),
        options: {
          unsubscribe: {
            builtin: {
              enabled: true,
              secret: 'my-secret',
              baseUrl: 'https://example.com',
              tokenExpiryDays: 0,
            },
          },
        },
      };
      expect(() => validateConfig(config)).toThrow(ConfigValidationError);
    });

    it('throws when tokenExpiryDays is negative', () => {
      const config = {
        ...createValidConfig(),
        options: {
          unsubscribe: {
            builtin: {
              enabled: true,
              secret: 'my-secret',
              baseUrl: 'https://example.com',
              tokenExpiryDays: -1,
            },
          },
        },
      };
      expect(() => validateConfig(config)).toThrow(ConfigValidationError);
    });

    it('accepts unsubscribe with only generateUrl', () => {
      const config = {
        ...createValidConfig(),
        options: {
          unsubscribe: {
            generateUrl: vi.fn(),
          },
        },
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
        expect(configErr.message).toContain('Invalid EmailAccountManagerConfig');
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
