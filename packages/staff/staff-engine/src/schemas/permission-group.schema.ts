import { Schema, type Connection, type Model, type Document, type Types } from 'mongoose';
import { PERMISSION_TYPE_VALUES } from '@astralibx/staff-types';
import type { IPermissionGroup } from '@astralibx/staff-types';

export interface IPermissionGroupDocument extends Omit<IPermissionGroup, '_id'>, Document {
  _id: Types.ObjectId;
}

const permissionEntrySchema = new Schema(
  {
    key: { type: String, required: true },
    label: { type: String, required: true },
    type: { type: String, enum: PERMISSION_TYPE_VALUES, required: true },
  },
  { _id: false },
);

export function createPermissionGroupModel(
  connection: Connection,
  prefix?: string,
): Model<IPermissionGroupDocument> {
  const schema = new Schema<IPermissionGroupDocument>(
    {
      groupId: { type: String, required: true },
      label: { type: String, required: true, trim: true },
      permissions: { type: [permissionEntrySchema], default: [] },
      sortOrder: { type: Number, default: 0 },
      tenantId: { type: String, index: true, sparse: true },
    },
    { timestamps: true },
  );

  schema.index({ groupId: 1, tenantId: 1 }, { unique: true });
  schema.index({ sortOrder: 1 });

  const collectionName = prefix ? `${prefix}_permission_groups` : 'permission_groups';
  return connection.model<IPermissionGroupDocument>('PermissionGroup', schema, collectionName);
}
