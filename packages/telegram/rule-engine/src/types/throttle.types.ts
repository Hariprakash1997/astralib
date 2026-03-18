export type ThrottleWindow = 'rolling' | 'fixed';

export interface ThrottleConfig {
  maxPerUserPerDay: number;
  maxPerUserPerWeek: number;
  minGapDays: number;
  /** Reserved for future use. Currently defaults to rolling behavior. */
  throttleWindow: ThrottleWindow;
}
