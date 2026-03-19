import { Schema, Model, HydratedDocument } from 'mongoose';
import { TEMPLATE_CATEGORY, TEMPLATE_AUDIENCE } from '../constants';
import type { Template, CreateTemplateInput } from '../types/template.types';

export interface ITemplate extends Omit<Template, '_id'> {}

export type TemplateDocument = HydratedDocument<ITemplate>;

export interface TemplateStatics {
  findBySlug(slug: string): Promise<TemplateDocument | null>;
  findActive(platform?: string): Promise<TemplateDocument[]>;
  findByCategory(category: string): Promise<TemplateDocument[]>;
  findByAudience(audience: string): Promise<TemplateDocument[]>;
  createTemplate(input: CreateTemplateInput): Promise<TemplateDocument>;
}

export type TemplateModel = Model<ITemplate> & TemplateStatics;

export function createTemplateSchema(
  platformValues?: string[],
  audienceValues?: string[],
  categoryValues?: string[],
  collectionPrefix?: string
) {
  const schema = new Schema<ITemplate>(
    {
      name: { type: String, required: true },
      slug: { type: String, required: true, unique: true, maxlength: 200 },
      description: String,
      category: { type: String, enum: categoryValues || Object.values(TEMPLATE_CATEGORY), required: true },
      audience: { type: String, enum: audienceValues || Object.values(TEMPLATE_AUDIENCE), required: true },
      platform: {
        type: String,
        required: true,
        ...(platformValues ? { enum: platformValues } : {})
      },

      textBody: String,
      subjects: { type: [{ type: String }], default: [] },
      bodies: { type: [{ type: String }], required: true, validate: [(v: string[]) => v.length >= 1, 'At least one body is required'] },
      preheaders: [{ type: String }],

      fields: {
        type: Schema.Types.Mixed,
        default: {},
        validate: {
          validator: (v: any) => {
            if (!v || typeof v !== 'object') return true;
            return Object.values(v).every(val => typeof val === 'string');
          },
          message: 'All field values must be strings'
        }
      },
      variables: [{ type: String }],
      collectionName: { type: String },
      joins: [{ type: String }],
      attachments: {
        type: [{
          _id: false,
          filename: { type: String, required: true },
          url: { type: String, required: true },
          contentType: { type: String, required: true },
        }],
        default: [],
      },
      metadata: { type: Schema.Types.Mixed, default: undefined },
      version: { type: Number, default: 1 },
      isActive: { type: Boolean, default: true }
    },
    {
      timestamps: true,
      collection: `${collectionPrefix || ''}templates`,

      statics: {
        findBySlug(slug: string) {
          return this.findOne({ slug });
        },

        findActive(platform?: string) {
          const filter: Record<string, unknown> = { isActive: true };
          if (platform) filter.platform = platform;
          return this.find(filter).sort({ category: 1, name: 1 });
        },

        findByCategory(category: string) {
          return this.find({ category, isActive: true }).sort({ name: 1 });
        },

        findByAudience(audience: string) {
          return this.find({
            $or: [{ audience }, { audience: TEMPLATE_AUDIENCE.All }],
            isActive: true
          }).sort({ name: 1 });
        },

        async createTemplate(input: CreateTemplateInput) {
          return this.create({
            name: input.name,
            slug: input.slug,
            description: input.description,
            category: input.category,
            audience: input.audience,
            platform: input.platform,
            textBody: input.textBody,
            subjects: input.subjects || [],
            bodies: input.bodies,
            preheaders: input.preheaders || [],
            fields: input.fields || {},
            variables: input.variables || [],
            collectionName: input.collectionName,
            joins: input.joins || [],
            attachments: input.attachments || [],
            metadata: input.metadata,
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
