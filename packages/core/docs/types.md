# Type Contracts

Shared interfaces that keep @astralibx packages interoperable. Packages accept these types in their config so consumers can plug in any compatible implementation.

## LogAdapter

A logger-agnostic interface. Any object with `info`, `warn`, and `error` methods satisfies it, so consumers can use pino, winston, console, or anything else.

```ts
interface LogAdapter {
  info: (msg: string, meta?: Record<string, unknown>) => void;
  warn: (msg: string, meta?: Record<string, unknown>) => void;
  error: (msg: string, meta?: Record<string, unknown>) => void;
}
```

### Wrapping pino

```ts
import type { LogAdapter } from '@astralibx/core';
import pino from 'pino';

const raw = pino();

const logger: LogAdapter = {
  info: (msg, meta) => raw.info(meta, msg),
  warn: (msg, meta) => raw.warn(meta, msg),
  error: (msg, meta) => raw.error(meta, msg),
};
```

### Wrapping winston

```ts
import type { LogAdapter } from '@astralibx/core';
import winston from 'winston';

const raw = winston.createLogger({ /* ... */ });

const logger: LogAdapter = {
  info: (msg, meta) => raw.info(msg, meta),
  warn: (msg, meta) => raw.warn(msg, meta),
  error: (msg, meta) => raw.error(msg, meta),
};
```

### Using console

```ts
import type { LogAdapter } from '@astralibx/core';

const logger: LogAdapter = {
  info: (msg, meta) => console.log(msg, meta),
  warn: (msg, meta) => console.warn(msg, meta),
  error: (msg, meta) => console.error(msg, meta),
};
```

### Accepting LogAdapter in your package

```ts
import type { LogAdapter } from '@astralibx/core';

interface QueueConfig {
  logger?: LogAdapter;
}

function createQueue(config: QueueConfig) {
  const log = config.logger ?? {
    info: () => {},
    warn: () => {},
    error: () => {},
  };

  log.info('Queue initialized', { concurrency: 5 });
}
```

## BaseDbConfig

Standard shape for database connections across all packages.

```ts
interface BaseDbConfig {
  connection: any;          // Database client/connection (e.g. Mongoose Db, Knex instance)
  collectionPrefix?: string; // Optional prefix for collection/table names
}
```

### Example usage

```ts
import type { BaseDbConfig } from '@astralibx/core';

function init(db: BaseDbConfig) {
  const prefix = db.collectionPrefix ?? 'alx_';
  const collection = db.connection.collection(`${prefix}jobs`);
  // ...
}
```

## BaseRedisConfig

Standard shape for Redis connections.

```ts
interface BaseRedisConfig {
  connection: any;    // Redis client instance (e.g. ioredis, node-redis)
  keyPrefix?: string; // Optional prefix for all keys
}
```

### Example usage

```ts
import type { BaseRedisConfig } from '@astralibx/core';

function init(redis: BaseRedisConfig) {
  const prefix = redis.keyPrefix ?? 'alx:';

  async function set(key: string, value: string) {
    await redis.connection.set(`${prefix}${key}`, value);
  }

  return { set };
}
```

## Combining types in a package config

```ts
import type { BaseDbConfig, BaseRedisConfig, LogAdapter } from '@astralibx/core';

interface MyPackageConfig {
  db: BaseDbConfig;
  redis?: BaseRedisConfig;
  logger?: LogAdapter;
  retries?: number;
}
```
