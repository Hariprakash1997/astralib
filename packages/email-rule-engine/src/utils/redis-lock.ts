import crypto from 'crypto';
import type { Redis } from 'ioredis';
import type { LogAdapter } from '../types/config.types';

export class RedisLock {
  private lockValue = '';

  constructor(
    private redis: Redis,
    private lockKey: string,
    private ttlMs: number,
    private logger?: LogAdapter
  ) {}

  async acquire(): Promise<boolean> {
    this.lockValue = crypto.randomUUID();
    const result = await this.redis.set(this.lockKey, this.lockValue, 'PX', this.ttlMs, 'NX');
    return result === 'OK';
  }

  async release(): Promise<void> {
    try {
      const script = "if redis.call('get',KEYS[1]) == ARGV[1] then return redis.call('del',KEYS[1]) else return 0 end";
      await this.redis.eval(script, 1, this.lockKey, this.lockValue);
    } catch (err) {
      this.logger?.error('Failed to release lock', { error: err });
    }
  }
}
