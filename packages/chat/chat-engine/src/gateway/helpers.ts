import type { Socket } from 'socket.io';
import type { LogAdapter } from '@astralibx/core';
import { SessionMode } from '@astralibx/chat-types';
import { RateLimitError, AlxChatError } from '../errors/index.js';
import { ERROR_CODE, INTERNAL_EVENT } from '../constants/index.js';
import type { RedisService } from '../services/redis.service.js';

// Re-export validation functions that moved to the validation module so that
// existing import paths from './helpers' continue to work.
export { validateMessageContent, validateSessionForMessaging, validateAgentOwnership } from '../validation/index.js';

export async function checkRateLimit(
  sessionId: string,
  redisService: RedisService,
): Promise<void> {
  const allowed = await redisService.checkRateLimit(sessionId);
  if (!allowed) {
    const resetIn = await redisService.getRateLimitTTL(sessionId);
    const err = new RateLimitError(sessionId);
    err.resetIn = resetIn > 0 ? resetIn : 60;
    throw err;
  }
}

const typingTimeouts = new Map<string, NodeJS.Timeout>();

export function setTypingTimeout(
  key: string,
  callback: () => void,
  timeoutMs: number = 5000,
): void {
  const existing = typingTimeouts.get(key);
  if (existing) {
    clearTimeout(existing);
  }

  const timeout = setTimeout(() => {
    typingTimeouts.delete(key);
    callback();
  }, timeoutMs);

  typingTimeouts.set(key, timeout);
}

export function clearTypingTimeout(key: string): void {
  const existing = typingTimeouts.get(key);
  if (existing) {
    clearTimeout(existing);
    typingTimeouts.delete(key);
  }
}

export function clearAllTypingTimeouts(): void {
  for (const [, timeout] of typingTimeouts) {
    clearTimeout(timeout);
  }
  typingTimeouts.clear();
}

// -- Typing throttle (rate-limits typing events per session) --

const typingLastEmit = new Map<string, number>();

export function isTypingThrottled(sessionId: string, intervalMs: number = 2000): boolean {
  const now = Date.now();
  const last = typingLastEmit.get(sessionId);
  if (last && (now - last) < intervalMs) {
    return true;
  }
  typingLastEmit.set(sessionId, now);
  return false;
}

export function clearTypingThrottle(sessionId: string): void {
  typingLastEmit.delete(sessionId);
}

export function clearAllTypingThrottles(): void {
  typingLastEmit.clear();
}

// -- Circular reference / JSON safety check --

export function isJsonSafe(data: unknown): boolean {
  try {
    JSON.stringify(data);
    return true;
  } catch {
    return false;
  }
}

// -- Connection rate limiting --

const connectionAttempts = new Map<string, { count: number; resetAt: number }>();
const MAX_CONNECTIONS_PER_MINUTE = 20;

export function checkConnectionRateLimit(ip: string): boolean {
  const now = Date.now();
  const entry = connectionAttempts.get(ip);
  if (!entry || now > entry.resetAt) {
    connectionAttempts.set(ip, { count: 1, resetAt: now + 60000 });
    return true;
  }
  entry.count++;
  return entry.count <= MAX_CONNECTIONS_PER_MINUTE;
}

export function clearAllConnectionLimits(): void {
  connectionAttempts.clear();
}

export function resolveMode(
  agent: { modeOverride?: string | null } | null | undefined,
  globalSettings: { defaultSessionMode?: string },
): string {
  if (agent?.modeOverride != null) return agent.modeOverride;
  return globalSettings?.defaultSessionMode || SessionMode.Manual;
}

export function resolveAiEnabled(
  agent: { aiEnabled?: boolean | null } | null | undefined,
  globalSettings: { aiEnabled?: boolean },
): boolean {
  if (agent?.aiEnabled != null) return agent.aiEnabled;
  return globalSettings?.aiEnabled ?? false;
}

export function withSocketErrorHandler(
  socket: Socket,
  logger: LogAdapter,
  handler: (...args: unknown[]) => Promise<void>,
): (...args: unknown[]) => void {
  return (...args: unknown[]) => {
    handler(...args).catch((err: unknown) => {
      const isKnownError = err instanceof AlxChatError;
      const code = isKnownError ? err.code : ERROR_CODE.InternalError;

      // Log full error internally
      logger.error('Socket handler error', {
        error: err instanceof Error ? err.message : 'Unknown error',
        stack: err instanceof Error ? err.stack : undefined,
        code,
        socketId: socket.id,
      });

      // Send sanitized error to client — don't expose internals
      const clientMessage = isKnownError
        ? err.message
        : 'An unexpected error occurred';

      const errorPayload: Record<string, unknown> = { code, message: clientMessage };
      if (err instanceof RateLimitError && err.resetIn != null) {
        errorPayload.resetIn = err.resetIn;
      }
      socket.emit(INTERNAL_EVENT.ChatError, errorPayload);
    });
  };
}
