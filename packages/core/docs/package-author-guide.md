# Package Author Guide

Step-by-step guide for building a new `@astralibx/*` package on top of `@astralibx/core`.

## 1. Set up the package

Add `@astralibx/core` as a dependency:

```json
{
  "name": "@astralibx/queue",
  "dependencies": {
    "@astralibx/core": "workspace:*"
  }
}
```

## 2. Define package-specific errors

Create an error class that extends `AlxError`. This lets consumers catch your errors specifically or catch all @astralibx errors with a single `instanceof AlxError` check.

```ts
// src/errors.ts
import { AlxError } from '@astralibx/core';

export class QueueError extends AlxError {
  constructor(message: string, code = 'QUEUE_ERROR') {
    super(message, code);
    this.name = 'QueueError';
  }
}

export class JobTimeoutError extends QueueError {
  constructor(public readonly jobId: string) {
    super(`Job ${jobId} timed out`, 'JOB_TIMEOUT');
    this.name = 'JobTimeoutError';
  }
}
```

## 3. Define your config schema

Compose your schema from core Zod fragments plus package-specific fields. Use `createConfigValidator` to get a validation function.

```ts
// src/validation.ts
import { z } from 'zod';
import {
  baseDbSchema,
  baseRedisSchema,
  loggerSchema,
  createConfigValidator,
} from '@astralibx/core';

export const queueConfigSchema = z.object({
  db: baseDbSchema,
  redis: baseRedisSchema,
  logger: loggerSchema.optional(),
  concurrency: z.number().int().positive().default(5),
  maxRetries: z.number().int().min(0).default(3),
});

export type QueueConfig = z.infer<typeof queueConfigSchema>;
export const validateQueueConfig = createConfigValidator(queueConfigSchema);
```

## 4. Define your config type

Use the inferred Zod type or define an interface using core types:

```ts
// src/types.ts
import type { BaseDbConfig, BaseRedisConfig, LogAdapter } from '@astralibx/core';

export interface QueueConfig {
  db: BaseDbConfig;
  redis: BaseRedisConfig;
  logger?: LogAdapter;
  concurrency?: number;
  maxRetries?: number;
}
```

## 5. Validate config on init

Call your validator at the entry point so consumers get clear errors immediately.

```ts
// src/queue.ts
import type { LogAdapter } from '@astralibx/core';
import { validateQueueConfig, type QueueConfig } from './validation';
import { QueueError } from './errors';

export function createQueue(rawConfig: unknown) {
  validateQueueConfig(rawConfig);
  const config = rawConfig as QueueConfig;

  const log: LogAdapter = config.logger ?? {
    info: () => {},
    warn: () => {},
    error: () => {},
  };

  const prefix = config.db.collectionPrefix ?? 'alx_';
  const collection = config.db.connection.collection(`${prefix}jobs`);

  log.info('Queue initialized', { concurrency: config.concurrency });

  return {
    async add(job: unknown) {
      await collection.insertOne(job);
    },
    async process(handler: (job: unknown) => Promise<void>) {
      // processing logic...
    },
  };
}
```

## 6. Set up your barrel export

Re-export `LogAdapter` so consumers of your package don't need a direct dependency on `@astralibx/core` just for the type.

```ts
// src/index.ts
export type { LogAdapter } from '@astralibx/core';
export { QueueError, JobTimeoutError } from './errors';
export { createQueue } from './queue';
export type { QueueConfig } from './validation';
```

## 7. Write tests

Test validation, error types, and core functionality:

```ts
import { describe, it, expect } from 'vitest';
import { AlxError, ConfigValidationError } from '@astralibx/core';
import { createQueue } from './queue';
import { QueueError, JobTimeoutError } from './errors';

describe('QueueError', () => {
  it('is catchable as AlxError', () => {
    const err = new QueueError('fail');
    expect(err).toBeInstanceOf(AlxError);
    expect(err.code).toBe('QUEUE_ERROR');
  });

  it('JobTimeoutError carries jobId', () => {
    const err = new JobTimeoutError('abc-123');
    expect(err).toBeInstanceOf(QueueError);
    expect(err.jobId).toBe('abc-123');
    expect(err.code).toBe('JOB_TIMEOUT');
  });
});

describe('createQueue', () => {
  it('throws ConfigValidationError on invalid config', () => {
    expect(() => createQueue({})).toThrow(ConfigValidationError);
  });

  it('throws ConfigValidationError with field path', () => {
    try {
      createQueue({ db: { connection: null } });
    } catch (err) {
      expect(err).toBeInstanceOf(ConfigValidationError);
      expect((err as ConfigValidationError).field).toBe('db.connection');
    }
  });
});
```

## Checklist

- [ ] Package error class extends `AlxError`
- [ ] Config schema composes core Zod fragments (`baseDbSchema`, `baseRedisSchema`, `loggerSchema`)
- [ ] Config validated at entry point using `createConfigValidator`
- [ ] `LogAdapter` re-exported from your package's barrel
- [ ] Tests verify error hierarchy and config validation
