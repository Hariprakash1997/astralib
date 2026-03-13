import { Schema, Model, Types, HydratedDocument } from 'mongoose';
import { RuleOperator, EmailType, TemplateAudience } from '../types/enums';
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

export function createEmailRuleSchema(platformValues?: string[]) {
  const RuleConditionSchema = new Schema({
    field: { type: String, required: true },
    operator: { type: String, enum: Object.values(RuleOperator), required: true },
    value: { type: Schema.Types.Mixed }
  }, { _id: false });

  const RuleTargetSchema = new Schema({
    role: { type: String, enum: Object.values(TemplateAudience), required: true },
    platform: {
      type: String,
      required: true,
      ...(platformValues ? { enum: platformValues } : {})
    },
    conditions: [RuleConditionSchema]
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

      bypassThrottle: { type: Boolean, default: false },
      emailType: { type: String, enum: Object.values(EmailType), default: EmailType.Automated },

      totalSent: { type: Number, default: 0 },
      totalSkipped: { type: Number, default: 0 },
      lastRunAt: Date,
      lastRunStats: RuleRunStatsSchema
    },
    {
      timestamps: true,
      collection: 'email_rules',

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
            bypassThrottle: input.bypassThrottle ?? false,
            emailType: input.emailType ?? EmailType.Automated,
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
