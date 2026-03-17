import type { Server as HttpServer } from 'http';
import type { Router } from 'express';
import { noopLogger } from '@astralibx/core';
import type { LogAdapter } from '@astralibx/core';
import type { ChatEngineConfig, ResolvedOptions } from './types/config.types';
import { DEFAULT_OPTIONS } from './types/config.types';
import { validateConfig } from './validation';
import { createChatSessionSchema, type ChatSessionModel } from './schemas/chat-session.schema';
import { createChatMessageSchema, type ChatMessageModel } from './schemas/chat-message.schema';
import { createChatAgentSchema, type ChatAgentModel } from './schemas/chat-agent.schema';
import { createChatSettingsSchema, type ChatSettingsModel } from './schemas/chat-settings.schema';
import { createPendingMessageSchema, type PendingMessageModel } from './schemas/pending-message.schema';
import { createChatFAQItemSchema, type ChatFAQItemModel } from './schemas/chat-faq-item.schema';
import { createChatGuidedQuestionSchema, type ChatGuidedQuestionModel } from './schemas/chat-guided-question.schema';
import { createChatCannedResponseSchema, type ChatCannedResponseModel } from './schemas/chat-canned-response.schema';
import { createChatWidgetConfigSchema, type ChatWidgetConfigModel } from './schemas/chat-widget-config.schema';
import { SessionService } from './services/session.service';
import { MessageService } from './services/message.service';
import { AgentService } from './services/agent.service';
import { SettingsService } from './services/settings.service';
import { FAQService } from './services/faq.service';
import { GuidedQuestionService } from './services/guided-question.service';
import { CannedResponseService } from './services/canned-response.service';
import { WidgetConfigService } from './services/widget-config.service';
import { PendingMessageService } from './services/pending-message.service';
import { RedisService } from './services/redis.service';
import { createGateway, type GatewayResult } from './gateway';
import { createRoutes } from './routes';
import { SessionTimeoutWorker } from './workers/session-timeout.worker';

export interface ChatEngine {
  attach(httpServer: HttpServer): void;

  routes: Router;
  sessions: SessionService;
  messages: MessageService;
  agents: AgentService;
  settings: SettingsService;
  faq: FAQService;
  guidedQuestions: GuidedQuestionService;
  cannedResponses: CannedResponseService;
  widgetConfig: WidgetConfigService;

  models: {
    ChatSession: ChatSessionModel;
    ChatMessage: ChatMessageModel;
    ChatAgent: ChatAgentModel;
    ChatSettings: ChatSettingsModel;
    PendingMessage: PendingMessageModel;
    ChatFAQItem: ChatFAQItemModel;
    ChatGuidedQuestion: ChatGuidedQuestionModel;
    ChatCannedResponse: ChatCannedResponseModel;
    ChatWidgetConfig: ChatWidgetConfigModel;
  };

  destroy(): Promise<void>;
}

export function createChatEngine(config: ChatEngineConfig): ChatEngine {
  validateConfig(config);

  const conn = config.db.connection;
  const prefix = config.db.collectionPrefix || '';
  const logger = config.logger || noopLogger;
  const hooks = config.hooks;

  const resolvedOptions: ResolvedOptions = {
    ...DEFAULT_OPTIONS,
    ...config.options,
  };

  // Register Mongoose models

  const ChatSession = conn.model<any>(
    `${prefix}ChatSession`,
    createChatSessionSchema(),
  ) as ChatSessionModel;

  const ChatMessage = conn.model<any>(
    `${prefix}ChatMessage`,
    createChatMessageSchema(),
  ) as ChatMessageModel;

  const ChatAgent = conn.model<any>(
    `${prefix}ChatAgent`,
    createChatAgentSchema(),
  ) as ChatAgentModel;

  const ChatSettings = conn.model<any>(
    `${prefix}ChatSettings`,
    createChatSettingsSchema(),
  ) as ChatSettingsModel;

  const PendingMessage = conn.model<any>(
    `${prefix}PendingMessage`,
    createPendingMessageSchema(),
  ) as PendingMessageModel;

  const ChatFAQItem = conn.model<any>(
    `${prefix}ChatFAQItem`,
    createChatFAQItemSchema(),
  ) as ChatFAQItemModel;

  const ChatGuidedQuestion = conn.model<any>(
    `${prefix}ChatGuidedQuestion`,
    createChatGuidedQuestionSchema(),
  ) as ChatGuidedQuestionModel;

  const ChatCannedResponse = conn.model<any>(
    `${prefix}ChatCannedResponse`,
    createChatCannedResponseSchema(),
  ) as ChatCannedResponseModel;

  const ChatWidgetConfig = conn.model<any>(
    `${prefix}ChatWidgetConfig`,
    createChatWidgetConfigSchema(),
  ) as ChatWidgetConfigModel;

  // Create services

  const redisService = new RedisService(
    config.redis.connection,
    resolvedOptions,
    config.redis.keyPrefix || 'chat:',
    logger,
  );

  const sessionService = new SessionService(
    ChatSession,
    ChatMessage,
    resolvedOptions,
    logger,
    hooks,
  );

  const messageService = new MessageService(
    ChatMessage,
    resolvedOptions,
    logger,
    hooks,
  );

  const agentService = new AgentService(
    ChatAgent,
    resolvedOptions,
    logger,
  );

  const settingsService = new SettingsService(ChatSettings, logger);

  const faqService = new FAQService(ChatFAQItem, logger);

  const guidedQuestionService = new GuidedQuestionService(ChatGuidedQuestion, logger);

  const cannedResponseService = new CannedResponseService(ChatCannedResponse, logger);

  const widgetConfigService = new WidgetConfigService(ChatWidgetConfig, logger);

  const pendingMessageService = new PendingMessageService(
    PendingMessage,
    resolvedOptions,
    logger,
  );

  // Create gateway

  const gateway: GatewayResult = createGateway({
    sessionService,
    messageService,
    agentService,
    settingsService,
    pendingMessageService,
    redisService,
    config,
    options: resolvedOptions,
    logger,
  });

  // Create REST routes

  const routes = createRoutes(
    {
      sessions: sessionService,
      messages: messageService,
      agents: agentService,
      settings: settingsService,
      faq: faqService,
      guidedQuestions: guidedQuestionService,
      cannedResponses: cannedResponseService,
      widgetConfig: widgetConfigService,
    },
    {
      authenticateRequest: config.adapters.authenticateRequest,
      onOfflineMessage: hooks?.onOfflineMessage,
      logger,
    },
  );

  // Create timeout worker

  const timeoutWorker = new SessionTimeoutWorker({
    sessionService,
    agentService,
    redisService,
    config,
    options: resolvedOptions,
    logger,
  });

  timeoutWorker.start();

  // Build return object

  function attach(httpServer: HttpServer): void {
    gateway.attach(httpServer);
  }

  async function destroy(): Promise<void> {
    timeoutWorker.stop();
    if (gateway.io) {
      await new Promise<void>((resolve) => {
        gateway.io.close(() => resolve());
      });
    }
    logger.info('ChatEngine destroyed');
  }

  return {
    attach,
    routes,
    sessions: sessionService,
    messages: messageService,
    agents: agentService,
    settings: settingsService,
    faq: faqService,
    guidedQuestions: guidedQuestionService,
    cannedResponses: cannedResponseService,
    widgetConfig: widgetConfigService,
    models: {
      ChatSession,
      ChatMessage,
      ChatAgent,
      ChatSettings,
      PendingMessage,
      ChatFAQItem,
      ChatGuidedQuestion,
      ChatCannedResponse,
      ChatWidgetConfig,
    },
    destroy,
  };
}

// Barrel exports
export * from './types';
export * from './errors';
export { validateConfig } from './validation';
export * from './schemas';
export { SessionService } from './services/session.service';
export { MessageService } from './services/message.service';
export { AgentService } from './services/agent.service';
export { SettingsService } from './services/settings.service';
export { FAQService } from './services/faq.service';
export { GuidedQuestionService } from './services/guided-question.service';
export { CannedResponseService } from './services/canned-response.service';
export { WidgetConfigService } from './services/widget-config.service';
export { PendingMessageService } from './services/pending-message.service';
export { RedisService } from './services/redis.service';
export { SessionTimeoutWorker } from './workers/session-timeout.worker';
export { createRoutes } from './routes';
