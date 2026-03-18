import type { Socket } from 'socket.io';
import type { LogAdapter } from '@astralibx/core';
import type { ResolvedOptions } from '../types/config.types';
import type { ChatSessionDocument } from '../schemas/chat-session.schema';
import { ChatSessionStatus, SessionMode } from '@astralibx/chat-types';
import { RateLimitError } from '../errors';
import type { RedisService } from '../services/redis.service';

export function validateMessageContent(content: string, options: ResolvedOptions): string {
  if (!content || typeof content !== 'string') {
    throw new Error('Message content is required');
  }

  const trimmed = content.trim();
  if (trimmed.length === 0) {
    throw new Error('Message content cannot be empty');
  }

  if (trimmed.length > options.maxMessageLength) {
    throw new Error(`Message exceeds maximum length of ${options.maxMessageLength} characters`);
  }

  return trimmed;
}

export function validateSessionForMessaging(session: ChatSessionDocument): void {
  const invalidStatuses = [ChatSessionStatus.Resolved, ChatSessionStatus.Abandoned];
  if (invalidStatuses.includes(session.status)) {
    throw new Error(`Cannot send messages to a ${session.status} session`);
  }
}

export async function checkRateLimit(
  sessionId: string,
  redisService: RedisService,
): Promise<void> {
  const allowed = await redisService.checkRateLimit(sessionId);
  if (!allowed) {
    const resetIn = await redisService.getRateLimitTTL(sessionId);
    const err = new RateLimitError(sessionId);
    (err as any).resetIn = resetIn > 0 ? resetIn : 60;
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

// -- Agent ownership validation --

export function validateAgentOwnership(session: any, connectedAgentId: string): void {
  if (session.agentId && session.agentId.toString() !== connectedAgentId) {
    throw new Error('Agent does not own this session');
  }
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
  handler: (...args: any[]) => Promise<void>,
): (...args: any[]) => void {
  return (...args: any[]) => {
    handler(...args).catch((err) => {
      const isKnownError = err instanceof Error && 'code' in err;
      const code = isKnownError ? (err as any).code : 'INTERNAL_ERROR';

      // Log full error internally
      logger.error('Socket handler error', {
        error: err instanceof Error ? err.message : 'Unknown error',
        stack: err instanceof Error ? err.stack : undefined,
        code,
        socketId: socket.id,
      });

      // Send sanitized error to client — don't expose internals
      const clientMessage = isKnownError
        ? (err as Error).message
        : 'An unexpected error occurred';

      const errorPayload: Record<string, unknown> = { code, message: clientMessage };
      if (err instanceof RateLimitError && (err as any).resetIn != null) {
        errorPayload.resetIn = (err as any).resetIn;
      }
      socket.emit('chat:error', errorPayload);
    });
  };
}
