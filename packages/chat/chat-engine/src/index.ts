import type { Server as HttpServer } from 'http';
import type { Router } from 'express';
import { noopLogger } from '@astralibx/core';
import type { LogAdapter } from '@astralibx/core';
import type { ChatEngineConfig, ResolvedOptions } from './types/config.types.js';
import { DEFAULT_OPTIONS } from './types/config.types.js';
import { validateConfig } from './validation/index.js';
import { createChatSessionSchema, type IChatSession, type ChatSessionModel } from './schemas/chat-session.schema.js';
import { createChatMessageSchema, type IChatMessage, type ChatMessageModel } from './schemas/chat-message.schema.js';
import { createChatAgentSchema, type IChatAgent, type ChatAgentModel } from './schemas/chat-agent.schema.js';
import { createChatSettingsSchema, type IChatSettings, type ChatSettingsModel } from './schemas/chat-settings.schema.js';
import { createPendingMessageSchema, type IPendingMessage, type PendingMessageModel } from './schemas/pending-message.schema.js';
import { createChatFAQItemSchema, type IChatFAQItem, type ChatFAQItemModel } from './schemas/chat-faq-item.schema.js';
import { createChatGuidedQuestionSchema, type IChatGuidedQuestion, type ChatGuidedQuestionModel } from './schemas/chat-guided-question.schema.js';
import { createChatCannedResponseSchema, type IChatCannedResponse, type ChatCannedResponseModel } from './schemas/chat-canned-response.schema.js';
import { createChatWidgetConfigSchema, type IChatWidgetConfig, type ChatWidgetConfigModel } from './schemas/chat-widget-config.schema.js';
import { createChatWebhookSchema, type IChatWebhook, type ChatWebhookModel } from './schemas/chat-webhook.schema.js';
import { SessionService } from './services/session.service.js';
import { MessageService } from './services/message.service.js';
import { AgentService } from './services/agent.service.js';
import { SettingsService } from './services/settings.service.js';
import { FAQService } from './services/faq.service.js';
import { GuidedQuestionService } from './services/guided-question.service.js';
import { CannedResponseService } from './services/canned-response.service.js';
import { WidgetConfigService } from './services/widget-config.service.js';
import { PendingMessageService } from './services/pending-message.service.js';
import { RedisService } from './services/redis.service.js';
import { ExportService } from './services/export.service.js';
import { ReportService } from './services/report.service.js';
import { WebhookService } from './services/webhook.service.js';
import { WEBHOOK_EVENT } from './constants/index.js';
import { createGateway, type GatewayResult } from './gateway/index.js';
import { createRoutes } from './routes/index.js';
import { SessionTimeoutWorker } from './workers/session-timeout.worker.js';
import { AutoAwayWorker } from './workers/auto-away.worker.js';
import { clearAllDebounceTimers } from './gateway/ai-debounce.js';
import { clearAllTypingTimeouts, clearAllTypingThrottles, clearAllConnectionLimits } from './gateway/helpers.js';

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
  exports: ExportService;
  reports: ReportService;
  webhooks: WebhookService;

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
    ChatWebhook: ChatWebhookModel;
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

  const ChatSession = conn.model<IChatSession>(
    `${prefix}ChatSession`,
    createChatSessionSchema(),
  );

  const ChatMessage = conn.model<IChatMessage>(
    `${prefix}ChatMessage`,
    createChatMessageSchema(),
  );

  const ChatAgent = conn.model<IChatAgent>(
    `${prefix}ChatAgent`,
    createChatAgentSchema(),
  );

  const ChatSettings = conn.model<IChatSettings>(
    `${prefix}ChatSettings`,
    createChatSettingsSchema(),
  );

  const PendingMessage = conn.model<IPendingMessage>(
    `${prefix}PendingMessage`,
    createPendingMessageSchema(),
  );

  const ChatFAQItem = conn.model<IChatFAQItem>(
    `${prefix}ChatFAQItem`,
    createChatFAQItemSchema(),
  );

  const ChatGuidedQuestion = conn.model<IChatGuidedQuestion>(
    `${prefix}ChatGuidedQuestion`,
    createChatGuidedQuestionSchema(),
  );

  const ChatCannedResponse = conn.model<IChatCannedResponse>(
    `${prefix}ChatCannedResponse`,
    createChatCannedResponseSchema(),
  );

  const ChatWidgetConfig = conn.model<IChatWidgetConfig>(
    `${prefix}ChatWidgetConfig`,
    createChatWidgetConfigSchema(),
  );

  const ChatWebhook = conn.model<IChatWebhook>(
    `${prefix}ChatWebhook`,
    createChatWebhookSchema(),
  );

  // Create services

  const redisService = new RedisService(
    config.redis.connection,
    resolvedOptions,
    config.redis.keyPrefix || 'chat:',
    logger,
  );

  const tenantId = config.tenantId;

  const sessionService = new SessionService(
    ChatSession,
    ChatMessage,
    resolvedOptions,
    logger,
    hooks,
    tenantId,
  );

  const messageService = new MessageService(
    ChatMessage,
    resolvedOptions,
    logger,
    hooks,
    tenantId,
  );

  const agentService = new AgentService(
    ChatAgent,
    resolvedOptions,
    logger,
    tenantId,
  );

  const settingsService = new SettingsService(ChatSettings, logger, tenantId);

  const faqService = new FAQService(ChatFAQItem, logger, tenantId);

  const guidedQuestionService = new GuidedQuestionService(ChatGuidedQuestion, logger);

  const cannedResponseService = new CannedResponseService(ChatCannedResponse, logger, tenantId);

  const widgetConfigService = new WidgetConfigService(ChatWidgetConfig, logger, tenantId);

  const pendingMessageService = new PendingMessageService(
    PendingMessage,
    resolvedOptions,
    logger,
  );

  const exportService = new ExportService(ChatSession, ChatMessage, logger);

  const reportService = new ReportService(ChatSession, ChatMessage, logger);

  const webhookService = new WebhookService(ChatWebhook, logger);

  // Wire webhook triggers into lifecycle hooks
  const originalOnSessionCreated = hooks?.onSessionCreated;
  const originalOnSessionResolved = hooks?.onSessionResolved;
  const originalOnSessionAbandoned = hooks?.onSessionAbandoned;
  const originalOnSessionClosed = hooks?.onSessionClosed;
  const originalOnMessageSent = hooks?.onMessageSent;
  const originalOnEscalation = hooks?.onEscalation;
  const originalOnAgentTransfer = hooks?.onAgentTransfer;
  const originalOnFeedbackReceived = hooks?.onFeedbackReceived;

  const webhookHooks: ChatEngineConfig['hooks'] = {
    ...hooks,
    onSessionCreated: (session) => {
      originalOnSessionCreated?.(session);
      webhookService.trigger(WEBHOOK_EVENT.ChatStarted, { session });
    },
    onSessionResolved: (session, stats) => {
      originalOnSessionResolved?.(session, stats);
      webhookService.trigger(WEBHOOK_EVENT.ChatEnded, { session, stats });
    },
    onSessionAbandoned: (session) => {
      originalOnSessionAbandoned?.(session);
      webhookService.trigger(WEBHOOK_EVENT.ChatEnded, { session, reason: 'abandoned' });
    },
    onSessionClosed: (session) => {
      originalOnSessionClosed?.(session);
      webhookService.trigger(WEBHOOK_EVENT.ChatEnded, { session, reason: 'closed' });
    },
    onMessageSent: (message) => {
      originalOnMessageSent?.(message);
      const event = message.senderType === 'visitor'
        ? WEBHOOK_EVENT.MessageReceived
        : WEBHOOK_EVENT.MessageSent;
      webhookService.trigger(event, { message });
    },
    onEscalation: (sessionId, reason) => {
      originalOnEscalation?.(sessionId, reason);
      webhookService.trigger(WEBHOOK_EVENT.ChatEscalated, { sessionId, reason });
    },
    onAgentTransfer: (sessionId, fromAgentId, toAgentId) => {
      originalOnAgentTransfer?.(sessionId, fromAgentId, toAgentId);
      webhookService.trigger(WEBHOOK_EVENT.AgentTransferred, { sessionId, fromAgentId, toAgentId });
    },
    onFeedbackReceived: (sessionId, feedback) => {
      originalOnFeedbackReceived?.(sessionId, feedback);
      webhookService.trigger(WEBHOOK_EVENT.RatingSubmitted, { sessionId, feedback });
    },
  };

  // Re-create services that depend on hooks with webhook-wrapped hooks
  const sessionServiceWithWebhooks = new SessionService(
    ChatSession,
    ChatMessage,
    resolvedOptions,
    logger,
    webhookHooks,
  );

  const messageServiceWithWebhooks = new MessageService(
    ChatMessage,
    resolvedOptions,
    logger,
    webhookHooks,
  );

  // Create gateway

  const gateway: GatewayResult = createGateway({
    sessionService: sessionServiceWithWebhooks,
    messageService: messageServiceWithWebhooks,
    agentService,
    settingsService,
    pendingMessageService,
    redisService,
    config,
    options: resolvedOptions,
    logger,
  });

  // Compute capabilities once at startup (cached for GET /capabilities)

  const capabilities = {
    agents: !!config.adapters?.assignAgent,
    ai: !!config.adapters?.generateAiResponse,
    visitorSelection: false,
    labeling: !!resolvedOptions.labelingEnabled,
    fileUpload: !!config.adapters?.uploadFile || !!config.adapters?.fileStorage,
    memory: false,
    prompts: false,
    knowledge: false,
  };

  // Create REST routes

  const routes = createRoutes(
    {
      sessions: sessionServiceWithWebhooks,
      messages: messageServiceWithWebhooks,
      agents: agentService,
      settings: settingsService,
      faq: faqService,
      guidedQuestions: guidedQuestionService,
      cannedResponses: cannedResponseService,
      widgetConfig: widgetConfigService,
      exports: exportService,
      reports: reportService,
      webhooks: webhookService,
    },
    {
      authenticateRequest: config.adapters.authenticateRequest,
      onOfflineMessage: hooks?.onOfflineMessage,
      capabilities,
      uploadFile: config.adapters?.uploadFile,
      maxUploadSizeMb: resolvedOptions.maxUploadSizeMb,
      enrichSessionContext: config.adapters?.enrichSessionContext,
      fileStorage: config.adapters?.fileStorage,
      logger,
    },
  );

  // Create timeout worker

  const timeoutWorker = new SessionTimeoutWorker({
    sessionService: sessionServiceWithWebhooks,
    messageService: messageServiceWithWebhooks,
    agentService,
    settingsService,
    redisService,
    config,
    options: resolvedOptions,
    logger,
    getEmitDeps: () => gateway.emitDeps,
  });

  timeoutWorker.start();

  // Create auto-away worker

  const autoAwayWorker = new AutoAwayWorker({
    agentService,
    settingsService,
    redisService,
    logger,
  });

  autoAwayWorker.start();

  // Build return object

  function attach(httpServer: HttpServer): void {
    gateway.attach(httpServer);

    // Wire the agentNs into the auto-away worker after gateway attach
    const agentNs = gateway.agentNs;
    if (agentNs) {
      autoAwayWorker.setAgentNamespace(agentNs);
    }
  }

  async function destroy(): Promise<void> {
    timeoutWorker.stop();
    autoAwayWorker.stop();
    clearAllDebounceTimers();
    clearAllTypingTimeouts();
    clearAllTypingThrottles();
    clearAllConnectionLimits();
    await redisService.clearAllAiLocks();
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
    sessions: sessionServiceWithWebhooks,
    messages: messageServiceWithWebhooks,
    agents: agentService,
    settings: settingsService,
    faq: faqService,
    guidedQuestions: guidedQuestionService,
    cannedResponses: cannedResponseService,
    widgetConfig: widgetConfigService,
    exports: exportService,
    reports: reportService,
    webhooks: webhookService,
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
      ChatWebhook,
    },
    destroy,
  };
}

// Barrel exports
export * from './constants/index.js';
export * from './types/index.js';
export * from './errors/index.js';
export {
  validateConfig,
  validateMessageContent,
  validateSessionForMessaging,
  validateAgentOwnership,
  validateSessionTransition,
} from './validation/index.js';
export * from './schemas/index.js';
export { SessionService } from './services/session.service.js';
export { MessageService } from './services/message.service.js';
export { AgentService } from './services/agent.service.js';
export { SettingsService } from './services/settings.service.js';
export { FAQService } from './services/faq.service.js';
export { GuidedQuestionService } from './services/guided-question.service.js';
export { CannedResponseService } from './services/canned-response.service.js';
export { WidgetConfigService } from './services/widget-config.service.js';
export { PendingMessageService } from './services/pending-message.service.js';
export { RedisService } from './services/redis.service.js';
export { SessionTimeoutWorker } from './workers/session-timeout.worker.js';
export { AutoAwayWorker } from './workers/auto-away.worker.js';
export { ExportService } from './services/export.service.js';
export { ReportService } from './services/report.service.js';
export { WebhookService } from './services/webhook.service.js';
export { createRoutes } from './routes/index.js';
export { resolveAiMode, resolveAiCharacter } from './utils/ai-resolver.js';
