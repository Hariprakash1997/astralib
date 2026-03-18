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
      // SECURITY NOTE: Fail-open on Redis errors allows unlimited messages.
      // For strict rate limiting, configure Redis high-availability (sentinel/cluster).
      this.logger.warn('Rate limit check failed — allowing request (fail-open)', {
        sessionId,
        error: err instanceof Error ? err.message : 'unknown',
      });
      return true;
    }
  }

  async getRateLimitTTL(sessionId: string): Promise<number> {
    try {
      return await this.redis.ttl(this.key(`ratelimit:${sessionId}`));
    } catch {
      return 60;
    }
  }

  // --- Agent multi-tab connection tracking ---

  async incrementAgentConnections(agentId: string): Promise<number> {
    const k = this.key(`agent-conns:${agentId}`);
    return this.redis.incr(k);
  }

  async decrementAgentConnections(agentId: string): Promise<number> {
    const k = this.key(`agent-conns:${agentId}`);
    const val = await this.redis.decr(k);
    if (val <= 0) await this.redis.del(k);
    return Math.max(0, val);
  }

  async getAgentConnectionCount(agentId: string): Promise<number> {
    const k = this.key(`agent-conns:${agentId}`);
    const val = await this.redis.get(k);
    return parseInt(val || '0', 10);
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

  // --- Disconnect tracking (reconnect detection) ---

  async markDisconnected(sessionId: string): Promise<void> {
    await this.redis.set(
      this.key(`disconnect:${sessionId}`),
      '1',
      'PX',
      this.options.reconnectWindowMs,
    );
  }

  async hadRecentDisconnect(sessionId: string): Promise<boolean> {
    const key = this.key(`disconnect:${sessionId}`);
    const val = await this.redis.get(key);
    if (val) {
      await this.redis.del(key);
      return true;
    }
    return false;
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
      try {
        await lock.release();
      } catch (err) {
        this.logger.warn('Failed to release AI lock', {
          sessionId,
          error: err instanceof Error ? err.message : 'Unknown error',
        });
      }
      this.aiLocks.delete(sessionId);
    }
  }

  async clearAllAiLocks(): Promise<void> {
    for (const [sessionId, lock] of this.aiLocks) {
      try {
        await lock.release();
      } catch (err) {
        this.logger.warn('Failed to release AI lock during cleanup', {
          sessionId,
          error: err instanceof Error ? err.message : 'Unknown error',
        });
      }
    }
    this.aiLocks.clear();
  }

  // --- Pending messages ---

  async addPendingMessage(sessionId: string, message: Record<string, unknown>): Promise<void> {
    const key = this.key(`pending:${sessionId}`);

    // Limit pending messages per session
    const MAX_PENDING = 100;
    const currentCount = await this.redis.llen(key);
    if (currentCount >= MAX_PENDING) {
      this.logger.warn('Pending message limit reached', { sessionId, count: currentCount });
      return; // Drop silently — visitor will get messages when they reconnect
    }

    await this.redis.rpush(key, JSON.stringify(message));
    await this.redis.pexpire(key, this.options.pendingMessageTTLMs);
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
