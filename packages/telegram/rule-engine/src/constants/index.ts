import type { ThrottleConfig } from '../types/throttle.types';

// Re-export core constants that telegram consumers may need
export {
  TEMPLATE_CATEGORY,
  TEMPLATE_AUDIENCE,
  RULE_OPERATOR,
  SEND_STATUS,
  TARGET_MODE,
  RUN_TRIGGER,
  RUN_LOG_STATUS,
} from '@astralibx/rule-engine';

// Telegram-specific constants
export const DEFAULT_THROTTLE_TTL_SECONDS = 604800; // 7 days
export const DEFAULT_THINKING_PAUSE_PROBABILITY = 0.25;
export const DEFAULT_HEALTH_DELAY_MULTIPLIER = 3;
export const DEFAULT_MAX_CONSECUTIVE_FAILURES = 3;
export const DEFAULT_BATCH_PROGRESS_INTERVAL = 10;

// Keep the existing defaults that core also has (for reference/override)
export const DEFAULT_LOCK_TTL_MS = 1_800_000;
export const DEFAULT_MAX_PER_RUN = 100;
export const DEFAULT_DELAY_BETWEEN_SENDS_MS = 3_000;
export const DEFAULT_JITTER_MS = 1_500;
export const REDIS_KEY_PREFIX = 'tg-rule-engine';
export const RUN_PROGRESS_TTL_SECONDS = 3_600;
export const MESSAGE_PREVIEW_LENGTH = 200;
export const DEFAULT_THROTTLE_CONFIG: ThrottleConfig = {
  maxPerUserPerDay: 1,
  maxPerUserPerWeek: 2,
  minGapDays: 3,
  throttleWindow: 'rolling',
};
