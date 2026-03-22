import type { Model } from 'mongoose';
import type { LogAdapter } from '@astralibx/staff-types';
import type { IStaffDocument } from '../schemas/staff.schema.js';

export class PermissionCacheService {
  private memoryCache = new Map<string, { permissions: string[]; expiresAt: number }>();

  constructor(
    private StaffModel: Model<IStaffDocument>,
    private ttlMs: number,
    private redis: unknown | null,
    private keyPrefix: string,
    private logger: LogAdapter,
    private tenantId?: string,
  ) {}

  async get(staffId: string): Promise<string[]> {
    if (this.redis) {
      return this.getRedis(staffId);
    }
    return this.getMemory(staffId);
  }

  async invalidate(staffId: string): Promise<void> {
    if (this.redis) {
      await (this.redis as any).del(`${this.keyPrefix}perms:${staffId}`);
      return;
    }
    this.memoryCache.delete(staffId);
  }

  async invalidateAll(): Promise<void> {
    if (this.redis) {
      const redis = this.redis as any;
      const keys = await redis.keys(`${this.keyPrefix}perms:*`);
      if (keys.length > 0) {
        await redis.del(...keys);
      }
      return;
    }
    this.memoryCache.clear();
  }

  private async getMemory(staffId: string): Promise<string[]> {
    const cached = this.memoryCache.get(staffId);
    if (cached && Date.now() < cached.expiresAt) {
      return cached.permissions;
    }
    const permissions = await this.fetchFromDb(staffId);
    this.memoryCache.set(staffId, { permissions, expiresAt: Date.now() + this.ttlMs });
    return permissions;
  }

  private async getRedis(staffId: string): Promise<string[]> {
    const redisKey = `${this.keyPrefix}perms:${staffId}`;
    const redis = this.redis as any;
    const cached = await redis.get(redisKey);
    if (cached) {
      return JSON.parse(cached);
    }
    const permissions = await this.fetchFromDb(staffId);
    await redis.set(redisKey, JSON.stringify(permissions), 'PX', this.ttlMs);
    return permissions;
  }

  private async fetchFromDb(staffId: string): Promise<string[]> {
    const filter: Record<string, unknown> = { _id: staffId };
    if (this.tenantId) filter.tenantId = this.tenantId;
    const staff = await this.StaffModel.findOne(filter).select('permissions').lean();
    return staff?.permissions ?? [];
  }
}
