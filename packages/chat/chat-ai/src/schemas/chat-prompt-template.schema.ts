import { Schema, Model, HydratedDocument } from 'mongoose';

export interface IPromptSection {
  key: string;
  label: string;
  content: string;
  position: number;
  isEnabled: boolean;
  isSystem: boolean;
  variables?: string[];
}

export interface IChatPromptTemplate {
  templateId: string;
  name: string;
  description?: string;
  isDefault: boolean;
  isActive: boolean;
  sections: IPromptSection[];
  responseFormat?: string;
  temperature?: number;
  maxTokens?: number;
  metadata?: Record<string, unknown>;
  createdAt: Date;
  updatedAt: Date;
  createdBy?: string;
}

export type ChatPromptTemplateDocument = HydratedDocument<IChatPromptTemplate>;

export type ChatPromptTemplateModel = Model<IChatPromptTemplate>;

const promptSectionSchema = new Schema<IPromptSection>(
  {
    key: { type: String, required: true },
    label: { type: String, required: true },
    content: { type: String, required: true },
    position: { type: Number, required: true },
    isEnabled: { type: Boolean, default: true },
    isSystem: { type: Boolean, default: false },
    variables: { type: [String], default: [] },
  },
  { _id: false },
);

export function createChatPromptTemplateSchema() {
  const schema = new Schema<IChatPromptTemplate>(
    {
      templateId: { type: String, required: true, unique: true },
      name: { type: String, required: true },
      description: { type: String },
      isDefault: { type: Boolean, default: false, index: true },
      isActive: { type: Boolean, default: true, index: true },
      sections: { type: [promptSectionSchema], default: [] },
      responseFormat: { type: String },
      temperature: { type: Number, min: 0, max: 2 },
      maxTokens: { type: Number, min: 1 },
      metadata: { type: Schema.Types.Mixed, default: {} },
      createdBy: { type: String },
    },
    {
      timestamps: true,
    },
  );

  return schema;
}
