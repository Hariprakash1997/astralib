import { Schema, Model, HydratedDocument } from 'mongoose';

export interface IChatKnowledgeEntry {
  entryId: string;
  title: string;
  content: string;
  category?: string;
  tags?: string[];
  isActive: boolean;
  priority: number;
  embedding?: number[];
  metadata?: Record<string, unknown>;
  createdAt: Date;
  updatedAt: Date;
  createdBy?: string;
}

export type ChatKnowledgeEntryDocument = HydratedDocument<IChatKnowledgeEntry>;

export type ChatKnowledgeEntryModel = Model<IChatKnowledgeEntry>;

export function createChatKnowledgeEntrySchema() {
  const schema = new Schema<IChatKnowledgeEntry>(
    {
      entryId: { type: String, required: true, unique: true },
      title: { type: String, required: true },
      content: { type: String, required: true },
      category: { type: String, index: true },
      tags: { type: [String], default: [], index: true },
      isActive: { type: Boolean, default: true, index: true },
      priority: { type: Number, default: 50, min: 0, max: 100, index: true },
      embedding: { type: [Number], select: false },
      metadata: { type: Schema.Types.Mixed, default: {} },
      createdBy: { type: String },
    },
    {
      timestamps: true,
    },
  );

  // Text index for text search strategy
  schema.index(
    { title: 'text', content: 'text', tags: 'text' },
    { weights: { title: 3, content: 2, tags: 1 } },
  );

  return schema;
}
