# @astralibx/core

Shared foundation for all @astralibx packages -- base errors, types, and validation helpers.

## Install

```bash
npm install @astralibx/core
```

`zod` is included as a dependency -- no need to install it separately.

## Quick Start

```ts
import { z } from 'zod';
import {
  AlxError,
  createConfigValidator,
  baseDbSchema,
  loggerSchema,
} from '@astralibx/core';

// 1. Extend AlxError for your package
class QueueError extends AlxError {
  constructor(message: string) {
    super(message, 'QUEUE_ERROR');
    this.name = 'QueueError';
  }
}

// 2. Compose a config schema from core fragments + your own fields
const queueConfigSchema = z.object({
  db: baseDbSchema,
  logger: loggerSchema.optional(),
  concurrency: z.number().int().positive().default(5),
});

// 3. Validate config -- throws ConfigValidationError on invalid input
const validate = createConfigValidator(queueConfigSchema);

validate({
  db: { connection: mongoClient.db() },
  concurrency: 10,
});
```

## What's Included

**Error classes**

- `AlxError` -- Base error for the ecosystem. Carries a `code` string.
- `ConfigValidationError` -- Thrown on invalid config. Adds a `field` property.

**Type contracts**

- `LogAdapter` -- Logger-agnostic interface (`info`, `warn`, `error` methods).
- `BaseDbConfig` -- Database connection + optional `collectionPrefix`.
- `BaseRedisConfig` -- Redis connection + optional `keyPrefix`.

**Zod schemas**

- `loggerSchema` -- Validates a `LogAdapter`-shaped object.
- `baseDbSchema` -- Validates `BaseDbConfig` (connection must be non-null).
- `baseRedisSchema` -- Validates `BaseRedisConfig` (connection must be non-null).

**Helpers**

- `createConfigValidator` -- Takes a Zod schema, returns a validate function that throws `ConfigValidationError` on failure.

## Documentation

- [Error Classes](https://github.com/Hariprakash1997/astralib/blob/main/packages/core/docs/errors.md) -- AlxError, ConfigValidationError, extending for your package
- [Type Contracts](https://github.com/Hariprakash1997/astralib/blob/main/packages/core/docs/types.md) -- LogAdapter, BaseDbConfig, BaseRedisConfig
- [Validation](https://github.com/Hariprakash1997/astralib/blob/main/packages/core/docs/validation.md) -- Zod schemas, createConfigValidator, composing schemas
- [Package Author Guide](https://github.com/Hariprakash1997/astralib/blob/main/packages/core/docs/package-author-guide.md) -- Building new @astralibx packages on top of core

## License

MIT
