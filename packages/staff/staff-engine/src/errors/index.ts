import { AlxError } from '@astralibx/core';
import { ERROR_CODE, ERROR_MESSAGE } from '../constants/index.js';

export class AlxStaffError extends AlxError {
  constructor(
    message: string,
    code: string,
    public readonly context?: Record<string, unknown>,
  ) {
    super(message, code);
    this.name = 'AlxStaffError';
  }
}

export class AuthenticationError extends AlxStaffError {
  constructor(code: string = ERROR_CODE.InvalidCredentials, message?: string) {
    super(message || ERROR_MESSAGE.InvalidCredentials, code);
    this.name = 'AuthenticationError';
  }
}

export class AuthorizationError extends AlxStaffError {
  constructor(code: string = ERROR_CODE.InsufficientPermissions, message?: string) {
    super(message || ERROR_MESSAGE.InsufficientPermissions, code);
    this.name = 'AuthorizationError';
  }
}

export class RateLimitError extends AlxStaffError {
  constructor(public readonly retryAfterMs: number) {
    super(ERROR_MESSAGE.RateLimited, ERROR_CODE.RateLimited, { retryAfterMs });
    this.name = 'RateLimitError';
  }
}

export class TokenError extends AlxStaffError {
  constructor(code: string = ERROR_CODE.TokenInvalid, message?: string) {
    super(message || ERROR_MESSAGE.TokenInvalid, code);
    this.name = 'TokenError';
  }
}

export class StaffNotFoundError extends AlxStaffError {
  constructor(public readonly staffId: string) {
    super(ERROR_MESSAGE.StaffNotFound, ERROR_CODE.StaffNotFound, { staffId });
    this.name = 'StaffNotFoundError';
  }
}

export class DuplicateError extends AlxStaffError {
  constructor(code: string, message: string, context?: Record<string, unknown>) {
    super(message, code, context);
    this.name = 'DuplicateError';
  }
}

export class SetupError extends AlxStaffError {
  constructor() {
    super(ERROR_MESSAGE.SetupAlreadyComplete, ERROR_CODE.SetupAlreadyComplete);
    this.name = 'SetupError';
  }
}

export class LastOwnerError extends AlxStaffError {
  constructor(public readonly staffId: string) {
    super(ERROR_MESSAGE.LastOwnerGuard, ERROR_CODE.LastOwnerGuard, { staffId });
    this.name = 'LastOwnerError';
  }
}

export class InvalidPermissionError extends AlxStaffError {
  constructor(public readonly missingViewKeys: string[]) {
    super(ERROR_MESSAGE.InvalidPermissions, ERROR_CODE.InvalidPermissions, { missingViewKeys });
    this.name = 'InvalidPermissionError';
  }
}

export class GroupNotFoundError extends AlxStaffError {
  constructor(public readonly groupId: string) {
    super(ERROR_MESSAGE.GroupNotFound, ERROR_CODE.GroupNotFound, { groupId });
    this.name = 'GroupNotFoundError';
  }
}

export class InvalidConfigError extends AlxStaffError {
  constructor(public readonly field: string, public readonly reason: string) {
    super(`Invalid config for "${field}": ${reason}`, ERROR_CODE.InvalidConfig, { field, reason });
    this.name = 'InvalidConfigError';
  }
}
