import { describe, it, expect, vi, beforeEach } from 'vitest';
import { SesWebhookHandler } from '../services/ses-webhook-handler';
import {
  ACCOUNT_PROVIDER,
  BOUNCE_TYPE,
  IDENTIFIER_STATUS,
  SNS_MESSAGE_TYPE,
  SES_NOTIFICATION_TYPE,
  SES_BOUNCE_TYPE,
} from '../constants';
import type { EmailAccountModel } from '../schemas/email-account.schema';
import type { HealthTracker } from '../services/health-tracker';
import type { IdentifierService } from '../services/identifier.service';
import type { LogAdapter, EmailAccountManagerConfig } from '../types/config.types';

function createMockLogger(): LogAdapter {
  return {
    info: vi.fn(),
    warn: vi.fn(),
    error: vi.fn(),
  };
}

function createMockHealthTracker(): HealthTracker {
  return {
    recordBounce: vi.fn(),
    recordSuccess: vi.fn(),
    recordError: vi.fn(),
  } as unknown as HealthTracker;
}

function createMockIdentifierService(): IdentifierService {
  return {
    updateStatus: vi.fn(),
    markBounced: vi.fn(),
  } as unknown as IdentifierService;
}

function createMockEmailAccount() {
  return {
    findOne: vi.fn(),
  } as unknown as EmailAccountModel;
}

function makeSnsNotification(notificationType: string, extra: Record<string, unknown> = {}) {
  return {
    Type: SNS_MESSAGE_TYPE.Notification,
    MessageId: 'msg-1',
    TopicArn: 'arn:aws:sns:us-east-1:123456:ses-topic',
    Message: JSON.stringify({
      notificationType,
      mail: {
        messageId: 'mail-1',
        timestamp: '2025-01-01T00:00:00Z',
        source: 'sender@example.com',
        destination: ['recipient@example.com'],
      },
      ...extra,
    }),
    Timestamp: '2025-01-01T00:00:00Z',
    SignatureVersion: '',
    Signature: '',
    SigningCertURL: '',
  };
}

describe('SesWebhookHandler', () => {
  let handler: SesWebhookHandler;
  let healthTracker: HealthTracker;
  let identifierService: IdentifierService;
  let EmailAccount: EmailAccountModel;
  let logger: LogAdapter;
  let config: EmailAccountManagerConfig;
  let hooks: EmailAccountManagerConfig['hooks'];

  beforeEach(() => {
    healthTracker = createMockHealthTracker();
    identifierService = createMockIdentifierService();
    EmailAccount = createMockEmailAccount();
    logger = createMockLogger();
    config = {
      db: { connection: {} as any },
      redis: { connection: {} as any },
      options: {
        ses: {
          enabled: true,
          validateSignature: false,
        },
      },
    };
    hooks = {
      onBounce: vi.fn(),
      onComplaint: vi.fn(),
      onDelivery: vi.fn(),
      onOpen: vi.fn(),
      onClick: vi.fn(),
    };
    handler = new SesWebhookHandler(healthTracker, identifierService, EmailAccount, config, logger, hooks);

    // Default: account found
    (EmailAccount.findOne as ReturnType<typeof vi.fn>).mockResolvedValue({ _id: 'acc-1', toString: () => 'acc-1' });
  });

  describe('handleSnsMessage()', () => {
    it('should return error for invalid SNS message', async () => {
      const result = await handler.handleSnsMessage({});

      expect(result.processed).toBe(false);
      expect(result.error).toContain('Invalid SNS message');
    });

    it('should handle SubscriptionConfirmation by visiting SubscribeURL', async () => {
      // We can't easily test the https.get, but we can test URL validation
      const message = {
        Type: SNS_MESSAGE_TYPE.SubscriptionConfirmation,
        MessageId: 'msg-1',
        TopicArn: 'arn:aws:sns:us-east-1:123456:ses-topic',
        SubscribeURL: 'https://invalid-host.com/confirm',
        Message: '',
        Timestamp: '2025-01-01T00:00:00Z',
        SignatureVersion: '',
        Signature: '',
        SigningCertURL: '',
      };

      const result = await handler.handleSnsMessage(message);

      // Should reject non-AWS hostname
      expect(result.processed).toBe(false);
      expect(result.error).toContain('not from amazonaws.com');
    });

    it('should return error when SubscriptionConfirmation has no SubscribeURL', async () => {
      const message = {
        Type: SNS_MESSAGE_TYPE.SubscriptionConfirmation,
        MessageId: 'msg-1',
        TopicArn: 'arn:aws:sns:us-east-1:123456:ses-topic',
        Message: '',
        Timestamp: '2025-01-01T00:00:00Z',
        SignatureVersion: '',
        Signature: '',
        SigningCertURL: '',
      };

      const result = await handler.handleSnsMessage(message);

      expect(result.processed).toBe(false);
      expect(result.error).toBe('No SubscribeURL provided');
    });
  });

  describe('processBounce - Permanent', () => {
    it('should mark identifier as Invalid for Permanent/noemail bounce', async () => {
      const snsMessage = makeSnsNotification(SES_NOTIFICATION_TYPE.Bounce, {
        bounce: {
          bounceType: SES_BOUNCE_TYPE.Permanent,
          bounceSubType: 'NoEmail',
          bouncedRecipients: [{ emailAddress: 'bad@example.com' }],
          timestamp: '2025-01-01T00:00:00Z',
        },
      });

      const result = await handler.handleSnsMessage(snsMessage);

      expect(result.processed).toBe(true);
      expect(result.type).toBe('bounce');
      expect(identifierService.updateStatus).toHaveBeenCalledWith('bad@example.com', IDENTIFIER_STATUS.Invalid);
    });

    it('should mark identifier as Invalid for Permanent/general bounce', async () => {
      const snsMessage = makeSnsNotification(SES_NOTIFICATION_TYPE.Bounce, {
        bounce: {
          bounceType: SES_BOUNCE_TYPE.Permanent,
          bounceSubType: 'General',
          bouncedRecipients: [{ emailAddress: 'bad@example.com' }],
          timestamp: '2025-01-01T00:00:00Z',
        },
      });

      await handler.handleSnsMessage(snsMessage);

      expect(identifierService.updateStatus).toHaveBeenCalledWith('bad@example.com', IDENTIFIER_STATUS.Invalid);
    });

    it('should mark identifier as Hard bounced for other Permanent sub-types', async () => {
      const snsMessage = makeSnsNotification(SES_NOTIFICATION_TYPE.Bounce, {
        bounce: {
          bounceType: SES_BOUNCE_TYPE.Permanent,
          bounceSubType: 'Suppressed',
          bouncedRecipients: [{ emailAddress: 'suppressed@example.com' }],
          timestamp: '2025-01-01T00:00:00Z',
        },
      });

      await handler.handleSnsMessage(snsMessage);

      expect(identifierService.markBounced).toHaveBeenCalledWith('suppressed@example.com', BOUNCE_TYPE.Hard);
    });
  });

  describe('processBounce - Transient', () => {
    it('should mark as Bounced with inbox_full type for mailboxfull', async () => {
      const snsMessage = makeSnsNotification(SES_NOTIFICATION_TYPE.Bounce, {
        bounce: {
          bounceType: SES_BOUNCE_TYPE.Transient,
          bounceSubType: 'MailboxFull',
          bouncedRecipients: [{ emailAddress: 'full@example.com' }],
          timestamp: '2025-01-01T00:00:00Z',
        },
      });

      await handler.handleSnsMessage(snsMessage);

      expect(identifierService.markBounced).toHaveBeenCalledWith('full@example.com', BOUNCE_TYPE.InboxFull);
    });

    it('should mark as Bounced with soft type for other transient bounces', async () => {
      const snsMessage = makeSnsNotification(SES_NOTIFICATION_TYPE.Bounce, {
        bounce: {
          bounceType: SES_BOUNCE_TYPE.Transient,
          bounceSubType: 'General',
          bouncedRecipients: [{ emailAddress: 'temp@example.com' }],
          timestamp: '2025-01-01T00:00:00Z',
        },
      });

      await handler.handleSnsMessage(snsMessage);

      expect(identifierService.markBounced).toHaveBeenCalledWith('temp@example.com', BOUNCE_TYPE.Soft);
    });
  });

  describe('processBounce - hooks and health tracking', () => {
    it('should call onBounce hook', async () => {
      const snsMessage = makeSnsNotification(SES_NOTIFICATION_TYPE.Bounce, {
        bounce: {
          bounceType: SES_BOUNCE_TYPE.Permanent,
          bounceSubType: 'Suppressed',
          bouncedRecipients: [{ emailAddress: 'bounced@example.com' }],
          timestamp: '2025-01-01T00:00:00Z',
        },
      });

      await handler.handleSnsMessage(snsMessage);

      expect(hooks!.onBounce).toHaveBeenCalledWith({
        accountId: 'acc-1',
        email: 'bounced@example.com',
        bounceType: BOUNCE_TYPE.Hard,
        provider: ACCOUNT_PROVIDER.Ses,
      });
    });

    it('should record bounce in health tracker', async () => {
      const snsMessage = makeSnsNotification(SES_NOTIFICATION_TYPE.Bounce, {
        bounce: {
          bounceType: SES_BOUNCE_TYPE.Transient,
          bounceSubType: 'General',
          bouncedRecipients: [{ emailAddress: 'temp@example.com' }],
          timestamp: '2025-01-01T00:00:00Z',
        },
      });

      await handler.handleSnsMessage(snsMessage);

      expect(healthTracker.recordBounce).toHaveBeenCalledWith('acc-1', 'temp@example.com', BOUNCE_TYPE.Soft);
    });
  });

  describe('processComplaint', () => {
    it('should mark identifier as Blocked', async () => {
      const snsMessage = makeSnsNotification(SES_NOTIFICATION_TYPE.Complaint, {
        complaint: {
          complainedRecipients: [{ emailAddress: 'complainer@example.com' }],
          timestamp: '2025-01-01T00:00:00Z',
          complaintFeedbackType: 'abuse',
        },
      });

      const result = await handler.handleSnsMessage(snsMessage);

      expect(result.processed).toBe(true);
      expect(result.type).toBe('complaint');
      expect(identifierService.updateStatus).toHaveBeenCalledWith(
        'complainer@example.com',
        IDENTIFIER_STATUS.Blocked,
      );
    });

    it('should call onComplaint hook', async () => {
      const snsMessage = makeSnsNotification(SES_NOTIFICATION_TYPE.Complaint, {
        complaint: {
          complainedRecipients: [{ emailAddress: 'complainer@example.com' }],
          timestamp: '2025-01-01T00:00:00Z',
        },
      });

      await handler.handleSnsMessage(snsMessage);

      expect(hooks!.onComplaint).toHaveBeenCalledWith({
        accountId: 'acc-1',
        email: 'complainer@example.com',
      });
    });
  });
});
