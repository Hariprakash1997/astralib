export class AlxError extends Error {
  constructor(message: string, public readonly code: string) {
    super(message);
    Object.setPrototypeOf(this, new.target.prototype);
    this.name = 'AlxError';
    if (Error.captureStackTrace) {
      Error.captureStackTrace(this, this.constructor);
    }
  }
}

export class ConfigValidationError extends AlxError {
  constructor(message: string, public readonly field: string) {
    super(message, 'CONFIG_VALIDATION_ERROR');
    Object.setPrototypeOf(this, new.target.prototype);
    this.name = 'ConfigValidationError';
  }
}
