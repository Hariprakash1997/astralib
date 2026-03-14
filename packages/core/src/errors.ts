export class AlxError extends Error {
  constructor(message: string, public readonly code: string) {
    super(message);
    this.name = 'AlxError';
    if (Error.captureStackTrace) {
      Error.captureStackTrace(this, this.constructor);
    }
  }
}

export class ConfigValidationError extends AlxError {
  constructor(message: string, public readonly field: string) {
    super(message, 'CONFIG_VALIDATION_ERROR');
    this.name = 'ConfigValidationError';
  }
}
