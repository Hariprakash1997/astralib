import { Router } from 'express';
import type { Request, Response } from 'express';
import { sendSuccess, sendError } from '@astralibx/core';
import type { LogAdapter } from '@astralibx/core';
import type { PipelineService } from '../services/pipeline.service.js';
import { AlxCallLogError } from '../errors/index.js';

export function createPipelineRoutes(
  pipeline: PipelineService,
  logger: LogAdapter,
): Router {
  const router = Router();

  // GET / — list pipelines
  router.get('/', async (req: Request, res: Response) => {
    try {
      const isActive = req.query['isActive'] !== undefined
        ? req.query['isActive'] === 'true'
        : undefined;
      const result = await pipeline.list({ isActive });
      sendSuccess(res, result);
    } catch (error: unknown) {
      const message = error instanceof Error ? error.message : 'Unknown error';
      logger.error('Failed to list pipelines', { error: message });
      sendError(res, message, 500);
    }
  });

  // POST / — create pipeline
  router.post('/', async (req: Request, res: Response) => {
    try {
      const result = await pipeline.create(req.body);
      sendSuccess(res, result, 201);
    } catch (error: unknown) {
      if (error instanceof AlxCallLogError) {
        sendError(res, error.message, 400);
        return;
      }
      const message = error instanceof Error ? error.message : 'Unknown error';
      logger.error('Failed to create pipeline', { error: message });
      sendError(res, message, 500);
    }
  });

  // GET /:id — get pipeline
  router.get('/:id', async (req: Request, res: Response) => {
    try {
      const result = await pipeline.get(req.params['id']!);
      sendSuccess(res, result);
    } catch (error: unknown) {
      if (error instanceof AlxCallLogError) {
        sendError(res, error.message, 404);
        return;
      }
      const message = error instanceof Error ? error.message : 'Unknown error';
      logger.error('Failed to get pipeline', { id: req.params['id'], error: message });
      sendError(res, message, 500);
    }
  });

  // PUT /:id — update pipeline
  router.put('/:id', async (req: Request, res: Response) => {
    try {
      const result = await pipeline.update(req.params['id']!, req.body);
      sendSuccess(res, result);
    } catch (error: unknown) {
      if (error instanceof AlxCallLogError) {
        sendError(res, error.message, 400);
        return;
      }
      const message = error instanceof Error ? error.message : 'Unknown error';
      logger.error('Failed to update pipeline', { id: req.params['id'], error: message });
      sendError(res, message, 500);
    }
  });

  // DELETE /:id — delete pipeline
  router.delete('/:id', async (req: Request, res: Response) => {
    try {
      await pipeline.delete(req.params['id']!);
      sendSuccess(res, undefined);
    } catch (error: unknown) {
      if (error instanceof AlxCallLogError) {
        sendError(res, error.message, 400);
        return;
      }
      const message = error instanceof Error ? error.message : 'Unknown error';
      logger.error('Failed to delete pipeline', { id: req.params['id'], error: message });
      sendError(res, message, 500);
    }
  });

  // POST /:id/stages — add stage
  router.post('/:id/stages', async (req: Request, res: Response) => {
    try {
      const result = await pipeline.addStage(req.params['id']!, req.body);
      sendSuccess(res, result, 201);
    } catch (error: unknown) {
      if (error instanceof AlxCallLogError) {
        sendError(res, error.message, 400);
        return;
      }
      const message = error instanceof Error ? error.message : 'Unknown error';
      logger.error('Failed to add stage', { id: req.params['id'], error: message });
      sendError(res, message, 500);
    }
  });

  // PUT /:id/stages/reorder — reorder stages (must be BEFORE /:id/stages/:stageId)
  router.put('/:id/stages/reorder', async (req: Request, res: Response) => {
    try {
      const { stageIds } = req.body as { stageIds: string[] };
      const result = await pipeline.reorderStages(req.params['id']!, stageIds);
      sendSuccess(res, result);
    } catch (error: unknown) {
      if (error instanceof AlxCallLogError) {
        sendError(res, error.message, 400);
        return;
      }
      const message = error instanceof Error ? error.message : 'Unknown error';
      logger.error('Failed to reorder stages', { id: req.params['id'], error: message });
      sendError(res, message, 500);
    }
  });

  // PUT /:id/stages/:stageId — update stage
  router.put('/:id/stages/:stageId', async (req: Request, res: Response) => {
    try {
      const result = await pipeline.updateStage(req.params['id']!, req.params['stageId']!, req.body);
      sendSuccess(res, result);
    } catch (error: unknown) {
      if (error instanceof AlxCallLogError) {
        sendError(res, error.message, 400);
        return;
      }
      const message = error instanceof Error ? error.message : 'Unknown error';
      logger.error('Failed to update stage', { id: req.params['id'], stageId: req.params['stageId'], error: message });
      sendError(res, message, 500);
    }
  });

  // DELETE /:id/stages/:stageId — remove stage
  router.delete('/:id/stages/:stageId', async (req: Request, res: Response) => {
    try {
      await pipeline.removeStage(req.params['id']!, req.params['stageId']!);
      sendSuccess(res, undefined);
    } catch (error: unknown) {
      if (error instanceof AlxCallLogError) {
        sendError(res, error.message, 400);
        return;
      }
      const message = error instanceof Error ? error.message : 'Unknown error';
      logger.error('Failed to remove stage', { id: req.params['id'], stageId: req.params['stageId'], error: message });
      sendError(res, message, 500);
    }
  });

  return router;
}
