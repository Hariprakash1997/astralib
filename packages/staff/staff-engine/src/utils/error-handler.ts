import type { Response } from 'express';
import type { LogAdapter } from '@astralibx/staff-types';
import { sendSuccess, sendError } from '@astralibx/core';
import {
  AlxStaffError, AuthenticationError, AuthorizationError,
  RateLimitError, TokenError, StaffNotFoundError, DuplicateError,
  SetupError, LastOwnerError, InvalidPermissionError, GroupNotFoundError,
} from '../errors/index.js';

export { sendSuccess };

function sendStaffError(res: Response, error: AlxStaffError, status: number): void {
  res.status(status).json({ success: false, error: error.message, code: error.code });
}

export function handleStaffError(res: Response, error: unknown, logger: LogAdapter): void {
  if (error instanceof RateLimitError) {
    res.set('Retry-After', String(Math.ceil(error.retryAfterMs / 1000)));
    sendStaffError(res, error, 429);
  } else if (error instanceof AuthenticationError || error instanceof TokenError) {
    sendStaffError(res, error, 401);
  } else if (error instanceof AuthorizationError || error instanceof SetupError) {
    sendStaffError(res, error, 403);
  } else if (error instanceof StaffNotFoundError || error instanceof GroupNotFoundError) {
    sendStaffError(res, error, 404);
  } else if (error instanceof DuplicateError) {
    sendStaffError(res, error, 409);
  } else if (error instanceof LastOwnerError || error instanceof InvalidPermissionError) {
    sendStaffError(res, error, 400);
  } else if (error instanceof AlxStaffError) {
    sendStaffError(res, error, 400);
  } else {
    const message = error instanceof Error ? error.message : 'Unknown error';
    logger.error('Unexpected error', { error: message });
    sendError(res, message, 500);
  }
}
