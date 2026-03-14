import { Router, text, json } from 'express';
import type { SesWebhookHandler } from '../services/ses-webhook-handler';

export function createSesWebhookRoutes(handler: SesWebhookHandler): Router {
  const router = Router();

  router.use(text({ type: '*/*' }));
  router.use(json({ type: 'application/json' }));

  router.post('/', async (req, res) => {
    try {
      const body = typeof req.body === 'string' ? JSON.parse(req.body) : req.body;
      const result = await handler.handleSnsMessage(body);
      res.json({ success: true, ...result });
    } catch (error: unknown) {
      const message = error instanceof Error ? error.message : 'Unknown error';
      const status = message.includes('signature') ? 403 : 500;
      res.status(status).json({ success: false, error: message });
    }
  });

  return router;
}
