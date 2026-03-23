import type { StaffAdapters } from './adapter.types.js';
import type { IStaffSummary } from './staff.types.js';

export interface LogAdapter {
  info: (message: string, meta?: Record<string, unknown>) => void;
  warn: (message: string, meta?: Record<string, unknown>) => void;
  error: (message: string, meta?: Record<string, unknown>) => void;
}

export interface StaffMetric {
  name: string;
  value: number;
  labels?: Record<string, string>;
  timestamp?: Date;
}

export interface StaffHooks {
  onStaffCreated?: (staff: IStaffSummary) => void | Promise<void>;
  onLogin?: (staff: IStaffSummary, ip?: string) => void | Promise<void>;
  onLoginFailed?: (email: string, ip?: string) => void | Promise<void>;
  onPermissionsChanged?: (staffId: string, oldPerms: string[], newPerms: string[]) => void | Promise<void>;
  onStatusChanged?: (staffId: string, oldStatus: string, newStatus: string) => void | Promise<void>;
  onMetric?: (metric: StaffMetric) => void | Promise<void>;
}

export interface RateLimiterOptions {
  windowMs?: number;
  maxAttempts?: number;
}

export interface StaffEngineOptions {
  requireEmailUniqueness?: boolean;
  allowSelfPasswordChange?: boolean;
  rateLimiter?: RateLimiterOptions;
}

export interface StaffEngineConfig {
  db: {
    connection: unknown;
    collectionPrefix?: string;
  };
  redis?: {
    connection: unknown;
    keyPrefix?: string;
  };
  logger?: LogAdapter;
  tenantId?: string;
  auth: {
    jwtSecret: string;
    staffTokenExpiry?: string;
    ownerTokenExpiry?: string;
    permissionCacheTtlMs?: number;
  };
  adapters: StaffAdapters;
  hooks?: StaffHooks;
  options?: StaffEngineOptions;
}

export interface ResolvedOptions {
  requireEmailUniqueness: boolean;
  allowSelfPasswordChange: boolean;
  rateLimiter: {
    windowMs: number;
    maxAttempts: number;
  };
}

export const DEFAULT_OPTIONS: ResolvedOptions = {
  requireEmailUniqueness: true,
  allowSelfPasswordChange: false,
  rateLimiter: {
    windowMs: 15 * 60 * 1000,
    maxAttempts: 5,
  },
};

// DEFAULT_AUTH lives in staff-engine/src/constants/index.ts (internal, not exported from types)
