import { Router } from 'express';
import type { Request, Response } from 'express';
import type { PromptService } from '../services/prompt.service';
import type { PromptBuilderService } from '../services/prompt-builder.service';
import type { LogAdapter } from '@astralibx/core';
import { getParam, sendSuccess, sendError } from '@astralibx/core';

export function createPromptRoutes(
  promptService: PromptService,
  promptBuilder: PromptBuilderService,
  logger: LogAdapter,
): Router {
  const router = Router();

  // GET /
  router.get('/', async (req: Request, res: Response) => {
    try {
      const { isActive, search } = req.query;
      const templates = await promptService.list({
        isActive: isActive !== undefined ? isActive === 'true' : undefined,
        search: search as string | undefined,
      });
      sendSuccess(res, { templates });
    } catch (error: unknown) {
      const message = error instanceof Error ? error.message : 'Unknown error';
      logger.error('Failed to list prompt templates', { error });
      sendError(res, message, 500);
    }
  });

  // POST /preview — must be before /:templateId
  router.post('/preview', async (req: Request, res: Response) => {
    try {
      const { templateId, context } = req.body;
      if (!context) {
        return sendError(res, 'context is required', 400);
      }
      const result = await promptBuilder.buildPrompt({ templateId, context });
      sendSuccess(res, result);
    } catch (error: unknown) {
      const message = error instanceof Error ? error.message : 'Unknown error';
      logger.error('Failed to preview prompt', { error });
      sendError(res, message, 500);
    }
  });

  // POST /
  router.post('/', async (req: Request, res: Response) => {
    try {
      const { name, description, isDefault, isActive, sections, responseFormat, temperature, maxTokens, metadata, createdBy } = req.body;
      if (!name) {
        return sendError(res, 'name is required', 400);
      }
      const template = await promptService.create({
        name, description, isDefault, isActive, sections, responseFormat, temperature, maxTokens, metadata, createdBy,
      });
      sendSuccess(res, { template }, 201);
    } catch (error: unknown) {
      const message = error instanceof Error ? error.message : 'Unknown error';
      logger.error('Failed to create prompt template', { error });
      sendError(res, message, 500);
    }
  });

  // POST /:templateId/default
  router.post('/:templateId/default', async (req: Request, res: Response) => {
    try {
      await promptService.setDefault(getParam(req, 'templateId'));
      sendSuccess(res, undefined);
    } catch (error: unknown) {
      const message = error instanceof Error ? error.message : 'Unknown error';
      logger.error('Failed to set default prompt template', { error });
      if (message.includes('not found')) {
        return sendError(res, message, 404);
      }
      sendError(res, message, 500);
    }
  });

  // GET /:templateId
  router.get('/:templateId', async (req: Request, res: Response) => {
    try {
      const template = await promptService.findById(getParam(req, 'templateId'));
      if (!template) {
        return sendError(res, 'Prompt template not found', 404);
      }
      sendSuccess(res, { template });
    } catch (error: unknown) {
      const message = error instanceof Error ? error.message : 'Unknown error';
      logger.error('Failed to get prompt template', { error });
      sendError(res, message, 500);
    }
  });

  // PUT /:templateId
  router.put('/:templateId', async (req: Request, res: Response) => {
    try {
      const template = await promptService.update(getParam(req, 'templateId'), req.body);
      sendSuccess(res, { template });
    } catch (error: unknown) {
      const message = error instanceof Error ? error.message : 'Unknown error';
      logger.error('Failed to update prompt template', { error });
      if (message.includes('not found')) {
        return sendError(res, message, 404);
      }
      sendError(res, message, 500);
    }
  });

  // DELETE /:templateId
  router.delete('/:templateId', async (req: Request, res: Response) => {
    try {
      await promptService.delete(getParam(req, 'templateId'));
      sendSuccess(res, undefined);
    } catch (error: unknown) {
      const message = error instanceof Error ? error.message : 'Unknown error';
      logger.error('Failed to delete prompt template', { error });
      if (message.includes('not found')) {
        return sendError(res, message, 404);
      }
      sendError(res, message, 500);
    }
  });

  return router;
}
