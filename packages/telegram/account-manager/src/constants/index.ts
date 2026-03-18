import type { WarmupPhase } from '../types/config.types';

export const ACCOUNT_STATUS = {
  Connected: 'connected',
  Disconnected: 'disconnected',
  Error: 'error',
  Banned: 'banned',
  Quarantined: 'quarantined',
  Warmup: 'warmup',
} as const;

export type AccountStatus = (typeof ACCOUNT_STATUS)[keyof typeof ACCOUNT_STATUS];

export const IDENTIFIER_STATUS = {
  Active: 'active',
  Blocked: 'blocked',
  PrivacyBlocked: 'privacy_blocked',
  Inactive: 'inactive',
  Invalid: 'invalid',
} as const;

export type IdentifierStatus = (typeof IDENTIFIER_STATUS)[keyof typeof IDENTIFIER_STATUS];

export const DEFAULT_HEALTH_SCORE = 100;
export const MIN_HEALTH_SCORE = 0;
export const MAX_HEALTH_SCORE = 100;
export const DEFAULT_DAILY_LIMIT = 40;

export const DEFAULT_WARMUP_SCHEDULE: WarmupPhase[] = [
  { days: [1, 3], dailyLimit: 10, delayMinMs: 60000, delayMaxMs: 120000 },
  { days: [4, 7], dailyLimit: 25, delayMinMs: 45000, delayMaxMs: 90000 },
  { days: [8, 14], dailyLimit: 50, delayMinMs: 30000, delayMaxMs: 60000 },
  { days: [15, 0], dailyLimit: 100, delayMinMs: 15000, delayMaxMs: 45000 },
];

export const DEFAULT_WARMUP_ADVANCE_INTERVAL_MS = 86400000; // 24 hours
export const DEFAULT_CONNECTION_TIMEOUT_MS = 30000;
export const DEFAULT_HEALTH_CHECK_INTERVAL_MS = 300000;
export const DEFAULT_QUARANTINE_MONITOR_INTERVAL_MS = 300000;
export const DEFAULT_QUARANTINE_DURATION_MS = 86400000;
export const DEFAULT_MAX_ACCOUNTS = 50;
export const DEFAULT_RECONNECT_MAX_RETRIES = 5;

export const HEALTH_SCORE_INCREMENT = 2;
export const HEALTH_SCORE_DECREMENT = 10;
export const HEALTH_SCORE_FLOOD_DECREMENT = 20;
export const CRITICAL_HEALTH_THRESHOLD = 20;

export const MAX_PAGE_LIMIT = 100;

export const CRITICAL_ERRORS = [
  'AUTH_KEY_UNREGISTERED',
  'SESSION_REVOKED',
  'USER_DEACTIVATED_BAN',
  'AUTH_KEY_DUPLICATED',
  'PHONE_NUMBER_BANNED',
] as const;

export const QUARANTINE_ERRORS = [
  'PEER_FLOOD',
  'USER_RESTRICTED',
] as const;

export const SKIP_ERRORS = [
  'USER_NOT_FOUND',
  'INPUT_USER_DEACTIVATED',
  'USER_PRIVACY_RESTRICTED',
  'USER_IS_BLOCKED',
  'PEER_ID_INVALID',
  'USER_IS_BOT',
  'CHAT_WRITE_FORBIDDEN',
  'USER_NOT_MUTUAL_CONTACT',
  'CHAT_SEND_PLAIN_FORBIDDEN',
  'CHAT_SEND_MEDIA_FORBIDDEN',
] as const;

export const ROTATION_STRATEGIES = {
  RoundRobin: 'round-robin',
  LeastUsed: 'least-used',
  HighestHealth: 'highest-health',
} as const;

export type RotationStrategy = (typeof ROTATION_STRATEGIES)[keyof typeof ROTATION_STRATEGIES];

export const RECOVERABLE_ERRORS = [
  'TIMEOUT',
  'NETWORK_ERROR',
  'RPC_TIMEOUT',
  'CONNECTION_ERROR',
  'MSG_WAIT_FAILED',
  'RPC_CALL_FAIL',
  'CONNECTION_NOT_INITED',
] as const;
