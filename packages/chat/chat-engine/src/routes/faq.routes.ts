import { Router } from 'express';
import type { Request, Response } from 'express';
import type { FAQService } from '../services/faq.service';
import { sendSuccess, sendError, getParam } from '@astralibx/core';
import type { LogAdapter } from '@astralibx/core';

export function createFAQRoutes(
  faqService: FAQService,
  logger: LogAdapter,
): Router {
  const router = Router();

  // GET /categories — must be before /:itemId
  router.get('/categories', async (_req: Request, res: Response) => {
    try {
      const categories = await faqService.getCategories();
      sendSuccess(res, { categories });
    } catch (error: unknown) {
      const message = error instanceof Error ? error.message : 'Unknown error';
      logger.error('Failed to get FAQ categories', { error });
      sendError(res, message, 500);
    }
  });

  // GET /
  router.get('/', async (req: Request, res: Response) => {
    try {
      const { category, search } = req.query;
      const items = await faqService.list({
        category: category as string | undefined,
        search: search as string | undefined,
      });
      sendSuccess(res, { items });
    } catch (error: unknown) {
      const message = error instanceof Error ? error.message : 'Unknown error';
      logger.error('Failed to list FAQ items', { error });
      sendError(res, message, 500);
    }
  });

  // POST /
  router.post('/', async (req: Request, res: Response) => {
    try {
      const { question, answer, category, tags, order, isActive, metadata } = req.body;
      if (!question || !answer) {
        return sendError(res, 'question and answer are required', 400);
      }
      const item = await faqService.create({ question, answer, category, tags, order, isActive, metadata });
      sendSuccess(res, { item }, 201);
    } catch (error: unknown) {
      const message = error instanceof Error ? error.message : 'Unknown error';
      logger.error('Failed to create FAQ item', { error });
      sendError(res, message, 500);
    }
  });

  // PUT /reorder — must be before /:itemId
  router.put('/reorder', async (req: Request, res: Response) => {
    try {
      const { items } = req.body;
      if (!Array.isArray(items)) {
        return sendError(res, 'items array is required', 400);
      }
      await faqService.reorder(items);
      sendSuccess(res, undefined);
    } catch (error: unknown) {
      const message = error instanceof Error ? error.message : 'Unknown error';
      logger.error('Failed to reorder FAQ items', { error });
      sendError(res, message, 500);
    }
  });

  // POST /import
  router.post('/import', async (req: Request, res: Response) => {
    try {
      const { items } = req.body;
      if (!Array.isArray(items)) {
        return sendError(res, 'items array is required', 400);
      }
      const created = await faqService.bulkImport(items);
      sendSuccess(res, { items: created, count: created.length }, 201);
    } catch (error: unknown) {
      const message = error instanceof Error ? error.message : 'Unknown error';
      logger.error('Failed to import FAQ items', { error });
      sendError(res, message, 500);
    }
  });

  // PUT /:itemId
  router.put('/:itemId', async (req: Request, res: Response) => {
    try {
      const item = await faqService.update(getParam(req, 'itemId'), req.body);
      if (!item) {
        return sendError(res, 'FAQ item not found', 404);
      }
      sendSuccess(res, { item });
    } catch (error: unknown) {
      const message = error instanceof Error ? error.message : 'Unknown error';
      logger.error('Failed to update FAQ item', { error });
      sendError(res, message, 500);
    }
  });

  // DELETE /:itemId
  router.delete('/:itemId', async (req: Request, res: Response) => {
    try {
      await faqService.remove(getParam(req, 'itemId'));
      sendSuccess(res, undefined);
    } catch (error: unknown) {
      const message = error instanceof Error ? error.message : 'Unknown error';
      logger.error('Failed to delete FAQ item', { error });
      sendError(res, message, 500);
    }
  });

  return router;
}
