export { AlxError, ConfigValidationError } from './errors';
export type { LogAdapter, BaseDbConfig, BaseRedisConfig } from './types';
export { loggerSchema, baseDbSchema, baseRedisSchema, createConfigValidator } from './validation';

// ── Shared utilities ──────────────────────────────────────────────────
import type { LogAdapter } from './types';

export const noopLogger: LogAdapter = { info: () => {}, warn: () => {}, error: () => {} };

export { RedisLock } from './utils/redis-lock';
export { getParam, getQueryString } from './utils/express-helpers';
export { sendSuccess, sendError } from './utils/response';
