import { Router } from 'express';
import type { Request, Response } from 'express';
import { sendSuccess, sendError, getParam } from '@astralibx/core';
import type { LogAdapter } from '@astralibx/core';
import type { WebhookService } from '../services/webhook.service';
import { WEBHOOK_EVENT } from '../constants/index.js';

const VALID_EVENTS = Object.values(WEBHOOK_EVENT);

export function createWebhookRoutes(
  webhookService: WebhookService,
  logger: LogAdapter,
): Router {
  const router = Router();

  // GET / — list all webhooks
  router.get('/', async (_req: Request, res: Response) => {
    try {
      const webhooks = await webhookService.list();
      sendSuccess(res, { webhooks });
    } catch (error: unknown) {
      const message = error instanceof Error ? error.message : 'Unknown error';
      logger.error('Failed to list webhooks', { error });
      sendError(res, message, 500);
    }
  });

  // POST / — register a webhook
  router.post('/', async (req: Request, res: Response) => {
    try {
      const { url, events, secret, description } = req.body;

      if (!url || typeof url !== 'string') {
        return sendError(res, 'url is required and must be a string', 400);
      }
      if (!events || !Array.isArray(events) || events.length === 0) {
        return sendError(res, 'events is required and must be a non-empty array', 400);
      }

      const invalidEvents = events.filter((e: string) => !VALID_EVENTS.includes(e as any));
      if (invalidEvents.length > 0) {
        return sendError(res, `Invalid events: ${invalidEvents.join(', ')}. Valid events: ${VALID_EVENTS.join(', ')}`, 400);
      }

      const webhook = await webhookService.register(url, events, secret, description);
      sendSuccess(res, { webhook });
    } catch (error: unknown) {
      const message = error instanceof Error ? error.message : 'Unknown error';
      logger.error('Failed to register webhook', { error });
      sendError(res, message, 500);
    }
  });

  // PUT /:id — update a webhook
  router.put('/:id', async (req: Request, res: Response) => {
    try {
      const webhookId = getParam(req, 'id');
      const { url, events, secret, isActive, description } = req.body;

      if (events && Array.isArray(events)) {
        const invalidEvents = events.filter((e: string) => !VALID_EVENTS.includes(e as any));
        if (invalidEvents.length > 0) {
          return sendError(res, `Invalid events: ${invalidEvents.join(', ')}`, 400);
        }
      }

      const webhook = await webhookService.update(webhookId, {
        url,
        events,
        secret,
        isActive,
        description,
      });
      sendSuccess(res, { webhook });
    } catch (error: unknown) {
      const message = error instanceof Error ? error.message : 'Unknown error';
      const statusCode = message.includes('not found') ? 404 : 500;
      logger.error('Failed to update webhook', { error });
      sendError(res, message, statusCode);
    }
  });

  // DELETE /:id — remove a webhook
  router.delete('/:id', async (req: Request, res: Response) => {
    try {
      const webhookId = getParam(req, 'id');
      await webhookService.remove(webhookId);
      sendSuccess(res, undefined);
    } catch (error: unknown) {
      const message = error instanceof Error ? error.message : 'Unknown error';
      const statusCode = message.includes('not found') ? 404 : 500;
      logger.error('Failed to remove webhook', { error });
      sendError(res, message, statusCode);
    }
  });

  // POST /retry — retry failed deliveries
  router.post('/retry', async (_req: Request, res: Response) => {
    try {
      const retried = await webhookService.retryFailedWebhooks();
      sendSuccess(res, { retried });
    } catch (error: unknown) {
      const message = error instanceof Error ? error.message : 'Unknown error';
      logger.error('Failed to retry webhooks', { error });
      sendError(res, message, 500);
    }
  });

  return router;
}
