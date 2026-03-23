import { AlxStaffConfig } from '../config.js';
import type {
  IStaffSummary,
  IStaffCreateInput,
  IStaffUpdateInput,
  IStaffListFilters,
  IPermissionGroup,
  IPermissionGroupCreateInput,
  IPermissionGroupUpdateInput,
} from '@astralibx/staff-types';

export interface StaffApiResponse<T> {
  success: boolean;
  data: T;
  message?: string;
}

export interface SetupInput {
  name: string;
  email: string;
  password: string;
}

export interface SetupResult {
  staff: IStaffSummary;
  token: string;
}

export interface LoginResult {
  staff: IStaffSummary;
  token: string;
}

export interface StaffListResult {
  staff: IStaffSummary[];
  total: number;
  page: number;
  limit: number;
  totalPages: number;
}

async function request<T>(
  method: string,
  path: string,
  body?: unknown,
): Promise<T> {
  const baseUrl = AlxStaffConfig.getApiUrl();
  const url = `${baseUrl}${path}`;
  const headers = AlxStaffConfig.getHeaders();

  const res = await fetch(url, {
    method,
    headers,
    body: body !== undefined ? JSON.stringify(body) : undefined,
  });

  const json: StaffApiResponse<T> = await res.json();

  if (!res.ok || !json.success) {
    throw new Error(json.message ?? `Request failed: ${res.status}`);
  }

  return json.data;
}

/**
 * High-level API client for all staff-engine endpoints.
 * Uses AlxStaffConfig for base URL and auth token.
 */
export class StaffApiClient {
  // ── Setup ─────────────────────────────────────────────────────────────

  static async setup(data: SetupInput): Promise<SetupResult> {
    return request<SetupResult>('POST', '/setup', data);
  }

  // ── Auth ──────────────────────────────────────────────────────────────

  static async login(email: string, password: string): Promise<LoginResult> {
    return request<LoginResult>('POST', '/login', { email, password });
  }

  static async getMe(): Promise<IStaffSummary> {
    return request<IStaffSummary>('GET', '/me');
  }

  static async changePassword(oldPassword: string, newPassword: string): Promise<void> {
    return request<void>('PUT', '/me/password', { oldPassword, newPassword });
  }

  // ── Staff CRUD ────────────────────────────────────────────────────────

  static async listStaff(filters?: IStaffListFilters): Promise<StaffListResult> {
    const params = filters
      ? '?' + new URLSearchParams(
          Object.fromEntries(
            Object.entries(filters)
              .filter(([, v]) => v !== undefined)
              .map(([k, v]) => [k, String(v)]),
          ),
        ).toString()
      : '';
    return request<StaffListResult>('GET', `/${params}`);
  }

  static async createStaff(data: IStaffCreateInput): Promise<IStaffSummary> {
    return request<IStaffSummary>('POST', '/', data);
  }

  static async updateStaff(staffId: string, data: IStaffUpdateInput): Promise<IStaffSummary> {
    return request<IStaffSummary>('PUT', `/${staffId}`, data);
  }

  static async updatePermissions(staffId: string, permissions: string[]): Promise<IStaffSummary> {
    return request<IStaffSummary>('PUT', `/${staffId}/permissions`, { permissions });
  }

  static async updateStatus(staffId: string, status: string): Promise<IStaffSummary> {
    return request<IStaffSummary>('PUT', `/${staffId}/status`, { status });
  }

  static async resetPassword(staffId: string, password: string): Promise<void> {
    return request<void>('PUT', `/${staffId}/password`, { password });
  }

  // ── Permission Groups ─────────────────────────────────────────────────

  static async listPermissionGroups(): Promise<IPermissionGroup[]> {
    return request<IPermissionGroup[]>('GET', '/permission-groups');
  }

  static async createPermissionGroup(data: IPermissionGroupCreateInput): Promise<IPermissionGroup> {
    return request<IPermissionGroup>('POST', '/permission-groups', data);
  }

  static async updatePermissionGroup(
    groupId: string,
    data: IPermissionGroupUpdateInput,
  ): Promise<IPermissionGroup> {
    return request<IPermissionGroup>('PUT', `/permission-groups/${groupId}`, data);
  }

  static async deletePermissionGroup(groupId: string): Promise<void> {
    return request<void>('DELETE', `/permission-groups/${groupId}`);
  }
}
