import { Schema, Model, Types, HydratedDocument } from 'mongoose';
import type { AggregationInterval } from '../constants';
import { AGGREGATION_INTERVAL } from '../constants';

export interface IAnalyticsStats {
  date: string;
  interval: AggregationInterval;
  accountId: Types.ObjectId | null;
  ruleId: Types.ObjectId | null;
  templateId: Types.ObjectId | null;
  sent: number;
  delivered: number;
  bounced: number;
  complained: number;
  opened: number;
  clicked: number;
  unsubscribed: number;
  failed: number;
  createdAt: Date;
  updatedAt: Date;
}

export type AnalyticsStatsDocument = HydratedDocument<IAnalyticsStats>;

export interface AnalyticsStatsStatics {
  upsertStats(
    date: string,
    interval: AggregationInterval,
    dimensions: { accountId?: string; ruleId?: string; templateId?: string },
    increments: Partial<Record<'sent' | 'delivered' | 'bounced' | 'complained' | 'opened' | 'clicked' | 'unsubscribed' | 'failed', number>>,
  ): Promise<AnalyticsStatsDocument>;
}

export type AnalyticsStatsModel = Model<IAnalyticsStats> & AnalyticsStatsStatics;

export interface CreateAnalyticsStatsSchemaOptions {
  collectionName?: string;
}

export function createAnalyticsStatsSchema(options?: CreateAnalyticsStatsSchemaOptions) {
  const intervalValues = Object.values(AGGREGATION_INTERVAL);

  const schema = new Schema<IAnalyticsStats>(
    {
      date: { type: String, required: true, index: true },
      interval: { type: String, required: true, enum: intervalValues },
      accountId: { type: Schema.Types.ObjectId, default: null },
      ruleId: { type: Schema.Types.ObjectId, default: null },
      templateId: { type: Schema.Types.ObjectId, default: null },
      sent: { type: Number, default: 0 },
      delivered: { type: Number, default: 0 },
      bounced: { type: Number, default: 0 },
      complained: { type: Number, default: 0 },
      opened: { type: Number, default: 0 },
      clicked: { type: Number, default: 0 },
      unsubscribed: { type: Number, default: 0 },
      failed: { type: Number, default: 0 },
    },
    {
      timestamps: true,
      collection: options?.collectionName || 'analytics_stats',

      statics: {
        upsertStats(
          date: string,
          interval: AggregationInterval,
          dimensions: { accountId?: string; ruleId?: string; templateId?: string },
          increments: Partial<Record<string, number>>,
        ) {
          const filter: Record<string, unknown> = { date, interval };

          filter.accountId = dimensions.accountId ? new Types.ObjectId(dimensions.accountId) : null;
          filter.ruleId = dimensions.ruleId ? new Types.ObjectId(dimensions.ruleId) : null;
          filter.templateId = dimensions.templateId ? new Types.ObjectId(dimensions.templateId) : null;

          const $inc: Record<string, number> = {};
          for (const [key, value] of Object.entries(increments)) {
            if (value) $inc[key] = value;
          }

          return this.findOneAndUpdate(
            filter,
            { $inc },
            { upsert: true, new: true },
          );
        },
      },
    },
  );

  schema.index({ date: 1, interval: 1, accountId: 1, ruleId: 1, templateId: 1 }, { unique: true });
  schema.index({ date: 1, interval: 1 });

  return schema;
}
