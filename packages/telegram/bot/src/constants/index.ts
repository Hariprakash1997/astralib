export const CONTACT_STATUS = {
  Active: 'active',
  Blocked: 'blocked',
  Stopped: 'stopped',
} as const;

export const BOT_MODE = {
  Polling: 'polling',
  Webhook: 'webhook',
} as const;

export const DEFAULT_WEBHOOK_PATH = '/telegram/webhook';
