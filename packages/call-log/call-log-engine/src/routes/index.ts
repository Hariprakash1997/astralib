import { Router } from 'express';
import type { Request, Response, NextFunction, RequestHandler } from 'express';
import { sendSuccess, sendError } from '@astralibx/core';
import type { LogAdapter } from '@astralibx/core';
import type { AuthResult } from '@astralibx/call-log-types';
import type { PipelineService } from '../services/pipeline.service.js';
import type { CallLogService } from '../services/call-log.service.js';
import type { CallLogLifecycleService } from '../services/call-log-lifecycle.service.js';
import type { TimelineService } from '../services/timeline.service.js';
import type { AnalyticsService } from '../services/analytics.service.js';
import type { PipelineAnalyticsService } from '../services/pipeline-analytics.service.js';
import type { SettingsService } from '../services/settings.service.js';
import type { ExportService } from '../services/export.service.js';
import { createPipelineRoutes } from './pipeline.routes.js';
import { createCallLogRoutes } from './call-log.routes.js';
import { createContactRoutes } from './contact.routes.js';
import { createAnalyticsRoutes } from './analytics.routes.js';
import { createSettingsRoutes } from './settings.routes.js';

export interface RouteServices {
  pipelines: PipelineService;
  callLogs: CallLogService;
  lifecycle: CallLogLifecycleService;
  timeline: TimelineService;
  analytics: AnalyticsService;
  pipelineAnalytics: PipelineAnalyticsService;
  settings: SettingsService;
  export: ExportService;
}

export interface RouteOptions {
  authenticateRequest?: (req: Request) => Promise<AuthResult | null>;
  logger: LogAdapter;
}

export function createRoutes(services: RouteServices, options: RouteOptions): Router {
  const router = Router();
  const { logger, authenticateRequest } = options;

  // Build auth middleware
  let authMiddleware: RequestHandler | undefined;
  if (authenticateRequest) {
    authMiddleware = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
      try {
        const result = await authenticateRequest(req);
        if (!result) {
          sendError(res, 'Unauthorized', 401);
          return;
        }
        (req as Request & { user: AuthResult }).user = result;
        next();
      } catch (error: unknown) {
        const message = error instanceof Error ? error.message : 'Authentication failed';
        sendError(res, message, 401);
      }
    };
  }

  const protectedRouter = Router();

  protectedRouter.use('/pipelines', createPipelineRoutes(services.pipelines, logger));
  protectedRouter.use('/calls', createCallLogRoutes({ callLogs: services.callLogs, lifecycle: services.lifecycle, timeline: services.timeline }, logger));
  protectedRouter.use('/contacts', createContactRoutes({ callLogs: services.callLogs, timeline: services.timeline }, logger));
  protectedRouter.use('/analytics', createAnalyticsRoutes(services.analytics, services.pipelineAnalytics, logger));
  protectedRouter.use('/', createSettingsRoutes(services.settings, services.export, logger));

  if (authMiddleware) {
    router.use(authMiddleware, protectedRouter);
  } else {
    router.use(protectedRouter);
  }

  return router;
}
