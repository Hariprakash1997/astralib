import { Router } from 'express';
import type { Request, Response } from 'express';
import type { KnowledgeService } from '../services/knowledge.service.js';
import type { LogAdapter } from '@astralibx/core';
import { getParam, sendSuccess, sendError } from '@astralibx/core';

export function createKnowledgeRoutes(
  knowledgeService: KnowledgeService,
  logger: LogAdapter,
): Router {
  const router = Router();

  // GET /categories — must be before /:entryId
  router.get('/categories', async (_req: Request, res: Response) => {
    try {
      const categories = await knowledgeService.getCategories();
      sendSuccess(res, { categories });
    } catch (error: unknown) {
      const message = error instanceof Error ? error.message : 'Unknown error';
      logger.error('Failed to get knowledge categories', { error });
      sendError(res, message, 500);
    }
  });

  // GET /export
  router.get('/export', async (_req: Request, res: Response) => {
    try {
      const entries = await knowledgeService.export();
      sendSuccess(res, { entries });
    } catch (error: unknown) {
      const message = error instanceof Error ? error.message : 'Unknown error';
      logger.error('Failed to export knowledge entries', { error });
      sendError(res, message, 500);
    }
  });

  // GET /stats — entry statistics
  router.get('/stats', async (_req: Request, res: Response) => {
    try {
      const stats = await knowledgeService.getEntryStats();
      sendSuccess(res, { stats });
    } catch (error: unknown) {
      const message = error instanceof Error ? error.message : 'Unknown error';
      logger.error('Failed to get knowledge stats', { error });
      sendError(res, message, 500);
    }
  });

  // GET /
  router.get('/', async (req: Request, res: Response) => {
    try {
      const { category, search, isActive, page, limit } = req.query;
      const result = await knowledgeService.list({
        category: category as string | undefined,
        search: search as string | undefined,
        isActive: isActive !== undefined ? isActive === 'true' : undefined,
        page: page ? parseInt(page as string, 10) : undefined,
        limit: limit ? parseInt(limit as string, 10) : undefined,
      });
      sendSuccess(res, result);
    } catch (error: unknown) {
      const message = error instanceof Error ? error.message : 'Unknown error';
      logger.error('Failed to list knowledge entries', { error });
      sendError(res, message, 500);
    }
  });

  // POST /import
  router.post('/import', async (req: Request, res: Response) => {
    try {
      const { entries } = req.body;
      if (!Array.isArray(entries)) {
        return sendError(res, 'entries array is required', 400);
      }
      const result = await knowledgeService.import(entries);
      sendSuccess(res, result, 201);
    } catch (error: unknown) {
      const message = error instanceof Error ? error.message : 'Unknown error';
      logger.error('Failed to import knowledge entries', { error });
      sendError(res, message, 500);
    }
  });

  // POST /search — semantic or text search
  router.post('/search', async (req: Request, res: Response) => {
    try {
      const { query, limit, category } = req.body;
      if (!query) {
        return sendError(res, 'query is required', 400);
      }
      const entries = await knowledgeService.getRelevantKnowledge(query, { limit, category });
      sendSuccess(res, { entries });
    } catch (error: unknown) {
      const message = error instanceof Error ? error.message : 'Unknown error';
      logger.error('Failed to search knowledge', { error });
      sendError(res, message, 500);
    }
  });

  // POST /from-conversation — add knowledge from a conversation
  router.post('/from-conversation', async (req: Request, res: Response) => {
    try {
      const { sessionId, content, category } = req.body;
      if (!sessionId || !content) {
        return sendError(res, 'sessionId and content are required', 400);
      }
      const result = await knowledgeService.addFromConversation(sessionId, content, category);
      sendSuccess(res, result, 201);
    } catch (error: unknown) {
      const message = error instanceof Error ? error.message : 'Unknown error';
      logger.error('Failed to add knowledge from conversation', { error });
      sendError(res, message, 500);
    }
  });

  // POST /cleanup — generate staleness review report (does not delete)
  router.post('/cleanup', async (_req: Request, res: Response) => {
    try {
      const report = await knowledgeService.cleanupStaleEntries();
      sendSuccess(res, { report });
    } catch (error: unknown) {
      const message = error instanceof Error ? error.message : 'Unknown error';
      logger.error('Failed to generate cleanup report', { error });
      sendError(res, message, 500);
    }
  });

  // POST /cleanup/apply — apply cleanup (actually delete/merge based on report)
  router.post('/cleanup/apply', async (req: Request, res: Response) => {
    try {
      const { deleteIds, mergeInstructions } = req.body;
      if (!Array.isArray(deleteIds)) {
        return sendError(res, 'deleteIds array is required', 400);
      }
      const result = await knowledgeService.applyCleanup(deleteIds, mergeInstructions);
      sendSuccess(res, result);
    } catch (error: unknown) {
      const message = error instanceof Error ? error.message : 'Unknown error';
      logger.error('Failed to apply cleanup', { error });
      sendError(res, message, 500);
    }
  });

  // DELETE /bulk
  router.delete('/bulk', async (req: Request, res: Response) => {
    try {
      const { ids } = req.body;
      if (!Array.isArray(ids)) {
        return sendError(res, 'ids array is required', 400);
      }
      const result = await knowledgeService.bulkDelete(ids);
      sendSuccess(res, result);
    } catch (error: unknown) {
      const message = error instanceof Error ? error.message : 'Unknown error';
      logger.error('Failed to bulk delete knowledge entries', { error });
      sendError(res, message, 500);
    }
  });

  // GET /:entryId
  router.get('/:entryId', async (req: Request, res: Response) => {
    try {
      const entry = await knowledgeService.findById(getParam(req, 'entryId'));
      if (!entry) {
        return sendError(res, 'Knowledge entry not found', 404);
      }
      sendSuccess(res, { entry });
    } catch (error: unknown) {
      const message = error instanceof Error ? error.message : 'Unknown error';
      logger.error('Failed to get knowledge entry', { error });
      sendError(res, message, 500);
    }
  });

  // POST / — add knowledge (pre-feed document) with dedup
  router.post('/', async (req: Request, res: Response) => {
    try {
      const { title, content, category, tags, isActive, priority, metadata, createdBy } = req.body;
      if (!title || !content) {
        return sendError(res, 'title and content are required', 400);
      }
      const entry = await knowledgeService.create({
        title, content, category, tags, isActive, priority, metadata, createdBy,
      });
      sendSuccess(res, { entry }, 201);
    } catch (error: unknown) {
      const message = error instanceof Error ? error.message : 'Unknown error';
      logger.error('Failed to create knowledge entry', { error });
      sendError(res, message, 500);
    }
  });

  // PUT /:entryId
  router.put('/:entryId', async (req: Request, res: Response) => {
    try {
      const entry = await knowledgeService.update(getParam(req, 'entryId'), req.body);
      sendSuccess(res, { entry });
    } catch (error: unknown) {
      const message = error instanceof Error ? error.message : 'Unknown error';
      logger.error('Failed to update knowledge entry', { error });
      if (message.includes('not found')) {
        return sendError(res, message, 404);
      }
      sendError(res, message, 500);
    }
  });

  // DELETE /:entryId
  router.delete('/:entryId', async (req: Request, res: Response) => {
    try {
      await knowledgeService.delete(getParam(req, 'entryId'));
      sendSuccess(res, undefined);
    } catch (error: unknown) {
      const message = error instanceof Error ? error.message : 'Unknown error';
      logger.error('Failed to delete knowledge entry', { error });
      if (message.includes('not found')) {
        return sendError(res, message, 404);
      }
      sendError(res, message, 500);
    }
  });

  return router;
}
