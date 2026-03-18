import { TelegramClient } from 'telegram';
import { StringSession } from 'telegram/sessions';
import { noopLogger } from '@astralibx/core';
import type { LogAdapter, TelegramAccountManagerConfig } from '../types/config.types';
import type { ConnectedAccount } from '../types/account.types';
import type { TelegramAccountModel, TelegramAccountDocument } from '../schemas/telegram-account.schema';
import { ACCOUNT_STATUS, DEFAULT_CONNECTION_TIMEOUT_MS, DEFAULT_RECONNECT_MAX_RETRIES, DEFAULT_MAX_ACCOUNTS } from '../constants';
import { ConnectionError, AccountNotFoundError } from '../errors';

interface ClientEntry {
  client: TelegramClient;
  isConnected: boolean;
  phone: string;
  name: string;
  lastActivityAt: Date;
}

export class ConnectionService {
  private clients = new Map<string, ClientEntry>();
  private logger: LogAdapter;
  private idleMonitorInterval: ReturnType<typeof setInterval> | null = null;
  private connectingAll = false;

  onMessageSent?: (accountId: string) => Promise<void>;
  onMessageFailed?: (accountId: string) => Promise<void>;

  constructor(
    private TelegramAccount: TelegramAccountModel,
    private config: TelegramAccountManagerConfig,
    private hooks?: TelegramAccountManagerConfig['hooks'],
  ) {
    this.logger = config.logger || noopLogger;
  }

  async connect(accountId: string): Promise<void> {
    const maxAccounts = this.config.options?.maxAccounts ?? DEFAULT_MAX_ACCOUNTS;
    if (this.clients.size >= maxAccounts) {
      throw new Error(`Maximum connected accounts (${maxAccounts}) reached`);
    }

    const account = await this.TelegramAccount.findById(accountId) as TelegramAccountDocument | null;
    if (!account) throw new AccountNotFoundError(accountId);
    const timeoutMs = this.config.options?.connectionTimeoutMs ?? DEFAULT_CONNECTION_TIMEOUT_MS;

    const session = new StringSession(account.session);
    const client = new TelegramClient(session, this.config.credentials.apiId, this.config.credentials.apiHash, {
      connectionRetries: 3,
      timeout: Math.floor(timeoutMs / 1000),
    });

    try {
      let timeoutId: ReturnType<typeof setTimeout>;
      try {
        await Promise.race([
          client.connect(),
          new Promise<never>((_, reject) => {
            timeoutId = setTimeout(() => reject(new Error('Connection timeout')), timeoutMs);
          }),
        ]);
      } finally {
        clearTimeout(timeoutId!);
      }

      // Validate connection
      const me = await client.getMe();
      if (!me) {
        throw new Error('getMe() returned null — session may be invalid');
      }

      this.clients.set(accountId, { client, isConnected: true, phone: account.phone, name: account.name, lastActivityAt: new Date() });

      await this.TelegramAccount.findByIdAndUpdate(accountId, {
        $set: { status: ACCOUNT_STATUS.Connected },
      });

      this.logger.info('Account connected', { accountId, phone: account.phone });

      try {
        this.hooks?.onAccountConnected?.({ accountId, phone: account.phone });
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
      }) as TelegramAccountDocument | null;

      const phone = account?.phone ?? '';

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
    if (entry?.isConnected) {
      entry.lastActivityAt = new Date();
      return entry.client;
    }
    return null;
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

  async sendMessage(accountId: string, chatId: string, text: string): Promise<{ messageId: string }> {
    const client = this.getClient(accountId);
    if (!client) throw new Error(`Account ${accountId} is not connected`);

    const entry = this.clients.get(accountId);
    if (entry) entry.lastActivityAt = new Date();

    try {
      const result = await client.sendMessage(chatId, { message: text });

      try { await this.onMessageSent?.(accountId); } catch (e) {
        this.logger.error('onMessageSent callback error', { accountId, error: e instanceof Error ? e.message : String(e) });
      }

      return { messageId: String(result.id) };
    } catch (err) {
      try { await this.onMessageFailed?.(accountId); } catch (e) {
        this.logger.error('onMessageFailed callback error', { accountId, error: e instanceof Error ? e.message : String(e) });
      }
      throw err;
    }
  }

  async connectAll(): Promise<{ connected: number; errors: number }> {
    if (this.connectingAll) return { connected: 0, errors: 0 };
    this.connectingAll = true;

    try {
      const accounts = await this.TelegramAccount.find({ status: ACCOUNT_STATUS.Disconnected });
      let connected = 0;
      let errors = 0;

      for (const account of accounts) {
        const accountId = String(account._id);
        if (this.clients.has(accountId)) continue;

        try {
          await this.connect(accountId);
          connected++;
        } catch (err) {
          errors++;
          this.logger.error('connectAll: failed to connect account', {
            accountId,
            error: err instanceof Error ? err.message : String(err),
          });
        }
      }

      this.logger.info('connectAll completed', { connected, errors });
      return { connected, errors };
    } finally {
      this.connectingAll = false;
    }
  }

  async disconnectAll(): Promise<void> {
    const accountIds = Array.from(this.clients.keys());
    for (const accountId of accountIds) {
      await this.disconnect(accountId);
    }
    this.logger.info('All accounts disconnected', { count: accountIds.length });
  }

  startIdleMonitor(idleTimeoutMs: number): void {
    this.stopIdleMonitor();
    this.idleMonitorInterval = setInterval(async () => {
      const now = Date.now();
      const toDisconnect: string[] = [];
      for (const [accountId, entry] of this.clients) {
        if (entry.isConnected && now - entry.lastActivityAt.getTime() > idleTimeoutMs) {
          toDisconnect.push(accountId);
        }
      }
      for (const accountId of toDisconnect) {
        this.logger.info('Idle timeout reached, disconnecting', { accountId });
        await this.disconnect(accountId);
      }
    }, Math.min(idleTimeoutMs, 60000));
    this.idleMonitorInterval.unref();
  }

  stopIdleMonitor(): void {
    if (this.idleMonitorInterval) {
      clearInterval(this.idleMonitorInterval);
      this.idleMonitorInterval = null;
    }
  }

  async destroy(): Promise<void> {
    this.stopIdleMonitor();
    await this.disconnectAll();
  }
}
