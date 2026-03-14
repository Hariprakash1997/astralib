import { Schema, Model, HydratedDocument } from 'mongoose';
import { TemplateCategory, TemplateAudience } from '../types/enums';
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

export function createEmailTemplateSchema(platformValues?: string[], audienceValues?: string[]) {
  const schema = new Schema<IEmailTemplate>(
    {
      name: { type: String, required: true },
      slug: { type: String, required: true, unique: true },
      description: String,
      category: { type: String, enum: Object.values(TemplateCategory), required: true },
      audience: { type: String, enum: audienceValues || Object.values(TemplateAudience), required: true },
      platform: {
        type: String,
        required: true,
        ...(platformValues ? { enum: platformValues } : {})
      },

      subject: { type: String, required: true },
      body: { type: String, required: true },
      textBody: String,

      variables: [{ type: String }],
      version: { type: Number, default: 1 },
      isActive: { type: Boolean, default: true, index: true }
    },
    {
      timestamps: true,
      collection: 'email_templates',

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
            $or: [{ audience }, { audience: TemplateAudience.All }],
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
            subject: input.subject,
            body: input.body,
            textBody: input.textBody,
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
