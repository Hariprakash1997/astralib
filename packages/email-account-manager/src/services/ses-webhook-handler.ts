import https from 'https';
import crypto from 'crypto';
import type { SnsMessage, SesNotification, SesBounce, SesComplaint } from '../types/event.types';
import type { LogAdapter, EmailAccountManagerConfig } from '../types/config.types';
import {
  ACCOUNT_PROVIDER,
  BOUNCE_TYPE,
  IDENTIFIER_STATUS,
  SNS_MESSAGE_TYPE,
  SES_NOTIFICATION_TYPE,
  SES_BOUNCE_TYPE,
} from '../constants';
import { SnsSignatureError } from '../errors';
import type { HealthTracker } from './health-tracker';
import type { IdentifierService } from './identifier.service';
import type { EmailAccountModel } from '../schemas/email-account.schema';

const SNS_SIGNATURE_KEYS = [
  'Message',
  'MessageId',
  'Subject',
  'SubscribeURL',
  'Timestamp',
  'Token',
  'TopicArn',
  'Type',
];

export interface WebhookProcessResult {
  processed: boolean;
  type?: string;
  error?: string;
}

export class SesWebhookHandler {
  constructor(
    private healthTracker: HealthTracker,
    private identifierService: IdentifierService,
    private EmailAccount: EmailAccountModel,
    private config: EmailAccountManagerConfig,
    private logger: LogAdapter,
    private hooks?: EmailAccountManagerConfig['hooks'],
  ) {}

  async handleSnsMessage(body: unknown): Promise<WebhookProcessResult> {
    const message = this.parseBody(body);

    if (!message || !message.Type) {
      return { processed: false, error: 'Invalid SNS message format' };
    }

    const validateSignature = this.config.options?.ses?.validateSignature !== false;
    if (validateSignature && message.SignatureVersion) {
      const valid = await this.validateSignature(message);
      if (!valid) {
        throw new SnsSignatureError();
      }
    }

    const allowedTopics = this.config.options?.ses?.allowedTopicArns;
    if (allowedTopics?.length && !allowedTopics.includes(message.TopicArn)) {
      return { processed: false, error: 'Topic ARN not allowed' };
    }

    if (message.Type === SNS_MESSAGE_TYPE.SubscriptionConfirmation) {
      return this.handleSubscriptionConfirmation(message);
    }

    if (message.Type === SNS_MESSAGE_TYPE.UnsubscribeConfirmation) {
      return { processed: true, type: 'unsubscribe_confirmed' };
    }

    if (message.Type === SNS_MESSAGE_TYPE.Notification) {
      const notification: SesNotification = JSON.parse(message.Message);
      return this.processNotification(notification);
    }

    return { processed: true, type: 'ignored' };
  }

  private async handleSubscriptionConfirmation(
    message: SnsMessage,
  ): Promise<WebhookProcessResult> {
    if (!message.SubscribeURL) {
      return { processed: false, error: 'No SubscribeURL provided' };
    }

    return new Promise((resolve) => {
      https
        .get(message.SubscribeURL!, (res) => {
          resolve({
            processed: res.statusCode === 200,
            type: 'subscription_confirmed',
          });
        })
        .on('error', (err) => {
          resolve({ processed: false, error: err.message });
        });
    });
  }

  private async processNotification(
    notification: SesNotification,
  ): Promise<WebhookProcessResult> {
    const accountId = await this.findAccountIdBySource(notification.mail.source);

    switch (notification.notificationType) {
      case SES_NOTIFICATION_TYPE.Bounce:
        return this.processBounce(accountId, notification.bounce!);

      case SES_NOTIFICATION_TYPE.Complaint:
        return this.processComplaint(accountId, notification.complaint!);

      case SES_NOTIFICATION_TYPE.Delivery:
        if (notification.delivery) {
          for (const recipient of notification.delivery.recipients) {
            this.hooks?.onDelivery?.({ accountId: accountId || '', email: recipient });
          }
        }
        return { processed: true, type: 'delivery' };

      case SES_NOTIFICATION_TYPE.Open:
        if (notification.open) {
          const recipients = notification.mail.destination || [];
          for (const email of recipients) {
            this.hooks?.onOpen?.({
              accountId: accountId || '',
              email,
              timestamp: new Date(notification.open.timestamp),
            });
          }
        }
        return { processed: true, type: 'open' };

      case SES_NOTIFICATION_TYPE.Click:
        if (notification.click) {
          const recipients = notification.mail.destination || [];
          for (const email of recipients) {
            this.hooks?.onClick?.({
              accountId: accountId || '',
              email,
              link: notification.click.link,
            });
          }
        }
        return { processed: true, type: 'click' };

      default:
        return { processed: true, type: 'unknown' };
    }
  }

  private async processBounce(
    accountId: string | null,
    bounce: SesBounce,
  ): Promise<WebhookProcessResult> {
    const bounceType =
      bounce.bounceType === SES_BOUNCE_TYPE.Permanent
        ? BOUNCE_TYPE.Hard
        : BOUNCE_TYPE.Soft;

    for (const recipient of bounce.bouncedRecipients) {
      const email = recipient.emailAddress;

      if (bounce.bounceType === SES_BOUNCE_TYPE.Permanent) {
        const subType = bounce.bounceSubType?.toLowerCase();
        if (subType === 'noemail' || subType === 'general') {
          await this.identifierService.updateStatus(email, IDENTIFIER_STATUS.Invalid);
        } else {
          await this.identifierService.markBounced(email, BOUNCE_TYPE.Hard);
        }
      } else {
        if (bounce.bounceSubType?.toLowerCase() === 'mailboxfull') {
          await this.identifierService.markBounced(email, BOUNCE_TYPE.InboxFull);
        } else {
          await this.identifierService.markBounced(email, BOUNCE_TYPE.Soft);
        }
      }

      if (accountId) {
        await this.healthTracker.recordBounce(accountId, email, bounceType);
      }

      this.hooks?.onBounce?.({
        accountId: accountId || '',
        email,
        bounceType,
        provider: ACCOUNT_PROVIDER.Ses,
      });
    }

    return { processed: true, type: 'bounce' };
  }

  private async processComplaint(
    accountId: string | null,
    complaint: SesComplaint,
  ): Promise<WebhookProcessResult> {
    for (const recipient of complaint.complainedRecipients) {
      await this.identifierService.updateStatus(
        recipient.emailAddress,
        IDENTIFIER_STATUS.Blocked,
      );

      this.hooks?.onComplaint?.({
        accountId: accountId || '',
        email: recipient.emailAddress,
      });
    }

    return { processed: true, type: 'complaint' };
  }

  private async validateSignature(message: SnsMessage): Promise<boolean> {
    try {
      if (message.SignatureVersion !== '1') return false;

      const certificate = await this.fetchCertificate(message.SigningCertURL);
      const parts: string[] = [];
      const record = message as unknown as Record<string, unknown>;

      for (const key of SNS_SIGNATURE_KEYS) {
        const value = record[key];
        if (value !== undefined && value !== null) {
          parts.push(key);
          parts.push(String(value));
        }
      }

      const stringToSign = parts.join('\n') + '\n';
      const verifier = crypto.createVerify('SHA1');
      verifier.update(stringToSign, 'utf8');

      const signatureBuffer = Buffer.from(message.Signature, 'base64');
      return verifier.verify(certificate, signatureBuffer);
    } catch {
      return false;
    }
  }

  private async fetchCertificate(certUrl: string): Promise<string> {
    return new Promise((resolve, reject) => {
      const url = new URL(certUrl);
      if (!url.hostname.endsWith('.amazonaws.com')) {
        return reject(new Error('Invalid certificate URL: not from amazonaws.com'));
      }
      if (url.protocol !== 'https:') {
        return reject(new Error('Invalid certificate URL: must be HTTPS'));
      }

      https
        .get(certUrl, (res) => {
          let data = '';
          res.on('data', (chunk) => {
            data += chunk;
          });
          res.on('end', () => resolve(data));
          res.on('error', reject);
        })
        .on('error', reject);
    });
  }

  private parseBody(rawBody: unknown): SnsMessage {
    if (typeof rawBody === 'string') {
      return JSON.parse(rawBody);
    }
    return rawBody as SnsMessage;
  }

  private async findAccountIdBySource(source: string): Promise<string | null> {
    const email = source.replace(/.*<(.+)>/, '$1').toLowerCase();
    const account = await this.EmailAccount.findOne({ email });
    return account ? (account as any)._id.toString() : null;
  }
}
