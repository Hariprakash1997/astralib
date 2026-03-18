import { Schema, Model, Types, HydratedDocument } from 'mongoose';

export interface ITelegramDailyStats {
  accountId: Types.ObjectId;
  date: string;
  sent: number;
  failed: number;
  skipped: number;
  createdAt: Date;
  updatedAt: Date;
}

export type TelegramDailyStatsDocument = HydratedDocument<ITelegramDailyStats>;

export interface TelegramDailyStatsStatics {
  incrementStat(accountId: string, field: 'sent' | 'failed' | 'skipped', count?: number, date?: string): Promise<TelegramDailyStatsDocument>;
  getForAccount(accountId: string, days?: number): Promise<TelegramDailyStatsDocument[]>;
  getForDate(date: string): Promise<TelegramDailyStatsDocument[]>;
}

export type TelegramDailyStatsModel = Model<ITelegramDailyStats> & TelegramDailyStatsStatics;

export interface CreateTelegramDailyStatsSchemaOptions {
  collectionName?: string;
}

export function createTelegramDailyStatsSchema(options?: CreateTelegramDailyStatsSchemaOptions) {
  const schema = new Schema<ITelegramDailyStats>(
    {
      accountId: { type: Schema.Types.ObjectId, required: true },
      date: { type: String, required: true },
      sent: { type: Number, default: 0 },
      failed: { type: Number, default: 0 },
      skipped: { type: Number, default: 0 },
    },
    {
      timestamps: true,
      collection: options?.collectionName || 'telegram_daily_stats',

      statics: {
        incrementStat(accountId: string, field: 'sent' | 'failed' | 'skipped', count = 1, date?: string) {
          const targetDate = date || new Date().toISOString().split('T')[0];
          const update: Record<string, number> = {};
          update[field] = count;

          return this.findOneAndUpdate(
            { accountId: new Types.ObjectId(accountId), date: targetDate },
            { $inc: update },
            { upsert: true, new: true },
          );
        },

        getForAccount(accountId: string, days = 30) {
          const startDate = new Date();
          startDate.setDate(startDate.getDate() - days);
          const startDateStr = startDate.toISOString().split('T')[0];

          return this.find({
            accountId: new Types.ObjectId(accountId),
            date: { $gte: startDateStr },
          }).sort({ date: -1 });
        },

        getForDate(date: string) {
          return this.find({ date });
        },
      },
    },
  );

  schema.index({ accountId: 1, date: -1 }, { unique: true });

  return schema;
}
