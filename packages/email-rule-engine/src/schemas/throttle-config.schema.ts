import { Schema, Model, HydratedDocument } from 'mongoose';
import { ThrottleWindow } from '../types/enums';
import type { EmailThrottleConfig } from '../types/throttle.types';

export interface IEmailThrottleConfig extends Omit<EmailThrottleConfig, '_id'> {}

export type EmailThrottleConfigDocument = HydratedDocument<IEmailThrottleConfig>;

export interface EmailThrottleConfigStatics {
  getConfig(): Promise<EmailThrottleConfigDocument>;
}

export type EmailThrottleConfigModel = Model<IEmailThrottleConfig> & EmailThrottleConfigStatics;

export function createEmailThrottleConfigSchema() {
  const schema = new Schema<IEmailThrottleConfig>(
    {
      maxPerUserPerDay: { type: Number, default: 1 },
      maxPerUserPerWeek: { type: Number, default: 2 },
      minGapDays: { type: Number, default: 3 },
      throttleWindow: { type: String, enum: Object.values(ThrottleWindow), default: ThrottleWindow.Rolling }
    },
    {
      timestamps: true,
      collection: 'email_throttle_config',

      statics: {
        async getConfig() {
          let config = await this.findOne();
          if (!config) {
            config = await this.create({
              maxPerUserPerDay: 1,
              maxPerUserPerWeek: 2,
              minGapDays: 3,
              throttleWindow: ThrottleWindow.Rolling
            });
          }
          return config;
        }
      }
    }
  );

  return schema;
}
