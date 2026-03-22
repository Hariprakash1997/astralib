import { PERMISSION_TYPE } from '@astralibx/staff-types';
import { InvalidPermissionError } from '../errors/index.js';
import type { IPermissionGroupDocument } from '../schemas/permission-group.schema.js';

/**
 * Validates that for every edit-type permission, the corresponding view-type permission
 * is also present. Single-level cascade only.
 * Example: 'chat:edit' requires 'chat:view'
 */
export function validatePermissionPairs(
  permissions: string[],
  allGroups: IPermissionGroupDocument[],
): void {
  const allEntries = allGroups.flatMap(g => g.permissions);
  const editKeys = allEntries
    .filter(e => e.type === PERMISSION_TYPE.Edit)
    .map(e => e.key);

  const permissionSet = new Set(permissions);
  const missingViewKeys: string[] = [];

  for (const editKey of editKeys) {
    if (!permissionSet.has(editKey)) continue;
    const prefix = editKey.substring(0, editKey.lastIndexOf(':'));
    const viewKey = `${prefix}:view`;
    const viewEntry = allEntries.find(e => e.key === viewKey && e.type === PERMISSION_TYPE.View);
    if (viewEntry && !permissionSet.has(viewKey)) {
      missingViewKeys.push(viewKey);
    }
  }

  if (missingViewKeys.length > 0) {
    throw new InvalidPermissionError(missingViewKeys);
  }
}
