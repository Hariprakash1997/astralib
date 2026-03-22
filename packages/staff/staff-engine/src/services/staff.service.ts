import jwt from 'jsonwebtoken';
import type { Model } from 'mongoose';
import type {
  LogAdapter, StaffHooks, StaffAdapters, IStaffCreateInput,
  IStaffUpdateInput, IStaffListFilters, IPaginatedResult,
} from '@astralibx/staff-types';
import { STAFF_ROLE, STAFF_STATUS } from '@astralibx/staff-types';
import type { IStaffDocument } from '../schemas/staff.schema.js';
import type { IPermissionGroupDocument } from '../schemas/permission-group.schema.js';
import type { PermissionCacheService } from './permission-cache.service.js';
import type { RateLimiterService } from './rate-limiter.service.js';
import {
  AuthenticationError, DuplicateError, StaffNotFoundError,
  LastOwnerError, SetupError, RateLimitError,
} from '../errors/index.js';
import { ERROR_CODE, ERROR_MESSAGE, DEFAULTS } from '../constants/index.js';
import { validatePermissionPairs } from '../validation/index.js';

export interface StaffServiceDeps {
  Staff: Model<IStaffDocument>;
  PermissionGroup: Model<IPermissionGroupDocument>;
  adapters: StaffAdapters;
  hooks: StaffHooks;
  permissionCache: PermissionCacheService;
  rateLimiter: RateLimiterService;
  logger: LogAdapter;
  tenantId?: string;
  jwtSecret: string;
  staffTokenExpiry: string;
  ownerTokenExpiry: string;
  requireEmailUniqueness: boolean;
  allowSelfPasswordChange: boolean;
}

export class StaffService {
  private Staff: Model<IStaffDocument>;
  private PermissionGroup: Model<IPermissionGroupDocument>;
  private adapters: StaffAdapters;
  private hooks: StaffHooks;
  private permissionCache: PermissionCacheService;
  private rateLimiter: RateLimiterService;
  private logger: LogAdapter;
  private tenantId?: string;
  private jwtSecret: string;
  private staffTokenExpiry: string;
  private ownerTokenExpiry: string;
  private requireEmailUniqueness: boolean;
  private allowSelfPasswordChange: boolean;

  constructor(deps: StaffServiceDeps) {
    this.Staff = deps.Staff;
    this.PermissionGroup = deps.PermissionGroup;
    this.adapters = deps.adapters;
    this.hooks = deps.hooks;
    this.permissionCache = deps.permissionCache;
    this.rateLimiter = deps.rateLimiter;
    this.logger = deps.logger;
    this.tenantId = deps.tenantId;
    this.jwtSecret = deps.jwtSecret;
    this.staffTokenExpiry = deps.staffTokenExpiry;
    this.ownerTokenExpiry = deps.ownerTokenExpiry;
    this.requireEmailUniqueness = deps.requireEmailUniqueness;
    this.allowSelfPasswordChange = deps.allowSelfPasswordChange;
  }

  private get tenantFilter(): Record<string, unknown> {
    return this.tenantId ? { tenantId: this.tenantId } : {};
  }

  private generateToken(staffId: string, role: string): string {
    const expiresIn = role === STAFF_ROLE.Owner ? this.ownerTokenExpiry : this.staffTokenExpiry;
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    return jwt.sign({ staffId, role }, this.jwtSecret, { expiresIn } as any);
  }

  async setupOwner(data: { name: string; email: string; password: string }): Promise<{ staff: IStaffDocument; token: string }> {
    // Race-safe: use findOneAndUpdate with upsert. The filter ensures this only
    // succeeds when zero staff exist for the tenant. If two requests race, only
    // the first upsert creates a document; the second finds the existing one
    // and we detect it was not newly created.
    const hashedPassword = await this.adapters.hashPassword(data.password);
    const filter = { role: STAFF_ROLE.Owner, ...this.tenantFilter };
    const result = await (this.Staff.findOneAndUpdate(
      filter,
      {
        $setOnInsert: {
          name: data.name,
          email: data.email.toLowerCase().trim(),
          password: hashedPassword,
          role: STAFF_ROLE.Owner,
          status: STAFF_STATUS.Active,
          permissions: [],
          ...this.tenantFilter,
        },
      },
      { upsert: true, new: true, rawResult: true },
    ) as unknown as Promise<{ lastErrorObject?: { upserted?: unknown }; value?: IStaffDocument }>);

    if (!result.lastErrorObject?.upserted) {
      throw new SetupError();
    }

    const staff = await this.Staff.findOne({ _id: result.value!._id }).lean() as unknown as IStaffDocument;
    const token = this.generateToken(staff._id.toString(), STAFF_ROLE.Owner);
    this.logger.info('Owner setup complete', { staffId: staff._id.toString() });
    this.hooks.onStaffCreated?.(staff);
    this.hooks.onMetric?.({ name: 'staff_setup_complete', value: 1 });
    return { staff, token };
  }

  async login(email: string, password: string, ip?: string): Promise<{ staff: IStaffDocument; token: string }> {
    if (ip) {
      const limit = await this.rateLimiter.checkLimit(ip);
      if (!limit.allowed) {
        this.hooks.onLoginFailed?.(email, ip);
        throw new RateLimitError(limit.retryAfterMs!);
      }
    }

    const staff = await this.Staff.findOne({
      email: email.toLowerCase().trim(),
      ...this.tenantFilter,
    }).select('+password');

    if (!staff) {
      if (ip) await this.rateLimiter.recordAttempt(ip);
      this.hooks.onLoginFailed?.(email, ip);
      throw new AuthenticationError(ERROR_CODE.InvalidCredentials);
    }

    const valid = await this.adapters.comparePassword(password, staff.password);
    if (!valid) {
      if (ip) await this.rateLimiter.recordAttempt(ip);
      this.hooks.onLoginFailed?.(email, ip);
      throw new AuthenticationError(ERROR_CODE.InvalidCredentials);
    }

    if (staff.status === STAFF_STATUS.Inactive) {
      throw new AuthenticationError(ERROR_CODE.AccountInactive, ERROR_MESSAGE.AccountInactive);
    }
    if (staff.status === STAFF_STATUS.Pending) {
      throw new AuthenticationError(ERROR_CODE.AccountPending, ERROR_MESSAGE.AccountPending);
    }

    staff.lastLoginAt = new Date();
    if (ip) staff.lastLoginIp = ip;
    await staff.save();

    if (ip) await this.rateLimiter.reset(ip);
    const token = this.generateToken(staff._id.toString(), staff.role);
    this.hooks.onLogin?.(staff.toObject(), ip);
    this.hooks.onMetric?.({ name: 'staff_login', value: 1, labels: { role: staff.role } });
    this.logger.info('Staff login', { staffId: staff._id.toString() });

    const staffObj = staff.toObject();
    delete (staffObj as any).password;
    return { staff: staffObj, token };
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

  async resetPassword(staffId: string, newPassword: string): Promise<void> {
    const staff = await this.Staff.findOne({ _id: staffId, ...this.tenantFilter });
    if (!staff) throw new StaffNotFoundError(staffId);

    staff.password = await this.adapters.hashPassword(newPassword);
    await staff.save();
    this.logger.info('Staff password reset', { staffId });
  }

  async changeOwnPassword(staffId: string, oldPassword: string, newPassword: string): Promise<void> {
    if (!this.allowSelfPasswordChange) {
      throw new AuthenticationError(ERROR_CODE.InsufficientPermissions, 'Self password change is disabled');
    }

    const staff = await this.Staff.findOne({ _id: staffId, ...this.tenantFilter }).select('+password');
    if (!staff) throw new StaffNotFoundError(staffId);

    const valid = await this.adapters.comparePassword(oldPassword, staff.password);
    if (!valid) throw new AuthenticationError(ERROR_CODE.InvalidCredentials, 'Current password is incorrect');

    staff.password = await this.adapters.hashPassword(newPassword);
    await staff.save();
    this.logger.info('Staff changed own password', { staffId });
  }
}
