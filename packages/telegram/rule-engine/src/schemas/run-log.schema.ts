import { Schema, Model, HydratedDocument } from 'mongoose';

export interface ITelegramRunLog {
  runId: string;
  triggeredBy: string;
  status: string;
  startedAt: Date;
  completedAt?: Date;
  stats: {
    sent: number;
    failed: number;
    skipped: number;
    throttled: number;
  };
  createdAt?: Date;
  updatedAt?: Date;
}

export type TelegramRunLogDocument = HydratedDocument<ITelegramRunLog>;

export interface TelegramRunLogStatics {
  getRecent(limit?: number): Promise<TelegramRunLogDocument[]>;
  findByRunId(runId: string): Promise<TelegramRunLogDocument | null>;
}

export type TelegramRunLogModel = Model<ITelegramRunLog> & TelegramRunLogStatics;

export function createTelegramRunLogSchema(collectionPrefix?: string) {
  const RunStatsSchema = new Schema({
    sent: { type: Number, default: 0 },
    failed: { type: Number, default: 0 },
    skipped: { type: Number, default: 0 },
    throttled: { type: Number, default: 0 }
  }, { _id: false });

  const schema = new Schema<ITelegramRunLog>(
    {
      runId: { type: String, required: true, unique: true },
      triggeredBy: { type: String, default: 'system' },
      status: {
        type: String,
        enum: ['running', 'completed', 'cancelled', 'failed'],
        default: 'running'
      },
      startedAt: { type: Date, default: () => new Date() },
      completedAt: { type: Date },
      stats: { type: RunStatsSchema, default: () => ({ sent: 0, failed: 0, skipped: 0, throttled: 0 }) }
    },
    {
      timestamps: true,
      collection: `${collectionPrefix || ''}telegram_run_logs`,

      statics: {
        getRecent(limit = 20) {
          return this.find().sort({ startedAt: -1 }).limit(limit);
        },

        findByRunId(runId: string) {
          return this.findOne({ runId });
        }
      }
    }
  );

  schema.index({ status: 1 });
  schema.index({ startedAt: -1 });

  return schema;
}
