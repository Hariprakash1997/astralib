import { Api } from 'telegram';
import type { TelegramAccountManager } from '@astralibx/telegram-account-manager';
import { noopLogger } from '@astralibx/core';
import type { LogAdapter, TelegramInboxConfig } from '../types/config.types';
import { DEFAULT_TYPING_TIMEOUT_MS } from '../constants';

export class TypingBroadcasterService {
  private activeTyping = new Map<string, ReturnType<typeof setTimeout>>();
  private logger: LogAdapter;
  private accountManager: TelegramAccountManager;
  private timeoutMs: number;
  private hooks?: TelegramInboxConfig['hooks'];

  constructor(
    accountManager: TelegramAccountManager,
    config: TelegramInboxConfig,
    logger?: LogAdapter,
  ) {
    this.accountManager = accountManager;
    this.logger = logger || config.logger || noopLogger;
    this.timeoutMs = config.options?.typingTimeoutMs ?? DEFAULT_TYPING_TIMEOUT_MS;
    this.hooks = config.hooks;
  }

  async startTyping(chatId: string, accountId: string): Promise<void> {
    const key = `${chatId}:${accountId}`;

    // Clear any existing timeout for this chat:account pair
    this.clearTimeout(key);

    const client = this.accountManager.getClient(accountId);
    if (!client) {
      this.logger.warn('No connected client for typing', { accountId, chatId });
      return;
    }

    try {
      await client.invoke(
        new Api.messages.SetTyping({
          peer: chatId,
          action: new Api.SendMessageTypingAction(),
        }),
      );
    } catch (err) {
      this.logger.error('Failed to set typing action', {
        chatId,
        accountId,
        error: err instanceof Error ? err.message : String(err),
      });
      return;
    }

    // Auto-stop after timeout
    const timeout = setTimeout(() => {
      this.activeTyping.delete(key);
    }, this.timeoutMs);

    this.activeTyping.set(key, timeout);

    // Fire onTyping hook
    try {
      this.hooks?.onTyping?.({ chatId, userId: chatId, accountId });
    } catch (e) {
      this.logger.error('Hook onTyping error', {
        error: e instanceof Error ? e.message : String(e),
      });
    }
  }

  stopTyping(chatId: string, accountId: string): void {
    const key = `${chatId}:${accountId}`;
    this.clearTimeout(key);
  }

  isTyping(chatId: string, accountId: string): boolean {
    return this.activeTyping.has(`${chatId}:${accountId}`);
  }

  stopAll(): void {
    for (const [key, timeout] of this.activeTyping) {
      clearTimeout(timeout);
    }
    this.activeTyping.clear();
  }

  private clearTimeout(key: string): void {
    const existing = this.activeTyping.get(key);
    if (existing) {
      clearTimeout(existing);
      this.activeTyping.delete(key);
    }
  }
}
