import type { Request, Response } from 'express';
import type { IdentifierService } from '../services/identifier.service';

export function createIdentifierController(identifierService: IdentifierService) {
  return {
    async list(req: Request, res: Response) {
      try {
        const status = req.query.status as string | undefined;
        const page = parseInt(req.query.page as string, 10) || 1;
        const limit = parseInt(req.query.limit as string, 10) || 50;

        const result = await identifierService.list(
          status ? { status } : undefined,
          page,
          limit,
        );

        res.json({ success: true, data: result });
      } catch (error: unknown) {
        const message = error instanceof Error ? error.message : 'Unknown error';
        res.status(500).json({ success: false, error: message });
      }
    },

    async getByEmail(req: Request, res: Response) {
      try {
        const identifier = await identifierService.findByEmail(req.params.email);
        if (!identifier) {
          return res.status(404).json({ success: false, error: 'Identifier not found' });
        }
        res.json({ success: true, data: { identifier } });
      } catch (error: unknown) {
        const message = error instanceof Error ? error.message : 'Unknown error';
        res.status(500).json({ success: false, error: message });
      }
    },

    async updateStatus(req: Request, res: Response) {
      try {
        const { status } = req.body;
        if (!status) {
          return res.status(400).json({ success: false, error: 'status is required' });
        }

        await identifierService.updateStatus(req.params.email, status);
        res.json({ success: true });
      } catch (error: unknown) {
        const message = error instanceof Error ? error.message : 'Unknown error';
        res.status(500).json({ success: false, error: message });
      }
    },

    async merge(req: Request, res: Response) {
      try {
        const { sourceEmail, targetEmail } = req.body;
        if (!sourceEmail || !targetEmail) {
          return res.status(400).json({ success: false, error: 'sourceEmail and targetEmail are required' });
        }

        await identifierService.merge(sourceEmail, targetEmail);
        res.json({ success: true });
      } catch (error: unknown) {
        const message = error instanceof Error ? error.message : 'Unknown error';
        res.status(500).json({ success: false, error: message });
      }
    },
  };
}
