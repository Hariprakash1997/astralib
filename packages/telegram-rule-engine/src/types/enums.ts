export const DELIVERY_STATUS = {
  Pending: 'pending',
  Sent: 'sent',
  Delivered: 'delivered',
  Read: 'read',
  Failed: 'failed',
} as const;

export type DeliveryStatus = typeof DELIVERY_STATUS[keyof typeof DELIVERY_STATUS];

export const ERROR_CATEGORY = {
  Critical: 'critical',
  Account: 'account',
  Recoverable: 'recoverable',
  Skip: 'skip',
  Unknown: 'unknown',
} as const;

export type ErrorCategory = typeof ERROR_CATEGORY[keyof typeof ERROR_CATEGORY];

export const SEND_STATUS = {
  Sent: 'sent',
  Error: 'error',
  Skipped: 'skipped',
  Throttled: 'throttled',
  Invalid: 'invalid',
} as const;

export type SendStatus = typeof SEND_STATUS[keyof typeof SEND_STATUS];

export const ERROR_OPERATION = {
  Send: 'send',
  Sync: 'sync',
  Connect: 'connect',
  Other: 'other',
} as const;

export type ErrorOperation = typeof ERROR_OPERATION[keyof typeof ERROR_OPERATION];
