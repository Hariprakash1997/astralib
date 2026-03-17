import nodemailer, { type Transporter } from 'nodemailer';
import type { LogAdapter, EmailAccountManagerConfig } from '../types/config.types';
import { ACCOUNT_PROVIDER } from '../constants';
import type { CapacityManager } from './capacity-manager';
import type { HealthTracker } from './health-tracker';
import type { IdentifierService } from './identifier.service';
import type { UnsubscribeService } from './unsubscribe.service';
import type { QueueService } from './queue.service';
import type { SettingsService } from './settings.service';
import type { EmailAccountModel } from '../schemas/email-account.schema';

export interface SmtpSendParams {
  accountId?: string;
  to: string;
  subject: string;
  html: string;
  text?: string;
  metadata?: Record<string, unknown>;
}

export interface SmtpSendResult {
  success: boolean;
  messageId?: string;
  error?: string;
  draftId?: string;
}

export class SmtpService {
  private devRoundRobinIndex = 0;
  private transporterPool = new Map<string, Transporter>();

  constructor(
    private EmailAccount: EmailAccountModel,
    private capacityManager: CapacityManager,
    private healthTracker: HealthTracker,
    private identifierService: IdentifierService,
    private unsubscribeService: UnsubscribeService,
    private queueService: QueueService,
    private settings: SettingsService,
    private config: EmailAccountManagerConfig,
    private logger: LogAdapter,
    private hooks?: EmailAccountManagerConfig['hooks'],
  ) {}

  async send(params: SmtpSendParams): Promise<SmtpSendResult> {
    const globalSettings = await this.settings.get();

    if (globalSettings.approval.enabled) {
      return { success: true, draftId: 'approval-required' };
    }

    const account = params.accountId
      ? await this.EmailAccount.findById(params.accountId)
      : await this.capacityManager.getBestAccount();

    if (!account) {
      return { success: false, error: 'No available email account' };
    }

    const acct = account as any;
    const unsubscribeUrl = this.unsubscribeService.generateUrl(params.to, acct._id.toString());

    const jobId = await this.queueService.enqueueSend({
      accountId: acct._id.toString(),
      to: params.to,
      subject: params.subject,
      html: params.html,
      text: params.text || '',
      unsubscribeUrl: unsubscribeUrl || undefined,
      metadata: params.metadata,
    });

    return { success: true, messageId: jobId };
  }

  async testConnection(accountId: string): Promise<{ success: boolean; error?: string }> {
    const account = await this.EmailAccount.findById(accountId);
    if (!account) return { success: false, error: 'Account not found' };

    try {
      const acct = account as any;
      const transporter = this.createTransporter(acct);
      await transporter.verify();
      transporter.close();
      return { success: true };
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Unknown error';
      return { success: false, error: message };
    }
  }

  async executeSend(
    accountId: string,
    to: string,
    subject: string,
    html: string,
    text: string,
    unsubscribeUrl?: string,
  ): Promise<SmtpSendResult> {
    const account = await this.EmailAccount.findById(accountId);
    if (!account) return { success: false, error: 'Account not found' };

    const acct = account as any;

    try {
      const globalSettings = await this.settings.get();
      let recipientEmail = to;

      if (globalSettings.devMode.enabled && globalSettings.devMode.testEmails.length > 0) {
        const testEmails = globalSettings.devMode.testEmails;
        const devIndex = this.devRoundRobinIndex++ % testEmails.length;
        recipientEmail = testEmails[devIndex];
        this.logger.info('Dev mode: email redirected', { original: to, redirected: recipientEmail });
      }

      const transporter = this.getOrCreateTransporter(accountId, acct);

      const headers: Record<string, string> = {};

      if (acct.provider === ACCOUNT_PROVIDER.Ses && acct.ses?.configurationSet) {
        headers['X-SES-CONFIGURATION-SET'] = acct.ses.configurationSet;
      }

      if (unsubscribeUrl) {
        headers['List-Unsubscribe'] = `<${unsubscribeUrl}>`;
        headers['List-Unsubscribe-Post'] = 'List-Unsubscribe=One-Click';
      }

      const mailOptions = {
        from: `${acct.senderName} <${acct.email}>`,
        to: recipientEmail,
        subject,
        text,
        html,
        headers,
      };

      const info = await transporter.sendMail(mailOptions);

      const messageId = info.messageId?.replace(/[<>]/g, '');

      await this.healthTracker.recordSuccess(accountId);
      await this.identifierService.incrementSentCount(to);

      this.hooks?.onSend?.({ accountId, email: to, messageId });
      this.logger.info('Email sent', { accountId, to, messageId });

      return { success: true, messageId };
    } catch (err) {
      const errorMsg = err instanceof Error ? err.message : 'Unknown error';

      this.transporterPool.delete(accountId);

      await this.healthTracker.recordError(accountId, errorMsg);

      this.hooks?.onSendError?.({ accountId, email: to, error: errorMsg });
      this.logger.error('Email send failed', { accountId, to, error: errorMsg });

      return { success: false, error: errorMsg };
    }
  }

  closeAll(): void {
    for (const [id, transporter] of this.transporterPool) {
      try {
        transporter.close();
      } catch {
        // ignore close errors
      }
    }
    this.transporterPool.clear();
  }

  private getOrCreateTransporter(accountId: string, account: any): Transporter {
    const existing = this.transporterPool.get(accountId);
    if (existing) return existing;

    const transporter = this.createTransporter(account, true);
    this.transporterPool.set(accountId, transporter);
    return transporter;
  }

  private createTransporter(account: any, pooled = false): Transporter {
    return nodemailer.createTransport({
      host: account.smtp.host,
      port: account.smtp.port || 587,
      secure: account.smtp.port === 465,
      auth: {
        user: account.smtp.user,
        pass: account.smtp.pass,
      },
      ...(pooled ? { pool: true, maxConnections: 5, maxMessages: 100 } : {}),
    });
  }
}
