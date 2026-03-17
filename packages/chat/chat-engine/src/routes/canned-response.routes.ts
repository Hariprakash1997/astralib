import { Router } from 'express';
import type { Request, Response } from 'express';
import type { CannedResponseService } from '../services/canned-response.service';
import { sendSuccess, sendError, getParam } from '@astralibx/core';
import type { LogAdapter } from '@astralibx/core';

export function createCannedResponseRoutes(
  cannedResponseService: CannedResponseService,
  logger: LogAdapter,
): Router {
  const router = Router();

  // GET /
  router.get('/', async (req: Request, res: Response) => {
    try {
      const { category, search } = req.query;
      const responses = await cannedResponseService.list({
        category: category as string | undefined,
        search: search as string | undefined,
      });
      sendSuccess(res, { responses });
    } catch (error: unknown) {
      const message = error instanceof Error ? error.message : 'Unknown error';
      logger.error('Failed to list canned responses', { error });
      sendError(res, message, 500);
    }
  });

  // POST /
  router.post('/', async (req: Request, res: Response) => {
    try {
      const { title, content, category, shortcut, isActive, order, createdBy } = req.body;
      if (!title || !content) {
        return sendError(res, 'title and content are required', 400);
      }
      const response = await cannedResponseService.create({
        title, content, category, shortcut, isActive, order, createdBy,
      });
      sendSuccess(res, { response }, 201);
    } catch (error: unknown) {
      const message = error instanceof Error ? error.message : 'Unknown error';
      logger.error('Failed to create canned response', { error });
      sendError(res, message, 500);
    }
  });

  // PUT /:id
  router.put('/:id', async (req: Request, res: Response) => {
    try {
      const response = await cannedResponseService.update(getParam(req, 'id'), req.body);
      if (!response) {
        return sendError(res, 'Canned response not found', 404);
      }
      sendSuccess(res, { response });
    } catch (error: unknown) {
      const message = error instanceof Error ? error.message : 'Unknown error';
      logger.error('Failed to update canned response', { error });
      sendError(res, message, 500);
    }
  });

  // DELETE /:id
  router.delete('/:id', async (req: Request, res: Response) => {
    try {
      await cannedResponseService.remove(getParam(req, 'id'));
      sendSuccess(res, undefined);
    } catch (error: unknown) {
      const message = error instanceof Error ? error.message : 'Unknown error';
      logger.error('Failed to delete canned response', { error });
      sendError(res, message, 500);
    }
  });

  return router;
}
