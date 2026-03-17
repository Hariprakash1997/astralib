import { describe, it, expect } from 'vitest';
import {
  ACCOUNT_PROVIDER,
  ACCOUNT_STATUS,
  IDENTIFIER_STATUS,
  BOUNCE_TYPE,
  DRAFT_STATUS,
  EMAIL_EVENT_TYPE,
  SES_BOUNCE_TYPE,
  SES_COMPLAINT_TYPE,
  SNS_MESSAGE_TYPE,
  SES_NOTIFICATION_TYPE,
  type AccountProvider,
  type AccountStatus,
  type IdentifierStatus,
  type BounceType,
  type DraftStatus,
  type EmailEventType,
  type SesBounceType,
  type SesComplaintType,
  type SnsMessageType,
  type SesNotificationType,
} from '../constants';

describe('Constants', () => {
  describe('ACCOUNT_PROVIDER', () => {
    it('has all expected values', () => {
      expect(ACCOUNT_PROVIDER.Gmail).toBe('gmail');
      expect(ACCOUNT_PROVIDER.Ses).toBe('ses');
    });

    it('has exactly 2 entries', () => {
      expect(Object.keys(ACCOUNT_PROVIDER)).toHaveLength(2);
    });

    it('all values are unique', () => {
      const values = Object.values(ACCOUNT_PROVIDER);
      expect(new Set(values).size).toBe(values.length);
    });

    it('union type accepts valid values', () => {
      const gmail: AccountProvider = 'gmail';
      const ses: AccountProvider = 'ses';
      expect(gmail).toBe(ACCOUNT_PROVIDER.Gmail);
      expect(ses).toBe(ACCOUNT_PROVIDER.Ses);
    });
  });

  describe('ACCOUNT_STATUS', () => {
    it('has all expected values', () => {
      expect(ACCOUNT_STATUS.Active).toBe('active');
      expect(ACCOUNT_STATUS.Disabled).toBe('disabled');
      expect(ACCOUNT_STATUS.QuotaExceeded).toBe('quota_exceeded');
      expect(ACCOUNT_STATUS.Error).toBe('error');
      expect(ACCOUNT_STATUS.Warmup).toBe('warmup');
    });

    it('has exactly 5 entries', () => {
      expect(Object.keys(ACCOUNT_STATUS)).toHaveLength(5);
    });

    it('all values are unique', () => {
      const values = Object.values(ACCOUNT_STATUS);
      expect(new Set(values).size).toBe(values.length);
    });

    it('union type accepts valid values', () => {
      const active: AccountStatus = 'active';
      const warmup: AccountStatus = 'warmup';
      expect(active).toBe(ACCOUNT_STATUS.Active);
      expect(warmup).toBe(ACCOUNT_STATUS.Warmup);
    });
  });

  describe('IDENTIFIER_STATUS', () => {
    it('has all expected values', () => {
      expect(IDENTIFIER_STATUS.Active).toBe('active');
      expect(IDENTIFIER_STATUS.Bounced).toBe('bounced');
      expect(IDENTIFIER_STATUS.Unsubscribed).toBe('unsubscribed');
      expect(IDENTIFIER_STATUS.Blocked).toBe('blocked');
      expect(IDENTIFIER_STATUS.Invalid).toBe('invalid');
    });

    it('has exactly 5 entries', () => {
      expect(Object.keys(IDENTIFIER_STATUS)).toHaveLength(5);
    });

    it('all values are unique', () => {
      const values = Object.values(IDENTIFIER_STATUS);
      expect(new Set(values).size).toBe(values.length);
    });

    it('union type accepts valid values', () => {
      const bounced: IdentifierStatus = 'bounced';
      expect(bounced).toBe(IDENTIFIER_STATUS.Bounced);
    });
  });

  describe('BOUNCE_TYPE', () => {
    it('has all expected values', () => {
      expect(BOUNCE_TYPE.Hard).toBe('hard');
      expect(BOUNCE_TYPE.Soft).toBe('soft');
      expect(BOUNCE_TYPE.InboxFull).toBe('inbox_full');
      expect(BOUNCE_TYPE.InvalidEmail).toBe('invalid_email');
    });

    it('has exactly 4 entries', () => {
      expect(Object.keys(BOUNCE_TYPE)).toHaveLength(4);
    });

    it('all values are unique', () => {
      const values = Object.values(BOUNCE_TYPE);
      expect(new Set(values).size).toBe(values.length);
    });

    it('union type accepts valid values', () => {
      const hard: BounceType = 'hard';
      expect(hard).toBe(BOUNCE_TYPE.Hard);
    });
  });

  describe('DRAFT_STATUS', () => {
    it('has all expected values', () => {
      expect(DRAFT_STATUS.Pending).toBe('pending');
      expect(DRAFT_STATUS.Approved).toBe('approved');
      expect(DRAFT_STATUS.Rejected).toBe('rejected');
      expect(DRAFT_STATUS.Queued).toBe('queued');
      expect(DRAFT_STATUS.Sent).toBe('sent');
      expect(DRAFT_STATUS.Failed).toBe('failed');
    });

    it('has exactly 6 entries', () => {
      expect(Object.keys(DRAFT_STATUS)).toHaveLength(6);
    });

    it('all values are unique', () => {
      const values = Object.values(DRAFT_STATUS);
      expect(new Set(values).size).toBe(values.length);
    });

    it('union type accepts valid values', () => {
      const pending: DraftStatus = 'pending';
      expect(pending).toBe(DRAFT_STATUS.Pending);
    });
  });

  describe('EMAIL_EVENT_TYPE', () => {
    it('has all expected values', () => {
      expect(EMAIL_EVENT_TYPE.Sent).toBe('sent');
      expect(EMAIL_EVENT_TYPE.Failed).toBe('failed');
      expect(EMAIL_EVENT_TYPE.Delivered).toBe('delivered');
      expect(EMAIL_EVENT_TYPE.Bounced).toBe('bounced');
      expect(EMAIL_EVENT_TYPE.Complained).toBe('complained');
      expect(EMAIL_EVENT_TYPE.Opened).toBe('opened');
      expect(EMAIL_EVENT_TYPE.Clicked).toBe('clicked');
      expect(EMAIL_EVENT_TYPE.Unsubscribed).toBe('unsubscribed');
    });

    it('has exactly 8 entries', () => {
      expect(Object.keys(EMAIL_EVENT_TYPE)).toHaveLength(8);
    });

    it('all values are unique', () => {
      const values = Object.values(EMAIL_EVENT_TYPE);
      expect(new Set(values).size).toBe(values.length);
    });

    it('union type accepts valid values', () => {
      const sent: EmailEventType = 'sent';
      const clicked: EmailEventType = 'clicked';
      expect(sent).toBe(EMAIL_EVENT_TYPE.Sent);
      expect(clicked).toBe(EMAIL_EVENT_TYPE.Clicked);
    });
  });

  describe('SES_BOUNCE_TYPE', () => {
    it('has all expected values', () => {
      expect(SES_BOUNCE_TYPE.Permanent).toBe('Permanent');
      expect(SES_BOUNCE_TYPE.Transient).toBe('Transient');
      expect(SES_BOUNCE_TYPE.Undetermined).toBe('Undetermined');
    });

    it('has exactly 3 entries', () => {
      expect(Object.keys(SES_BOUNCE_TYPE)).toHaveLength(3);
    });

    it('all values are unique', () => {
      const values = Object.values(SES_BOUNCE_TYPE);
      expect(new Set(values).size).toBe(values.length);
    });

    it('union type accepts valid values', () => {
      const permanent: SesBounceType = 'Permanent';
      expect(permanent).toBe(SES_BOUNCE_TYPE.Permanent);
    });
  });

  describe('SES_COMPLAINT_TYPE', () => {
    it('has all expected values', () => {
      expect(SES_COMPLAINT_TYPE.Abuse).toBe('abuse');
      expect(SES_COMPLAINT_TYPE.AuthFailure).toBe('auth-failure');
      expect(SES_COMPLAINT_TYPE.Fraud).toBe('fraud');
      expect(SES_COMPLAINT_TYPE.NotSpam).toBe('not-spam');
      expect(SES_COMPLAINT_TYPE.Other).toBe('other');
      expect(SES_COMPLAINT_TYPE.Virus).toBe('virus');
    });

    it('has exactly 6 entries', () => {
      expect(Object.keys(SES_COMPLAINT_TYPE)).toHaveLength(6);
    });

    it('all values are unique', () => {
      const values = Object.values(SES_COMPLAINT_TYPE);
      expect(new Set(values).size).toBe(values.length);
    });

    it('union type accepts valid values', () => {
      const abuse: SesComplaintType = 'abuse';
      expect(abuse).toBe(SES_COMPLAINT_TYPE.Abuse);
    });
  });

  describe('SNS_MESSAGE_TYPE', () => {
    it('has all expected values', () => {
      expect(SNS_MESSAGE_TYPE.Notification).toBe('Notification');
      expect(SNS_MESSAGE_TYPE.SubscriptionConfirmation).toBe('SubscriptionConfirmation');
      expect(SNS_MESSAGE_TYPE.UnsubscribeConfirmation).toBe('UnsubscribeConfirmation');
    });

    it('has exactly 3 entries', () => {
      expect(Object.keys(SNS_MESSAGE_TYPE)).toHaveLength(3);
    });

    it('all values are unique', () => {
      const values = Object.values(SNS_MESSAGE_TYPE);
      expect(new Set(values).size).toBe(values.length);
    });

    it('union type accepts valid values', () => {
      const notification: SnsMessageType = 'Notification';
      expect(notification).toBe(SNS_MESSAGE_TYPE.Notification);
    });
  });

  describe('SES_NOTIFICATION_TYPE', () => {
    it('has all expected values', () => {
      expect(SES_NOTIFICATION_TYPE.Bounce).toBe('Bounce');
      expect(SES_NOTIFICATION_TYPE.Complaint).toBe('Complaint');
      expect(SES_NOTIFICATION_TYPE.Delivery).toBe('Delivery');
      expect(SES_NOTIFICATION_TYPE.Send).toBe('Send');
      expect(SES_NOTIFICATION_TYPE.Open).toBe('Open');
      expect(SES_NOTIFICATION_TYPE.Click).toBe('Click');
    });

    it('has exactly 6 entries', () => {
      expect(Object.keys(SES_NOTIFICATION_TYPE)).toHaveLength(6);
    });

    it('all values are unique', () => {
      const values = Object.values(SES_NOTIFICATION_TYPE);
      expect(new Set(values).size).toBe(values.length);
    });

    it('union type accepts valid values', () => {
      const bounce: SesNotificationType = 'Bounce';
      expect(bounce).toBe(SES_NOTIFICATION_TYPE.Bounce);
    });
  });

  describe('as const behavior', () => {
    it('values are plain strings (as const is compile-time only)', () => {
      expect(typeof ACCOUNT_PROVIDER.Gmail).toBe('string');
      expect(typeof ACCOUNT_STATUS.Active).toBe('string');
      expect(typeof BOUNCE_TYPE.Hard).toBe('string');
      expect(typeof DRAFT_STATUS.Pending).toBe('string');
      expect(typeof EMAIL_EVENT_TYPE.Sent).toBe('string');
      expect(typeof SES_BOUNCE_TYPE.Permanent).toBe('string');
      expect(typeof SES_COMPLAINT_TYPE.Abuse).toBe('string');
      expect(typeof SNS_MESSAGE_TYPE.Notification).toBe('string');
      expect(typeof SES_NOTIFICATION_TYPE.Bounce).toBe('string');
    });

    it('type-level satisfies checks compile correctly', () => {
      const _provider: AccountProvider = ACCOUNT_PROVIDER.Gmail;
      const _status: AccountStatus = ACCOUNT_STATUS.Active;
      const _idStatus: IdentifierStatus = IDENTIFIER_STATUS.Active;
      const _bounce: BounceType = BOUNCE_TYPE.Hard;
      const _draft: DraftStatus = DRAFT_STATUS.Pending;
      const _event: EmailEventType = EMAIL_EVENT_TYPE.Sent;
      const _sesBounce: SesBounceType = SES_BOUNCE_TYPE.Permanent;
      const _complaint: SesComplaintType = SES_COMPLAINT_TYPE.Abuse;
      const _sns: SnsMessageType = SNS_MESSAGE_TYPE.Notification;
      const _sesNotif: SesNotificationType = SES_NOTIFICATION_TYPE.Bounce;

      expect(_provider).toBeDefined();
      expect(_status).toBeDefined();
      expect(_idStatus).toBeDefined();
      expect(_bounce).toBeDefined();
      expect(_draft).toBeDefined();
      expect(_event).toBeDefined();
      expect(_sesBounce).toBeDefined();
      expect(_complaint).toBeDefined();
      expect(_sns).toBeDefined();
      expect(_sesNotif).toBeDefined();
    });
  });
});
