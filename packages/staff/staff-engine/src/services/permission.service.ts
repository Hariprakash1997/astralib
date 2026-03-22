import type { Model } from 'mongoose';
import type { LogAdapter, IPermissionGroupCreateInput, IPermissionGroupUpdateInput } from '@astralibx/staff-types';
import type { IPermissionGroupDocument } from '../schemas/permission-group.schema.js';
import { DuplicateError, GroupNotFoundError } from '../errors/index.js';
import { ERROR_CODE, ERROR_MESSAGE } from '../constants/index.js';
import type { PermissionCacheService } from './permission-cache.service.js';

export class PermissionService {
  constructor(
    private PermissionGroup: Model<IPermissionGroupDocument>,
    private permissionCache: PermissionCacheService,
    private logger: LogAdapter,
    private tenantId?: string,
  ) {}

  private get tenantFilter(): Record<string, unknown> {
    return this.tenantId ? { tenantId: this.tenantId } : {};
  }

  async listGroups(): Promise<IPermissionGroupDocument[]> {
    return this.PermissionGroup.find(this.tenantFilter).sort({ sortOrder: 1 }).lean() as unknown as IPermissionGroupDocument[];
  }

  async createGroup(data: IPermissionGroupCreateInput): Promise<IPermissionGroupDocument> {
    const existing = await this.PermissionGroup.findOne({
      groupId: data.groupId,
      ...this.tenantFilter,
    });
    if (existing) {
      throw new DuplicateError(
        ERROR_CODE.GroupIdExists,
        ERROR_MESSAGE.GroupIdExists,
        { groupId: data.groupId },
      );
    }
    const group = await this.PermissionGroup.create({
      ...data,
      sortOrder: data.sortOrder ?? 0,
      ...this.tenantFilter,
    });
    this.logger.info('Permission group created', { groupId: data.groupId });
    return group.toObject();
  }

  async updateGroup(groupId: string, data: IPermissionGroupUpdateInput): Promise<IPermissionGroupDocument> {
    const group = await this.PermissionGroup.findOneAndUpdate(
      { groupId, ...this.tenantFilter },
      { $set: data },
      { new: true },
    ).lean();
    if (!group) {
      throw new GroupNotFoundError(groupId);
    }
    await this.permissionCache.invalidateAll();
    this.logger.info('Permission group updated', { groupId, fields: Object.keys(data) });
    return group as unknown as IPermissionGroupDocument;
  }

  async deleteGroup(groupId: string): Promise<void> {
    const result = await this.PermissionGroup.deleteOne({ groupId, ...this.tenantFilter });
    if (result.deletedCount === 0) {
      throw new GroupNotFoundError(groupId);
    }
    await this.permissionCache.invalidateAll();
    this.logger.info('Permission group deleted', { groupId });
  }

  async getAllPermissionKeys(): Promise<string[]> {
    const groups = await this.listGroups();
    return groups.flatMap(g => g.permissions.map(p => p.key));
  }
}
