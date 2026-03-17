import { Schema, Model, HydratedDocument } from 'mongoose';
import type { WarmupPhase } from '../types/config.types';

export interface ITelegramAccount {
  phone: string;
  name: string;
  session: string;
  status: 'connected' | 'disconnected' | 'error' | 'banned' | 'quarantined' | 'warmup';

  healthScore: number;
  consecutiveErrors: number;
  floodWaitCount: number;
  lastError?: string;
  lastErrorAt?: Date;

  currentDailyLimit: number;
  totalMessagesSent: number;
  lastSuccessfulSendAt?: Date;

  warmup: {
    enabled: boolean;
    currentDay: number;
    startedAt?: Date;
    completedAt?: Date;
    schedule: WarmupPhase[];
  };

  quarantinedUntil?: Date;
  quarantineReason?: string;

  currentDelayMin: number;
  currentDelayMax: number;

  createdAt: Date;
  updatedAt: Date;
}

export type TelegramAccountDocument = HydratedDocument<ITelegramAccount>;

export interface TelegramAccountMethods {
  preflightCheck(): { ok: boolean; reason?: string };
  quarantine(reason: string, durationMs: number): void;
  releaseFromQuarantine(): void;
}

export type TelegramAccountModel = Model<ITelegramAccount, object, TelegramAccountMethods>;

export interface CreateTelegramAccountSchemaOptions {
  collectionName?: string;
}

const ACCOUNT_STATUSES = ['connected', 'disconnected', 'error', 'banned', 'quarantined', 'warmup'] as const;

export function createTelegramAccountSchema(options?: CreateTelegramAccountSchemaOptions) {
  const schema = new Schema<ITelegramAccount, TelegramAccountModel, TelegramAccountMethods>(
    {
      phone: { type: String, required: true, unique: true },
      name: { type: String, required: true },
      session: { type: String, required: true },
      status: {
        type: String,
        enum: ACCOUNT_STATUSES,
        default: 'disconnected',
      },

      healthScore: { type: Number, default: 100, min: 0, max: 100 },
      consecutiveErrors: { type: Number, default: 0 },
      floodWaitCount: { type: Number, default: 0 },
      lastError: String,
      lastErrorAt: Date,

      currentDailyLimit: { type: Number, default: 40 },
      totalMessagesSent: { type: Number, default: 0 },
      lastSuccessfulSendAt: Date,

      warmup: {
        type: {
          enabled: { type: Boolean, default: true },
          currentDay: { type: Number, default: 0 },
          startedAt: Date,
          completedAt: Date,
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

      quarantinedUntil: Date,
      quarantineReason: String,

      currentDelayMin: { type: Number, default: 30000 },
      currentDelayMax: { type: Number, default: 60000 },
    },
    {
      timestamps: true,
      collection: options?.collectionName || 'telegram_accounts',

      methods: {
        preflightCheck(this: TelegramAccountDocument): { ok: boolean; reason?: string } {
          if (this.status === 'banned') {
            return { ok: false, reason: 'Account is banned' };
          }
          if (this.status === 'error') {
            return { ok: false, reason: 'Account is in error state' };
          }
          if (this.status === 'quarantined') {
            if (this.quarantinedUntil && this.quarantinedUntil > new Date()) {
              return { ok: false, reason: `Quarantined until ${this.quarantinedUntil.toISOString()}` };
            }
          }
          if (this.status !== 'connected' && this.status !== 'warmup') {
            return { ok: false, reason: `Account status is '${this.status}'` };
          }
          if (this.healthScore < 20) {
            return { ok: false, reason: `Health score too low: ${this.healthScore}` };
          }
          return { ok: true };
        },

        quarantine(this: TelegramAccountDocument, reason: string, durationMs: number) {
          this.status = 'quarantined';
          this.quarantinedUntil = new Date(Date.now() + durationMs);
          this.quarantineReason = reason;
        },

        releaseFromQuarantine(this: TelegramAccountDocument) {
          this.quarantinedUntil = undefined;
          this.quarantineReason = undefined;
          this.status = 'disconnected';
        },
      },
    },
  );

  schema.index({ phone: 1 }, { unique: true });
  schema.index({ status: 1 });
  schema.index({ 'warmup.enabled': 1, status: 1 });

  return schema;
}
