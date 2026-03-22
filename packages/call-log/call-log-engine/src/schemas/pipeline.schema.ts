import crypto from 'node:crypto';
import { Schema, Document, Model } from 'mongoose';
import type mongoose from 'mongoose';
import type { IPipeline, IPipelineStage } from '@astralibx/call-log-types';

// ── Document interfaces ──────────────────────────────────────────────────────

export interface IPipelineStageDocument extends IPipelineStage, Document {}

export interface IPipelineDocument extends IPipeline, Document {}

// ── Sub-document schema ──────────────────────────────────────────────────────

export const PipelineStageSchema = new Schema<IPipelineStageDocument>(
  {
    stageId: { type: String, required: true, default: () => crypto.randomUUID() },
    name: { type: String, required: true },
    color: { type: String, required: true },
    order: { type: Number, required: true },
    isTerminal: { type: Boolean, default: false },
    isDefault: { type: Boolean, default: false },
  },
  { _id: false },
);

// ── Main schema ──────────────────────────────────────────────────────────────

export const PipelineSchema = new Schema<IPipelineDocument>(
  {
    pipelineId: { type: String, required: true, unique: true, default: () => crypto.randomUUID() },
    name: { type: String, required: true },
    description: { type: String },
    stages: { type: [PipelineStageSchema], required: true },
    isActive: { type: Boolean, default: true, index: true },
    isDeleted: { type: Boolean, default: false },
    isDefault: { type: Boolean, default: false },
    createdBy: { type: String, required: true },
    tenantId: { type: String, sparse: true },
    metadata: { type: Schema.Types.Mixed },
  },
  {
    timestamps: true,
  },
);

// Note: pipelineId unique index is defined inline via `unique: true`.
// isActive index is defined inline via `index: true`.
// tenantId sparse index is defined inline via `sparse: true`.
// No additional schema.index() calls needed for these fields.

// ── Factory ──────────────────────────────────────────────────────────────────

export function createPipelineModel(
  connection: mongoose.Connection,
  prefix?: string,
): Model<IPipelineDocument> {
  const collectionName = prefix ? `${prefix}_pipelines` : 'pipelines';
  return connection.model<IPipelineDocument>('Pipeline', PipelineSchema, collectionName);
}
