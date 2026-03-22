import type { LogAdapter } from '@astralibx/staff-types';

interface RateLimitEntry {
  count: number;
  expiresAt: number;
}

export class RateLimiterService {
  private memoryStore = new Map<string, RateLimitEntry>();

  constructor(
    private windowMs: number,
    private maxAttempts: number,
    private redis: unknown | null,
    private keyPrefix: string,
    private logger: LogAdapter,
  ) {}

  async checkLimit(key: string): Promise<{ allowed: boolean; remaining: number; retryAfterMs?: number }> {
    if (this.redis) {
      return this.checkLimitRedis(key);
    }
    return this.checkLimitMemory(key);
  }

  async recordAttempt(key: string): Promise<void> {
    if (this.redis) {
      return this.recordAttemptRedis(key);
    }
    this.recordAttemptMemory(key);
  }

  async reset(key: string): Promise<void> {
    if (this.redis) {
      await (this.redis as any).del(`${this.keyPrefix}rate:${key}`);
      return;
    }
    this.memoryStore.delete(key);
  }

  private checkLimitMemory(key: string): { allowed: boolean; remaining: number; retryAfterMs?: number } {
    const entry = this.memoryStore.get(key);
    if (!entry || Date.now() > entry.expiresAt) {
      return { allowed: true, remaining: this.maxAttempts };
    }
    if (entry.count >= this.maxAttempts) {
      return { allowed: false, remaining: 0, retryAfterMs: entry.expiresAt - Date.now() };
    }
    return { allowed: true, remaining: this.maxAttempts - entry.count };
  }

  private recordAttemptMemory(key: string): void {
    const entry = this.memoryStore.get(key);
    if (!entry || Date.now() > entry.expiresAt) {
      this.memoryStore.set(key, { count: 1, expiresAt: Date.now() + this.windowMs });
    } else {
      entry.count++;
    }
  }

  private async checkLimitRedis(key: string): Promise<{ allowed: boolean; remaining: number; retryAfterMs?: number }> {
    const redisKey = `${this.keyPrefix}rate:${key}`;
    const redis = this.redis as any;
    const count = await redis.get(redisKey);
    const current = count ? parseInt(count, 10) : 0;
    if (current >= this.maxAttempts) {
      const ttl = await redis.pttl(redisKey);
      return { allowed: false, remaining: 0, retryAfterMs: ttl > 0 ? ttl : this.windowMs };
    }
    return { allowed: true, remaining: this.maxAttempts - current };
  }

  private async recordAttemptRedis(key: string): Promise<void> {
    const redisKey = `${this.keyPrefix}rate:${key}`;
    const redis = this.redis as any;
    const count = await redis.incr(redisKey);
    if (count === 1) {
      await redis.pexpire(redisKey, this.windowMs);
    }
  }
}
