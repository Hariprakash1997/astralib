import type { Model } from 'mongoose';
import type {
  LogAdapter, StaffHooks, StaffAdapters, IStaffCreateInput,
  IStaffUpdateInput, IStaffListFilters, IPaginatedResult,
} from '@astralibx/staff-types';
import { STAFF_ROLE, STAFF_STATUS } from '@astralibx/staff-types';
import type { IStaffDocument } from '../schemas/staff.schema.js';
import type { IPermissionGroupDocument } from '../schemas/permission-group.schema.js';
import type { PermissionCacheService } from './permission-cache.service.js';
import {
  DuplicateError, StaffNotFoundError,
  LastOwnerError,
} from '../errors/index.js';
import { ERROR_CODE, ERROR_MESSAGE, DEFAULTS } from '../constants/index.js';
import { validatePermissionPairs } from '../validation/index.js';

export interface StaffServiceDeps {
  Staff: Model<IStaffDocument>;
  PermissionGroup: Model<IPermissionGroupDocument>;
  adapters: StaffAdapters;
  hooks: StaffHooks;
  permissionCache: PermissionCacheService;
  logger: LogAdapter;
  tenantId?: string;
  requireEmailUniqueness: boolean;
}

export class StaffService {
  private Staff: Model<IStaffDocument>;
  private PermissionGroup: Model<IPermissionGroupDocument>;
  private adapters: StaffAdapters;
  private hooks: StaffHooks;
  private permissionCache: PermissionCacheService;
  private logger: LogAdapter;
  private tenantId?: string;
  private requireEmailUniqueness: boolean;

  constructor(deps: StaffServiceDeps) {
    this.Staff = deps.Staff;
    this.PermissionGroup = deps.PermissionGroup;
    this.adapters = deps.adapters;
    this.hooks = deps.hooks;
    this.permissionCache = deps.permissionCache;
    this.logger = deps.logger;
    this.tenantId = deps.tenantId;
    this.requireEmailUniqueness = deps.requireEmailUniqueness;
  }

  private get tenantFilter(): Record<string, unknown> {
    return this.tenantId ? { tenantId: this.tenantId } : {};
  }

  async create(data: IStaffCreateInput): Promise<IStaffDocument> {
    if (this.requireEmailUniqueness) {
      const existing = await this.Staff.findOne({
        email: data.email.toLowerCase().trim(),
        ...this.tenantFilter,
      });
      if (existing) {
        throw new DuplicateError(ERROR_CODE.EmailExists, ERROR_MESSAGE.EmailExists, { email: data.email });
      }
    }

    const hashedPassword = await this.adapters.hashPassword(data.password);
    const staff = await this.Staff.create({
      ...data,
      email: data.email.toLowerCase().trim(),
      password: hashedPassword,
      role: data.role ?? STAFF_ROLE.Staff,
      status: data.status ?? STAFF_STATUS.Pending,
      permissions: data.permissions ?? [],
      ...this.tenantFilter,
    });

    this.logger.info('Staff created', { staffId: staff._id.toString() });
    this.hooks.onStaffCreated?.(staff.toObject());
    return staff.toObject();
  }

  async list(filters: IStaffListFilters = {}): Promise<IPaginatedResult<IStaffDocument>> {
    const page = Math.max(1, filters.page ?? 1);
    const limit = Math.min(filters.limit ?? DEFAULTS.ListPageSize, DEFAULTS.MaxListPageSize);

    const query: Record<string, unknown> = { ...this.tenantFilter };
    if (filters.status) query.status = filters.status;
    if (filters.role) query.role = filters.role;

    const [data, total] = await Promise.all([
      this.Staff.find(query)
        .sort({ createdAt: -1 })
        .skip((page - 1) * limit)
        .limit(limit)
        .lean(),
      this.Staff.countDocuments(query),
    ]);

    return {
      data: data as unknown as IStaffDocument[],
      pagination: { page, limit, total, totalPages: Math.ceil(total / limit) },
    };
  }

  async getById(staffId: string): Promise<IStaffDocument> {
    const staff = await this.Staff.findOne({ _id: staffId, ...this.tenantFilter }).lean() as unknown as IStaffDocument | null;
    if (!staff) throw new StaffNotFoundError(staffId);
    return staff;
  }

  async update(staffId: string, data: IStaffUpdateInput): Promise<IStaffDocument> {
    const updateData: Record<string, unknown> = {};
    if (data.name !== undefined) updateData.name = data.name;
    if (data.email !== undefined) updateData.email = data.email.toLowerCase().trim();
    if (data.metadata !== undefined) updateData.metadata = data.metadata;

    if (data.email && this.requireEmailUniqueness) {
      const existing = await this.Staff.findOne({
        email: data.email.toLowerCase().trim(),
        _id: { $ne: staffId },
        ...this.tenantFilter,
      });
      if (existing) {
        throw new DuplicateError(ERROR_CODE.EmailExists, ERROR_MESSAGE.EmailExists, { email: data.email });
      }
    }

    const staff = await this.Staff.findOneAndUpdate(
      { _id: staffId, ...this.tenantFilter },
      { $set: updateData },
      { new: true },
    ).lean() as unknown as IStaffDocument | null;
    if (!staff) throw new StaffNotFoundError(staffId);

    this.logger.info('Staff updated', { staffId, fields: Object.keys(updateData) });
    return staff;
  }

  async updatePermissions(staffId: string, permissions: string[]): Promise<IStaffDocument> {
    const groups = await this.PermissionGroup.find(this.tenantFilter).lean() as unknown as IPermissionGroupDocument[];
    validatePermissionPairs(permissions, groups);

    const staff = await this.Staff.findOne({ _id: staffId, ...this.tenantFilter });
    if (!staff) throw new StaffNotFoundError(staffId);

    const oldPerms = [...staff.permissions];
    staff.permissions = permissions;
    await staff.save();

    await this.permissionCache.invalidate(staffId);
    this.hooks.onPermissionsChanged?.(staffId, oldPerms, permissions);
    this.logger.info('Staff permissions updated', { staffId, count: permissions.length });
    return staff.toObject();
  }

  async updateStatus(staffId: string, status: string): Promise<IStaffDocument> {
    const staff = await this.Staff.findOne({ _id: staffId, ...this.tenantFilter });
    if (!staff) throw new StaffNotFoundError(staffId);

    if (status === STAFF_STATUS.Inactive && staff.role === STAFF_ROLE.Owner) {
      const activeOwnerCount = await this.Staff.countDocuments({
        role: STAFF_ROLE.Owner,
        status: STAFF_STATUS.Active,
        ...this.tenantFilter,
      });
      if (activeOwnerCount <= 1) throw new LastOwnerError(staffId);
    }

    const oldStatus = staff.status;
    staff.status = status as any;
    await staff.save();

    await this.permissionCache.invalidate(staffId);
    this.hooks.onStatusChanged?.(staffId, oldStatus, status);
    this.logger.info('Staff status updated', { staffId, oldStatus, newStatus: status });
    return staff.toObject();
  }
}
