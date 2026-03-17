import type { Redis } from 'ioredis';
import { RedisLock } from '@astralibx/core';
import type { LogAdapter } from '@astralibx/core';
import type { ResolvedOptions } from '../types/config.types';

export class RedisService {
  private prefix: string;
  private aiLocks = new Map<string, RedisLock>();

  constructor(
    private redis: Redis,
    private options: ResolvedOptions,
    keyPrefix: string,
    private logger: LogAdapter,
  ) {
    this.prefix = keyPrefix;
  }

  private key(suffix: string): string {
    return `${this.prefix}${suffix}`;
  }

  // --- Visitor connection tracking ---

  async setVisitorConnection(sessionId: string, socketId: string, visitorId: string): Promise<void> {
    const ttl = Math.ceil(this.options.reconnectWindowMs / 1000);
    await this.redis.set(
      this.key(`visitor:conn:${sessionId}`),
      JSON.stringify({ socketId, visitorId }),
      'EX',
      ttl,
    );
  }

  async getVisitorConnection(sessionId: string): Promise<{ socketId: string; visitorId: string } | null> {
    const data = await this.redis.get(this.key(`visitor:conn:${sessionId}`));
    if (!data) return null;
    try {
      return JSON.parse(data);
    } catch {
      return null;
    }
  }

  async removeVisitorConnection(sessionId: string): Promise<void> {
    await this.redis.del(this.key(`visitor:conn:${sessionId}`));
  }

  // --- Agent connection tracking ---

  async setAgentConnection(agentId: string, socketId: string, adminUserId: string): Promise<void> {
    await this.redis.set(
      this.key(`agent:conn:${agentId}`),
      JSON.stringify({ socketId, adminUserId }),
    );
  }

  async getAgentConnection(agentId: string): Promise<{ socketId: string; adminUserId: string } | null> {
    const data = await this.redis.get(this.key(`agent:conn:${agentId}`));
    if (!data) return null;
    try {
      return JSON.parse(data);
    } catch {
      return null;
    }
  }

  async removeAgentConnection(agentId: string): Promise<void> {
    await this.redis.del(this.key(`agent:conn:${agentId}`));
  }

  // --- Rate limiting ---

  async checkRateLimit(sessionId: string): Promise<boolean> {
    const windowKey = this.key(`ratelimit:${sessionId}`);
    try {
      const count = await this.redis.incr(windowKey);
      if (count === 1) {
        await this.redis.expire(windowKey, 60);
      }
      return count <= this.options.rateLimitPerMinute;
    } catch (err) {
      this.logger.warn('Rate limit check failed, allowing request', {
        sessionId,
        error: err instanceof Error ? err.message : 'Unknown error',
      });
      return true;
    }
  }

  // --- Session activity ---

  async setSessionActivity(sessionId: string): Promise<void> {
    await this.redis.set(
      this.key(`session:activity:${sessionId}`),
      Date.now().toString(),
      'EX',
      Math.ceil(this.options.idleTimeoutMs / 1000) * 2,
    );
  }

  async getSessionActivity(sessionId: string): Promise<number | null> {
    const data = await this.redis.get(this.key(`session:activity:${sessionId}`));
    return data ? parseInt(data, 10) : null;
  }

  async getStaleActiveSessions(sessionIds: string[]): Promise<string[]> {
    if (sessionIds.length === 0) return [];

    const now = Date.now();
    const stale: string[] = [];

    for (const sessionId of sessionIds) {
      const lastActivity = await this.getSessionActivity(sessionId);
      if (lastActivity === null || (now - lastActivity) > this.options.idleTimeoutMs) {
        stale.push(sessionId);
      }
    }

    return stale;
  }

  async removeSessionActivity(sessionId: string): Promise<void> {
    await this.redis.del(this.key(`session:activity:${sessionId}`));
  }

  // --- AI lock (uses RedisLock from @astralibx/core for safe acquire/release) ---

  async acquireAiLock(sessionId: string, ttlMs: number = 60_000): Promise<boolean> {
    const lock = new RedisLock(
      this.redis,
      this.key(`ai:lock:${sessionId}`),
      ttlMs,
      this.logger,
    );
    const acquired = await lock.acquire();
    if (acquired) {
      this.aiLocks.set(sessionId, lock);
    }
    return acquired;
  }

  async releaseAiLock(sessionId: string): Promise<void> {
    const lock = this.aiLocks.get(sessionId);
    if (lock) {
      await lock.release();
      this.aiLocks.delete(sessionId);
    }
  }

  // --- Pending messages ---

  async addPendingMessage(sessionId: string, message: Record<string, unknown>): Promise<void> {
    await this.redis.rpush(
      this.key(`pending:${sessionId}`),
      JSON.stringify(message),
    );
    await this.redis.pexpire(
      this.key(`pending:${sessionId}`),
      this.options.pendingMessageTTLMs,
    );
  }

  async getPendingMessages(sessionId: string): Promise<Record<string, unknown>[]> {
    const raw = await this.redis.lrange(this.key(`pending:${sessionId}`), 0, -1);
    return raw.map((item) => {
      try {
        return JSON.parse(item);
      } catch {
        return {};
      }
    });
  }

  async clearPendingMessages(sessionId: string): Promise<void> {
    await this.redis.del(this.key(`pending:${sessionId}`));
  }

  // --- AI debounce state ---

  async setDebounceTimer(sessionId: string, timerId: string): Promise<void> {
    await this.redis.set(
      this.key(`debounce:${sessionId}`),
      timerId,
      'PX',
      this.options.aiDebounceMs + 5000,
    );
  }

  async getDebounceTimer(sessionId: string): Promise<string | null> {
    return this.redis.get(this.key(`debounce:${sessionId}`));
  }

  async clearDebounceTimer(sessionId: string): Promise<void> {
    await this.redis.del(this.key(`debounce:${sessionId}`));
  }
}
