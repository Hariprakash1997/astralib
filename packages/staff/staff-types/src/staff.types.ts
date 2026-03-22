import type { StaffRole, StaffStatus } from './enums.js';

export interface IStaff {
  _id: unknown;
  name: string;
  email: string;
  password: string;
  role: StaffRole;
  status: StaffStatus;
  permissions: string[];
  externalUserId?: string;
  lastLoginAt?: Date;
  lastLoginIp?: string;
  metadata?: Record<string, unknown>;
  tenantId?: string;
  createdAt: Date;
  updatedAt: Date;
}

export interface IStaffSummary {
  _id: unknown;
  name: string;
  email: string;
  role: StaffRole;
  status: StaffStatus;
  permissions: string[];
  lastLoginAt?: Date;
  createdAt: Date;
}

export interface IStaffCreateInput {
  name: string;
  email: string;
  password: string;
  role?: StaffRole;
  status?: StaffStatus;
  permissions?: string[];
  externalUserId?: string;
  metadata?: Record<string, unknown>;
}

export interface IStaffUpdateInput {
  name?: string;
  email?: string;
  metadata?: Record<string, unknown>;
}

export interface IStaffListFilters {
  status?: StaffStatus;
  role?: StaffRole;
  page?: number;
  limit?: number;
}

export interface IPaginatedResult<T> {
  data: T[];
  pagination: {
    page: number;
    limit: number;
    total: number;
    totalPages: number;
  };
}
