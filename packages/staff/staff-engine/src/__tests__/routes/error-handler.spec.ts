import { describe, it, expect, vi, beforeEach } from 'vitest';
import { handleStaffError } from '../../utils/error-handler.js';
import {
  RateLimitError,
  AuthenticationError,
  TokenError,
  AuthorizationError,
  SetupError,
  StaffNotFoundError,
  GroupNotFoundError,
  DuplicateError,
  LastOwnerError,
  InvalidPermissionError,
  AlxStaffError,
} from '../../errors/index.js';
import { ERROR_CODE } from '../../constants/index.js';

function makeRes() {
  const res = {
    status: vi.fn().mockReturnThis(),
    json: vi.fn().mockReturnThis(),
    set: vi.fn().mockReturnThis(),
  };
  return res as unknown as import('express').Response;
}

const noopLogger = { info: vi.fn(), warn: vi.fn(), error: vi.fn() };

describe('handleStaffError', () => {
  let res: ReturnType<typeof makeRes>;

  beforeEach(() => {
    res = makeRes();
    vi.clearAllMocks();
  });

  it('maps RateLimitError to 429 with Retry-After header', () => {
    handleStaffError(res, new RateLimitError(5000), noopLogger);
    expect(res.set).toHaveBeenCalledWith('Retry-After', '5');
    expect(res.status).toHaveBeenCalledWith(429);
  });

  it('maps RateLimitError with partial second to rounded-up Retry-After', () => {
    handleStaffError(res, new RateLimitError(5001), noopLogger);
    expect(res.set).toHaveBeenCalledWith('Retry-After', '6');
  });

  it('maps AuthenticationError to 401', () => {
    handleStaffError(res, new AuthenticationError(), noopLogger);
    expect(res.status).toHaveBeenCalledWith(401);
  });

  it('maps TokenError to 401', () => {
    handleStaffError(res, new TokenError(), noopLogger);
    expect(res.status).toHaveBeenCalledWith(401);
  });

  it('maps AuthorizationError to 403', () => {
    handleStaffError(res, new AuthorizationError(), noopLogger);
    expect(res.status).toHaveBeenCalledWith(403);
  });

  it('maps SetupError to 403', () => {
    handleStaffError(res, new SetupError(), noopLogger);
    expect(res.status).toHaveBeenCalledWith(403);
  });

  it('maps StaffNotFoundError to 404', () => {
    handleStaffError(res, new StaffNotFoundError('abc'), noopLogger);
    expect(res.status).toHaveBeenCalledWith(404);
  });

  it('maps GroupNotFoundError to 404', () => {
    handleStaffError(res, new GroupNotFoundError('grp1'), noopLogger);
    expect(res.status).toHaveBeenCalledWith(404);
  });

  it('maps DuplicateError to 409', () => {
    handleStaffError(res, new DuplicateError(ERROR_CODE.EmailInUse, 'email in use'), noopLogger);
    expect(res.status).toHaveBeenCalledWith(409);
  });

  it('maps LastOwnerError to 400', () => {
    handleStaffError(res, new LastOwnerError('staff-1'), noopLogger);
    expect(res.status).toHaveBeenCalledWith(400);
  });

  it('maps InvalidPermissionError to 400', () => {
    handleStaffError(res, new InvalidPermissionError(['module:view']), noopLogger);
    expect(res.status).toHaveBeenCalledWith(400);
  });

  it('maps generic AlxStaffError to 400', () => {
    handleStaffError(res, new AlxStaffError('something', 'SOME_CODE'), noopLogger);
    expect(res.status).toHaveBeenCalledWith(400);
  });

  it('maps unknown Error to 500', () => {
    handleStaffError(res, new Error('boom'), noopLogger);
    expect(res.status).toHaveBeenCalledWith(500);
    expect(noopLogger.error).toHaveBeenCalled();
  });

  it('maps non-Error unknown to 500', () => {
    handleStaffError(res, 'string error', noopLogger);
    expect(res.status).toHaveBeenCalledWith(500);
  });
});
