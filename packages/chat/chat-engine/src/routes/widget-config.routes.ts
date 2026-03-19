import { Router } from 'express';
import type { Request, Response, RequestHandler } from 'express';
import type { WidgetConfigService } from '../services/widget-config.service';
import type { SettingsService } from '../services/settings.service';
import { sendSuccess, sendError } from '@astralibx/core';
import type { LogAdapter } from '@astralibx/core';

export function createWidgetConfigRoutes(
  widgetConfigService: WidgetConfigService,
  logger: LogAdapter,
  authMiddleware?: RequestHandler,
  settingsService?: SettingsService,
): Router {
  const router = Router();

  // GET / — public (no auth), widget fetches config at runtime
  router.get('/', async (_req: Request, res: Response) => {
    try {
      const config = await widgetConfigService.get();

      // Include business hours status if settings service is available
      let businessHoursStatus: { isOpen: boolean; outsideHoursMessage?: string; outsideHoursBehavior?: string } | undefined;
      if (settingsService) {
        const { isOpen, businessHours } = await settingsService.isWithinBusinessHours();
        businessHoursStatus = {
          isOpen,
          outsideHoursMessage: businessHours.outsideHoursMessage,
          outsideHoursBehavior: businessHours.outsideHoursBehavior,
        };
      }

      sendSuccess(res, { config, businessHoursStatus });
    } catch (error: unknown) {
      const message = error instanceof Error ? error.message : 'Unknown error';
      logger.error('Failed to get widget config', { error });
      sendError(res, message, 500);
    }
  });

  // PUT / — protected (admin only)
  const putHandlers: RequestHandler[] = [];
  if (authMiddleware) {
    putHandlers.push(authMiddleware);
  }
  putHandlers.push(async (req: Request, res: Response) => {
    try {
      const config = await widgetConfigService.update(req.body);
      sendSuccess(res, { config });
    } catch (error: unknown) {
      const message = error instanceof Error ? error.message : 'Unknown error';
      logger.error('Failed to update widget config', { error });
      sendError(res, message, 500);
    }
  });
  router.put('/', ...putHandlers);

  return router;
}
