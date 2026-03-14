import type {
  EmailEventType,
  AccountProvider,
  BounceType,
  SesBounceType,
  SesComplaintType,
  SesNotificationType,
  SnsMessageType,
} from '../constants';

export interface EmailEvent {
  type: EmailEventType;
  accountId: string;
  email: string;
  provider: AccountProvider;
  bounceType?: BounceType;
  link?: string;
  timestamp: Date;
  metadata?: Record<string, unknown>;
}

export interface SnsMessage {
  Type: SnsMessageType;
  MessageId: string;
  TopicArn: string;
  Subject?: string;
  Message: string;
  Timestamp: string;
  SignatureVersion: string;
  Signature: string;
  SigningCertURL: string;
  SubscribeURL?: string;
  UnsubscribeURL?: string;
  Token?: string;
}

export interface SesBounceRecipient {
  emailAddress: string;
  action?: string;
  status?: string;
  diagnosticCode?: string;
}

export interface SesComplaintRecipient {
  emailAddress: string;
}

export interface SesMailPayload {
  messageId: string;
  timestamp: string;
  source: string;
  sourceArn?: string;
  sendingAccountId?: string;
  destination: string[];
  headersTruncated?: boolean;
  headers?: Array<{ name: string; value: string }>;
  commonHeaders?: {
    from?: string[];
    to?: string[];
    subject?: string;
    messageId?: string;
  };
}

export interface SesBounce {
  bounceType: SesBounceType;
  bounceSubType: string;
  bouncedRecipients: SesBounceRecipient[];
  timestamp: string;
  feedbackId?: string;
  remoteMtaIp?: string;
  reportingMTA?: string;
}

export interface SesComplaint {
  complainedRecipients: SesComplaintRecipient[];
  timestamp: string;
  complaintFeedbackType?: SesComplaintType;
  feedbackId?: string;
  userAgent?: string;
  arrivalDate?: string;
}

export interface SesDelivery {
  timestamp: string;
  processingTimeMillis: number;
  recipients: string[];
  smtpResponse: string;
  reportingMTA?: string;
}

export interface SesOpen {
  ipAddress: string;
  timestamp: string;
  userAgent: string;
}

export interface SesClick {
  ipAddress: string;
  timestamp: string;
  userAgent: string;
  link: string;
  linkTags?: Record<string, string[]>;
}

export interface SesNotification {
  notificationType: SesNotificationType;
  mail: SesMailPayload;
  bounce?: SesBounce;
  complaint?: SesComplaint;
  delivery?: SesDelivery;
  open?: SesOpen;
  click?: SesClick;
}
