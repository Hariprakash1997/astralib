import type { Request, Response } from 'express';
import type { ConversationService } from '../services/conversation.service';
import type { MessageService } from '../services/message.service';
import type { HistorySyncService } from '../services/history-sync.service';
import type { DialogLoaderService } from '../services/dialog-loader.service';
import type { LogAdapter } from '../types/config.types';
import { MAX_PAGE_LIMIT } from '../constants';

export function createConversationController(
  conversationService: ConversationService,
  messageService: MessageService,
  historySyncService: HistorySyncService,
  logger?: LogAdapter,
  dialogLoaderService?: DialogLoaderService,
) {
  return {
    async loadDialogs(req: Request, res: Response) {
      try {
        if (!dialogLoaderService) {
          return res.status(500).json({ success: false, error: 'DialogLoaderService not available' });
        }

        const { accountId, limit } = req.query;

        if (!accountId) {
          return res.status(400).json({ success: false, error: 'accountId is required' });
        }

        const limitNum = Math.min(Number(limit) || 50, MAX_PAGE_LIMIT);
        const dialogs = await dialogLoaderService.loadDialogs(accountId as string, limitNum);

        res.json({ success: true, data: { dialogs } });
      } catch (error: unknown) {
        const message = error instanceof Error ? error.message : 'Unknown error';
        res.status(500).json({ success: false, error: message });
      }
    },

    async syncDialogs(req: Request, res: Response) {
      try {
        if (!dialogLoaderService) {
          return res.status(500).json({ success: false, error: 'DialogLoaderService not available' });
        }

        const { accountId, limit } = req.query;

        if (!accountId) {
          return res.status(400).json({ success: false, error: 'accountId is required' });
        }

        const limitNum = Math.min(Number(limit) || 50, MAX_PAGE_LIMIT);
        const result = await dialogLoaderService.syncDialogs(accountId as string, limitNum);

        res.json({ success: true, data: result });
      } catch (error: unknown) {
        const message = error instanceof Error ? error.message : 'Unknown error';
        res.status(500).json({ success: false, error: message });
      }
    },

    async list(req: Request, res: Response) {
      try {
        const { page, limit, accountId } = req.query;

        const pageNum = Math.max(Number(page) || 1, 1);
        const limitNum = Math.min(Number(limit) || 50, MAX_PAGE_LIMIT);

        const filters = accountId ? { accountId: accountId as string } : undefined;
        const result = await conversationService.list(filters, pageNum, limitNum);

        res.json({ success: true, data: { conversations: result.items, total: result.total } });
      } catch (error: unknown) {
        const message = error instanceof Error ? error.message : 'Unknown error';
        res.status(500).json({ success: false, error: message });
      }
    },

    async getMessages(req: Request, res: Response) {
      try {
        const chatId = req.params.chatId as string;
        if (!chatId?.trim()) return res.status(400).json({ success: false, error: 'chatId is required' });

        const { page, limit, accountId } = req.query;

        const pageNum = Math.max(Number(page) || 1, 1);
        const limitNum = Math.min(Number(limit) || 50, MAX_PAGE_LIMIT);

        const result = await conversationService.getMessages(chatId, pageNum, limitNum, accountId as string | undefined);

        res.json({ success: true, data: { messages: result.items, total: result.total } });
      } catch (error: unknown) {
        const message = error instanceof Error ? error.message : 'Unknown error';
        res.status(500).json({ success: false, error: message });
      }
    },

    async sendMessage(req: Request, res: Response) {
      try {
        const chatId = req.params.chatId as string;
        if (!chatId?.trim()) return res.status(400).json({ success: false, error: 'chatId is required' });

        const { accountId, text, media } = req.body;

        if (!accountId || !text) {
          return res.status(400).json({ success: false, error: 'accountId and text are required' });
        }

        const result = await messageService.sendMessage(accountId, chatId, text, media);

        res.status(201).json({ success: true, data: { message: result } });
      } catch (error: unknown) {
        const message = error instanceof Error ? error.message : 'Unknown error';
        res.status(500).json({ success: false, error: message });
      }
    },

    async markAsRead(req: Request, res: Response) {
      try {
        const chatId = req.params.chatId as string;
        if (!chatId?.trim()) return res.status(400).json({ success: false, error: 'chatId is required' });

        const count = await conversationService.markAsRead(chatId);

        res.json({ success: true, data: { markedCount: count } });
      } catch (error: unknown) {
        const message = error instanceof Error ? error.message : 'Unknown error';
        res.status(500).json({ success: false, error: message });
      }
    },

    async getUnreadCount(req: Request, res: Response) {
      try {
        const { accountId, conversationId } = req.query;

        const count = await conversationService.getUnreadCount(
          conversationId as string | undefined,
          accountId as string | undefined,
        );

        res.json({ success: true, data: { unreadCount: count } });
      } catch (error: unknown) {
        const message = error instanceof Error ? error.message : 'Unknown error';
        res.status(500).json({ success: false, error: message });
      }
    },

    async syncHistory(req: Request, res: Response) {
      try {
        const chatId = req.params.chatId as string;
        if (!chatId?.trim()) return res.status(400).json({ success: false, error: 'chatId is required' });

        const { accountId, limit } = req.body;

        if (!accountId) {
          return res.status(400).json({ success: false, error: 'accountId is required' });
        }

        const result = await historySyncService.syncChat(accountId, chatId, limit);

        res.json({ success: true, data: result });
      } catch (error: unknown) {
        const message = error instanceof Error ? error.message : 'Unknown error';
        res.status(500).json({ success: false, error: message });
      }
    },

    async search(req: Request, res: Response) {
      try {
        const { q, page, limit, accountId } = req.query;

        if (!q || !(q as string).trim()) {
          return res.status(400).json({ success: false, error: 'q (search query) is required' });
        }

        const pageNum = Math.max(Number(page) || 1, 1);
        const limitNum = Math.min(Number(limit) || 50, MAX_PAGE_LIMIT);

        const result = await conversationService.search(
          q as string,
          pageNum,
          limitNum,
          accountId as string | undefined,
        );

        res.json({ success: true, data: { messages: result.items, total: result.total } });
      } catch (error: unknown) {
        const message = error instanceof Error ? error.message : 'Unknown error';
        res.status(500).json({ success: false, error: message });
      }
    },
  };
}
