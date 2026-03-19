import { Router } from 'express';
import type { Request, Response } from 'express';
import type { SettingsService } from '../services/settings.service';
import { sendSuccess, sendError } from '@astralibx/core';
import type { LogAdapter } from '@astralibx/core';
import { InvalidConfigError } from '../errors/index.js';

export interface SettingsRouteOptions {
  hasAiAdapter?: boolean;
}

export function createSettingsRoutes(
  settingsService: SettingsService,
  logger: LogAdapter,
  routeOptions?: SettingsRouteOptions,
): Router {
  const router = Router();

  // GET /
  router.get('/', async (_req: Request, res: Response) => {
    try {
      const settings = await settingsService.get();
      sendSuccess(res, { settings });
    } catch (error: unknown) {
      const message = error instanceof Error ? error.message : 'Unknown error';
      logger.error('Failed to get settings', { error });
      sendError(res, message, 500);
    }
  });

  // PUT /
  router.put('/', async (req: Request, res: Response) => {
    try {
      const settings = await settingsService.update(req.body);
      sendSuccess(res, { settings });
    } catch (error: unknown) {
      const message = error instanceof Error ? error.message : 'Unknown error';
      logger.error('Failed to update settings', { error });
      sendError(res, message, 500);
    }
  });

  // GET /chat-mode
  router.get('/chat-mode', async (_req: Request, res: Response) => {
    try {
      const settings = await settingsService.get();
      sendSuccess(res, { chatMode: settings.chatMode });
    } catch (error: unknown) {
      const message = error instanceof Error ? error.message : 'Unknown error';
      logger.error('Failed to get chat mode', { error });
      sendError(res, message, 500);
    }
  });

  // PUT /chat-mode
  router.put('/chat-mode', async (req: Request, res: Response) => {
    try {
      const { chatMode } = req.body;
      if (!chatMode) {
        return sendError(res, 'chatMode is required', 400);
      }
      const settings = await settingsService.update({ chatMode });
      sendSuccess(res, { chatMode: settings.chatMode });
    } catch (error: unknown) {
      if (error instanceof InvalidConfigError) {
        sendError(res, error.message, 400);
        return;
      }
      const message = error instanceof Error ? error.message : 'Unknown error';
      logger.error('Failed to update chat mode', { error });
      sendError(res, message, 500);
    }
  });

  // GET /available-tags
  router.get('/available-tags', async (_req: Request, res: Response) => {
    try {
      const settings = await settingsService.get();
      sendSuccess(res, { availableTags: settings.availableTags });
    } catch (error: unknown) {
      const message = error instanceof Error ? error.message : 'Unknown error';
      logger.error('Failed to get available tags', { error });
      sendError(res, message, 500);
    }
  });

  // PUT /available-tags
  router.put('/available-tags', async (req: Request, res: Response) => {
    try {
      const { availableTags } = req.body;
      if (!Array.isArray(availableTags)) {
        return sendError(res, 'availableTags must be an array of strings', 400);
      }
      const settings = await settingsService.update({ availableTags });
      sendSuccess(res, { availableTags: settings.availableTags });
    } catch (error: unknown) {
      if (error instanceof InvalidConfigError) {
        sendError(res, error.message, 400);
        return;
      }
      const message = error instanceof Error ? error.message : 'Unknown error';
      logger.error('Failed to update available tags', { error });
      sendError(res, message, 500);
    }
  });

  // GET /business-hours
  router.get('/business-hours', async (_req: Request, res: Response) => {
    try {
      const { isOpen, businessHours } = await settingsService.isWithinBusinessHours();
      sendSuccess(res, { isOpen, businessHours });
    } catch (error: unknown) {
      const message = error instanceof Error ? error.message : 'Unknown error';
      logger.error('Failed to get business hours', { error });
      sendError(res, message, 500);
    }
  });

  // PUT /business-hours
  router.put('/business-hours', async (req: Request, res: Response) => {
    try {
      const businessHours = await settingsService.updateBusinessHours(req.body);
      sendSuccess(res, { businessHours });
    } catch (error: unknown) {
      if (error instanceof InvalidConfigError) {
        sendError(res, error.message, 400);
        return;
      }
      const message = error instanceof Error ? error.message : 'Unknown error';
      logger.error('Failed to update business hours', { error });
      sendError(res, message, 500);
    }
  });

  // GET /ai
  router.get('/ai', async (_req: Request, res: Response) => {
    try {
      const aiSettings = await settingsService.getAiSettings();
      sendSuccess(res, aiSettings);
    } catch (error: unknown) {
      const message = error instanceof Error ? error.message : 'Unknown error';
      logger.error('Failed to get AI settings', { error });
      sendError(res, message, 500);
    }
  });

  // PUT /ai
  router.put('/ai', async (req: Request, res: Response) => {
    try {
      const aiSettings = await settingsService.updateAiSettings(req.body, {
        hasAiAdapter: routeOptions?.hasAiAdapter ?? false,
      });
      sendSuccess(res, aiSettings);
    } catch (error: unknown) {
      if (error instanceof InvalidConfigError) {
        sendError(res, error.message, 400);
        return;
      }
      const message = error instanceof Error ? error.message : 'Unknown error';
      logger.error('Failed to update AI settings', { error });
      sendError(res, message, 500);
    }
  });

  // GET /rating
  router.get('/rating', async (_req: Request, res: Response) => {
    try {
      const ratingConfig = await settingsService.getRatingConfig();
      sendSuccess(res, { ratingConfig });
    } catch (error: unknown) {
      const message = error instanceof Error ? error.message : 'Unknown error';
      logger.error('Failed to get rating config', { error });
      sendError(res, message, 500);
    }
  });

  // PUT /rating
  router.put('/rating', async (req: Request, res: Response) => {
    try {
      const ratingConfig = await settingsService.updateRatingConfig(req.body);
      sendSuccess(res, { ratingConfig });
    } catch (error: unknown) {
      if (error instanceof InvalidConfigError) {
        sendError(res, error.message, 400);
        return;
      }
      const message = error instanceof Error ? error.message : 'Unknown error';
      logger.error('Failed to update rating config', { error });
      sendError(res, message, 500);
    }
  });

  return router;
}
