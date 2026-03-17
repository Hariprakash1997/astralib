import { Schema, Model, HydratedDocument } from 'mongoose';

export interface ITelegramTemplate {
  name: string;
  messages: string[];
  variables: string[];
  category?: string;
  platform?: string;
  audience?: string;
  media?: {
    type: string;
    url: string;
    caption?: string;
  };
  fields: Record<string, string>;
  createdAt?: Date;
  updatedAt?: Date;
}

export type TelegramTemplateDocument = HydratedDocument<ITelegramTemplate>;

export interface TelegramTemplateStatics {
  findByName(name: string): Promise<TelegramTemplateDocument | null>;
  findByCategory(category: string): Promise<TelegramTemplateDocument[]>;
  findByAudience(audience: string): Promise<TelegramTemplateDocument[]>;
}

export type TelegramTemplateModel = Model<ITelegramTemplate> & TelegramTemplateStatics;

export function createTelegramTemplateSchema(
  platformValues?: string[],
  audienceValues?: string[],
  categoryValues?: string[],
  collectionPrefix?: string
) {
  const MediaSchema = new Schema({
    type: { type: String, enum: ['photo', 'video', 'voice', 'audio', 'document'], required: true },
    url: { type: String, required: true },
    caption: { type: String }
  }, { _id: false });

  const schema = new Schema<ITelegramTemplate>(
    {
      name: { type: String, required: true, unique: true },
      messages: {
        type: [{ type: String }],
        required: true,
        validate: [(v: string[]) => v.length >= 1, 'At least one message is required']
      },
      variables: [{ type: String }],
      category: {
        type: String,
        ...(categoryValues ? { enum: categoryValues } : {})
      },
      platform: {
        type: String,
        ...(platformValues ? { enum: platformValues } : {})
      },
      audience: {
        type: String,
        ...(audienceValues ? { enum: audienceValues } : {})
      },
      media: { type: MediaSchema, default: undefined },
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
      }
    },
    {
      timestamps: true,
      collection: `${collectionPrefix || ''}telegram_templates`,

      statics: {
        findByName(name: string) {
          return this.findOne({ name });
        },

        findByCategory(category: string) {
          return this.find({ category }).sort({ name: 1 });
        },

        findByAudience(audience: string) {
          return this.find({ audience }).sort({ name: 1 });
        }
      }
    }
  );

  schema.index({ name: 1 }, { unique: true });

  return schema;
}
