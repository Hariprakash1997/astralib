import { Schema, Model, HydratedDocument } from 'mongoose';
import { THROTTLE_WINDOW } from '../constants';

export interface IThrottleConfig {
  maxPerUserPerDay: number;
  maxPerUserPerWeek: number;
  minGapDays: number;
  throttleWindow: string;
  sendWindow?: {
    startHour: number;
    endHour: number;
    timezone: string;
  };
}

export type ThrottleConfigDocument = HydratedDocument<IThrottleConfig>;

export interface ThrottleConfigStatics {
  getConfig(): Promise<ThrottleConfigDocument>;
}

export type ThrottleConfigModel = Model<IThrottleConfig> & ThrottleConfigStatics;

export function createThrottleConfigSchema(collectionPrefix?: string) {
  const schema = new Schema<IThrottleConfig>(
    {
      maxPerUserPerDay: { type: Number, default: 1 },
      maxPerUserPerWeek: { type: Number, default: 2 },
      minGapDays: { type: Number, default: 3 },
      throttleWindow: { type: String, enum: Object.values(THROTTLE_WINDOW), default: THROTTLE_WINDOW.Rolling },
      sendWindow: {
        type: {
          startHour: { type: Number, min: 0, max: 23 },
          endHour: { type: Number, min: 0, max: 23 },
          timezone: { type: String },
        },
        _id: false,
        default: undefined,
      }
    },
    {
      timestamps: true,
      collection: `${collectionPrefix || ''}throttle_config`,

      statics: {
        async getConfig() {
          let config = await this.findOne();
          if (!config) {
            config = await this.create({
              maxPerUserPerDay: 1,
              maxPerUserPerWeek: 2,
              minGapDays: 3,
              throttleWindow: THROTTLE_WINDOW.Rolling
            });
          }
          return config;
        }
      }
    }
  );

  return schema;
}
