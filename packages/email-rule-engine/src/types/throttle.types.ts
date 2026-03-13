import { ThrottleWindow } from './enums';

export interface EmailThrottleConfig {
  _id: string;
  maxPerUserPerDay: number;
  maxPerUserPerWeek: number;
  minGapDays: number;
  throttleWindow: ThrottleWindow;
  updatedAt: Date;
}

export interface UpdateEmailThrottleConfigInput {
  maxPerUserPerDay?: number;
  maxPerUserPerWeek?: number;
  minGapDays?: number;
}
