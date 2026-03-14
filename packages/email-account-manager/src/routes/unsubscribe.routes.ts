import { Router } from 'express';
import type { createUnsubscribeController } from '../controllers/unsubscribe.controller';

export function createUnsubscribeRoutes(
  controller: ReturnType<typeof createUnsubscribeController>,
): Router {
  const router = Router();

  router.get('/', controller.handleGet);
  router.post('/', controller.handlePost);

  return router;
}
