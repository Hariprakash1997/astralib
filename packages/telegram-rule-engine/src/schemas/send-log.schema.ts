import { Schema, Model, Types, HydratedDocument } from 'mongoose';

export interface ITelegramSendLog {
  identifierId: string;
  contactId: string;
  accountId: string;
  ruleId: Types.ObjectId;
  runId: string;
  templateId: Types.ObjectId;
  messagePreview?: string;
  messageIndex: number;
  deliveryStatus: string;
  sentAt?: Date;
  responseReceived: boolean;
  responseAt?: Date;
  responsePreview?: string;
  errorInfo?: {
    code: string;
    category: string;
    message: string;
    retryable: boolean;
  };
  createdAt?: Date;
  updatedAt?: Date;
}

export type TelegramSendLogDocument = HydratedDocument<ITelegramSendLog>;

export interface TelegramSendLogStatics {
  findByRuleAndIdentifier(ruleId: string | Types.ObjectId, identifierId: string): Promise<TelegramSendLogDocument[]>;
  findByRunId(runId: string): Promise<TelegramSendLogDocument[]>;
  findByContactId(contactId: string): Promise<TelegramSendLogDocument[]>;
}

export type TelegramSendLogModel = Model<ITelegramSendLog> & TelegramSendLogStatics;

export function createTelegramSendLogSchema(collectionPrefix?: string) {
  const ErrorInfoSchema = new Schema({
    code: { type: String, required: true },
    category: { type: String, required: true },
    message: { type: String, required: true },
    retryable: { type: Boolean, required: true }
  }, { _id: false });

  const schema = new Schema<ITelegramSendLog>(
    {
      identifierId: { type: String, required: true },
      contactId: { type: String, required: true },
      accountId: { type: String, required: true },
      ruleId: { type: Schema.Types.ObjectId, required: true },
      runId: { type: String, required: true },
      templateId: { type: Schema.Types.ObjectId, required: true },
      messagePreview: { type: String },
      messageIndex: { type: Number, default: 0 },
      deliveryStatus: {
        type: String,
        enum: ['pending', 'sent', 'delivered', 'read', 'failed'],
        default: 'pending'
      },
      sentAt: { type: Date },
      responseReceived: { type: Boolean, default: false },
      responseAt: { type: Date },
      responsePreview: { type: String },
      errorInfo: { type: ErrorInfoSchema, default: undefined }
    },
    {
      timestamps: true,
      collection: `${collectionPrefix || ''}telegram_send_logs`,

      statics: {
        findByRuleAndIdentifier(ruleId: string | Types.ObjectId, identifierId: string) {
          return this.find({ ruleId, identifierId }).sort({ sentAt: -1 });
        },

        findByRunId(runId: string) {
          return this.find({ runId }).sort({ sentAt: -1 });
        },

        findByContactId(contactId: string) {
          return this.find({ contactId }).sort({ sentAt: -1 });
        }
      }
    }
  );

  schema.index({ ruleId: 1, identifierId: 1 });
  schema.index({ runId: 1 });
  schema.index({ contactId: 1 });
  schema.index({ sentAt: -1 });

  return schema;
}
