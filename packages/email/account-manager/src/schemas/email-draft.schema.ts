import { Schema, Model, Types, HydratedDocument } from 'mongoose';
import { DRAFT_STATUS } from '../constants';
import type { DraftStatus } from '../constants';

export interface IEmailDraft {
  to: string;
  subject: string;
  htmlBody: string;
  textBody?: string;
  accountId: Types.ObjectId;
  status: DraftStatus;
  approvedAt?: Date;
  rejectedAt?: Date;
  rejectionReason?: string;
  sentAt?: Date;
  scheduledAt?: Date;
  failureReason?: string;
  source?: string;
  identifierId?: string;
  metadata?: Record<string, unknown>;
  createdAt: Date;
  updatedAt: Date;
}

export type EmailDraftDocument = HydratedDocument<IEmailDraft>;

export interface EmailDraftStatics {
  findPending(limit?: number): Promise<EmailDraftDocument[]>;
  findByStatus(status: DraftStatus, limit?: number): Promise<EmailDraftDocument[]>;
  countByStatus(): Promise<Record<string, number>>;
}

export type EmailDraftModel = Model<IEmailDraft> & EmailDraftStatics;

export interface CreateEmailDraftSchemaOptions {
  collectionName?: string;
}

export function createEmailDraftSchema(options?: CreateEmailDraftSchemaOptions) {
  const schema = new Schema<IEmailDraft>(
    {
      to: { type: String, required: true, lowercase: true },
      subject: { type: String, required: true },
      htmlBody: { type: String, required: true },
      textBody: String,
      accountId: { type: Schema.Types.ObjectId, required: true },
      status: {
        type: String,
        enum: Object.values(DRAFT_STATUS),
        default: DRAFT_STATUS.Pending,
      },
      approvedAt: Date,
      rejectedAt: Date,
      rejectionReason: String,
      sentAt: Date,
      scheduledAt: Date,
      failureReason: String,
      source: { type: String },
      identifierId: { type: String },
      metadata: { type: Schema.Types.Mixed },
    },
    {
      timestamps: true,
      collection: options?.collectionName || 'email_drafts',

      statics: {
        findPending(limit = 50) {
          return this.find({ status: DRAFT_STATUS.Pending })
            .sort({ createdAt: -1 })
            .limit(limit);
        },

        findByStatus(status: DraftStatus, limit = 50) {
          return this.find({ status })
            .sort({ createdAt: -1 })
            .limit(limit);
        },

        async countByStatus() {
          const results = await this.aggregate([
            { $group: { _id: '$status', count: { $sum: 1 } } },
          ]);

          const counts: Record<string, number> = {};
          for (const status of Object.values(DRAFT_STATUS)) {
            counts[status] = 0;
          }
          for (const result of results) {
            counts[result._id] = result.count;
          }
          return counts;
        },
      },
    },
  );

  schema.index({ status: 1, createdAt: -1 });
  schema.index({ accountId: 1, status: 1 });

  return schema;
}
