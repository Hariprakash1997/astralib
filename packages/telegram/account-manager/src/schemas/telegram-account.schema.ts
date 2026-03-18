import { Schema, Model, HydratedDocument } from 'mongoose';
import type { WarmupPhase } from '../types/config.types';
import { ACCOUNT_STATUS, CRITICAL_HEALTH_THRESHOLD, DEFAULT_HEALTH_SCORE, DEFAULT_DAILY_LIMIT, type AccountStatus } from '../constants';

export interface ITelegramAccount {
  phone: string;
  name: string;
  session: string;
  status: AccountStatus;

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

  tags: string[];

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

const ACCOUNT_STATUSES = Object.values(ACCOUNT_STATUS);

export function createTelegramAccountSchema(options?: CreateTelegramAccountSchemaOptions) {
  const schema = new Schema<ITelegramAccount, TelegramAccountModel, TelegramAccountMethods>(
    {
      phone: { type: String, required: true, unique: true },
      name: { type: String, required: true },
      session: { type: String, required: true },
      status: {
        type: String,
        enum: ACCOUNT_STATUSES,
        default: ACCOUNT_STATUS.Disconnected,
      },

      healthScore: { type: Number, default: DEFAULT_HEALTH_SCORE, min: 0, max: 100 },
      consecutiveErrors: { type: Number, default: 0 },
      floodWaitCount: { type: Number, default: 0 },
      lastError: String,
      lastErrorAt: Date,

      currentDailyLimit: { type: Number, default: DEFAULT_DAILY_LIMIT },
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

      tags: { type: [String], default: [] },

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
          if (this.status === ACCOUNT_STATUS.Banned) {
            return { ok: false, reason: 'Account is banned' };
          }
          if (this.status === ACCOUNT_STATUS.Error) {
            return { ok: false, reason: 'Account is in error state' };
          }
          if (this.status === ACCOUNT_STATUS.Quarantined) {
            if (this.quarantinedUntil && this.quarantinedUntil > new Date()) {
              return { ok: false, reason: `Quarantined until ${this.quarantinedUntil.toISOString()}` };
            }
          }
          if (this.status !== ACCOUNT_STATUS.Connected && this.status !== ACCOUNT_STATUS.Warmup) {
            return { ok: false, reason: `Account status is '${this.status}'` };
          }
          if (this.healthScore < CRITICAL_HEALTH_THRESHOLD) {
            return { ok: false, reason: `Health score too low: ${this.healthScore}` };
          }
          return { ok: true };
        },

        quarantine(this: TelegramAccountDocument, reason: string, durationMs: number) {
          this.status = ACCOUNT_STATUS.Quarantined;
          this.quarantinedUntil = new Date(Date.now() + durationMs);
          this.quarantineReason = reason;
        },

        releaseFromQuarantine(this: TelegramAccountDocument) {
          this.quarantinedUntil = undefined;
          this.quarantineReason = undefined;
          this.status = ACCOUNT_STATUS.Disconnected;
        },
      },
    },
  );

  schema.index({ phone: 1 }, { unique: true });
  schema.index({ status: 1 });
  schema.index({ 'warmup.enabled': 1, status: 1 });
  schema.index({ tags: 1 });
  schema.index({ status: 1, quarantinedUntil: 1 });
  schema.index({ status: 1, healthScore: -1 });

  return schema;
}
