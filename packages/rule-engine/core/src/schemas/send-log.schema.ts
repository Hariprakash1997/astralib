import { Schema, Model, Types, HydratedDocument } from 'mongoose';

export interface ISendLog {
  ruleId: Types.ObjectId;
  userId: string;
  identifierId?: string;
  messageId?: string;
  sentAt: Date;
  status?: string;
  accountId?: string;
  senderName?: string;
  subject?: string;
  failureReason?: string;
}

export type SendLogDocument = HydratedDocument<ISendLog>;

export interface SendLogStatics {
  findLatestForUser(ruleId: string | Types.ObjectId, userId: string): Promise<SendLogDocument | null>;
  findRecentByUserIds(userIds: string[], sinceDays: number): Promise<SendLogDocument[]>;
  logSend(
    ruleId: string | Types.ObjectId,
    userId: string,
    identifierId?: string,
    messageId?: string,
    extra?: { status?: string; accountId?: string; senderName?: string; subject?: string; failureReason?: string }
  ): Promise<SendLogDocument>;
}

export type SendLogModel = Model<ISendLog> & SendLogStatics;

export function createSendLogSchema(collectionPrefix?: string) {
  const schema = new Schema<ISendLog>(
    {
      ruleId: { type: Schema.Types.ObjectId, ref: 'Rule', required: true },
      userId: { type: String, required: true },
      identifierId: { type: String },
      messageId: { type: String },
      sentAt: { type: Date, required: true, default: () => new Date() },
      status: { type: String },
      accountId: { type: String },
      senderName: { type: String },
      subject: { type: String },
      failureReason: { type: String },
    },
    {
      collection: `${collectionPrefix || ''}send_logs`,

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
          identifierId?: string,
          messageId?: string,
          extra?: { status?: string; accountId?: string; senderName?: string; subject?: string; failureReason?: string }
        ) {
          return this.create({
            ruleId,
            userId,
            identifierId,
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
