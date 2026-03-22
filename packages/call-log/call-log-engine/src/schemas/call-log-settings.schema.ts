import { Schema, Document, Model } from 'mongoose';
import type mongoose from 'mongoose';
import { CallPriority } from '@astralibx/call-log-types';
import type { ICallLogSettings, IPriorityConfig } from '@astralibx/call-log-types';
import { CALL_LOG_DEFAULTS, AGENT_CALL_DEFAULTS } from '../constants/index.js';

// ── Document interface ───────────────────────────────────────────────────────

export interface ICallLogSettingsDocument extends ICallLogSettings, Document {}

// ── Default priority levels ──────────────────────────────────────────────────

const DEFAULT_PRIORITY_LEVELS: IPriorityConfig[] = [
  { value: CallPriority.Low, label: 'Low', color: '#6b7280', order: 1 },
  { value: CallPriority.Medium, label: 'Medium', color: '#3b82f6', order: 2 },
  { value: CallPriority.High, label: 'High', color: '#f59e0b', order: 3 },
  { value: CallPriority.Urgent, label: 'Urgent', color: '#ef4444', order: 4 },
];

// ── Sub-document schema ──────────────────────────────────────────────────────

const PriorityConfigSchema = new Schema<IPriorityConfig>(
  {
    value: { type: String, required: true },
    label: { type: String, required: true },
    color: { type: String, required: true },
    order: { type: Number, required: true },
  },
  { _id: false },
);

// ── Main schema ──────────────────────────────────────────────────────────────

export const CallLogSettingsSchema = new Schema<ICallLogSettingsDocument>(
  {
    key: { type: String, required: true, default: 'global' },
    availableTags: { type: [String], default: [] },
    availableCategories: { type: [String], default: [] },
    priorityLevels: {
      type: [PriorityConfigSchema],
      default: () => DEFAULT_PRIORITY_LEVELS.map((p) => ({ ...p })),
    },
    defaultFollowUpDays: {
      type: Number,
      default: CALL_LOG_DEFAULTS.DefaultFollowUpDays,
    },
    followUpReminderEnabled: { type: Boolean, default: true },
    defaultPipelineId: { type: String },
    timelinePageSize: {
      type: Number,
      default: CALL_LOG_DEFAULTS.TimelinePageSize,
    },
    maxConcurrentCalls: {
      type: Number,
      default: AGENT_CALL_DEFAULTS.MaxConcurrentCalls,
    },
    tenantId: { type: String, sparse: true },
    metadata: { type: Schema.Types.Mixed },
  },
  {
    timestamps: true,
  },
);

CallLogSettingsSchema.index({ key: 1, tenantId: 1 }, { unique: true });

// ── Factory ──────────────────────────────────────────────────────────────────

export function createCallLogSettingsModel(
  connection: mongoose.Connection,
  prefix?: string,
): Model<ICallLogSettingsDocument> {
  const collectionName = prefix ? `${prefix}_call_log_settings` : 'call_log_settings';
  return connection.model<ICallLogSettingsDocument>(
    'CallLogSettings',
    CallLogSettingsSchema,
    collectionName,
  );
}
