import { Schema, Model, Types, HydratedDocument } from 'mongoose';

export interface ITelegramRule {
  name: string;
  templateId: Types.ObjectId;
  isActive: boolean;
  target: Record<string, unknown>;
  schedule?: string;
  sendOnce: boolean;
  maxPerRun?: number;
  autoApprove: boolean;
  validFrom?: Date;
  validTill?: Date;
  platform?: string;
  audience?: string;
  createdAt?: Date;
  updatedAt?: Date;
}

export type TelegramRuleDocument = HydratedDocument<ITelegramRule>;

export interface TelegramRuleStatics {
  findActive(): Promise<TelegramRuleDocument[]>;
  findByTemplateId(templateId: string | Types.ObjectId): Promise<TelegramRuleDocument[]>;
}

export type TelegramRuleModel = Model<ITelegramRule> & TelegramRuleStatics;

export function createTelegramRuleSchema(
  platformValues?: string[],
  audienceValues?: string[],
  collectionPrefix?: string
) {
  const schema = new Schema<ITelegramRule>(
    {
      name: { type: String, required: true },
      templateId: { type: Schema.Types.ObjectId, required: true, index: true },
      isActive: { type: Boolean, default: false },
      target: { type: Schema.Types.Mixed, required: true },
      schedule: { type: String },
      sendOnce: { type: Boolean, default: false },
      maxPerRun: { type: Number },
      autoApprove: { type: Boolean, default: true },
      validFrom: { type: Date },
      validTill: { type: Date },
      platform: {
        type: String,
        ...(platformValues ? { enum: platformValues } : {})
      },
      audience: {
        type: String,
        ...(audienceValues ? { enum: audienceValues } : {})
      }
    },
    {
      timestamps: true,
      collection: `${collectionPrefix || ''}telegram_rules`,

      statics: {
        findActive() {
          return this.find({ isActive: true });
        },

        findByTemplateId(templateId: string | Types.ObjectId) {
          return this.find({ templateId });
        }
      }
    }
  );

  schema.index({ isActive: 1 });

  return schema;
}
