import { Router } from 'express';
import type { Request, Response, NextFunction, RequestHandler } from 'express';
import { sendSuccess, sendError } from '@astralibx/core';
import { ChatSessionStatus } from '@astralibx/chat-types';
import type { LogAdapter } from '@astralibx/core';
import type { SessionService } from '../services/session.service.js';
import type { MessageService } from '../services/message.service.js';
import type { AgentService } from '../services/agent.service.js';
import type { SettingsService } from '../services/settings.service.js';
import type { FAQService } from '../services/faq.service.js';
import type { GuidedQuestionService } from '../services/guided-question.service.js';
import type { CannedResponseService } from '../services/canned-response.service.js';
import type { WidgetConfigService } from '../services/widget-config.service.js';
import type { ExportService } from '../services/export.service.js';
import type { ReportService } from '../services/report.service.js';
import type { WebhookService } from '../services/webhook.service.js';
import { createSessionRoutes } from './session.routes.js';
import { createAgentRoutes } from './agent.routes.js';
import { createSettingsRoutes } from './settings.routes.js';
import { createFAQRoutes } from './faq.routes.js';
import { createGuidedQuestionRoutes } from './guided-question.routes.js';
import { createCannedResponseRoutes } from './canned-response.routes.js';
import { createWidgetConfigRoutes } from './widget-config.routes.js';
import { createStatsRoutes } from './stats.routes.js';
import { createReportRoutes } from './reports.routes.js';
import { createWebhookRoutes } from './webhook.routes.js';

export interface RouteServices {
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
}

export interface ChatCapabilities {
  agents: boolean;
  ai: boolean;
  visitorSelection: boolean;
  labeling: boolean;
  fileUpload: boolean;
  memory: boolean;
  prompts: boolean;
  knowledge: boolean;
}

export interface RouteOptions {
  authenticateRequest?: (req: any) => Promise<{ userId: string; permissions?: string[] } | null>;
  onOfflineMessage?: (data: { visitorId: string; formData: Record<string, unknown> }) => void;
  capabilities: ChatCapabilities;
  uploadFile?: (file: { buffer: Buffer; mimetype: string; originalname: string }) => Promise<string>;
  maxUploadSizeMb?: number;
  enrichSessionContext?: (context: Record<string, unknown>) => Promise<Record<string, unknown>>;
  fileStorage?: {
    upload(file: Buffer, fileName: string, mimeType: string): Promise<string>;
    delete(fileUrl: string): Promise<void>;
    getSignedUrl?(fileUrl: string, expiresIn?: number): Promise<string>;
  };
  logger: LogAdapter;
}

export function createRoutes(services: RouteServices, options: RouteOptions): Router {
  const router = Router();
  const { logger, authenticateRequest, onOfflineMessage, capabilities, uploadFile, maxUploadSizeMb, enrichSessionContext, fileStorage } = options;

  // Build auth middleware if adapter is provided
  let authMiddleware: RequestHandler | undefined;
  if (authenticateRequest) {
    authMiddleware = async (req: Request, _res: Response, next: NextFunction): Promise<void> => {
      try {
        const result = await authenticateRequest(req);
        if (!result) {
          sendError(_res, 'Unauthorized', 401);
          return;
        }
        (req as any).user = result;
        next();
      } catch (error: unknown) {
        const message = error instanceof Error ? error.message : 'Authentication failed';
        sendError(_res, message, 401);
      }
    };
  }

  // Capabilities — public, no auth, computed once at startup
  router.get('/capabilities', (_req: Request, res: Response) => {
    sendSuccess(res, capabilities);
  });

  // Widget config — GET is public, PUT is protected
  router.use('/widget-config', createWidgetConfigRoutes(services.widgetConfig, logger, authMiddleware, services.settings));

  // Offline message submission — public (visitor submits when offline)
  router.post('/offline-messages', async (req: Request, res: Response) => {
    try {
      const { visitorId, formData } = req.body;
      if (!visitorId || !formData) {
        sendError(res, 'visitorId and formData are required', 400);
        return;
      }
      onOfflineMessage?.({ visitorId, formData });
      sendSuccess(res, undefined);
    } catch (error: unknown) {
      const message = error instanceof Error ? error.message : 'Unknown error';
      logger.error('Failed to process offline message', { error });
      sendError(res, message, 500);
    }
  });

  // All other routes are protected if authMiddleware exists
  const protectedRouter = Router();

  protectedRouter.use('/sessions', createSessionRoutes(services.sessions, services.messages, logger, { enrichSessionContext, fileStorage, settingsService: services.settings, exportService: services.exports, webhookService: services.webhooks }));
  protectedRouter.use('/agents', createAgentRoutes(services.agents, logger, { uploadFile, maxUploadSizeMb }));
  protectedRouter.use('/settings', createSettingsRoutes(services.settings, logger, {
    hasAiAdapter: capabilities.ai,
  }));
  protectedRouter.use('/faq', createFAQRoutes(services.faq, logger));
  protectedRouter.use('/guided-questions', createGuidedQuestionRoutes(services.guidedQuestions, logger));
  protectedRouter.use('/canned-responses', createCannedResponseRoutes(services.cannedResponses, logger));
  protectedRouter.use('/stats', createStatsRoutes(services.sessions, services.agents, logger));
  protectedRouter.use('/reports', createReportRoutes(services.reports, logger));
  protectedRouter.use('/webhooks', createWebhookRoutes(services.webhooks, logger));

  // GET /offline-messages — protected (admin lists offline messages)
  protectedRouter.get('/offline-messages', async (req: Request, res: Response) => {
    try {
      const { dateFrom, dateTo, page, limit } = req.query;
      const filter: Record<string, unknown> = {
        status: ChatSessionStatus.Abandoned,
        messageCount: 0,
      };

      if (dateFrom || dateTo) {
        const dateFilter: Record<string, unknown> = {};
        if (dateFrom) dateFilter.$gte = new Date(dateFrom as string);
        if (dateTo) dateFilter.$lte = new Date(dateTo as string);
        filter.startedAt = dateFilter;
      }

      const pageNum = Number(page) || 1;
      const limitNum = Number(limit) || 20;

      const result = await services.sessions.findPaginated(filter, pageNum, limitNum);
      sendSuccess(res, result);
    } catch (error: unknown) {
      const message = error instanceof Error ? error.message : 'Unknown error';
      logger.error('Failed to list offline messages', { error });
      sendError(res, message, 500);
    }
  });

  if (authMiddleware) {
    router.use(authMiddleware, protectedRouter);
  } else {
    router.use(protectedRouter);
  }

  return router;
}
