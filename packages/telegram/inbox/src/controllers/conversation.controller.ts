import type { Request, Response } from 'express';
import type { ConversationService } from '../services/conversation.service';
import type { MessageService } from '../services/message.service';
import type { HistorySyncService } from '../services/history-sync.service';
import type { LogAdapter } from '../types/config.types';

export function createConversationController(
  conversationService: ConversationService,
  messageService: MessageService,
  historySyncService: HistorySyncService,
  logger?: LogAdapter,
) {
  return {
    async list(req: Request, res: Response) {
      try {
        const { page, limit } = req.query;

        const pageNum = Number(page) || 1;
        const limitNum = Number(limit) || 50;

        const result = await conversationService.list(undefined, pageNum, limitNum);

        res.json({ success: true, data: { conversations: result.items, total: result.total } });
      } catch (error: unknown) {
        const message = error instanceof Error ? error.message : 'Unknown error';
        res.status(500).json({ success: false, error: message });
      }
    },

    async getMessages(req: Request, res: Response) {
      try {
        const chatId = req.params.chatId as string;
        const { page, limit } = req.query;

        const pageNum = Number(page) || 1;
        const limitNum = Number(limit) || 50;

        const result = await conversationService.getMessages(chatId, pageNum, limitNum);

        res.json({ success: true, data: { messages: result.items, total: result.total } });
      } catch (error: unknown) {
        const message = error instanceof Error ? error.message : 'Unknown error';
        res.status(500).json({ success: false, error: message });
      }
    },

    async sendMessage(req: Request, res: Response) {
      try {
        const chatId = req.params.chatId as string;
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

        const count = await conversationService.markAsRead(chatId);

        res.json({ success: true, data: { markedCount: count } });
      } catch (error: unknown) {
        const message = error instanceof Error ? error.message : 'Unknown error';
        res.status(500).json({ success: false, error: message });
      }
    },

    async getUnreadCount(_req: Request, res: Response) {
      try {
        const count = await conversationService.getUnreadCount();

        res.json({ success: true, data: { unreadCount: count } });
      } catch (error: unknown) {
        const message = error instanceof Error ? error.message : 'Unknown error';
        res.status(500).json({ success: false, error: message });
      }
    },

    async syncHistory(req: Request, res: Response) {
      try {
        const chatId = req.params.chatId as string;
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
  };
}
