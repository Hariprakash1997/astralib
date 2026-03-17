import { Router } from 'express';
import type { createBotController } from '../controllers/bot.controller';
import type { LogAdapter } from '../types/config.types';

export interface TelegramBotRouteDeps {
  botController: ReturnType<typeof createBotController>;
  logger?: LogAdapter;
}

export function createRoutes(deps: TelegramBotRouteDeps): Router {
  const router = Router();
  const { botController } = deps;

  router.get('/status', botController.getStatus);
  router.get('/stats', botController.getStats);
  router.get('/users', botController.getUsers);
  router.get('/users/:userId', botController.getUser);

  return router;
}
