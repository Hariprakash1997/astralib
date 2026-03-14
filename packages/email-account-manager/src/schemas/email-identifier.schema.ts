import { Schema, Model, HydratedDocument } from 'mongoose';
import { IDENTIFIER_STATUS, BOUNCE_TYPE } from '../constants';
import type { IdentifierStatus, BounceType } from '../constants';

export interface IEmailIdentifier {
  email: string;
  status: IdentifierStatus;
  sentCount: number;
  bounceCount: number;
  lastSentAt?: Date;
  lastBouncedAt?: Date;
  bounceType?: BounceType;
  unsubscribedAt?: Date;
  metadata?: Record<string, unknown>;
  createdAt: Date;
  updatedAt: Date;
}

export type EmailIdentifierDocument = HydratedDocument<IEmailIdentifier>;

export interface EmailIdentifierStatics {
  findOrCreate(email: string): Promise<{ identifier: EmailIdentifierDocument; created: boolean }>;
  markBounced(email: string, bounceType: BounceType): Promise<EmailIdentifierDocument | null>;
  markUnsubscribed(email: string): Promise<EmailIdentifierDocument | null>;
  incrementSentCount(email: string): Promise<EmailIdentifierDocument | null>;
  findByEmail(email: string): Promise<EmailIdentifierDocument | null>;
}

export type EmailIdentifierModel = Model<IEmailIdentifier> & EmailIdentifierStatics;

export interface CreateEmailIdentifierSchemaOptions {
  collectionName?: string;
}

export function createEmailIdentifierSchema(options?: CreateEmailIdentifierSchemaOptions) {
  const schema = new Schema<IEmailIdentifier>(
    {
      email: { type: String, required: true, unique: true, lowercase: true },
      status: {
        type: String,
        enum: Object.values(IDENTIFIER_STATUS),
        default: IDENTIFIER_STATUS.Active,
        index: true,
      },
      sentCount: { type: Number, default: 0 },
      bounceCount: { type: Number, default: 0 },
      lastSentAt: Date,
      lastBouncedAt: Date,
      bounceType: { type: String, enum: Object.values(BOUNCE_TYPE) },
      unsubscribedAt: Date,
      metadata: { type: Schema.Types.Mixed },
    },
    {
      timestamps: true,
      collection: options?.collectionName || 'email_identifiers',

      statics: {
        async findOrCreate(email: string) {
          const normalized = email.toLowerCase().trim();
          const existing = await this.findOne({ email: normalized });
          if (existing) {
            return { identifier: existing, created: false };
          }
          const identifier = await this.create({ email: normalized });
          return { identifier, created: true };
        },

        markBounced(email: string, bounceType: BounceType) {
          const normalized = email.toLowerCase().trim();
          return this.findOneAndUpdate(
            { email: normalized },
            {
              $set: {
                status: IDENTIFIER_STATUS.Bounced,
                bounceType,
                lastBouncedAt: new Date(),
              },
              $inc: { bounceCount: 1 },
            },
            { new: true },
          );
        },

        markUnsubscribed(email: string) {
          const normalized = email.toLowerCase().trim();
          return this.findOneAndUpdate(
            { email: normalized },
            {
              $set: {
                status: IDENTIFIER_STATUS.Unsubscribed,
                unsubscribedAt: new Date(),
              },
            },
            { new: true },
          );
        },

        incrementSentCount(email: string) {
          const normalized = email.toLowerCase().trim();
          return this.findOneAndUpdate(
            { email: normalized },
            {
              $inc: { sentCount: 1 },
              $set: { lastSentAt: new Date() },
            },
            { new: true, upsert: true },
          );
        },

        findByEmail(email: string) {
          const normalized = email.toLowerCase().trim();
          return this.findOne({ email: normalized });
        },
      },
    },
  );

  schema.index({ email: 1 }, { unique: true });
  schema.index({ status: 1 });

  return schema;
}
