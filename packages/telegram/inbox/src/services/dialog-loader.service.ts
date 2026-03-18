import { noopLogger } from '@astralibx/core';
import type { LogAdapter } from '@astralibx/core';
import type { TelegramAccountManager } from '@astralibx/telegram-account-manager';
import type { TelegramConversationSessionModel } from '../schemas/telegram-conversation-session.schema';
import { STATUS_ACTIVE, DIALOG_TYPE_USER, DIALOG_TYPE_GROUP, DIALOG_TYPE_CHANNEL } from '../constants';

export interface Dialog {
  chatId: string;
  title: string;
  type: 'user' | 'group' | 'channel';
  unreadCount: number;
  lastMessage?: { text: string; date: Date };
}

export class DialogLoaderService {
  private logger: LogAdapter;

  constructor(
    private accountManager: TelegramAccountManager,
    private TelegramConversationSession: TelegramConversationSessionModel,
    logger?: LogAdapter,
  ) {
    this.logger = logger || noopLogger;
  }

  async loadDialogs(accountId: string, limit = 50): Promise<Dialog[]> {
    const client = this.accountManager.getClient(accountId);
    if (!client) throw new Error(`Account ${accountId} is not connected`);

    try {
      const dialogs = await client.getDialogs({ limit });
      return dialogs.map((d: Record<string, any>) => ({
        chatId: String(d.id),
        title: d.title || d.name || '',
        type: this.resolveType(d),
        unreadCount: d.unreadCount || 0,
        lastMessage: d.message
          ? {
              text: d.message.message || '',
              date: new Date((d.message.date || 0) * 1000),
            }
          : undefined,
      }));
    } catch (e) {
      this.logger.error('Failed to load dialogs', { error: e instanceof Error ? e.message : String(e) });
      throw e;
    }
  }

  async syncDialogs(accountId: string, limit = 50): Promise<{ synced: number; total: number }> {
    const dialogs = await this.loadDialogs(accountId, limit);
    let synced = 0;

    for (const dialog of dialogs) {
      await this.TelegramConversationSession.findOneAndUpdate(
        { conversationId: dialog.chatId, accountId },
        {
          $set: { lastMessageAt: dialog.lastMessage?.date },
          $setOnInsert: {
            conversationId: dialog.chatId,
            accountId,
            contactId: dialog.chatId,
            status: STATUS_ACTIVE,
            startedAt: new Date(),
            messageCount: 0,
          },
        },
        { upsert: true },
      );
      synced++;
    }

    return { synced, total: dialogs.length };
  }

  private resolveType(dialog: any): 'user' | 'group' | 'channel' {
    if (dialog.isChannel) return DIALOG_TYPE_CHANNEL;
    if (dialog.isGroup) return DIALOG_TYPE_GROUP;
    return DIALOG_TYPE_USER;
  }
}
