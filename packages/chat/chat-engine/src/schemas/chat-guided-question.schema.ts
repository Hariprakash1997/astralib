import { Schema, Model, HydratedDocument } from 'mongoose';

export interface IChatGuidedQuestionOption {
  value: string;
  label: string;
  icon?: string;
  description?: string;
  nextQuestion?: string;
  skipToStep?: string;
  metadata?: Record<string, unknown>;
}

export interface IChatGuidedQuestion {
  questionId: string;
  key: string;
  text: string;
  options: IChatGuidedQuestionOption[];
  allowFreeText: boolean;
  multiSelect: boolean;
  order: number;
  isActive: boolean;
  metadata?: Record<string, unknown>;
  createdAt: Date;
  updatedAt: Date;
}

export type ChatGuidedQuestionDocument = HydratedDocument<IChatGuidedQuestion>;

export type ChatGuidedQuestionModel = Model<IChatGuidedQuestion>;

export function createChatGuidedQuestionSchema() {
  const optionSchema = new Schema<IChatGuidedQuestionOption>(
    {
      value: { type: String, required: true },
      label: { type: String, required: true },
      icon: { type: String },
      description: { type: String },
      nextQuestion: { type: String },
      skipToStep: { type: String },
      metadata: { type: Schema.Types.Mixed },
    },
    { _id: false },
  );

  const schema = new Schema<IChatGuidedQuestion>(
    {
      questionId: { type: String, required: true, unique: true },
      key: { type: String, required: true, unique: true, index: true },
      text: { type: String, required: true },
      options: { type: [optionSchema], default: [] },
      allowFreeText: { type: Boolean, default: false },
      multiSelect: { type: Boolean, default: false },
      order: { type: Number, default: 0, index: true },
      isActive: { type: Boolean, default: true },
      metadata: { type: Schema.Types.Mixed, default: {} },
    },
    {
      timestamps: true,
    },
  );

  return schema;
}
