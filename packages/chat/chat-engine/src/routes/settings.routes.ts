import { Router } from 'express';
import type { Request, Response } from 'express';
import type { SettingsService } from '../services/settings.service';
import { sendSuccess, sendError } from '@astralibx/core';
import type { LogAdapter } from '@astralibx/core';

export function createSettingsRoutes(
  settingsService: SettingsService,
  logger: LogAdapter,
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

  return router;
}
