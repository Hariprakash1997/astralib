export type ThrottleWindow = 'rolling' | 'fixed';

export interface ThrottleConfig {
  maxPerUserPerDay: number;
  maxPerUserPerWeek: number;
  minGapDays: number;
  throttleWindow: ThrottleWindow;
}
