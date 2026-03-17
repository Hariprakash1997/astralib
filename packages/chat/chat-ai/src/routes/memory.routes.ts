import { Router } from 'express';
import type { Request, Response } from 'express';
import type { MemoryService } from '../services/memory.service';
import type { LogAdapter } from '@astralibx/core';
import { getParam, sendSuccess, sendError } from '@astralibx/core';
import type { MemoryScope, MemorySource } from '../types/memory.types';

export function createMemoryRoutes(
  memoryService: MemoryService,
  logger: LogAdapter,
): Router {
  const router = Router();

  // GET /categories — must be before /:memoryId
  router.get('/categories', async (_req: Request, res: Response) => {
    try {
      const categories = await memoryService.getCategories();
      sendSuccess(res, { categories });
    } catch (error: unknown) {
      const message = error instanceof Error ? error.message : 'Unknown error';
      logger.error('Failed to get memory categories', { error });
      sendError(res, message, 500);
    }
  });

  // GET /export
  router.get('/export', async (req: Request, res: Response) => {
    try {
      const { scope, category, source } = req.query;
      const memories = await memoryService.export({
        scope: scope as MemoryScope | undefined,
        category: category as string | undefined,
        source: source as MemorySource | undefined,
      });
      sendSuccess(res, { memories });
    } catch (error: unknown) {
      const message = error instanceof Error ? error.message : 'Unknown error';
      logger.error('Failed to export memories', { error });
      sendError(res, message, 500);
    }
  });

  // GET /visitor/:visitorId
  router.get('/visitor/:visitorId', async (req: Request, res: Response) => {
    try {
      const memories = await memoryService.listByVisitor(getParam(req, 'visitorId'));
      sendSuccess(res, { memories });
    } catch (error: unknown) {
      const message = error instanceof Error ? error.message : 'Unknown error';
      logger.error('Failed to get visitor memories', { error });
      sendError(res, message, 500);
    }
  });

  // GET /
  router.get('/', async (req: Request, res: Response) => {
    try {
      const { scope, scopeId, category, source, search, isActive, page, limit } = req.query;
      const result = await memoryService.list({
        scope: scope as MemoryScope | undefined,
        scopeId: scopeId as string | undefined,
        category: category as string | undefined,
        source: source as MemorySource | undefined,
        search: search as string | undefined,
        isActive: isActive !== undefined ? isActive === 'true' : undefined,
        page: page ? parseInt(page as string, 10) : undefined,
        limit: limit ? parseInt(limit as string, 10) : undefined,
      });
      sendSuccess(res, result);
    } catch (error: unknown) {
      const message = error instanceof Error ? error.message : 'Unknown error';
      logger.error('Failed to list memories', { error });
      sendError(res, message, 500);
    }
  });

  // POST /import
  router.post('/import', async (req: Request, res: Response) => {
    try {
      const { memories } = req.body;
      if (!Array.isArray(memories)) {
        return sendError(res, 'memories array is required', 400);
      }
      const result = await memoryService.import(memories);
      sendSuccess(res, result, 201);
    } catch (error: unknown) {
      const message = error instanceof Error ? error.message : 'Unknown error';
      logger.error('Failed to import memories', { error });
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
      const result = await memoryService.bulkDelete(ids);
      sendSuccess(res, result);
    } catch (error: unknown) {
      const message = error instanceof Error ? error.message : 'Unknown error';
      logger.error('Failed to bulk delete memories', { error });
      sendError(res, message, 500);
    }
  });

  // GET /:memoryId
  router.get('/:memoryId', async (req: Request, res: Response) => {
    try {
      const memory = await memoryService.findById(getParam(req, 'memoryId'));
      if (!memory) {
        return sendError(res, 'Memory not found', 404);
      }
      sendSuccess(res, { memory });
    } catch (error: unknown) {
      const message = error instanceof Error ? error.message : 'Unknown error';
      logger.error('Failed to get memory', { error });
      sendError(res, message, 500);
    }
  });

  // POST /
  router.post('/', async (req: Request, res: Response) => {
    try {
      const { scope, scopeId, key, content, category, tags, priority, isActive, source, metadata, createdBy } = req.body;
      if (!scope || !key || !content) {
        return sendError(res, 'scope, key, and content are required', 400);
      }
      const memory = await memoryService.create({
        scope, scopeId, key, content, category, tags, priority, isActive, source, metadata, createdBy,
      });
      sendSuccess(res, { memory }, 201);
    } catch (error: unknown) {
      const message = error instanceof Error ? error.message : 'Unknown error';
      logger.error('Failed to create memory', { error });
      sendError(res, message, 500);
    }
  });

  // PUT /:memoryId
  router.put('/:memoryId', async (req: Request, res: Response) => {
    try {
      const memory = await memoryService.update(getParam(req, 'memoryId'), req.body);
      sendSuccess(res, { memory });
    } catch (error: unknown) {
      const message = error instanceof Error ? error.message : 'Unknown error';
      logger.error('Failed to update memory', { error });
      if (message.includes('not found')) {
        return sendError(res, message, 404);
      }
      sendError(res, message, 500);
    }
  });

  // DELETE /:memoryId
  router.delete('/:memoryId', async (req: Request, res: Response) => {
    try {
      await memoryService.delete(getParam(req, 'memoryId'));
      sendSuccess(res, undefined);
    } catch (error: unknown) {
      const message = error instanceof Error ? error.message : 'Unknown error';
      logger.error('Failed to delete memory', { error });
      if (message.includes('not found')) {
        return sendError(res, message, 404);
      }
      sendError(res, message, 500);
    }
  });

  return router;
}
