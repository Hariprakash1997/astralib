import { Schema, Model, HydratedDocument } from 'mongoose';
import { TEMPLATE_CATEGORY, TEMPLATE_AUDIENCE } from '../constants';
import type { TemplateCategory, TemplateAudience } from '../constants';
import type { EmailTemplate, CreateEmailTemplateInput } from '../types/template.types';

export interface IEmailTemplate extends Omit<EmailTemplate, '_id'> {}

export type EmailTemplateDocument = HydratedDocument<IEmailTemplate>;

export interface EmailTemplateStatics {
  findBySlug(slug: string): Promise<EmailTemplateDocument | null>;
  findActive(): Promise<EmailTemplateDocument[]>;
  findByCategory(category: TemplateCategory): Promise<EmailTemplateDocument[]>;
  findByAudience(audience: TemplateAudience): Promise<EmailTemplateDocument[]>;
  createTemplate(input: CreateEmailTemplateInput): Promise<EmailTemplateDocument>;
}

export type EmailTemplateModel = Model<IEmailTemplate> & EmailTemplateStatics;

export function createEmailTemplateSchema(
  platformValues?: string[],
  audienceValues?: string[],
  categoryValues?: string[],
  collectionPrefix?: string
) {
  const schema = new Schema<IEmailTemplate>(
    {
      name: { type: String, required: true },
      slug: { type: String, required: true, unique: true },
      description: String,
      category: { type: String, enum: categoryValues || Object.values(TEMPLATE_CATEGORY), required: true },
      audience: { type: String, enum: audienceValues || Object.values(TEMPLATE_AUDIENCE), required: true },
      platform: {
        type: String,
        required: true,
        ...(platformValues ? { enum: platformValues } : {})
      },

      textBody: String,
      subjects: { type: [{ type: String }], required: true, validate: [(v: string[]) => v.length >= 1, 'At least one subject is required'] },
      bodies: { type: [{ type: String }], required: true, validate: [(v: string[]) => v.length >= 1, 'At least one body is required'] },

      fields: { type: Schema.Types.Mixed, default: {} },
      variables: [{ type: String }],
      version: { type: Number, default: 1 },
      isActive: { type: Boolean, default: true, index: true }
    },
    {
      timestamps: true,
      collection: `${collectionPrefix || ''}email_templates`,

      statics: {
        findBySlug(slug: string) {
          return this.findOne({ slug });
        },

        findActive() {
          return this.find({ isActive: true }).sort({ category: 1, name: 1 });
        },

        findByCategory(category: TemplateCategory) {
          return this.find({ category, isActive: true }).sort({ name: 1 });
        },

        findByAudience(audience: TemplateAudience) {
          return this.find({
            $or: [{ audience }, { audience: TEMPLATE_AUDIENCE.All }],
            isActive: true
          }).sort({ name: 1 });
        },

        async createTemplate(input: CreateEmailTemplateInput) {
          return this.create({
            name: input.name,
            slug: input.slug,
            description: input.description,
            category: input.category,
            audience: input.audience,
            platform: input.platform,
            textBody: input.textBody,
            subjects: input.subjects,
            bodies: input.bodies,
            fields: input.fields || {},
            variables: input.variables || [],
            version: 1,
            isActive: true
          });
        }
      }
    }
  );

  schema.index({ category: 1, isActive: 1 });
  schema.index({ audience: 1, platform: 1, isActive: 1 });

  return schema;
}
