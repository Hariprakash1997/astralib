/**
 * Bridge/adapter between @astralibx/telegram-bot and @astralibx/telegram-account-manager.
 *
 * Uses a structural interface so the bot package doesn't need a hard dependency
 * on @astralibx/telegram-account-manager. Pass the account manager instance
 * and it will be duck-typed.
 */
import type { LogAdapter } from '@astralibx/core';
import { noopLogger } from '@astralibx/core';

export interface AccountManagerLike {
  sendMessage(accountId: string, chatId: string, text: string): Promise<{ messageId: string }>;
  getConnectedAccounts(): { accountId: string; phone: string; name: string; isConnected: boolean }[];
  health: {
    getHealth(accountId: string): Promise<{ healthScore: number; status: string } | null>;
  };
}

export interface AccountManagerBridge {
  sendViaTDLib(accountId: string, chatId: string, text: string): Promise<{ messageId: string }>;
  getConnectedAccounts(): { accountId: string; phone: string; name: string; isConnected: boolean }[];
  getAccountHealth(accountId: string): Promise<{ score: number; status: string } | null>;
}

export function createAccountManagerBridge(
  accountManager: AccountManagerLike,
  logger?: LogAdapter,
): AccountManagerBridge {
  const log = logger || noopLogger;

  return {
    async sendViaTDLib(accountId, chatId, text) {
      log.info('Sending message via TDLib bridge', { accountId, chatId });
      return accountManager.sendMessage(accountId, chatId, text);
    },

    getConnectedAccounts() {
      return accountManager.getConnectedAccounts();
    },

    async getAccountHealth(accountId) {
      try {
        if (!accountManager.health) return null;
        const health = await accountManager.health.getHealth(accountId);
        if (!health) return null;
        return { score: health.healthScore, status: health.status };
      } catch (err) {
        log.error('Failed to get account health', { accountId, error: err instanceof Error ? err.message : String(err) });
        return null;
      }
    },
  };
}
