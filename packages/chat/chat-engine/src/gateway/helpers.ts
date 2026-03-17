import type { Socket } from 'socket.io';
import type { LogAdapter } from '@astralibx/core';
import type { ResolvedOptions } from '../types/config.types';
import type { ChatSessionDocument } from '../schemas/chat-session.schema';
import { ChatSessionStatus } from '@astralibx/chat-types';
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
    throw new RateLimitError(sessionId);
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

export function withSocketErrorHandler(
  socket: Socket,
  logger: LogAdapter,
  handler: (...args: any[]) => Promise<void>,
): (...args: any[]) => void {
  return (...args: any[]) => {
    handler(...args).catch((err) => {
      const message = err instanceof Error ? err.message : 'Unknown error';
      const code = err instanceof Error && 'code' in err ? (err as any).code : 'INTERNAL_ERROR';
      logger.error('Socket handler error', {
        error: message,
        code,
        socketId: socket.id,
      });
      socket.emit('chat:error', { code, message });
    });
  };
}
