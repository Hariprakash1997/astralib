import type { Router } from 'express';
import { noopLogger } from '@astralibx/core';
import type { TelegramInboxConfig, LogAdapter } from './types/config.types';
import { validateConfig } from './validation/config.schema';
import { createTelegramMessageSchema, type TelegramMessageModel } from './schemas/telegram-message.schema';
import { createTelegramConversationSessionSchema, type TelegramConversationSessionModel } from './schemas/telegram-conversation-session.schema';
import { MessageListenerService } from './services/message-listener.service';
import { ConversationService } from './services/conversation.service';
import { HistorySyncService } from './services/history-sync.service';
import { MessageService } from './services/message.service';
import { SessionService } from './services/session.service';
import { TypingBroadcasterService } from './services/typing-broadcaster.service';
import { InboxEventGateway } from './services/websocket-gateway';
import { createConversationController } from './controllers/conversation.controller';
import { createSessionController } from './controllers/session.controller';
import { createRoutes } from './routes';

export interface TelegramInbox {
  routes: Router;
  listener: MessageListenerService;
  conversations: ConversationService;
  history: HistorySyncService;
  messages: MessageService;
  sessions: SessionService;
  typing: TypingBroadcasterService;
  events: InboxEventGateway;
  models: {
    TelegramMessage: TelegramMessageModel;
    TelegramConversationSession: TelegramConversationSessionModel;
  };
  destroy(): Promise<void>;
}

export function createTelegramInbox(config: TelegramInboxConfig): TelegramInbox {
  validateConfig(config);

  const conn = config.db.connection;
  const prefix = config.db.collectionPrefix || '';
  const logger = config.logger || noopLogger;
  const accountManager = config.accountManager;

  // 1. Create models
  const TelegramMessage = conn.model<any>(
    `${prefix}TelegramMessage`,
    createTelegramMessageSchema(prefix || undefined),
  ) as TelegramMessageModel;

  const TelegramConversationSession = conn.model<any>(
    `${prefix}TelegramConversationSession`,
    createTelegramConversationSessionSchema(prefix || undefined),
  ) as TelegramConversationSessionModel;

  // 2. Create event gateway
  const events = new InboxEventGateway();

  // 3. Create services in dependency order
  const sessionService = new SessionService(TelegramConversationSession, logger);

  const conversationService = new ConversationService(TelegramMessage, logger, config.hooks, events);

  const historySyncService = new HistorySyncService(accountManager, TelegramMessage, config, logger);

  const messageService = new MessageService(
    accountManager,
    TelegramMessage,
    TelegramConversationSession,
    config,
    logger,
  );

  const typingBroadcaster = new TypingBroadcasterService(accountManager, config, logger);

  const messageListenerService = new MessageListenerService(
    accountManager,
    TelegramMessage,
    TelegramConversationSession,
    config,
    events,
  );

  // 4. Create controllers
  const conversationController = createConversationController(
    conversationService,
    messageService,
    historySyncService,
    logger,
  );

  const sessionController = createSessionController(sessionService, logger);

  // 5. Create routes
  const routes = createRoutes({ conversationController, sessionController, logger });

  // 6. Auto-attach listeners if autoAttachOnConnect (default true)
  const autoAttach = config.options?.autoAttachOnConnect !== false;
  if (autoAttach) {
    messageListenerService.attachAll().catch((err) => {
      logger.error('Failed to auto-attach listeners', {
        error: err instanceof Error ? err.message : String(err),
      });
    });
  }

  // 7. Return interface with destroy()
  async function destroy(): Promise<void> {
    await messageListenerService.detachAll();
    typingBroadcaster.stopAll();
    events.removeAllListeners();
    logger.info('TelegramInbox destroyed');
  }

  return {
    routes,
    listener: messageListenerService,
    conversations: conversationService,
    history: historySyncService,
    messages: messageService,
    sessions: sessionService,
    typing: typingBroadcaster,
    events,
    models: { TelegramMessage, TelegramConversationSession },
    destroy,
  };
}

// Export everything
export * from './types';
export * from './constants';
export * from './errors';
export { validateConfig } from './validation/config.schema';
export * from './schemas';
export * from './services';
export { createConversationController } from './controllers/conversation.controller';
export { createSessionController } from './controllers/session.controller';
export { createRoutes, type TelegramInboxRouteDeps } from './routes';
