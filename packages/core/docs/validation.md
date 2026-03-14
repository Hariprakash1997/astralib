# Validation

Zod schemas and a config validator factory. Use these to validate package config at runtime and throw structured errors on invalid input.

## Zod Schemas

Core provides three schemas that match the type contracts. Use them as building blocks when composing your package's config schema.

### loggerSchema

Validates that an object has `info`, `warn`, and `error` functions (matches `LogAdapter`).

```ts
import { loggerSchema } from '@astralibx/core';

loggerSchema.parse(console); // passes -- console has info, warn, error
loggerSchema.parse({});       // throws -- missing required functions
```

### baseDbSchema

Validates `BaseDbConfig`. Requires `connection` to be non-null. `collectionPrefix` is optional.

```ts
import { baseDbSchema } from '@astralibx/core';

baseDbSchema.parse({ connection: mongoClient.db() });           // passes
baseDbSchema.parse({ connection: null });                        // throws -- connection required
baseDbSchema.parse({ connection: db, collectionPrefix: 'app_' }); // passes
```

### baseRedisSchema

Validates `BaseRedisConfig`. Requires `connection` to be non-null. `keyPrefix` is optional.

```ts
import { baseRedisSchema } from '@astralibx/core';

baseRedisSchema.parse({ connection: redisClient });              // passes
baseRedisSchema.parse({ connection: null });                      // throws -- connection required
baseRedisSchema.parse({ connection: redis, keyPrefix: 'app:' }); // passes
```

## createConfigValidator

Factory that takes a Zod schema and returns a validation function. The returned function throws `ConfigValidationError` on invalid input, with all issues formatted in the error message.

**Signature:**

```ts
function createConfigValidator(
  schema: ZodSchema,
  ErrorClass?: typeof ConfigValidationError,
): (raw: unknown) => void;
```

**Parameters:**

| Parameter    | Type                              | Default                  | Description                        |
| ------------ | --------------------------------- | ------------------------ | ---------------------------------- |
| `schema`     | `ZodSchema`                       | --                       | The Zod schema to validate against |
| `ErrorClass` | `typeof ConfigValidationError`    | `ConfigValidationError`  | Custom error class to throw        |

### Basic usage

```ts
import { z } from 'zod';
import { createConfigValidator, baseDbSchema } from '@astralibx/core';

const schema = z.object({
  db: baseDbSchema,
  retries: z.number().int().min(0).default(3),
});

const validate = createConfigValidator(schema);

// Valid config -- no error
validate({ db: { connection: mongoClient.db() }, retries: 5 });

// Invalid config -- throws ConfigValidationError
validate({ db: { connection: null }, retries: -1 });
// ConfigValidationError: Invalid config:
//   db.connection: db.connection is required
//   retries: Number must be greater than or equal to 0
```

### Catching validation errors

```ts
import { ConfigValidationError } from '@astralibx/core';

try {
  validate(rawConfig);
} catch (err) {
  if (err instanceof ConfigValidationError) {
    console.log(err.field);   // first invalid field path, e.g. "db.connection"
    console.log(err.message); // formatted message with all issues
  }
}
```

### Custom error class

If your package has its own error hierarchy, pass a custom error class that extends `ConfigValidationError`:

```ts
import { ConfigValidationError, createConfigValidator } from '@astralibx/core';

class QueueConfigError extends ConfigValidationError {
  constructor(message: string, field: string) {
    super(message, field);
    this.name = 'QueueConfigError';
  }
}

const validate = createConfigValidator(queueConfigSchema, QueueConfigError);

// Now throws QueueConfigError instead of ConfigValidationError
```

## Composing Schemas

Build your package's config schema by combining core schemas with package-specific fields.

```ts
import { z } from 'zod';
import {
  baseDbSchema,
  baseRedisSchema,
  loggerSchema,
  createConfigValidator,
} from '@astralibx/core';

const queueConfigSchema = z.object({
  db: baseDbSchema,
  redis: baseRedisSchema,
  logger: loggerSchema.optional(),
  concurrency: z.number().int().positive().default(5),
  maxRetries: z.number().int().min(0).default(3),
  retryDelay: z.number().positive().default(1000),
});

export type QueueConfig = z.infer<typeof queueConfigSchema>;
export const validateQueueConfig = createConfigValidator(queueConfigSchema);
```

### Extending a core schema

Use `.extend()` to add fields to a core schema:

```ts
import { z } from 'zod';
import { baseDbSchema } from '@astralibx/core';

const extendedDbSchema = baseDbSchema.extend({
  poolSize: z.number().int().positive().default(10),
  timeout: z.number().positive().default(5000),
});
```
