import { Schema, Model, HydratedDocument } from 'mongoose';

export interface IErrorLog {
  ruleId: string;
  ruleName: string;
  contactValue: string;
  error: string;
  stack?: string;
  context?: Record<string, unknown>;
  createdAt: Date;
}

export type ErrorLogDocument = HydratedDocument<IErrorLog>;
export type ErrorLogModel = Model<IErrorLog>;

export function createErrorLogSchema(collectionPrefix?: string) {
  const schema = new Schema<IErrorLog>(
    {
      ruleId: { type: String, required: true, index: true },
      ruleName: { type: String },
      contactValue: { type: String },
      error: { type: String, required: true },
      stack: { type: String },
      context: { type: Schema.Types.Mixed },
    },
    {
      timestamps: { createdAt: true, updatedAt: false },
      collection: `${collectionPrefix || ''}error_logs`,
    }
  );

  schema.index({ createdAt: -1 });

  return schema;
}
