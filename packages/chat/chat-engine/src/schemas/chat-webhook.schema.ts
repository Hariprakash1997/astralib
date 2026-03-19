import { Schema, Model, HydratedDocument } from 'mongoose';

export interface IWebhookDelivery {
  event: string;
  payload: Record<string, unknown>;
  statusCode?: number;
  error?: string;
  attempts: number;
  lastAttemptAt: Date;
  succeededAt?: Date;
}

export interface IChatWebhook {
  webhookId: string;
  url: string;
  events: string[];
  secret?: string;
  isActive: boolean;
  description?: string;
  failedDeliveries: IWebhookDelivery[];
  createdAt: Date;
  updatedAt: Date;
}

export type ChatWebhookDocument = HydratedDocument<IChatWebhook>;

export type ChatWebhookModel = Model<IChatWebhook>;

export function createChatWebhookSchema() {
  const deliverySchema = new Schema<IWebhookDelivery>(
    {
      event: { type: String, required: true },
      payload: { type: Schema.Types.Mixed, required: true },
      statusCode: { type: Number },
      error: { type: String },
      attempts: { type: Number, default: 1 },
      lastAttemptAt: { type: Date, default: Date.now },
      succeededAt: { type: Date },
    },
    { _id: false },
  );

  const schema = new Schema<IChatWebhook>(
    {
      webhookId: { type: String, required: true, unique: true },
      url: { type: String, required: true },
      events: { type: [String], required: true },
      secret: { type: String },
      isActive: { type: Boolean, default: true },
      description: { type: String },
      failedDeliveries: { type: [deliverySchema], default: [] },
    },
    {
      timestamps: true,
    },
  );

  schema.index({ isActive: 1 });
  schema.index({ events: 1 });

  return schema;
}
