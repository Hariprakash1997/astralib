import jwt from 'jsonwebtoken';
import type { Model } from 'mongoose';
import type {
  LogAdapter, StaffHooks, StaffAdapters,
} from '@astralibx/staff-types';
import { STAFF_ROLE, STAFF_STATUS } from '@astralibx/staff-types';
import type { IStaffDocument } from '../schemas/staff.schema.js';
import type { RateLimiterService } from './rate-limiter.service.js';
import {
  AuthenticationError, StaffNotFoundError,
  SetupError, RateLimitError,
} from '../errors/index.js';
import { ERROR_CODE, ERROR_MESSAGE } from '../constants/index.js';

export interface AuthServiceDeps {
  Staff: Model<IStaffDocument>;
  adapters: StaffAdapters;
  hooks: StaffHooks;
  rateLimiter: RateLimiterService;
  logger: LogAdapter;
  tenantId?: string;
  jwtSecret: string;
  staffTokenExpiry: string;
  ownerTokenExpiry: string;
  allowSelfPasswordChange: boolean;
}

export class AuthService {
  private Staff: Model<IStaffDocument>;
  private adapters: StaffAdapters;
  private hooks: StaffHooks;
  private rateLimiter: RateLimiterService;
  private logger: LogAdapter;
  private tenantId?: string;
  private jwtSecret: string;
  private staffTokenExpiry: string;
  private ownerTokenExpiry: string;
  private allowSelfPasswordChange: boolean;

  constructor(deps: AuthServiceDeps) {
    this.Staff = deps.Staff;
    this.adapters = deps.adapters;
    this.hooks = deps.hooks;
    this.rateLimiter = deps.rateLimiter;
    this.logger = deps.logger;
    this.tenantId = deps.tenantId;
    this.jwtSecret = deps.jwtSecret;
    this.staffTokenExpiry = deps.staffTokenExpiry;
    this.ownerTokenExpiry = deps.ownerTokenExpiry;
    this.allowSelfPasswordChange = deps.allowSelfPasswordChange;
  }

  private get tenantFilter(): Record<string, unknown> {
    return this.tenantId ? { tenantId: this.tenantId } : {};
  }

  generateToken(staffId: string, role: string): string {
    const expiresIn = role === STAFF_ROLE.Owner ? this.ownerTokenExpiry : this.staffTokenExpiry;
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    return jwt.sign({ staffId, role }, this.jwtSecret, { expiresIn } as any);
  }

  async setupOwner(data: { name: string; email: string; password: string }): Promise<{ staff: IStaffDocument; token: string }> {
    // Race-safe: check count first, then create. If two requests race past the
    // count check, the unique index on {email, tenantId} will reject the second
    // create, which we catch and convert to SetupError.
    const count = await this.Staff.countDocuments(this.tenantFilter);
    if (count > 0) throw new SetupError();

    const hashedPassword = await this.adapters.hashPassword(data.password);
    let staff: IStaffDocument;
    try {
      const doc = await this.Staff.create({
        name: data.name,
        email: data.email.toLowerCase().trim(),
        password: hashedPassword,
        role: STAFF_ROLE.Owner,
        status: STAFF_STATUS.Active,
        permissions: [],
        ...this.tenantFilter,
      });
      staff = doc.toObject() as unknown as IStaffDocument;
    } catch (err: unknown) {
      // Race condition: another request created a staff member between our count and create
      if (err && typeof err === 'object' && 'code' in err && (err as any).code === 11000) {
        throw new SetupError();
      }
      throw err;
    }
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
