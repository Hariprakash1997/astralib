import { Router } from 'express';
import type { Request, Response } from 'express';
import { sendSuccess, sendError } from '@astralibx/core';
import type { LogAdapter } from '@astralibx/core';
import type { CallLogService } from '../services/call-log.service.js';
import type { TimelineService } from '../services/timeline.service.js';
import { AlxCallLogError } from '../errors/index.js';

export function createCallLogRoutes(
  services: { callLogs: CallLogService; timeline: TimelineService },
  logger: LogAdapter,
): Router {
  const router = Router();
  const { callLogs, timeline } = services;

  // Static routes BEFORE parameterized routes

  // GET /follow-ups — list due follow-ups (BEFORE /:id)
  router.get('/follow-ups', async (req: Request, res: Response) => {
    try {
      const { agentId } = req.query as { agentId?: string };
      const dateRange = {
        from: req.query['from'] as string | undefined,
        to: req.query['to'] as string | undefined,
      };
      const result = await callLogs.getFollowUpsDue(agentId, dateRange);
      sendSuccess(res, result);
    } catch (error: unknown) {
      const message = error instanceof Error ? error.message : 'Unknown error';
      logger.error('Failed to get follow-ups', { error: message });
      sendError(res, message, 500);
    }
  });

  // PUT /-/bulk/stage — bulk stage change (BEFORE /:id)
  router.put('/-/bulk/stage', async (req: Request, res: Response) => {
    try {
      const { callLogIds, newStageId, agentId } = req.body as {
        callLogIds: string[];
        newStageId: string;
        agentId: string;
      };
      const result = await callLogs.bulkChangeStage(callLogIds, newStageId, agentId);
      sendSuccess(res, result);
    } catch (error: unknown) {
      if (error instanceof AlxCallLogError) {
        sendError(res, error.message, 400);
        return;
      }
      const message = error instanceof Error ? error.message : 'Unknown error';
      logger.error('Failed to bulk change stage', { error: message });
      sendError(res, message, 500);
    }
  });

  // GET / — list call logs
  router.get('/', async (req: Request, res: Response) => {
    try {
      const query = req.query as Record<string, string | undefined>;
      const filter: Record<string, unknown> = {};
      if (query['pipelineId']) filter['pipelineId'] = query['pipelineId'];
      if (query['currentStageId']) filter['currentStageId'] = query['currentStageId'];
      if (query['agentId']) filter['agentId'] = query['agentId'];
      if (query['category']) filter['category'] = query['category'];
      if (query['isClosed'] !== undefined) filter['isClosed'] = query['isClosed'] === 'true';
      if (query['contactExternalId']) filter['contactExternalId'] = query['contactExternalId'];
      if (query['contactName']) filter['contactName'] = query['contactName'];
      if (query['contactPhone']) filter['contactPhone'] = query['contactPhone'];
      if (query['contactEmail']) filter['contactEmail'] = query['contactEmail'];
      if (query['priority']) filter['priority'] = query['priority'];
      if (query['direction']) filter['direction'] = query['direction'];
      if (query['page']) filter['page'] = parseInt(query['page']!, 10);
      if (query['limit']) filter['limit'] = parseInt(query['limit']!, 10);
      if (query['from'] || query['to']) {
        filter['dateRange'] = { from: query['from'], to: query['to'] };
      }
      const result = await callLogs.list(filter as Parameters<typeof callLogs.list>[0]);
      sendSuccess(res, result);
    } catch (error: unknown) {
      const message = error instanceof Error ? error.message : 'Unknown error';
      logger.error('Failed to list call logs', { error: message });
      sendError(res, message, 500);
    }
  });

  // POST / — create call log
  router.post('/', async (req: Request, res: Response) => {
    try {
      const result = await callLogs.create(req.body);
      sendSuccess(res, result, 201);
    } catch (error: unknown) {
      if (error instanceof AlxCallLogError) {
        sendError(res, error.message, 400);
        return;
      }
      const message = error instanceof Error ? error.message : 'Unknown error';
      logger.error('Failed to create call log', { error: message });
      sendError(res, message, 500);
    }
  });

  // GET /:id — get call log
  router.get('/:id', async (req: Request, res: Response) => {
    try {
      const result = await callLogs.get(req.params['id']!);
      sendSuccess(res, result);
    } catch (error: unknown) {
      if (error instanceof AlxCallLogError) {
        sendError(res, error.message, 404);
        return;
      }
      const message = error instanceof Error ? error.message : 'Unknown error';
      logger.error('Failed to get call log', { id: req.params['id'], error: message });
      sendError(res, message, 500);
    }
  });

  // PUT /:id — update call log
  router.put('/:id', async (req: Request, res: Response) => {
    try {
      const result = await callLogs.update(req.params['id']!, req.body);
      sendSuccess(res, result);
    } catch (error: unknown) {
      if (error instanceof AlxCallLogError) {
        sendError(res, error.message, 400);
        return;
      }
      const message = error instanceof Error ? error.message : 'Unknown error';
      logger.error('Failed to update call log', { id: req.params['id'], error: message });
      sendError(res, message, 500);
    }
  });

  // PUT /:id/stage — change stage
  router.put('/:id/stage', async (req: Request, res: Response) => {
    try {
      const { newStageId, agentId } = req.body as { newStageId: string; agentId: string };
      const result = await callLogs.changeStage(req.params['id']!, newStageId, agentId);
      sendSuccess(res, result);
    } catch (error: unknown) {
      if (error instanceof AlxCallLogError) {
        sendError(res, error.message, 400);
        return;
      }
      const message = error instanceof Error ? error.message : 'Unknown error';
      logger.error('Failed to change stage', { id: req.params['id'], error: message });
      sendError(res, message, 500);
    }
  });

  // PUT /:id/assign — reassign
  router.put('/:id/assign', async (req: Request, res: Response) => {
    try {
      const { agentId, assignedBy } = req.body as { agentId: string; assignedBy: string };
      const result = await callLogs.assign(req.params['id']!, agentId, assignedBy);
      sendSuccess(res, result);
    } catch (error: unknown) {
      if (error instanceof AlxCallLogError) {
        sendError(res, error.message, 400);
        return;
      }
      const message = error instanceof Error ? error.message : 'Unknown error';
      logger.error('Failed to assign call log', { id: req.params['id'], error: message });
      sendError(res, message, 500);
    }
  });

  // PUT /:id/close — manual close
  router.put('/:id/close', async (req: Request, res: Response) => {
    try {
      const { agentId } = req.body as { agentId: string };
      const result = await callLogs.close(req.params['id']!, agentId);
      sendSuccess(res, result);
    } catch (error: unknown) {
      if (error instanceof AlxCallLogError) {
        sendError(res, error.message, 400);
        return;
      }
      const message = error instanceof Error ? error.message : 'Unknown error';
      logger.error('Failed to close call log', { id: req.params['id'], error: message });
      sendError(res, message, 500);
    }
  });

  // PUT /:id/reopen — reopen a closed call
  router.put('/:id/reopen', async (req: Request, res: Response) => {
    try {
      const { agentId } = req.body as { agentId: string };
      const result = await callLogs.reopen(req.params['id']!, agentId);
      sendSuccess(res, result);
    } catch (error: unknown) {
      if (error instanceof AlxCallLogError) {
        sendError(res, error.message, 400);
        return;
      }
      const message = error instanceof Error ? error.message : 'Unknown error';
      logger.error('Failed to reopen call log', { id: req.params['id'], error: message });
      sendError(res, message, 500);
    }
  });

  // POST /:id/notes — add timeline note
  router.post('/:id/notes', async (req: Request, res: Response) => {
    try {
      const { content, authorId, authorName } = req.body as {
        content: string;
        authorId: string;
        authorName: string;
      };
      const result = await timeline.addNote(req.params['id']!, content, authorId, authorName);
      sendSuccess(res, result, 201);
    } catch (error: unknown) {
      if (error instanceof AlxCallLogError) {
        sendError(res, error.message, 400);
        return;
      }
      const message = error instanceof Error ? error.message : 'Unknown error';
      logger.error('Failed to add timeline note', { id: req.params['id'], error: message });
      sendError(res, message, 500);
    }
  });

  // GET /:id/timeline — paginated timeline
  router.get('/:id/timeline', async (req: Request, res: Response) => {
    try {
      const page = parseInt(req.query['page'] as string || '1', 10);
      const limit = parseInt(req.query['limit'] as string || '50', 10);
      const result = await timeline.getTimeline(req.params['id']!, { page, limit });
      sendSuccess(res, result);
    } catch (error: unknown) {
      if (error instanceof AlxCallLogError) {
        sendError(res, error.message, 404);
        return;
      }
      const message = error instanceof Error ? error.message : 'Unknown error';
      logger.error('Failed to get timeline', { id: req.params['id'], error: message });
      sendError(res, message, 500);
    }
  });

  return router;
}
