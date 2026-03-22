import { Router } from 'express';
import type { Request, Response } from 'express';
import { sendSuccess, sendError } from '@astralibx/core';
import type { LogAdapter } from '@astralibx/core';
import type { CallLogService } from '../services/call-log.service.js';
import type { TimelineService } from '../services/timeline.service.js';
import { AlxCallLogError } from '../errors/index.js';

export function createContactRoutes(
  services: { callLogs: CallLogService; timeline: TimelineService },
  logger: LogAdapter,
): Router {
  const router = Router();
  const { callLogs, timeline } = services;

  // GET /:externalId/calls — all calls for contact
  router.get('/:externalId/calls', async (req: Request, res: Response) => {
    try {
      const result = await callLogs.getByContact(req.params['externalId']!);
      sendSuccess(res, result);
    } catch (error: unknown) {
      if (error instanceof AlxCallLogError) {
        sendError(res, error.message, 404);
        return;
      }
      const message = error instanceof Error ? error.message : 'Unknown error';
      logger.error('Failed to get calls for contact', { externalId: req.params['externalId'], error: message });
      sendError(res, message, 500);
    }
  });

  // GET /:externalId/timeline — merged contact timeline
  router.get('/:externalId/timeline', async (req: Request, res: Response) => {
    try {
      const page = parseInt(req.query['page'] as string || '1', 10);
      const limit = parseInt(req.query['limit'] as string || '20', 10);
      const result = await timeline.getContactTimeline(req.params['externalId']!, { page, limit });
      sendSuccess(res, result);
    } catch (error: unknown) {
      if (error instanceof AlxCallLogError) {
        sendError(res, error.message, 404);
        return;
      }
      const message = error instanceof Error ? error.message : 'Unknown error';
      logger.error('Failed to get contact timeline', { externalId: req.params['externalId'], error: message });
      sendError(res, message, 500);
    }
  });

  return router;
}
