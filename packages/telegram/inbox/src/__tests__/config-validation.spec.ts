import { describe, it, expect, vi } from 'vitest';
import { validateConfig } from '../validation/config.schema';
import { ConfigValidationError } from '../errors';

function createValidConfig() {
  return {
    accountManager: { getClient: vi.fn() },
    db: { connection: { model: vi.fn() } },
  };
}

describe('validateConfig', () => {
  it('passes with a valid minimal config', () => {
    expect(() => validateConfig(createValidConfig())).not.toThrow();
  });

  it('passes with all optional fields provided', () => {
    const config = {
      ...createValidConfig(),
      media: {
        uploadAdapter: vi.fn(),
        maxFileSizeMb: 25,
      },
      options: {
        historySyncLimit: 200,
        autoAttachOnConnect: true,
        typingTimeoutMs: 3000,
      },
      logger: { info: vi.fn(), warn: vi.fn(), error: vi.fn() },
      hooks: {
        onNewMessage: vi.fn(),
        onMessageRead: vi.fn(),
        onTyping: vi.fn(),
      },
    };
    expect(() => validateConfig(config)).not.toThrow();
  });

  describe('accountManager validation', () => {
    it('throws ConfigValidationError when accountManager is missing', () => {
      const config = createValidConfig();
      delete (config as any).accountManager;
      expect(() => validateConfig(config)).toThrow(ConfigValidationError);
    });

    it('throws when accountManager is null', () => {
      const config = createValidConfig();
      (config as any).accountManager = null;
      expect(() => validateConfig(config)).toThrow(ConfigValidationError);
    });
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

    it('allows media to be omitted', () => {
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
          historySyncLimit: 50,
        },
      };
      expect(() => validateConfig(config)).not.toThrow();
    });
  });

  describe('options validation', () => {
    it('throws when historySyncLimit is zero', () => {
      const config = {
        ...createValidConfig(),
        options: { historySyncLimit: 0 },
      };
      expect(() => validateConfig(config)).toThrow(ConfigValidationError);
    });

    it('throws when historySyncLimit is negative', () => {
      const config = {
        ...createValidConfig(),
        options: { historySyncLimit: -1 },
      };
      expect(() => validateConfig(config)).toThrow(ConfigValidationError);
    });

    it('throws when typingTimeoutMs is zero', () => {
      const config = {
        ...createValidConfig(),
        options: { typingTimeoutMs: 0 },
      };
      expect(() => validateConfig(config)).toThrow(ConfigValidationError);
    });

    it('throws when typingTimeoutMs is negative', () => {
      const config = {
        ...createValidConfig(),
        options: { typingTimeoutMs: -1 },
      };
      expect(() => validateConfig(config)).toThrow(ConfigValidationError);
    });
  });

  describe('media validation', () => {
    it('throws when maxFileSizeMb is zero', () => {
      const config = {
        ...createValidConfig(),
        media: { maxFileSizeMb: 0 },
      };
      expect(() => validateConfig(config)).toThrow(ConfigValidationError);
    });

    it('throws when maxFileSizeMb exceeds 500', () => {
      const config = {
        ...createValidConfig(),
        media: { maxFileSizeMb: 501 },
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
        expect(configErr.message).toContain('Invalid TelegramInboxConfig');
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
