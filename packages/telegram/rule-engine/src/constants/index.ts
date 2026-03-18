import type { ThrottleConfig } from '../types/throttle.types';

export const DEFAULT_LOCK_TTL_MS = 1_800_000;
export const DEFAULT_MAX_PER_RUN = 100;
export const DEFAULT_DELAY_BETWEEN_SENDS_MS = 3_000;
export const DEFAULT_JITTER_MS = 1_500;
export const DEFAULT_MAX_CONSECUTIVE_FAILURES = 3;
export const DEFAULT_THINKING_PAUSE_PROBABILITY = 0.25;
export const DEFAULT_BATCH_PROGRESS_INTERVAL = 10;

export const DEFAULT_THROTTLE_CONFIG: ThrottleConfig = {
  maxPerUserPerDay: 1,
  maxPerUserPerWeek: 2,
  minGapDays: 3,
  throttleWindow: 'rolling',
};

export const DEFAULT_THROTTLE_TTL_SECONDS = 604800; // 7 days

export const REDIS_KEY_PREFIX = 'tg-rule-engine';
export const RUN_PROGRESS_TTL_SECONDS = 3600;
export const MESSAGE_PREVIEW_LENGTH = 200;
