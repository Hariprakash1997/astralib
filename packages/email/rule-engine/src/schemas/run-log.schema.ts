import { Schema, Model, Types, HydratedDocument } from 'mongoose';
import { RUN_TRIGGER, RUN_LOG_STATUS } from '../constants';
import { createRunStatsSchema } from './shared-schemas';

export interface IEmailRuleRunLog {
  runId?: string;
  runAt: Date;
  triggeredBy: string;
  duration: number;
  rulesProcessed: number;
  status?: string;
  totalStats: {
    matched: number;
    sent: number;
    skipped: number;
    skippedByThrottle: number;
    errorCount: number;
  };
  perRuleStats: Array<{
    ruleId: Types.ObjectId;
    ruleName: string;
    matched: number;
    sent: number;
    skipped: number;
    skippedByThrottle: number;
    errorCount: number;
  }>;
}

export type EmailRuleRunLogDocument = HydratedDocument<IEmailRuleRunLog>;

export interface EmailRuleRunLogStatics {
  getRecent(limit?: number): Promise<EmailRuleRunLogDocument[]>;
  getByRuleId(ruleId: string | Types.ObjectId, limit?: number): Promise<EmailRuleRunLogDocument[]>;
}

export type EmailRuleRunLogModel = Model<IEmailRuleRunLog> & EmailRuleRunLogStatics;

export function createEmailRuleRunLogSchema(collectionPrefix?: string) {
  const baseStatsSchema = createRunStatsSchema();

  const PerRuleStatsSchema = new Schema({
    ruleId: { type: Schema.Types.ObjectId, ref: 'EmailRule', required: true },
    ruleName: { type: String, required: true },
    ...baseStatsSchema.obj,
  }, { _id: false });

  const TotalStatsSchema = createRunStatsSchema();

  const schema = new Schema<IEmailRuleRunLog>(
    {
      runId: { type: String, index: true },
      runAt: { type: Date, required: true, default: () => new Date() },
      status: { type: String, enum: Object.values(RUN_LOG_STATUS), default: RUN_LOG_STATUS.Completed },
      triggeredBy: { type: String, enum: Object.values(RUN_TRIGGER), required: true },
      duration: { type: Number, required: true },
      rulesProcessed: { type: Number, required: true },
      totalStats: { type: TotalStatsSchema, required: true },
      perRuleStats: [PerRuleStatsSchema]
    },
    {
      collection: `${collectionPrefix || ''}email_rule_run_logs`,

      statics: {
        getRecent(limit = 20) {
          return this.find().sort({ runAt: -1 }).limit(limit);
        },

        getByRuleId(ruleId: string | Types.ObjectId, limit = 20) {
          return this.find({ 'perRuleStats.ruleId': ruleId })
            .sort({ runAt: -1 })
            .limit(limit);
        }
      }
    }
  );

  schema.index({ runAt: -1 }, { expireAfterSeconds: 90 * 86400 });

  return schema;
}
