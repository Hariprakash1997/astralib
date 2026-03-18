import { Schema, Model, Types, HydratedDocument } from 'mongoose';

export interface IEmailRuleSend {
  ruleId: Types.ObjectId;
  userId: string;
  emailIdentifierId?: string;
  messageId?: string;
  sentAt: Date;
  status?: string;
  accountId?: string;
  senderName?: string;
  subject?: string;
  subjectIndex?: number;
  bodyIndex?: number;
  preheaderIndex?: number;
  failureReason?: string;
}

export type EmailRuleSendDocument = HydratedDocument<IEmailRuleSend>;

export interface EmailRuleSendStatics {
  findLatestForUser(ruleId: string | Types.ObjectId, userId: string): Promise<EmailRuleSendDocument | null>;
  findRecentByUserIds(userIds: string[], sinceDays: number): Promise<EmailRuleSendDocument[]>;
  logSend(
    ruleId: string | Types.ObjectId,
    userId: string,
    emailIdentifierId?: string,
    messageId?: string,
    extra?: { status?: string; accountId?: string; senderName?: string; subject?: string; subjectIndex?: number; bodyIndex?: number; preheaderIndex?: number; failureReason?: string }
  ): Promise<EmailRuleSendDocument>;
}

export type EmailRuleSendModel = Model<IEmailRuleSend> & EmailRuleSendStatics;

export function createEmailRuleSendSchema(collectionPrefix?: string) {
  const schema = new Schema<IEmailRuleSend>(
    {
      ruleId: { type: Schema.Types.ObjectId, ref: 'EmailRule', required: true },
      userId: { type: String, required: true },
      emailIdentifierId: { type: String },
      messageId: { type: String },
      sentAt: { type: Date, required: true, default: () => new Date() },
      status: { type: String },
      accountId: { type: String },
      senderName: { type: String },
      subject: { type: String },
      subjectIndex: { type: Number },
      bodyIndex: { type: Number },
      preheaderIndex: { type: Number },
      failureReason: { type: String },
    },
    {
      collection: `${collectionPrefix || ''}email_rule_sends`,

      statics: {
        findLatestForUser(ruleId: string | Types.ObjectId, userId: string) {
          return this.findOne({ ruleId, userId }).sort({ sentAt: -1 });
        },

        findRecentByUserIds(userIds: string[], sinceDays: number) {
          const since = new Date(Date.now() - sinceDays * 86400000);
          return this.find({
            userId: { $in: userIds },
            sentAt: { $gte: since }
          }).sort({ sentAt: -1 });
        },

        async logSend(
          ruleId: string | Types.ObjectId,
          userId: string,
          emailIdentifierId?: string,
          messageId?: string,
          extra?: { status?: string; accountId?: string; senderName?: string; subject?: string; subjectIndex?: number; bodyIndex?: number; preheaderIndex?: number; failureReason?: string }
        ) {
          return this.create({
            ruleId,
            userId,
            emailIdentifierId,
            messageId,
            sentAt: new Date(),
            ...extra,
          });
        }
      }
    }
  );

  schema.index({ ruleId: 1, userId: 1, sentAt: -1 });
  schema.index({ userId: 1, sentAt: -1 });
  schema.index({ ruleId: 1, sentAt: -1 });
  schema.index({ status: 1, sentAt: -1 });

  return schema;
}
