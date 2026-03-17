import { Schema, Model, HydratedDocument } from 'mongoose';

export interface IChatMemory {
  memoryId: string;
  scope: 'global' | 'agent' | 'visitor' | 'channel';
  scopeId?: string;
  key: string;
  content: string;
  category?: string;
  tags?: string[];
  priority: number;
  isActive: boolean;
  source: 'admin' | 'agent' | 'ai' | 'import';
  embedding?: number[];
  metadata?: Record<string, unknown>;
  createdAt: Date;
  updatedAt: Date;
  createdBy?: string;
}

export type ChatMemoryDocument = HydratedDocument<IChatMemory>;

export type ChatMemoryModel = Model<IChatMemory>;

export function createChatMemorySchema() {
  const schema = new Schema<IChatMemory>(
    {
      memoryId: { type: String, required: true, unique: true },
      scope: {
        type: String,
        enum: ['global', 'agent', 'visitor', 'channel'],
        required: true,
      },
      scopeId: { type: String, default: null },
      key: { type: String, required: true },
      content: { type: String, required: true },
      category: { type: String, index: true },
      tags: { type: [String], default: [] },
      priority: { type: Number, default: 50, min: 0, max: 100, index: true },
      isActive: { type: Boolean, default: true, index: true },
      source: {
        type: String,
        enum: ['admin', 'agent', 'ai', 'import'],
        default: 'admin',
        index: true,
      },
      embedding: { type: [Number], select: false },
      metadata: { type: Schema.Types.Mixed, default: {} },
      createdBy: { type: String },
    },
    {
      timestamps: true,
    },
  );

  // Compound index for scope + scopeId queries
  schema.index({ scope: 1, scopeId: 1 });

  // Unique key within scope + scopeId
  schema.index({ scope: 1, scopeId: 1, key: 1 }, { unique: true });

  // Text index for text search strategy
  schema.index(
    { content: 'text', key: 'text', tags: 'text' },
    { weights: { key: 3, content: 2, tags: 1 } },
  );

  return schema;
}
