import { Router } from 'express';
import type { Request, Response } from 'express';
import type { AgentService } from '../services/agent.service';
import { sendSuccess, sendError, getParam } from '@astralibx/core';
import type { LogAdapter } from '@astralibx/core';

export function createAgentRoutes(
  agentService: AgentService,
  logger: LogAdapter,
): Router {
  const router = Router();

  // GET /
  router.get('/', async (_req: Request, res: Response) => {
    try {
      const agents = await agentService.list();
      sendSuccess(res, { agents });
    } catch (error: unknown) {
      const message = error instanceof Error ? error.message : 'Unknown error';
      logger.error('Failed to list agents', { error });
      sendError(res, message, 500);
    }
  });

  // GET /:agentId
  router.get('/:agentId', async (req: Request, res: Response) => {
    try {
      const agent = await agentService.findById(getParam(req, 'agentId'));
      if (!agent) {
        return sendError(res, 'Agent not found', 404);
      }
      sendSuccess(res, { agent });
    } catch (error: unknown) {
      const message = error instanceof Error ? error.message : 'Unknown error';
      logger.error('Failed to get agent', { error });
      sendError(res, message, 500);
    }
  });

  // POST /
  router.post('/', async (req: Request, res: Response) => {
    try {
      const { name, avatar, role, isAI, aiConfig, promptTemplateId, maxConcurrentChats, metadata } = req.body;
      if (!name) {
        return sendError(res, 'name is required', 400);
      }
      const agent = await agentService.create({
        name, avatar, role, isAI, aiConfig, promptTemplateId, maxConcurrentChats, metadata,
      });
      sendSuccess(res, { agent }, 201);
    } catch (error: unknown) {
      const message = error instanceof Error ? error.message : 'Unknown error';
      logger.error('Failed to create agent', { error });
      sendError(res, message, 500);
    }
  });

  // PUT /:agentId
  router.put('/:agentId', async (req: Request, res: Response) => {
    try {
      const agent = await agentService.update(getParam(req, 'agentId'), req.body);
      sendSuccess(res, { agent });
    } catch (error: unknown) {
      const message = error instanceof Error ? error.message : 'Unknown error';
      const statusCode = (error as any).code === 'AGENT_NOT_FOUND' ? 404 : 500;
      logger.error('Failed to update agent', { error });
      sendError(res, message, statusCode);
    }
  });

  // DELETE /:agentId
  router.delete('/:agentId', async (req: Request, res: Response) => {
    try {
      await agentService.remove(getParam(req, 'agentId'));
      sendSuccess(res, undefined);
    } catch (error: unknown) {
      const message = error instanceof Error ? error.message : 'Unknown error';
      logger.error('Failed to delete agent', { error });
      sendError(res, message, 500);
    }
  });

  // POST /:agentId/toggle-active
  router.post('/:agentId/toggle-active', async (req: Request, res: Response) => {
    try {
      const agent = await agentService.toggleActive(getParam(req, 'agentId'));
      sendSuccess(res, { agent });
    } catch (error: unknown) {
      const message = error instanceof Error ? error.message : 'Unknown error';
      const statusCode = (error as any).code === 'AGENT_NOT_FOUND' ? 404 : 500;
      logger.error('Failed to toggle agent active', { error });
      sendError(res, message, statusCode);
    }
  });

  return router;
}
