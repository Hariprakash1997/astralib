import { Router } from 'express';
import type { Request, Response } from 'express';
import type { AgentService } from '../services/agent.service';
import { sendSuccess, sendError, getParam } from '@astralibx/core';
import type { LogAdapter } from '@astralibx/core';

function isValidImage(buffer: Buffer): boolean {
  if (buffer.length < 4) return false;
  // JPEG: FF D8 FF
  if (buffer[0] === 0xFF && buffer[1] === 0xD8 && buffer[2] === 0xFF) return true;
  // PNG: 89 50 4E 47
  if (buffer[0] === 0x89 && buffer[1] === 0x50 && buffer[2] === 0x4E && buffer[3] === 0x47) return true;
  // GIF: 47 49 46
  if (buffer[0] === 0x47 && buffer[1] === 0x49 && buffer[2] === 0x46) return true;
  // WebP: 52 49 46 46 ... 57 45 42 50
  if (buffer[0] === 0x52 && buffer[1] === 0x49 && buffer[2] === 0x46 && buffer[3] === 0x46 &&
      buffer.length > 11 && buffer[8] === 0x57 && buffer[9] === 0x45 && buffer[10] === 0x42 && buffer[11] === 0x50) return true;
  return false;
}

export interface AgentRouteOptions {
  uploadFile?: (file: { buffer: Buffer; mimetype: string; originalname: string }) => Promise<string>;
  maxUploadSizeMb?: number;
}

export function createAgentRoutes(
  agentService: AgentService,
  logger: LogAdapter,
  options?: AgentRouteOptions,
): Router {
  const router = Router();
  const uploadFile = options?.uploadFile;
  const maxUploadSizeMb = options?.maxUploadSizeMb ?? 5;

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

  // POST /:agentId/avatar — upload avatar image (base64 JSON body)
  router.post('/:agentId/avatar', async (req: Request, res: Response) => {
    try {
      if (!uploadFile) {
        return sendError(res, 'File upload not configured', 404);
      }

      const { data, mimetype, filename } = req.body;

      if (!data || !mimetype) {
        return sendError(res, 'Missing data or mimetype', 400);
      }

      const allowedMimes = ['image/jpeg', 'image/png', 'image/webp', 'image/gif'];
      if (!allowedMimes.includes(mimetype)) {
        return sendError(res, `Invalid file type. Allowed: ${allowedMimes.join(', ')}`, 400);
      }

      const buffer = Buffer.from(data, 'base64');
      const maxBytes = maxUploadSizeMb * 1024 * 1024;
      if (buffer.length > maxBytes) {
        return sendError(res, `File too large. Max: ${maxUploadSizeMb}MB`, 400);
      }

      if (!isValidImage(buffer)) {
        return sendError(res, 'File content does not match a valid image format', 400);
      }

      const safeName = (filename || 'avatar').replace(/[^a-zA-Z0-9._-]/g, '_').slice(0, 100);

      const url = await uploadFile({ buffer, mimetype, originalname: safeName });

      const agentId = getParam(req, 'agentId');
      await agentService.update(agentId, { avatar: url });

      sendSuccess(res, { url });
    } catch (error: unknown) {
      logger.error('Avatar upload failed', { error });
      sendError(res, error instanceof Error ? error.message : 'Upload failed', 500);
    }
  });

  return router;
}
