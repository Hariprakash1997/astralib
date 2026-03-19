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

// SEND_STATUS is re-exported from @astralibx/rule-engine in index.ts.
// Telegram consumers should import it from there.

export const ERROR_OPERATION = {
  Send: 'send',
  Sync: 'sync',
  Connect: 'connect',
  Other: 'other',
} as const;

export type ErrorOperation = typeof ERROR_OPERATION[keyof typeof ERROR_OPERATION];
