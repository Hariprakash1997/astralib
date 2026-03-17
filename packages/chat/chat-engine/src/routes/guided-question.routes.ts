import { Router } from 'express';
import type { Request, Response } from 'express';
import type { GuidedQuestionService } from '../services/guided-question.service';
import { sendSuccess, sendError, getParam } from '@astralibx/core';
import type { LogAdapter } from '@astralibx/core';

export function createGuidedQuestionRoutes(
  guidedQuestionService: GuidedQuestionService,
  logger: LogAdapter,
): Router {
  const router = Router();

  // GET /
  router.get('/', async (_req: Request, res: Response) => {
    try {
      const questions = await guidedQuestionService.list();
      sendSuccess(res, { questions });
    } catch (error: unknown) {
      const message = error instanceof Error ? error.message : 'Unknown error';
      logger.error('Failed to list guided questions', { error });
      sendError(res, message, 500);
    }
  });

  // POST /
  router.post('/', async (req: Request, res: Response) => {
    try {
      const { key, text, options, allowFreeText, multiSelect, order, isActive, metadata } = req.body;
      if (!key || !text) {
        return sendError(res, 'key and text are required', 400);
      }
      const question = await guidedQuestionService.create({
        key, text, options, allowFreeText, multiSelect, order, isActive, metadata,
      });
      sendSuccess(res, { question }, 201);
    } catch (error: unknown) {
      const message = error instanceof Error ? error.message : 'Unknown error';
      logger.error('Failed to create guided question', { error });
      sendError(res, message, 500);
    }
  });

  // PUT /reorder — must be before /:questionId
  router.put('/reorder', async (req: Request, res: Response) => {
    try {
      const { items } = req.body;
      if (!Array.isArray(items)) {
        return sendError(res, 'items array is required', 400);
      }
      await guidedQuestionService.reorder(items);
      sendSuccess(res, undefined);
    } catch (error: unknown) {
      const message = error instanceof Error ? error.message : 'Unknown error';
      logger.error('Failed to reorder guided questions', { error });
      sendError(res, message, 500);
    }
  });

  // PUT /:questionId
  router.put('/:questionId', async (req: Request, res: Response) => {
    try {
      const question = await guidedQuestionService.update(getParam(req, 'questionId'), req.body);
      if (!question) {
        return sendError(res, 'Guided question not found', 404);
      }
      sendSuccess(res, { question });
    } catch (error: unknown) {
      const message = error instanceof Error ? error.message : 'Unknown error';
      logger.error('Failed to update guided question', { error });
      sendError(res, message, 500);
    }
  });

  // DELETE /:questionId
  router.delete('/:questionId', async (req: Request, res: Response) => {
    try {
      await guidedQuestionService.remove(getParam(req, 'questionId'));
      sendSuccess(res, undefined);
    } catch (error: unknown) {
      const message = error instanceof Error ? error.message : 'Unknown error';
      logger.error('Failed to delete guided question', { error });
      sendError(res, message, 500);
    }
  });

  return router;
}
