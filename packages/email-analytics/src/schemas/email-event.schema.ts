import { Schema, Model, Types, HydratedDocument } from 'mongoose';
import type { EventType, EventChannel } from '../constants';
import { EVENT_TYPE, EVENT_CHANNEL } from '../constants';

export interface IEmailEvent {
  type: EventType;
  accountId: Types.ObjectId;
  ruleId?: Types.ObjectId;
  templateId?: Types.ObjectId;
  recipientEmail: string;
  externalUserId?: string;
  channel?: EventChannel;
  identifierId?: Types.ObjectId;
  metadata?: Record<string, unknown>;
  timestamp: Date;
  createdAt: Date;
  updatedAt: Date;
}

export type EmailEventDocument = HydratedDocument<IEmailEvent>;

export interface EmailEventStatics {
  record(event: {
    type: EventType;
    accountId: string;
    ruleId?: string;
    templateId?: string;
    recipientEmail: string;
    externalUserId?: string;
    channel?: string;
    identifierId?: string;
    metadata?: Record<string, unknown>;
    timestamp?: Date;
  }): Promise<EmailEventDocument>;
  findByDateRange(
    start: Date,
    end: Date,
    filters?: { type?: EventType; accountId?: string; ruleId?: string; templateId?: string },
  ): Promise<EmailEventDocument[]>;
}

export type EmailEventModel = Model<IEmailEvent> & EmailEventStatics;

export interface CreateEmailEventSchemaOptions {
  collectionName?: string;
  eventTTLDays?: number;
}

export function createEmailEventSchema(options?: CreateEmailEventSchemaOptions) {
  const eventTypeValues = Object.values(EVENT_TYPE);
  const channelValues = Object.values(EVENT_CHANNEL);

  const schema = new Schema<IEmailEvent>(
    {
      type: { type: String, required: true, enum: eventTypeValues, index: true },
      accountId: { type: Schema.Types.ObjectId, required: true, index: true },
      ruleId: { type: Schema.Types.ObjectId, index: true },
      templateId: { type: Schema.Types.ObjectId, index: true },
      recipientEmail: { type: String, required: true },
      externalUserId: { type: String, index: true },
      channel: { type: String, enum: channelValues, index: true },
      identifierId: { type: Schema.Types.ObjectId },
      metadata: { type: Schema.Types.Mixed },
      timestamp: { type: Date, required: true, default: () => new Date() },
    },
    {
      timestamps: true,
      collection: options?.collectionName || 'email_events',

      statics: {
        record(event: {
          type: EventType;
          accountId: string;
          ruleId?: string;
          templateId?: string;
          recipientEmail: string;
          externalUserId?: string;
          channel?: string;
          identifierId?: string;
          metadata?: Record<string, unknown>;
          timestamp?: Date;
        }) {
          return this.create({
            type: event.type,
            accountId: new Types.ObjectId(event.accountId),
            ruleId: event.ruleId ? new Types.ObjectId(event.ruleId) : undefined,
            templateId: event.templateId ? new Types.ObjectId(event.templateId) : undefined,
            recipientEmail: event.recipientEmail,
            externalUserId: event.externalUserId,
            channel: event.channel,
            identifierId: event.identifierId ? new Types.ObjectId(event.identifierId) : undefined,
            metadata: event.metadata,
            timestamp: event.timestamp || new Date(),
          });
        },

        findByDateRange(
          start: Date,
          end: Date,
          filters?: { type?: EventType; accountId?: string; ruleId?: string; templateId?: string },
        ) {
          const query: Record<string, unknown> = {
            timestamp: { $gte: start, $lte: end },
          };

          if (filters?.type) query.type = filters.type;
          if (filters?.accountId) query.accountId = new Types.ObjectId(filters.accountId);
          if (filters?.ruleId) query.ruleId = new Types.ObjectId(filters.ruleId);
          if (filters?.templateId) query.templateId = new Types.ObjectId(filters.templateId);

          return this.find(query).sort({ timestamp: -1 });
        },
      },
    },
  );

  const ttlDays = options?.eventTTLDays ?? 90;
  schema.index({ timestamp: 1 }, { expireAfterSeconds: ttlDays * 24 * 60 * 60 });
  schema.index({ type: 1, timestamp: -1 });
  schema.index({ accountId: 1, timestamp: -1 });
  schema.index({ ruleId: 1, timestamp: -1 });
  schema.index({ externalUserId: 1, timestamp: -1 });
  schema.index({ channel: 1, timestamp: -1 });

  return schema;
}
