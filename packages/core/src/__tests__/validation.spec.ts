import { describe, it, expect } from 'vitest';
import { z } from 'zod';
import { loggerSchema, baseDbSchema, baseRedisSchema, createConfigValidator } from '../validation';
import { ConfigValidationError } from '../errors';

describe('loggerSchema', () => {
  it('should accept a valid logger', () => {
    const logger = {
      info: () => {},
      warn: () => {},
      error: () => {},
    };
    expect(loggerSchema.safeParse(logger).success).toBe(true);
  });

  it('should reject a logger missing methods', () => {
    expect(loggerSchema.safeParse({ info: () => {} }).success).toBe(false);
  });

  it('should reject non-objects', () => {
    expect(loggerSchema.safeParse('string').success).toBe(false);
    expect(loggerSchema.safeParse(null).success).toBe(false);
  });
});

describe('baseDbSchema', () => {
  it('should accept valid db config', () => {
    const result = baseDbSchema.safeParse({ connection: {} });
    expect(result.success).toBe(true);
  });

  it('should accept db config with collectionPrefix', () => {
    const result = baseDbSchema.safeParse({ connection: {}, collectionPrefix: 'app_' });
    expect(result.success).toBe(true);
  });

  it('should reject null connection', () => {
    const result = baseDbSchema.safeParse({ connection: null });
    expect(result.success).toBe(false);
  });

  it('should reject undefined connection', () => {
    const result = baseDbSchema.safeParse({});
    expect(result.success).toBe(false);
  });
});

describe('baseRedisSchema', () => {
  it('should accept valid redis config', () => {
    const result = baseRedisSchema.safeParse({ connection: {} });
    expect(result.success).toBe(true);
  });

  it('should accept redis config with keyPrefix', () => {
    const result = baseRedisSchema.safeParse({ connection: {}, keyPrefix: 'myapp:' });
    expect(result.success).toBe(true);
  });

  it('should reject null connection', () => {
    const result = baseRedisSchema.safeParse({ connection: null });
    expect(result.success).toBe(false);
  });
});

describe('createConfigValidator', () => {
  const testSchema = z.object({
    db: baseDbSchema,
    name: z.string(),
  });

  const validate = createConfigValidator(testSchema);

  it('should pass for valid config', () => {
    expect(() => validate({ db: { connection: {} }, name: 'test' })).not.toThrow();
  });

  it('should throw ConfigValidationError for invalid config', () => {
    expect(() => validate({ db: { connection: null }, name: 123 })).toThrow(ConfigValidationError);
  });

  it('should include field path in the error', () => {
    try {
      validate({ db: { connection: {} } });
    } catch (e) {
      expect(e).toBeInstanceOf(ConfigValidationError);
      expect((e as ConfigValidationError).field).toBe('name');
    }
  });

  it('should format issues in the error message', () => {
    try {
      validate({});
    } catch (e) {
      expect((e as ConfigValidationError).message).toContain('Invalid config:');
    }
  });

  it('should accept a custom error class', () => {
    class CustomError extends ConfigValidationError {}
    const customValidate = createConfigValidator(testSchema, CustomError);
    expect(() => customValidate({})).toThrow(CustomError);
  });
});
