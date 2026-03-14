import { describe, it, expectTypeOf } from 'vitest';
import type { LogAdapter, BaseDbConfig, BaseRedisConfig } from '../types';

describe('LogAdapter type', () => {
  it('should accept an object with info, warn, error methods', () => {
    const logger: LogAdapter = {
      info: (_msg: string, _meta?: Record<string, unknown>) => {},
      warn: (_msg: string, _meta?: Record<string, unknown>) => {},
      error: (_msg: string, _meta?: Record<string, unknown>) => {},
    };
    expectTypeOf(logger).toMatchTypeOf<LogAdapter>();
  });

  it('should require all three methods', () => {
    expectTypeOf<LogAdapter>().toHaveProperty('info');
    expectTypeOf<LogAdapter>().toHaveProperty('warn');
    expectTypeOf<LogAdapter>().toHaveProperty('error');
  });
});

describe('BaseDbConfig type', () => {
  it('should require connection and allow optional collectionPrefix', () => {
    expectTypeOf<BaseDbConfig>().toHaveProperty('connection');
    expectTypeOf<BaseDbConfig>().toHaveProperty('collectionPrefix');
  });

  it('should accept a config with only connection', () => {
    const config: BaseDbConfig = { connection: {} };
    expectTypeOf(config).toMatchTypeOf<BaseDbConfig>();
  });

  it('should accept a config with collectionPrefix', () => {
    const config: BaseDbConfig = { connection: {}, collectionPrefix: 'prefix_' };
    expectTypeOf(config).toMatchTypeOf<BaseDbConfig>();
  });
});

describe('BaseRedisConfig type', () => {
  it('should require connection and allow optional keyPrefix', () => {
    expectTypeOf<BaseRedisConfig>().toHaveProperty('connection');
    expectTypeOf<BaseRedisConfig>().toHaveProperty('keyPrefix');
  });

  it('should accept a config with only connection', () => {
    const config: BaseRedisConfig = { connection: {} };
    expectTypeOf(config).toMatchTypeOf<BaseRedisConfig>();
  });

  it('should accept a config with keyPrefix', () => {
    const config: BaseRedisConfig = { connection: {}, keyPrefix: 'app:' };
    expectTypeOf(config).toMatchTypeOf<BaseRedisConfig>();
  });
});
