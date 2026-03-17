import { TelegramClient } from 'telegram';
import { StringSession } from 'telegram/sessions';
import type { LogAdapter, TelegramAccountManagerConfig } from '../types/config.types';
import type { ConnectedAccount } from '../types/account.types';
import type { TelegramAccountModel } from '../schemas/telegram-account.schema';
import { ACCOUNT_STATUS, DEFAULT_CONNECTION_TIMEOUT_MS, DEFAULT_RECONNECT_MAX_RETRIES } from '../constants';
import { ConnectionError, AccountNotFoundError } from '../errors';

interface ClientEntry {
  client: TelegramClient;
  isConnected: boolean;
  phone: string;
  name: string;
}

export class ConnectionService {
  private clients = new Map<string, ClientEntry>();
  private logger: LogAdapter;

  constructor(
    private TelegramAccount: TelegramAccountModel,
    private config: TelegramAccountManagerConfig,
    private hooks?: TelegramAccountManagerConfig['hooks'],
  ) {
    this.logger = config.logger || { info: () => {}, warn: () => {}, error: () => {} };
  }

  async connect(accountId: string): Promise<void> {
    const account = await this.TelegramAccount.findById(accountId);
    if (!account) throw new AccountNotFoundError(accountId);

    const acct = account as any;
    const timeoutMs = this.config.options?.connectionTimeoutMs ?? DEFAULT_CONNECTION_TIMEOUT_MS;

    const session = new StringSession(acct.session);
    const client = new TelegramClient(session, this.config.credentials.apiId, this.config.credentials.apiHash, {
      connectionRetries: 3,
      timeout: Math.floor(timeoutMs / 1000),
    });

    try {
      await Promise.race([
        client.connect(),
        new Promise<never>((_, reject) =>
          setTimeout(() => reject(new Error('Connection timeout')), timeoutMs),
        ),
      ]);

      // Validate connection
      const me = await client.getMe();
      if (!me) {
        throw new Error('getMe() returned null — session may be invalid');
      }

      this.clients.set(accountId, { client, isConnected: true, phone: acct.phone, name: acct.name });

      await this.TelegramAccount.findByIdAndUpdate(accountId, {
        $set: { status: ACCOUNT_STATUS.Connected },
      });

      this.logger.info('Account connected', { accountId, phone: acct.phone });

      try {
        this.hooks?.onAccountConnected?.({ accountId, phone: acct.phone });
      } catch (e) {
        this.logger.error('Hook onAccountConnected error', { accountId, error: e instanceof Error ? e.message : String(e) });
      }
    } catch (err) {
      throw new ConnectionError(accountId, err instanceof Error ? err : new Error(String(err)));
    }
  }

  async disconnect(accountId: string): Promise<void> {
    const entry = this.clients.get(accountId);
    if (!entry) return;

    try {
      await entry.client.disconnect();
    } catch (err) {
      this.logger.error('Error disconnecting client', { accountId, error: err instanceof Error ? err.message : String(err) });
    }

    this.clients.delete(accountId);

    try {
      const account = await this.TelegramAccount.findByIdAndUpdate(accountId, {
        $set: { status: ACCOUNT_STATUS.Disconnected },
      });

      const phone = (account as any)?.phone || '';

      this.logger.info('Account disconnected', { accountId, phone });

      try {
        this.hooks?.onAccountDisconnected?.({ accountId, phone, reason: 'manual' });
      } catch (e) {
        this.logger.error('Hook onAccountDisconnected error', { accountId, error: e instanceof Error ? e.message : String(e) });
      }
    } catch (err) {
      this.logger.error('Error updating disconnect status', { accountId, error: err instanceof Error ? err.message : String(err) });
    }
  }

  async reconnect(accountId: string): Promise<void> {
    const maxRetries = this.config.options?.reconnectMaxRetries ?? DEFAULT_RECONNECT_MAX_RETRIES;

    for (let attempt = 1; attempt <= maxRetries; attempt++) {
      try {
        await this.disconnect(accountId);
        await this.connect(accountId);
        this.logger.info('Reconnected successfully', { accountId, attempt });
        return;
      } catch (err) {
        const delay = Math.min(1000 * Math.pow(2, attempt - 1), 30000);
        this.logger.warn('Reconnect attempt failed', {
          accountId,
          attempt,
          maxRetries,
          nextDelayMs: delay,
          error: err instanceof Error ? err.message : String(err),
        });

        if (attempt < maxRetries) {
          await new Promise((resolve) => setTimeout(resolve, delay));
        }
      }
    }

    this.logger.error('All reconnect attempts exhausted', { accountId, maxRetries });
    await this.TelegramAccount.findByIdAndUpdate(accountId, {
      $set: { status: ACCOUNT_STATUS.Error, lastError: 'RECONNECT_EXHAUSTED', lastErrorAt: new Date() },
    });
  }

  getClient(accountId: string): TelegramClient | null {
    const entry = this.clients.get(accountId);
    return entry?.isConnected ? entry.client : null;
  }

  getConnectedAccounts(): ConnectedAccount[] {
    const result: ConnectedAccount[] = [];
    for (const [accountId, entry] of this.clients) {
      if (entry.isConnected) {
        result.push({
          accountId,
          phone: entry.phone,
          name: entry.name,
          isConnected: true,
        });
      }
    }
    return result;
  }

  async disconnectAll(): Promise<void> {
    const accountIds = Array.from(this.clients.keys());
    for (const accountId of accountIds) {
      await this.disconnect(accountId);
    }
    this.logger.info('All accounts disconnected', { count: accountIds.length });
  }
}
