import { Schema, Model, HydratedDocument } from 'mongoose';

export interface IChatCannedResponse {
  responseId: string;
  title: string;
  content: string;
  category?: string;
  shortcut?: string;
  isActive: boolean;
  order: number;
  createdBy?: string;
  tenantId?: string;
  createdAt: Date;
  updatedAt: Date;
}

export type ChatCannedResponseDocument = HydratedDocument<IChatCannedResponse>;

export type ChatCannedResponseModel = Model<IChatCannedResponse>;

export function createChatCannedResponseSchema() {
  const schema = new Schema<IChatCannedResponse>(
    {
      responseId: { type: String, required: true, unique: true },
      title: { type: String, required: true },
      content: { type: String, required: true },
      category: { type: String, index: true },
      shortcut: { type: String, index: true },
      isActive: { type: Boolean, default: true },
      order: { type: Number, default: 0 },
      createdBy: { type: String },
      tenantId: { type: String, index: true, sparse: true },
    },
    {
      timestamps: true,
    },
  );

  return schema;
}
