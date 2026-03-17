import { Schema, Model, HydratedDocument } from 'mongoose';

export interface ITelegramErrorLog {
  accountId?: string;
  accountName?: string;
  contactId?: string;
  contactName?: string;
  errorCode: string;
  errorCategory: string;
  errorMessage?: string;
  operation: string;
  createdAt?: Date;
  updatedAt?: Date;
}

export type TelegramErrorLogDocument = HydratedDocument<ITelegramErrorLog>;

export interface TelegramErrorLogStatics {
  findByErrorCode(errorCode: string): Promise<TelegramErrorLogDocument[]>;
  findByCategory(category: string): Promise<TelegramErrorLogDocument[]>;
  getRecent(limit?: number): Promise<TelegramErrorLogDocument[]>;
}

export type TelegramErrorLogModel = Model<ITelegramErrorLog> & TelegramErrorLogStatics;

export function createTelegramErrorLogSchema(collectionPrefix?: string) {
  const schema = new Schema<ITelegramErrorLog>(
    {
      accountId: { type: String },
      accountName: { type: String },
      contactId: { type: String },
      contactName: { type: String },
      errorCode: { type: String, required: true },
      errorCategory: {
        type: String,
        enum: ['critical', 'account', 'recoverable', 'skip', 'unknown'],
        required: true
      },
      errorMessage: { type: String },
      operation: {
        type: String,
        enum: ['send', 'sync', 'connect', 'other'],
        default: 'send'
      }
    },
    {
      timestamps: true,
      collection: `${collectionPrefix || ''}telegram_error_logs`,

      statics: {
        findByErrorCode(errorCode: string) {
          return this.find({ errorCode }).sort({ createdAt: -1 });
        },

        findByCategory(category: string) {
          return this.find({ errorCategory: category }).sort({ createdAt: -1 });
        },

        getRecent(limit = 50) {
          return this.find().sort({ createdAt: -1 }).limit(limit);
        }
      }
    }
  );

  schema.index({ errorCode: 1 });
  schema.index({ errorCategory: 1 });
  schema.index({ operation: 1 });
  schema.index({ createdAt: -1 });

  return schema;
}
