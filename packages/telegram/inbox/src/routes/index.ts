import { Router } from 'express';
import type { createConversationController } from '../controllers/conversation.controller';
import type { createSessionController } from '../controllers/session.controller';
import type { LogAdapter } from '../types/config.types';

export interface TelegramInboxRouteDeps {
  conversationController: ReturnType<typeof createConversationController>;
  sessionController: ReturnType<typeof createSessionController>;
  logger?: LogAdapter;
}

export function createRoutes(deps: TelegramInboxRouteDeps): Router {
  const router = Router();
  const { conversationController, sessionController } = deps;

  // --- Conversation routes ---
  // Static routes BEFORE parameterized routes
  router.get('/conversations/unread', conversationController.getUnreadCount);

  router.get('/conversations', conversationController.list);
  router.get('/conversations/:chatId/messages', conversationController.getMessages);
  router.post('/conversations/:chatId/send', conversationController.sendMessage);
  router.post('/conversations/:chatId/read', conversationController.markAsRead);
  router.post('/conversations/:chatId/sync', conversationController.syncHistory);

  // --- Session routes ---
  router.get('/sessions', sessionController.list);
  router.get('/sessions/:id', sessionController.getById);
  router.post('/sessions/:id/close', sessionController.close);
  router.post('/sessions/:id/pause', sessionController.pause);
  router.post('/sessions/:id/resume', sessionController.resume);

  return router;
}
