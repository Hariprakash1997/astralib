import { Schema, Model, Types, HydratedDocument } from 'mongoose';
import { RUN_TRIGGER } from '../constants';

export interface IEmailRuleRunLog {
  runAt: Date;
  triggeredBy: string;
  duration: number;
  rulesProcessed: number;
  totalStats: {
    matched: number;
    sent: number;
    skipped: number;
    skippedByThrottle: number;
    errors: number;
  };
  perRuleStats: Array<{
    ruleId: Types.ObjectId;
    ruleName: string;
    matched: number;
    sent: number;
    skipped: number;
    skippedByThrottle: number;
    errors: number;
  }>;
}

export type EmailRuleRunLogDocument = HydratedDocument<IEmailRuleRunLog>;

export interface EmailRuleRunLogStatics {
  getRecent(limit?: number): Promise<EmailRuleRunLogDocument[]>;
  getByRuleId(ruleId: string | Types.ObjectId, limit?: number): Promise<EmailRuleRunLogDocument[]>;
}

export type EmailRuleRunLogModel = Model<IEmailRuleRunLog> & EmailRuleRunLogStatics;

export function createEmailRuleRunLogSchema() {
  const PerRuleStatsSchema = new Schema({
    ruleId: { type: Schema.Types.ObjectId, ref: 'EmailRule', required: true },
    ruleName: { type: String, required: true },
    matched: { type: Number, default: 0 },
    sent: { type: Number, default: 0 },
    skipped: { type: Number, default: 0 },
    skippedByThrottle: { type: Number, default: 0 },
    errors: { type: Number, default: 0 }
  }, { _id: false });

  const TotalStatsSchema = new Schema({
    matched: { type: Number, default: 0 },
    sent: { type: Number, default: 0 },
    skipped: { type: Number, default: 0 },
    skippedByThrottle: { type: Number, default: 0 },
    errors: { type: Number, default: 0 }
  }, { _id: false });

  const schema = new Schema<IEmailRuleRunLog>(
    {
      runAt: { type: Date, required: true, default: () => new Date() },
      triggeredBy: { type: String, enum: Object.values(RUN_TRIGGER), required: true },
      duration: { type: Number, required: true },
      rulesProcessed: { type: Number, required: true },
      totalStats: { type: TotalStatsSchema, required: true },
      perRuleStats: [PerRuleStatsSchema]
    },
    {
      collection: 'email_rule_run_logs',

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

  schema.index({ runAt: -1 });
  schema.index({ runAt: 1 }, { expireAfterSeconds: 90 * 86400 });

  return schema;
}
