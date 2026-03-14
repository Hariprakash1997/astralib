import type { LogAdapter, EmailAccountManagerConfig } from '../types/config.types';
import { ACCOUNT_PROVIDER, BOUNCE_TYPE, ACCOUNT_STATUS } from '../constants';
import type { HealthTracker } from './health-tracker';
import type { IdentifierService } from './identifier.service';
import type { SettingsService } from './settings.service';
import type { EmailAccountModel } from '../schemas/email-account.schema';

const BOUNCE_PATTERNS = [
  { pattern: /recipient inbox full|mailbox full|mail box full|delivery incomplete/i, type: BOUNCE_TYPE.InboxFull },
  { pattern: /address not found|user unknown|no such user|does not exist|invalid address|message blocked/i, type: BOUNCE_TYPE.InvalidEmail },
] as const;

export class ImapBounceChecker {
  private polling: ReturnType<typeof setInterval> | null = null;

  constructor(
    private EmailAccount: EmailAccountModel,
    private healthTracker: HealthTracker,
    private identifierService: IdentifierService,
    private settings: SettingsService,
    private logger: LogAdapter,
    private hooks?: EmailAccountManagerConfig['hooks'],
  ) {}

  async start(): Promise<void> {
    const globalSettings = await this.settings.get();

    if (!globalSettings.imap.enabled) {
      this.logger.info('IMAP bounce checker disabled');
      return;
    }

    const intervalMs = globalSettings.imap.pollIntervalMs || 300000;

    this.polling = setInterval(async () => {
      try {
        await this.checkNow();
      } catch (err) {
        const msg = err instanceof Error ? err.message : 'Unknown error';
        this.logger.error('IMAP polling error', { error: msg });
      }
    }, intervalMs);

    this.logger.info('IMAP bounce checker started', { intervalMs });
  }

  stop(): void {
    if (this.polling) {
      clearInterval(this.polling);
      this.polling = null;
      this.logger.info('IMAP bounce checker stopped');
    }
  }

  async checkNow(): Promise<void> {
    const accounts = await this.EmailAccount.find({
      provider: ACCOUNT_PROVIDER.Gmail,
      status: { $in: [ACCOUNT_STATUS.Active, ACCOUNT_STATUS.Warmup] },
      'imap.host': { $exists: true },
    });

    this.logger.info('IMAP bounce check starting', { accounts: accounts.length });

    for (const account of accounts) {
      try {
        await this.checkAccount((account as any)._id.toString());
      } catch (err) {
        const msg = err instanceof Error ? err.message : 'Unknown error';
        this.logger.error('IMAP check failed for account', {
          accountId: (account as any)._id.toString(),
          error: msg,
        });
      }
    }
  }

  async checkAccount(accountId: string): Promise<{ bouncesFound: number }> {
    let ImapFlow: any;
    try {
      ImapFlow = (await import('imapflow')).ImapFlow;
    } catch {
      this.logger.warn('imapflow package not installed, skipping IMAP check');
      return { bouncesFound: 0 };
    }

    const account = await this.EmailAccount.findById(accountId);
    if (!account) return { bouncesFound: 0 };

    const acct = account as any;
    if (!acct.imap?.host || !acct.imap?.user || !acct.imap?.pass) {
      return { bouncesFound: 0 };
    }

    const globalSettings = await this.settings.get();
    const bounceSenders = globalSettings.imap.bounceSenders || ['mailer-daemon@googlemail.com'];

    const client = new ImapFlow({
      host: acct.imap.host,
      port: acct.imap.port || 993,
      secure: true,
      auth: {
        user: acct.imap.user,
        pass: acct.imap.pass,
      },
      logger: false,
    });

    let bouncesFound = 0;

    try {
      await client.connect();
      const lock = await client.getMailboxLock('INBOX');

      try {
        const searchDate = this.getSearchDate(globalSettings.imap.searchSince);
        const senderQuery = bounceSenders.map((s: string) => ({ from: s }));

        const messages = client.fetch(
          {
            or: senderQuery,
            since: searchDate,
          },
          { source: true },
        );

        for await (const msg of messages) {
          try {
            const source = msg.source?.toString() || '';
            const recipientMatch = source.match(
              /Original-Recipient:.*?;?\s*<?([^\s<>]+@[^\s<>]+)>?/i,
            ) || source.match(
              /Final-Recipient:.*?;?\s*<?([^\s<>]+@[^\s<>]+)>?/i,
            ) || source.match(
              /was\s+not\s+delivered\s+to\s+<?([^\s<>]+@[^\s<>]+)>?/i,
            );

            if (!recipientMatch) continue;

            const recipientEmail = recipientMatch[1].toLowerCase();
            const bounceType = this.classifyBounce(source);

            await this.identifierService.markBounced(recipientEmail, bounceType);
            await this.healthTracker.recordBounce(accountId, recipientEmail, bounceType);

            this.hooks?.onBounce?.({
              accountId,
              email: recipientEmail,
              bounceType,
              provider: ACCOUNT_PROVIDER.Gmail,
            });

            bouncesFound++;
          } catch (err) {
            const msg = err instanceof Error ? err.message : 'Unknown error';
            this.logger.warn('Failed to parse bounce message', { error: msg });
          }
        }
      } finally {
        lock.release();
      }

      await client.logout();
    } catch (err) {
      const msg = err instanceof Error ? err.message : 'Unknown error';
      this.logger.error('IMAP connection failed', { accountId, error: msg });
      try { await client.logout(); } catch { /* ignore */ }
    }

    this.logger.info('IMAP bounce check completed', { accountId, bouncesFound });
    return { bouncesFound };
  }

  private classifyBounce(messageBody: string): typeof BOUNCE_TYPE[keyof typeof BOUNCE_TYPE] {
    for (const { pattern, type } of BOUNCE_PATTERNS) {
      if (pattern.test(messageBody)) return type;
    }
    return BOUNCE_TYPE.Soft;
  }

  private getSearchDate(searchSince: string): Date {
    const now = new Date();
    switch (searchSince) {
      case 'last_24h':
        return new Date(now.getTime() - 24 * 60 * 60 * 1000);
      case 'last_7d':
        return new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
      case 'last_check':
      default:
        return new Date(now.getTime() - 24 * 60 * 60 * 1000);
    }
  }
}
