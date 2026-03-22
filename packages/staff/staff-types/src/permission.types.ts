import type { PermissionType } from './enums.js';

export interface IPermissionEntry {
  key: string;
  label: string;
  type: PermissionType;
}

export interface IPermissionGroup {
  _id: unknown;
  groupId: string;
  label: string;
  permissions: IPermissionEntry[];
  sortOrder: number;
  tenantId?: string;
  createdAt: Date;
  updatedAt: Date;
}

export interface IPermissionGroupCreateInput {
  groupId: string;
  label: string;
  permissions: IPermissionEntry[];
  sortOrder?: number;
}

export interface IPermissionGroupUpdateInput {
  label?: string;
  permissions?: IPermissionEntry[];
  sortOrder?: number;
}
