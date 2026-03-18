import { Schema, Model, Types, HydratedDocument } from 'mongoose';
import { IDENTIFIER_STATUS } from '../constants';

const IDENTIFIER_STATUSES = Object.values(IDENTIFIER_STATUS);
type IdentifierStatus = typeof IDENTIFIER_STATUSES[number];

export interface ITelegramIdentifier {
  contactId: string;
  telegramUserId: string;
  username?: string;
  firstName?: string;
  lastName?: string;
  phone?: string;
  status: IdentifierStatus;
  knownByAccounts: Types.ObjectId[];
  lastActiveAt?: Date;
  sentCount: number;
  createdAt: Date;
  updatedAt: Date;
}

export type TelegramIdentifierDocument = HydratedDocument<ITelegramIdentifier>;

export interface TelegramIdentifierStatics {
  addKnownAccount(identifierId: string, accountId: string): Promise<TelegramIdentifierDocument | null>;
}

export type TelegramIdentifierModel = Model<ITelegramIdentifier> & TelegramIdentifierStatics;

export interface CreateTelegramIdentifierSchemaOptions {
  collectionName?: string;
}

export function createTelegramIdentifierSchema(options?: CreateTelegramIdentifierSchemaOptions) {
  const schema = new Schema<ITelegramIdentifier>(
    {
      contactId: { type: String, required: true },
      telegramUserId: { type: String, required: true, unique: true },
      username: String,
      firstName: String,
      lastName: String,
      phone: String,
      status: {
        type: String,
        enum: IDENTIFIER_STATUSES,
        default: 'active',
      },
      knownByAccounts: { type: [Schema.Types.ObjectId], default: [] },
      lastActiveAt: Date,
      sentCount: { type: Number, default: 0 },
    },
    {
      timestamps: true,
      collection: options?.collectionName || 'telegram_identifiers',

      statics: {
        addKnownAccount(identifierId: string, accountId: string) {
          return this.findByIdAndUpdate(
            identifierId,
            { $addToSet: { knownByAccounts: new Types.ObjectId(accountId) } },
            { new: true },
          );
        },
      },
    },
  );

  schema.index({ contactId: 1 });
  schema.index({ status: 1 });
  schema.index({ phone: 1 }, { sparse: true });

  return schema;
}
