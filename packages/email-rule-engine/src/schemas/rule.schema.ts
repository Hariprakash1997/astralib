import { Schema, Model, Types, HydratedDocument } from 'mongoose';
import { RULE_OPERATOR, EMAIL_TYPE, TEMPLATE_AUDIENCE } from '../constants';
import type { EmailRule, CreateEmailRuleInput } from '../types/rule.types';

export interface IEmailRule extends Omit<EmailRule, '_id' | 'templateId'> {
  templateId: Types.ObjectId;
}

export type EmailRuleDocument = HydratedDocument<IEmailRule>;

export interface EmailRuleStatics {
  findActive(): Promise<EmailRuleDocument[]>;
  findByTemplateId(templateId: string | Types.ObjectId): Promise<EmailRuleDocument[]>;
  createRule(input: CreateEmailRuleInput): Promise<EmailRuleDocument>;
}

export type EmailRuleModel = Model<IEmailRule> & EmailRuleStatics;

export function createEmailRuleSchema(platformValues?: string[], audienceValues?: string[], collectionPrefix?: string) {
  const RuleConditionSchema = new Schema({
    field: { type: String, required: true },
    operator: { type: String, enum: Object.values(RULE_OPERATOR), required: true },
    value: { type: Schema.Types.Mixed }
  }, { _id: false });

  const RuleTargetSchema = new Schema({
    mode: { type: String, enum: ['query', 'list'], required: true },
    role: { type: String, enum: audienceValues || Object.values(TEMPLATE_AUDIENCE) },
    platform: {
      type: String,
      ...(platformValues ? { enum: platformValues } : {})
    },
    conditions: [RuleConditionSchema],
    identifiers: [{ type: String }]
  }, { _id: false });

  const RuleRunStatsSchema = new Schema({
    matched: { type: Number, default: 0 },
    sent: { type: Number, default: 0 },
    skipped: { type: Number, default: 0 },
    skippedByThrottle: { type: Number, default: 0 },
    errors: { type: Number, default: 0 }
  }, { _id: false });

  const schema = new Schema<IEmailRule>(
    {
      name: { type: String, required: true },
      description: String,
      isActive: { type: Boolean, default: false, index: true },

      sortOrder: { type: Number, default: 10 },

      target: { type: RuleTargetSchema, required: true },
      templateId: { type: Schema.Types.ObjectId, ref: 'EmailTemplate', required: true, index: true },

      sendOnce: { type: Boolean, default: true },
      resendAfterDays: Number,
      cooldownDays: Number,
      autoApprove: { type: Boolean, default: true },
      maxPerRun: Number,

      validFrom: { type: Date },
      validTill: { type: Date },

      bypassThrottle: { type: Boolean, default: false },
      emailType: { type: String, enum: Object.values(EMAIL_TYPE), default: EMAIL_TYPE.Automated },

      totalSent: { type: Number, default: 0 },
      totalSkipped: { type: Number, default: 0 },
      lastRunAt: Date,
      lastRunStats: RuleRunStatsSchema
    },
    {
      timestamps: true,
      collection: `${collectionPrefix || ''}email_rules`,

      statics: {
        findActive() {
          return this.find({ isActive: true }).sort({ sortOrder: 1 });
        },

        findByTemplateId(templateId: string | Types.ObjectId) {
          return this.find({ templateId });
        },

        async createRule(input: CreateEmailRuleInput) {
          return this.create({
            name: input.name,
            description: input.description,
            isActive: false,
            sortOrder: input.sortOrder ?? 10,
            target: input.target,
            templateId: input.templateId,
            sendOnce: input.sendOnce ?? true,
            resendAfterDays: input.resendAfterDays,
            cooldownDays: input.cooldownDays,
            autoApprove: input.autoApprove ?? true,
            maxPerRun: input.maxPerRun,
            validFrom: input.validFrom,
            validTill: input.validTill,
            bypassThrottle: input.bypassThrottle ?? false,
            emailType: input.emailType ?? EMAIL_TYPE.Automated,
            totalSent: 0,
            totalSkipped: 0
          });
        }
      }
    }
  );

  schema.index({ isActive: 1, sortOrder: 1 });
  schema.index({ templateId: 1 });

  return schema;
}
