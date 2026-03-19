import type { Redis } from 'ioredis';
import type { LogAdapter } from '@astralibx/core';
import { noopLogger } from '@astralibx/core';
import { getHealthAdjustedDelay, getHumanDelay } from '../utils/delay';
import { DEFAULT_THROTTLE_TTL_SECONDS } from '../constants';

// Error categorization for Telegram API codes
const CRITICAL_ERRORS = ['AUTH_KEY_UNREGISTERED', 'SESSION_REVOKED', 'USER_DEACTIVATED_BAN', 'PHONE_NUMBER_BANNED'];
const ACCOUNT_ERRORS = ['FLOOD_WAIT', 'PEER_FLOOD', 'USER_RESTRICTED', 'SLOWMODE_WAIT'];
const RECOVERABLE_ERRORS = ['TIMEOUT', 'NETWORK_ERROR', 'RPC_TIMEOUT', 'CONNECTION_ERROR', 'RPC_CALL_FAIL'];
const SKIP_ERRORS = ['USER_NOT_FOUND', 'USER_PRIVACY_RESTRICTED', 'USER_IS_BLOCKED', 'PEER_ID_INVALID', 'CHAT_WRITE_FORBIDDEN'];

export function categorizeError(err: any): string {
  const code = String(err?.code || err?.errorMessage || '').toUpperCase();
  if (CRITICAL_ERRORS.some(c => code.includes(c))) return 'critical';
  if (ACCOUNT_ERRORS.some(c => code.includes(c))) return 'account';
  if (RECOVERABLE_ERRORS.some(c => code.includes(c))) return 'recoverable';
  if (SKIP_ERRORS.some(c => code.includes(c))) return 'skip';
  return 'unknown';
}

export function isRetryableError(err: any): boolean {
  return categorizeError(err) === 'recoverable';
}

// Redis throttle helpers
export interface RedisThrottleOptions {
  redis: Redis;
  keyPrefix: string;
  timezone?: string;
  logger?: LogAdapter;
}

function sanitizeRedisKey(value: string): string {
  return value.replace(/[\s\n\r]/g, '_');
}

function getTodayString(timezone?: string): string {
  return timezone
    ? new Intl.DateTimeFormat('en-CA', { timeZone: timezone }).format(new Date())
    : new Date().toISOString().slice(0, 10);
}

function getWeekStartDate(timezone?: string): string {
  const now = new Date();
  if (timezone) {
    const parts = new Intl.DateTimeFormat('en-US', {
      timeZone: timezone,
      year: 'numeric', month: '2-digit', day: '2-digit',
      weekday: 'short', hour12: false,
    }).formatToParts(now);
    const dayMap: Record<string, number> = { Sun: 0, Mon: 1, Tue: 2, Wed: 3, Thu: 4, Fri: 5, Sat: 6 };
    const dayName = parts.find(p => p.type === 'weekday')?.value || 'Mon';
    const day = dayMap[dayName] ?? 1;
    const diff = day === 0 ? 6 : day - 1;
    const monday = new Date(now);
    monday.setDate(monday.getDate() - diff);
    return new Intl.DateTimeFormat('en-CA', { timeZone: timezone }).format(monday);
  }
  const day = now.getDay();
  const diff = now.getDate() - day + (day === 0 ? -6 : 1);
  const monday = new Date(now);
  monday.setDate(diff);
  return new Intl.DateTimeFormat('en-CA', { timeZone: 'UTC' }).format(monday);
}

export async function checkRedisThrottle(
  opts: RedisThrottleOptions,
  identifierId: string,
  config: { maxPerUserPerDay: number; maxPerUserPerWeek: number; minGapDays: number },
): Promise<{ allowed: boolean; reason?: string }> {
  const log = opts.logger || noopLogger;
  const key = `${opts.keyPrefix}throttle:${sanitizeRedisKey(identifierId)}`;
  const todayStr = getTodayString(opts.timezone);
  const weekStartStr = getWeekStartDate(opts.timezone);

  try {
    const data = await opts.redis.hgetall(key);
    let today = parseInt(data.today || '0', 10);
    let thisWeek = parseInt(data.thisWeek || '0', 10);
    const lastSentDate = data.lastSentDate ? new Date(data.lastSentDate) : null;

    // Reset counters if date/week changed
    if (data.todayDate !== todayStr) today = 0;
    if (data.weekStartDate !== weekStartStr) thisWeek = 0;

    if (today >= config.maxPerUserPerDay) return { allowed: false, reason: 'daily throttle limit' };
    if (thisWeek >= config.maxPerUserPerWeek) return { allowed: false, reason: 'weekly throttle limit' };
    if (lastSentDate) {
      const daysSince = (Date.now() - lastSentDate.getTime()) / 86400000;
      if (daysSince < config.minGapDays) return { allowed: false, reason: 'min gap days' };
    }

    return { allowed: true };
  } catch (err) {
    log.warn('Redis throttle check failed, allowing send', { identifierId, error: (err as Error).message });
    return { allowed: true }; // Fail open
  }
}

export async function incrementRedisThrottle(
  opts: RedisThrottleOptions,
  identifierId: string,
): Promise<void> {
  const log = opts.logger || noopLogger;
  const key = `${opts.keyPrefix}throttle:${sanitizeRedisKey(identifierId)}`;
  const todayStr = getTodayString(opts.timezone);
  const weekStartStr = getWeekStartDate(opts.timezone);

  try {
    const [currentToday, currentWeek] = await Promise.all([
      opts.redis.hget(key, 'todayDate'),
      opts.redis.hget(key, 'weekStartDate'),
    ]);

    const pipe = opts.redis.pipeline();
    if (currentToday !== todayStr) {
      pipe.hset(key, 'today', '1', 'todayDate', todayStr);
    } else {
      pipe.hincrby(key, 'today', 1);
    }
    if (currentWeek !== weekStartStr) {
      pipe.hset(key, 'thisWeek', '1', 'weekStartDate', weekStartStr);
    } else {
      pipe.hincrby(key, 'thisWeek', 1);
    }
    pipe.hset(key, 'lastSentDate', new Date().toISOString());
    pipe.expire(key, DEFAULT_THROTTLE_TTL_SECONDS);
    await pipe.exec();
  } catch (err) {
    log.warn('Redis throttle increment failed', { identifierId, error: (err as Error).message });
  }
}

// Health-adjusted delay calculator
export function calculateTelegramDelay(
  baseMs: number,
  jitterMs: number,
  thinkingPauseProbability: number,
  healthScore?: number,
  healthDelayMultiplier?: number,
): number {
  let delay = getHumanDelay(baseMs, jitterMs, thinkingPauseProbability);
  if (typeof healthScore === 'number') {
    delay = getHealthAdjustedDelay(delay, healthScore, healthDelayMultiplier ?? 3);
  }
  return delay;
}
