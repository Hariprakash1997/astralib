import type { Request, Response } from 'express';
import type { UnsubscribeService } from '../services/unsubscribe.service';

export function createUnsubscribeController(unsubscribeService: UnsubscribeService) {
  return {
    async handleGet(req: Request, res: Response) {
      try {
        const token = req.query.token as string;

        if (!token) {
          const html = unsubscribeService.getConfirmationHtml('', false);
          return res.status(400).type('html').send(html);
        }

        const result = await unsubscribeService.handleUnsubscribe('', token);
        const html = unsubscribeService.getConfirmationHtml(result.email || '', result.success);
        res.status(200).type('html').send(html);
      } catch {
        const html = unsubscribeService.getConfirmationHtml('', false);
        res.status(500).type('html').send(html);
      }
    },

    async handlePost(req: Request, res: Response) {
      try {
        const token = (req.query.token || req.body?.token) as string;

        if (!token) {
          return res.status(400).json({ success: false, error: 'Missing token' });
        }

        const result = await unsubscribeService.handleUnsubscribe('', token);
        res.json({ success: result.success, error: result.error });
      } catch (error: unknown) {
        const message = error instanceof Error ? error.message : 'Unknown error';
        res.status(500).json({ success: false, error: message });
      }
    },
  };
}
