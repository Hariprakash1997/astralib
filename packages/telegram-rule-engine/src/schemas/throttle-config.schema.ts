import { Schema, Model, HydratedDocument } from 'mongoose';

export interface ITelegramThrottleConfig {
  maxPerUserPerDay: number;
  maxPerUserPerWeek: number;
  minGapDays: number;
  throttleWindow: string;
  createdAt?: Date;
  updatedAt?: Date;
}

export type TelegramThrottleConfigDocument = HydratedDocument<ITelegramThrottleConfig>;

export interface TelegramThrottleConfigStatics {
  getConfig(): Promise<TelegramThrottleConfigDocument>;
}

export type TelegramThrottleConfigModel = Model<ITelegramThrottleConfig> & TelegramThrottleConfigStatics;

export function createTelegramThrottleConfigSchema(collectionPrefix?: string) {
  const schema = new Schema<ITelegramThrottleConfig>(
    {
      maxPerUserPerDay: { type: Number, default: 1 },
      maxPerUserPerWeek: { type: Number, default: 2 },
      minGapDays: { type: Number, default: 3 },
      throttleWindow: { type: String, enum: ['rolling', 'fixed'], default: 'rolling' }
    },
    {
      timestamps: true,
      collection: `${collectionPrefix || ''}telegram_throttle_config`,

      statics: {
        async getConfig() {
          let config = await this.findOne();
          if (!config) {
            config = await this.create({
              maxPerUserPerDay: 1,
              maxPerUserPerWeek: 2,
              minGapDays: 3,
              throttleWindow: 'rolling'
            });
          }
          return config;
        }
      }
    }
  );

  return schema;
}
