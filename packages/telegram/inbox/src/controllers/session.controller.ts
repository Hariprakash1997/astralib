import type { Request, Response } from 'express';
import type { SessionService } from '../services/session.service';
import type { LogAdapter } from '../types/config.types';

export function createSessionController(
  sessionService: SessionService,
  logger?: LogAdapter,
) {
  return {
    async list(req: Request, res: Response) {
      try {
        const { accountId, contactId, status, page, limit } = req.query;

        const filters: Record<string, unknown> = {};
        if (accountId) filters.accountId = accountId;
        if (contactId) filters.contactId = contactId;
        if (status) filters.status = status;

        const pageNum = Number(page) || 1;
        const limitNum = Number(limit) || 50;

        const result = await sessionService.list(
          filters as { accountId?: string; contactId?: string; status?: 'active' | 'paused' | 'closed' },
          pageNum,
          limitNum,
        );

        res.json({ success: true, data: { sessions: result.items, total: result.total } });
      } catch (error: unknown) {
        const message = error instanceof Error ? error.message : 'Unknown error';
        res.status(500).json({ success: false, error: message });
      }
    },

    async getById(req: Request, res: Response) {
      try {
        const id = req.params.id as string;
        const session = await sessionService.getById(id);
        if (!session) {
          return res.status(404).json({ success: false, error: 'Session not found' });
        }
        res.json({ success: true, data: { session } });
      } catch (error: unknown) {
        const message = error instanceof Error ? error.message : 'Unknown error';
        res.status(500).json({ success: false, error: message });
      }
    },

    async close(req: Request, res: Response) {
      try {
        const id = req.params.id as string;
        const session = await sessionService.close(id);
        if (!session) {
          return res.status(404).json({ success: false, error: 'Session not found' });
        }
        res.json({ success: true, data: { session } });
      } catch (error: unknown) {
        const message = error instanceof Error ? error.message : 'Unknown error';
        res.status(500).json({ success: false, error: message });
      }
    },

    async pause(req: Request, res: Response) {
      try {
        const id = req.params.id as string;
        const session = await sessionService.pause(id);
        if (!session) {
          return res.status(404).json({ success: false, error: 'Session not found' });
        }
        res.json({ success: true, data: { session } });
      } catch (error: unknown) {
        const message = error instanceof Error ? error.message : 'Unknown error';
        res.status(500).json({ success: false, error: message });
      }
    },

    async resume(req: Request, res: Response) {
      try {
        const id = req.params.id as string;
        const session = await sessionService.resume(id);
        if (!session) {
          return res.status(404).json({ success: false, error: 'Session not found' });
        }
        res.json({ success: true, data: { session } });
      } catch (error: unknown) {
        const message = error instanceof Error ? error.message : 'Unknown error';
        res.status(500).json({ success: false, error: message });
      }
    },
  };
}
