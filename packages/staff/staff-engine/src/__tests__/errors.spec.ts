import { describe, it, expect } from 'vitest';
import {
  AlxStaffError, AuthenticationError, AuthorizationError,
  RateLimitError, TokenError, StaffNotFoundError, DuplicateError,
  SetupError, LastOwnerError, InvalidPermissionError, InvalidConfigError,
  GroupNotFoundError,
} from '../errors/index.js';
import { ERROR_CODE } from '../constants/index.js';

describe('Error classes', () => {
  it('AlxStaffError has code and context', () => {
    const err = new AlxStaffError('test', 'CODE', { key: 'val' });
    expect(err.message).toBe('test');
    expect(err.code).toBe('CODE');
    expect(err.context).toEqual({ key: 'val' });
    expect(err.name).toBe('AlxStaffError');
  });

  it('AuthenticationError defaults to InvalidCredentials', () => {
    const err = new AuthenticationError();
    expect(err.code).toBe(ERROR_CODE.InvalidCredentials);
  });

  it('RateLimitError includes retryAfterMs', () => {
    const err = new RateLimitError(30000);
    expect(err.retryAfterMs).toBe(30000);
    expect(err.code).toBe(ERROR_CODE.RateLimited);
  });

  it('StaffNotFoundError includes staffId', () => {
    const err = new StaffNotFoundError('abc123');
    expect(err.staffId).toBe('abc123');
    expect(err.code).toBe(ERROR_CODE.StaffNotFound);
  });

  it('LastOwnerError includes staffId', () => {
    const err = new LastOwnerError('owner1');
    expect(err.staffId).toBe('owner1');
    expect(err.code).toBe(ERROR_CODE.LastOwnerGuard);
  });

  it('InvalidPermissionError includes missing keys', () => {
    const err = new InvalidPermissionError(['chat:view']);
    expect(err.missingViewKeys).toEqual(['chat:view']);
    expect(err.code).toBe(ERROR_CODE.InvalidPermissions);
  });

  it('InvalidConfigError includes field and reason', () => {
    const err = new InvalidConfigError('jwtSecret', 'must be a string');
    expect(err.field).toBe('jwtSecret');
    expect(err.reason).toBe('must be a string');
  });

  it('SetupError has correct code', () => {
    const err = new SetupError();
    expect(err.code).toBe(ERROR_CODE.SetupAlreadyComplete);
  });

  it('GroupNotFoundError includes groupId', () => {
    const err = new GroupNotFoundError('chat-mgmt');
    expect(err.groupId).toBe('chat-mgmt');
    expect(err.code).toBe(ERROR_CODE.GroupNotFound);
  });

  it('DuplicateError has custom code and context', () => {
    const err = new DuplicateError(ERROR_CODE.EmailExists, 'Email exists', { email: 'a@b.com' });
    expect(err.code).toBe(ERROR_CODE.EmailExists);
    expect(err.context).toEqual({ email: 'a@b.com' });
  });

  it('AuthorizationError defaults to InsufficientPermissions', () => {
    const err = new AuthorizationError();
    expect(err.code).toBe(ERROR_CODE.InsufficientPermissions);
  });

  it('TokenError defaults to TokenInvalid', () => {
    const err = new TokenError();
    expect(err.code).toBe(ERROR_CODE.TokenInvalid);
  });
});
