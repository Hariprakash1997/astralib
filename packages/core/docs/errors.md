# Error Classes

Base error types for the @astralibx ecosystem. Every package extends these to provide consistent, catchable errors with machine-readable codes.

## AlxError

The root error class. All @astralibx errors inherit from it, so a single `instanceof AlxError` check catches any library error.

**Constructor:** `new AlxError(message: string, code: string)`

**Properties:**

| Property  | Type     | Description                          |
| --------- | -------- | ------------------------------------ |
| `message` | `string` | Human-readable error description     |
| `code`    | `string` | Machine-readable error code          |
| `name`    | `string` | Always `'AlxError'` (or subclass name) |

```ts
import { AlxError } from '@astralibx/core';

try {
  throw new AlxError('Something broke', 'GENERIC_ERROR');
} catch (err) {
  if (err instanceof AlxError) {
    console.log(err.code);    // "GENERIC_ERROR"
    console.log(err.message); // "Something broke"
  }
}
```

## ConfigValidationError

Extends `AlxError` with a `field` property that points to the invalid config path. Thrown automatically by `createConfigValidator` -- you rarely need to construct it yourself.

**Constructor:** `new ConfigValidationError(message: string, field: string)`

**Properties:**

| Property  | Type     | Description                              |
| --------- | -------- | ---------------------------------------- |
| `field`   | `string` | Dot-path to the invalid field (e.g. `"db.connection"`) |
| `code`    | `string` | Always `"CONFIG_VALIDATION_ERROR"`       |

```ts
import { ConfigValidationError } from '@astralibx/core';

try {
  validateMyConfig({ db: { connection: null } });
} catch (err) {
  if (err instanceof ConfigValidationError) {
    console.log(err.field); // "db.connection"
    console.log(err.code);  // "CONFIG_VALIDATION_ERROR"
  }
}
```

## Extending AlxError for Your Package

Every @astralibx package should define its own error class that extends `AlxError`. This gives consumers fine-grained `instanceof` checks while keeping everything catchable under the `AlxError` umbrella.

### Basic extension

```ts
import { AlxError } from '@astralibx/core';

export class QueueError extends AlxError {
  constructor(message: string, code = 'QUEUE_ERROR') {
    super(message, code);
    this.name = 'QueueError';
  }
}
```

### Multi-level error hierarchy

For packages with distinct failure modes, create specific subclasses:

```ts
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

export class JobNotFoundError extends QueueError {
  constructor(public readonly jobId: string) {
    super(`Job ${jobId} not found`, 'JOB_NOT_FOUND');
    this.name = 'JobNotFoundError';
  }
}
```

### Catching errors at different levels

```ts
import { AlxError } from '@astralibx/core';
import { QueueError, JobTimeoutError } from '@astralibx/queue';

try {
  await queue.process(job);
} catch (err) {
  if (err instanceof JobTimeoutError) {
    // Handle timeout specifically -- retry, alert, etc.
    console.log(`Timed out: ${err.jobId}`);
  } else if (err instanceof QueueError) {
    // Handle any queue error
    console.log(`Queue problem: ${err.code}`);
  } else if (err instanceof AlxError) {
    // Handle any @astralibx error
    console.log(`Library error: ${err.code}`);
  }
}
```
