import { Schema, Model, HydratedDocument } from 'mongoose';

export interface IPendingMessage {
  sessionId: string;
  message: Record<string, unknown>;
  expiresAt: Date;
  createdAt: Date;
}

export type PendingMessageDocument = HydratedDocument<IPendingMessage>;

export type PendingMessageModel = Model<IPendingMessage>;

export function createPendingMessageSchema() {
  const schema = new Schema<IPendingMessage>(
    {
      sessionId: { type: String, required: true, index: true },
      message: { type: Schema.Types.Mixed, required: true },
      expiresAt: { type: Date, required: true },
      createdAt: { type: Date, default: Date.now },
    },
    {
      timestamps: false,
    },
  );

  schema.index({ expiresAt: 1 }, { expireAfterSeconds: 0 });

  return schema;
}
