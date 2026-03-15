import { Schema, Model, HydratedDocument } from 'mongoose';
import { ACCOUNT_PROVIDER, ACCOUNT_STATUS } from '../constants';
import type { AccountProvider, AccountStatus } from '../constants';
import type { WarmupPhase } from '../types/config.types';

export interface IEmailAccount {
  email: string;
  senderName: string;
  provider: AccountProvider;
  status: AccountStatus;

  smtp: { host: string; port: number; user: string; pass: string };
  imap?: { host: string; port: number; user: string; pass: string };
  ses?: { region: string; configurationSet?: string };

  limits: { dailyMax: number };

  health: {
    score: number;
    consecutiveErrors: number;
    bounceCount: number;
    thresholds: {
      minScore: number;
      maxBounceRate: number;
      maxConsecutiveErrors: number;
    };
  };

  warmup: {
    enabled: boolean;
    startedAt?: Date;
    completedAt?: Date;
    currentDay: number;
    schedule: WarmupPhase[];
  };

  metadata?: Record<string, unknown>;

  totalEmailsSent: number;
  lastSuccessfulSendAt?: Date;
  lastImapCheckAt?: Date;

  createdAt: Date;
  updatedAt: Date;
}

export type EmailAccountDocument = HydratedDocument<IEmailAccount>;

export interface EmailAccountStatics {
  findActive(): Promise<EmailAccountDocument[]>;
  findByProvider(provider: AccountProvider): Promise<EmailAccountDocument[]>;
  findByEmail(email: string): Promise<EmailAccountDocument | null>;
  getBestAvailable(): Promise<EmailAccountDocument | null>;
}

export type EmailAccountModel = Model<IEmailAccount> & EmailAccountStatics;

export interface CreateEmailAccountSchemaOptions {
  collectionName?: string;
}

export function createEmailAccountSchema(options?: CreateEmailAccountSchemaOptions) {
  const schema = new Schema<IEmailAccount>(
    {
      email: { type: String, required: true, unique: true, lowercase: true },
      senderName: { type: String, required: true },
      provider: { type: String, enum: Object.values(ACCOUNT_PROVIDER), required: true },
      status: {
        type: String,
        enum: Object.values(ACCOUNT_STATUS),
        default: ACCOUNT_STATUS.Active,
      },

      // WARNING: SMTP/IMAP credentials are stored as plaintext in the database.
      // Consumers MUST encrypt `smtp.pass` and `imap.pass` at the application layer
      // before storing, and decrypt after retrieval. A built-in encryption layer
      // is planned for a future version.
      smtp: {
        type: {
          host: { type: String, required: true },
          port: { type: Number, required: true },
          user: { type: String, required: true },
          pass: { type: String, required: true },
        },
        required: true,
        _id: false,
      },

      imap: {
        type: {
          host: { type: String, required: true },
          port: { type: Number, required: true },
          user: { type: String, required: true },
          pass: { type: String, required: true },
        },
        _id: false,
      },

      ses: {
        type: {
          region: { type: String, required: true },
          configurationSet: String,
        },
        _id: false,
      },

      limits: {
        type: {
          dailyMax: { type: Number, required: true, default: 50 },
        },
        required: true,
        _id: false,
      },

      health: {
        type: {
          score: { type: Number, default: 100, min: 0, max: 100 },
          consecutiveErrors: { type: Number, default: 0 },
          bounceCount: { type: Number, default: 0 },
          thresholds: {
            type: {
              minScore: { type: Number, default: 50 },
              maxBounceRate: { type: Number, default: 0.1 },
              maxConsecutiveErrors: { type: Number, default: 5 },
            },
            _id: false,
          },
        },
        required: true,
        _id: false,
      },

      warmup: {
        type: {
          enabled: { type: Boolean, default: true },
          startedAt: Date,
          completedAt: Date,
          currentDay: { type: Number, default: 1 },
          schedule: [{
            days: { type: [Number], required: true },
            dailyLimit: { type: Number, required: true },
            delayMinMs: { type: Number, required: true },
            delayMaxMs: { type: Number, required: true },
            _id: false,
          }],
        },
        required: true,
        _id: false,
      },

      metadata: {
        type: Schema.Types.Mixed,
        default: {},
      },

      totalEmailsSent: { type: Number, default: 0 },
      lastSuccessfulSendAt: Date,
      lastImapCheckAt: Date,
    },
    {
      timestamps: true,
      collection: options?.collectionName || 'email_accounts',

      statics: {
        findActive() {
          return this.find({
            status: { $in: [ACCOUNT_STATUS.Active, ACCOUNT_STATUS.Warmup] },
          });
        },

        findByProvider(provider: AccountProvider) {
          return this.find({ provider });
        },

        findByEmail(email: string) {
          return this.findOne({ email: email.toLowerCase().trim() });
        },

        async getBestAvailable(): Promise<EmailAccountDocument | null> {
          const accounts: EmailAccountDocument[] = await this.find({
            status: { $in: [ACCOUNT_STATUS.Active, ACCOUNT_STATUS.Warmup] },
          });

          if (accounts.length === 0) return null;

          return accounts
            .sort((a, b) => b.health.score - a.health.score)[0] || null;
        },
      },
    },
  );

  schema.index({ status: 1, 'health.score': -1 });
  schema.index({ 'health.score': -1 });
  schema.index({ provider: 1 });

  return schema;
}
