import { Schema, Model, Types, HydratedDocument } from 'mongoose';

export interface IEmailDailyStats {
  accountId: Types.ObjectId;
  date: string;
  sent: number;
  failed: number;
  bounced: number;
  delivered: number;
  complained: number;
  opened: number;
  clicked: number;
  unsubscribed: number;
  createdAt: Date;
  updatedAt: Date;
}

export type EmailDailyStatsDocument = HydratedDocument<IEmailDailyStats>;

export interface EmailDailyStatsStatics {
  incrementStat(accountId: string, field: string, count?: number, date?: string): Promise<EmailDailyStatsDocument>;
  getForAccount(accountId: string, days?: number): Promise<EmailDailyStatsDocument[]>;
  getForDate(date: string): Promise<EmailDailyStatsDocument[]>;
}

export type EmailDailyStatsModel = Model<IEmailDailyStats> & EmailDailyStatsStatics;

export interface CreateEmailDailyStatsSchemaOptions {
  collectionName?: string;
}

export function createEmailDailyStatsSchema(options?: CreateEmailDailyStatsSchemaOptions) {
  const schema = new Schema<IEmailDailyStats>(
    {
      accountId: { type: Schema.Types.ObjectId, required: true, index: true },
      date: { type: String, required: true, index: true },
      sent: { type: Number, default: 0 },
      failed: { type: Number, default: 0 },
      bounced: { type: Number, default: 0 },
      delivered: { type: Number, default: 0 },
      complained: { type: Number, default: 0 },
      opened: { type: Number, default: 0 },
      clicked: { type: Number, default: 0 },
      unsubscribed: { type: Number, default: 0 },
    },
    {
      timestamps: true,
      collection: options?.collectionName || 'email_daily_stats',

      statics: {
        incrementStat(accountId: string, field: string, count = 1, date?: string) {
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
