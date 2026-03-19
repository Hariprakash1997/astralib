import { Schema, Model, HydratedDocument } from 'mongoose';

export interface IChatFAQItem {
  itemId: string;
  question: string;
  answer: string;
  category?: string;
  tags?: string[];
  order: number;
  isActive: boolean;
  viewCount: number;
  helpfulCount: number;
  notHelpfulCount: number;
  tenantId?: string;
  metadata?: Record<string, unknown>;
  createdAt: Date;
  updatedAt: Date;
}

export type ChatFAQItemDocument = HydratedDocument<IChatFAQItem>;

export type ChatFAQItemModel = Model<IChatFAQItem>;

export function createChatFAQItemSchema() {
  const schema = new Schema<IChatFAQItem>(
    {
      itemId: { type: String, required: true, unique: true },
      question: { type: String, required: true },
      answer: { type: String, required: true },
      category: { type: String, index: true },
      tags: { type: [String], default: [] },
      order: { type: Number, default: 0, index: true },
      isActive: { type: Boolean, default: true, index: true },
      viewCount: { type: Number, default: 0 },
      helpfulCount: { type: Number, default: 0 },
      notHelpfulCount: { type: Number, default: 0 },
      tenantId: { type: String, index: true, sparse: true },
      metadata: { type: Schema.Types.Mixed, default: {} },
    },
    {
      timestamps: true,
    },
  );

  return schema;
}
