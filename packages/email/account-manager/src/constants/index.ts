export const ACCOUNT_PROVIDER = {
  Gmail: 'gmail',
  Ses: 'ses',
} as const;

export type AccountProvider = (typeof ACCOUNT_PROVIDER)[keyof typeof ACCOUNT_PROVIDER];

export const ACCOUNT_STATUS = {
  Active: 'active',
  Disabled: 'disabled',
  QuotaExceeded: 'quota_exceeded',
  Error: 'error',
  Warmup: 'warmup',
} as const;

export type AccountStatus = (typeof ACCOUNT_STATUS)[keyof typeof ACCOUNT_STATUS];

export const IDENTIFIER_STATUS = {
  Active: 'active',
  Bounced: 'bounced',
  Unsubscribed: 'unsubscribed',
  Blocked: 'blocked',
  Invalid: 'invalid',
} as const;

export type IdentifierStatus = (typeof IDENTIFIER_STATUS)[keyof typeof IDENTIFIER_STATUS];

export const BOUNCE_TYPE = {
  Hard: 'hard',
  Soft: 'soft',
  InboxFull: 'inbox_full',
  InvalidEmail: 'invalid_email',
} as const;

export type BounceType = (typeof BOUNCE_TYPE)[keyof typeof BOUNCE_TYPE];

export const DRAFT_STATUS = {
  Pending: 'pending',
  Approved: 'approved',
  Rejected: 'rejected',
  Queued: 'queued',
  Sent: 'sent',
  Failed: 'failed',
} as const;

export type DraftStatus = (typeof DRAFT_STATUS)[keyof typeof DRAFT_STATUS];

export const EMAIL_EVENT_TYPE = {
  Sent: 'sent',
  Failed: 'failed',
  Delivered: 'delivered',
  Bounced: 'bounced',
  Complained: 'complained',
  Opened: 'opened',
  Clicked: 'clicked',
  Unsubscribed: 'unsubscribed',
} as const;

export type EmailEventType = (typeof EMAIL_EVENT_TYPE)[keyof typeof EMAIL_EVENT_TYPE];

export const SES_BOUNCE_TYPE = {
  Permanent: 'Permanent',
  Transient: 'Transient',
  Undetermined: 'Undetermined',
} as const;

export type SesBounceType = (typeof SES_BOUNCE_TYPE)[keyof typeof SES_BOUNCE_TYPE];

export const SES_COMPLAINT_TYPE = {
  Abuse: 'abuse',
  AuthFailure: 'auth-failure',
  Fraud: 'fraud',
  NotSpam: 'not-spam',
  Other: 'other',
  Virus: 'virus',
} as const;

export type SesComplaintType = (typeof SES_COMPLAINT_TYPE)[keyof typeof SES_COMPLAINT_TYPE];

export const SNS_MESSAGE_TYPE = {
  Notification: 'Notification',
  SubscriptionConfirmation: 'SubscriptionConfirmation',
  UnsubscribeConfirmation: 'UnsubscribeConfirmation',
} as const;

export type SnsMessageType = (typeof SNS_MESSAGE_TYPE)[keyof typeof SNS_MESSAGE_TYPE];

export const SES_NOTIFICATION_TYPE = {
  Bounce: 'Bounce',
  Complaint: 'Complaint',
  Delivery: 'Delivery',
  Send: 'Send',
  Open: 'Open',
  Click: 'Click',
} as const;

export type SesNotificationType = (typeof SES_NOTIFICATION_TYPE)[keyof typeof SES_NOTIFICATION_TYPE];

export const IMAP_SEARCH_SINCE = {
  LastCheck: 'last_check',
  Last24h: 'last_24h',
  Last7d: 'last_7d',
} as const;

export type ImapSearchSince = (typeof IMAP_SEARCH_SINCE)[keyof typeof IMAP_SEARCH_SINCE];

export const APPROVAL_MODE = {
  Manual: 'manual',
  Auto: 'auto',
} as const;

export type ApprovalMode = (typeof APPROVAL_MODE)[keyof typeof APPROVAL_MODE];

export const SPREAD_STRATEGY = {
  Random: 'random',
  Even: 'even',
} as const;

export type SpreadStrategy = (typeof SPREAD_STRATEGY)[keyof typeof SPREAD_STRATEGY];
