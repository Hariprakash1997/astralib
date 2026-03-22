import crypto from 'node:crypto';
import { Schema, Document, Model } from 'mongoose';
import type mongoose from 'mongoose';
import { CallDirection, CallPriority, TimelineEntryType } from '@astralibx/call-log-types';
import type { ICallLog, IContactRef, ITimelineEntry, IStageChange } from '@astralibx/call-log-types';

// ── Document interface ───────────────────────────────────────────────────────

export interface ICallLogDocument extends Omit<ICallLog, 'agentId'>, Document {
  agentId: mongoose.Types.ObjectId;
}

// ── Sub-document schemas ─────────────────────────────────────────────────────

export const ContactRefSchema = new Schema<IContactRef>(
  {
    externalId: { type: String, required: true },
    displayName: { type: String, required: true },
    phone: { type: String },
    email: { type: String },
  },
  { _id: false },
);

export const TimelineEntrySchema = new Schema<ITimelineEntry>(
  {
    entryId: { type: String, required: true, default: () => crypto.randomUUID() },
    type: {
      type: String,
      required: true,
      enum: Object.values(TimelineEntryType),
    },
    content: { type: String },
    authorId: { type: String },
    authorName: { type: String },
    fromStageId: { type: String },
    fromStageName: { type: String },
    toStageId: { type: String },
    toStageName: { type: String },
    fromAgentId: { type: String },
    fromAgentName: { type: String },
    toAgentId: { type: String },
    toAgentName: { type: String },
    createdAt: { type: Date, default: Date.now },
  },
  { _id: false },
);

export const StageChangeSchema = new Schema<IStageChange>(
  {
    fromStageId: { type: String, required: true },
    toStageId: { type: String, required: true },
    fromStageName: { type: String, required: true },
    toStageName: { type: String, required: true },
    changedBy: { type: String, required: true },
    changedAt: { type: Date, required: true },
    timeInStageMs: { type: Number, required: true },
  },
  { _id: false },
);

// ── Main schema ──────────────────────────────────────────────────────────────

export const CallLogSchema = new Schema<ICallLogDocument>(
  {
    callLogId: { type: String, required: true, unique: true, default: () => crypto.randomUUID() },
    pipelineId: { type: String, required: true, index: true },
    currentStageId: { type: String, required: true, index: true },
    contactRef: { type: ContactRefSchema, required: true },
    direction: {
      type: String,
      required: true,
      enum: Object.values(CallDirection),
    },
    callDate: { type: Date, required: true, index: true },
    nextFollowUpDate: { type: Date, index: true },
    followUpNotifiedAt: { type: Date },
    priority: {
      type: String,
      required: true,
      enum: Object.values(CallPriority),
      default: CallPriority.Medium,
    },
    agentId: { type: Schema.Types.ObjectId, required: true, index: true },
    assignedBy: { type: String },
    tags: { type: [String], default: [], index: true },
    category: { type: String },
    timeline: { type: [TimelineEntrySchema], default: [] },
    stageHistory: { type: [StageChangeSchema], default: [] },
    durationMinutes: { type: Number, min: 0 },
    channel: { type: String, default: 'phone', index: true },
    outcome: { type: String, default: 'pending', index: true },
    isFollowUp: { type: Boolean, default: false, index: true },
    isDeleted: { type: Boolean, default: false },
    deletedAt: { type: Date },
    isClosed: { type: Boolean, default: false, index: true },
    closedAt: { type: Date },
    tenantId: { type: String, sparse: true },
    metadata: { type: Schema.Types.Mixed },
  },
  {
    timestamps: true,
  },
);

// callLogId unique index is defined inline via `unique: true`.
// tenantId sparse index is defined inline via `sparse: true`.
// Compound and additional indexes:
CallLogSchema.index({ 'contactRef.externalId': 1 });
CallLogSchema.index({ pipelineId: 1, currentStageId: 1 });
CallLogSchema.index({ agentId: 1, isClosed: 1 });
CallLogSchema.index({ isDeleted: 1, isClosed: 1 });

// ── Factory ──────────────────────────────────────────────────────────────────

export function createCallLogModel(
  connection: mongoose.Connection,
  prefix?: string,
): Model<ICallLogDocument> {
  const collectionName = prefix ? `${prefix}_call_logs` : 'call_logs';
  return connection.model<ICallLogDocument>('CallLog', CallLogSchema, collectionName);
}
