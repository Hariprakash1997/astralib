import { describe, it, expect } from 'vitest';
import { validateConfig } from '../validation/config.schema';
import { ConfigValidationError } from '../errors';

describe('validateConfig', () => {
  const validConfig = {
    db: { connection: {} },
  };

  it('should accept a valid minimal config', () => {
    expect(() => validateConfig(validConfig)).not.toThrow();
  });

  it('should accept config with all optional fields', () => {
    const full = {
      db: { connection: {}, collectionPrefix: 'analytics_' },
      logger: {
        info: () => {},
        warn: () => {},
        error: () => {},
      },
      options: {
        eventTTLDays: 90,
        timezone: 'Asia/Kolkata',
        aggregationSchedule: ['daily', 'weekly'],
      },
    };
    expect(() => validateConfig(full)).not.toThrow();
  });

  it('should accept config with only db.connection and options', () => {
    const config = {
      db: { connection: {} },
      options: { eventTTLDays: 30 },
    };
    expect(() => validateConfig(config)).not.toThrow();
  });

  it('should throw ConfigValidationError when db is missing', () => {
    expect(() => validateConfig({})).toThrow(ConfigValidationError);
  });

  it('should throw ConfigValidationError when db.connection is null', () => {
    expect(() => validateConfig({ db: { connection: null } })).toThrow(ConfigValidationError);
  });

  it('should throw ConfigValidationError when db.connection is undefined', () => {
    expect(() => validateConfig({ db: {} })).toThrow(ConfigValidationError);
  });

  it('should throw when config is null', () => {
    expect(() => validateConfig(null)).toThrow();
  });

  it('should throw when config is a string', () => {
    expect(() => validateConfig('invalid')).toThrow();
  });

  it('should throw when options.eventTTLDays is negative', () => {
    expect(() =>
      validateConfig({
        db: { connection: {} },
        options: { eventTTLDays: -1 },
      }),
    ).toThrow(ConfigValidationError);
  });

  it('should throw when options.eventTTLDays is not an integer', () => {
    expect(() =>
      validateConfig({
        db: { connection: {} },
        options: { eventTTLDays: 1.5 },
      }),
    ).toThrow(ConfigValidationError);
  });

  it('should throw when aggregationSchedule has invalid value', () => {
    expect(() =>
      validateConfig({
        db: { connection: {} },
        options: { aggregationSchedule: ['hourly'] },
      }),
    ).toThrow(ConfigValidationError);
  });

  it('should include field path in error message', () => {
    try {
      validateConfig({ db: { connection: null } });
    } catch (e) {
      expect(e).toBeInstanceOf(ConfigValidationError);
      expect((e as ConfigValidationError).message).toContain('Invalid EmailAnalyticsConfig');
    }
  });

  it('should accept empty options object', () => {
    expect(() =>
      validateConfig({
        db: { connection: {} },
        options: {},
      }),
    ).not.toThrow();
  });
});
