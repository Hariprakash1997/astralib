import type { ThrottleWindow } from '../constants';

export interface SendWindowConfig {
  startHour: number;
  endHour: number;
  timezone: string;
}

export interface EmailThrottleConfig {
  _id: string;
  maxPerUserPerDay: number;
  maxPerUserPerWeek: number;
  minGapDays: number;
  throttleWindow: ThrottleWindow;
  sendWindow?: SendWindowConfig;
  updatedAt: Date;
}

export interface UpdateEmailThrottleConfigInput {
  maxPerUserPerDay?: number;
  maxPerUserPerWeek?: number;
  minGapDays?: number;
  sendWindow?: SendWindowConfig | null;
}
