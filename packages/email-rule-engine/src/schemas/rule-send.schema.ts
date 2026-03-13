import { Schema, Model, Types, HydratedDocument } from 'mongoose';

export interface IEmailRuleSend {
  ruleId: Types.ObjectId;
  userId: Types.ObjectId;
  emailIdentifierId?: Types.ObjectId;
  messageId?: Types.ObjectId;
  sentAt: Date;
}

export type EmailRuleSendDocument = HydratedDocument<IEmailRuleSend>;

export interface EmailRuleSendStatics {
  findLatestForUser(ruleId: string | Types.ObjectId, userId: string | Types.ObjectId): Promise<EmailRuleSendDocument | null>;
  findRecentByUserIds(userIds: (string | Types.ObjectId)[], sinceDays: number): Promise<EmailRuleSendDocument[]>;
  logSend(ruleId: string | Types.ObjectId, userId: string | Types.ObjectId, emailIdentifierId?: string | Types.ObjectId, messageId?: string | Types.ObjectId): Promise<EmailRuleSendDocument>;
}

export type EmailRuleSendModel = Model<IEmailRuleSend> & EmailRuleSendStatics;

export function createEmailRuleSendSchema() {
  const schema = new Schema<IEmailRuleSend>(
    {
      ruleId: { type: Schema.Types.ObjectId, ref: 'EmailRule', required: true },
      userId: { type: Schema.Types.ObjectId, required: true },
      emailIdentifierId: { type: Schema.Types.ObjectId },
      messageId: { type: Schema.Types.ObjectId },
      sentAt: { type: Date, required: true, default: () => new Date() }
    },
    {
      collection: 'email_rule_sends',

      statics: {
        findLatestForUser(ruleId: string | Types.ObjectId, userId: string | Types.ObjectId) {
          return this.findOne({ ruleId, userId }).sort({ sentAt: -1 });
        },

        findRecentByUserIds(userIds: (string | Types.ObjectId)[], sinceDays: number) {
          const since = new Date(Date.now() - sinceDays * 86400000);
          return this.find({
            userId: { $in: userIds },
            sentAt: { $gte: since }
          }).sort({ sentAt: -1 });
        },

        async logSend(
          ruleId: string | Types.ObjectId,
          userId: string | Types.ObjectId,
          emailIdentifierId?: string | Types.ObjectId,
          messageId?: string | Types.ObjectId
        ) {
          return this.create({
            ruleId,
            userId,
            emailIdentifierId,
            messageId,
            sentAt: new Date()
          });
        }
      }
    }
  );

  schema.index({ ruleId: 1, userId: 1, sentAt: -1 });
  schema.index({ userId: 1, sentAt: -1 });
  schema.index({ ruleId: 1, sentAt: -1 });

  return schema;
}
