import { Schema, Model, Types, HydratedDocument } from 'mongoose';
import { RULE_OPERATOR, RULE_TYPE, TEMPLATE_AUDIENCE, TARGET_MODE } from '../constants';
import { createRunStatsSchema } from './shared-schemas';
import type { Rule, CreateRuleInput } from '../types/rule.types';

export interface IRule extends Omit<Rule, '_id' | 'templateId'> {
  templateId: Types.ObjectId;
}

export type RuleDocument = HydratedDocument<IRule>;

export interface RuleStatics {
  findActive(platform?: string): Promise<RuleDocument[]>;
  findByTemplateId(templateId: string | Types.ObjectId): Promise<RuleDocument[]>;
  createRule(input: CreateRuleInput): Promise<RuleDocument>;
}

export type RuleModel = Model<IRule> & RuleStatics;

export function createRuleSchema(platformValues?: string[], audienceValues?: string[], collectionPrefix?: string) {
  const RuleConditionSchema = new Schema({
    field: { type: String, required: true },
    operator: { type: String, enum: Object.values(RULE_OPERATOR), required: true },
    value: { type: Schema.Types.Mixed }
  }, { _id: false });

  const RuleTargetSchema = new Schema({
    mode: { type: String, enum: Object.values(TARGET_MODE), required: true },
    role: { type: String, enum: audienceValues || Object.values(TEMPLATE_AUDIENCE) },
    platform: {
      type: String,
      ...(platformValues ? { enum: platformValues } : {})
    },
    conditions: [RuleConditionSchema],
    identifiers: [{ type: String }],
  }, { _id: false });

  const RuleRunStatsSchema = createRunStatsSchema();

  const schema = new Schema<IRule>(
    {
      name: { type: String, required: true },
      description: String,
      isActive: { type: Boolean, default: false },
      platform: {
        type: String,
        required: true,
        ...(platformValues ? { enum: platformValues } : {})
      },

      sortOrder: { type: Number, default: 10 },

      target: { type: RuleTargetSchema, required: true },
      templateId: { type: Schema.Types.ObjectId, ref: 'Template', required: true, index: true },

      sendOnce: { type: Boolean, default: true },
      resendAfterDays: Number,
      cooldownDays: Number,
      autoApprove: { type: Boolean, default: true },
      maxPerRun: Number,

      validFrom: { type: Date },
      validTill: { type: Date },

      bypassThrottle: { type: Boolean, default: false },
      throttleOverride: {
        type: {
          maxPerUserPerDay: { type: Number },
          maxPerUserPerWeek: { type: Number },
          minGapDays: { type: Number },
        },
        _id: false,
        default: undefined,
      },
      ruleType: { type: String, enum: Object.values(RULE_TYPE), default: RULE_TYPE.Automated },

      schedule: {
        type: {
          enabled: { type: Boolean, default: false },
          cron: { type: String },
          timezone: { type: String, default: 'UTC' },
        },
        _id: false,
      },

      totalSent: { type: Number, default: 0 },
      totalSkipped: { type: Number, default: 0 },
      lastRunAt: Date,
      lastRunStats: RuleRunStatsSchema
    },
    {
      timestamps: true,
      collection: `${collectionPrefix || ''}rules`,

      statics: {
        findActive(platform?: string) {
          const filter: Record<string, unknown> = { isActive: true };
          if (platform) filter.platform = platform;
          return this.find(filter).sort({ sortOrder: 1 });
        },

        findByTemplateId(templateId: string | Types.ObjectId) {
          return this.find({ templateId });
        },

        async createRule(input: CreateRuleInput) {
          return this.create({
            name: input.name,
            description: input.description,
            isActive: false,
            platform: input.platform,
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
            throttleOverride: input.throttleOverride,
            schedule: input.schedule,
            ruleType: input.ruleType ?? RULE_TYPE.Automated,
            totalSent: 0,
            totalSkipped: 0
          });
        }
      }
    }
  );

  schema.index({ isActive: 1, sortOrder: 1 });
  schema.index({ platform: 1, isActive: 1 });

  return schema;
}
