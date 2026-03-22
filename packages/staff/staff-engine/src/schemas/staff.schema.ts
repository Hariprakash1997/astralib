import { Schema, type Connection, type Model, type Document, type Types } from 'mongoose';
import { STAFF_ROLE_VALUES, STAFF_STATUS_VALUES, STAFF_STATUS } from '@astralibx/staff-types';
import type { IStaff } from '@astralibx/staff-types';

export interface IStaffDocument extends Omit<IStaff, '_id'>, Document {
  _id: Types.ObjectId;
}

export function createStaffModel(connection: Connection, prefix?: string): Model<IStaffDocument> {
  const schema = new Schema<IStaffDocument>(
    {
      name: { type: String, required: true, trim: true },
      email: { type: String, required: true, trim: true, lowercase: true },
      password: { type: String, required: true, select: false },
      role: { type: String, enum: STAFF_ROLE_VALUES, default: 'staff' },
      status: { type: String, enum: STAFF_STATUS_VALUES, default: STAFF_STATUS.Pending },
      permissions: { type: [String], default: [] },
      externalUserId: { type: String, sparse: true },
      lastLoginAt: { type: Date },
      lastLoginIp: { type: String },
      metadata: { type: Schema.Types.Mixed },
      tenantId: { type: String, sparse: true },
    },
    { timestamps: true },
  );

  schema.index({ email: 1, tenantId: 1 }, { unique: true });
  schema.index({ status: 1 });
  schema.index({ role: 1 });

  const collectionName = prefix ? `${prefix}_staff` : 'staff';
  return connection.model<IStaffDocument>('Staff', schema, collectionName);
}
