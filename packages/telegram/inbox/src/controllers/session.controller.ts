import type { Request, Response } from 'express';
import { Types } from 'mongoose';
import type { SessionService } from '../services/session.service';
import type { LogAdapter } from '../types/config.types';
import { MAX_PAGE_LIMIT, SESSION_STATUSES } from '../constants';

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
        if (status) {
          if (!SESSION_STATUSES.includes(status as typeof SESSION_STATUSES[number])) {
            return res.status(400).json({ success: false, error: `Invalid status. Must be one of: ${SESSION_STATUSES.join(', ')}` });
          }
          filters.status = status;
        }

        const pageNum = Math.max(Number(page) || 1, 1);
        const limitNum = Math.min(Number(limit) || 50, MAX_PAGE_LIMIT);

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
        if (!Types.ObjectId.isValid(id)) {
          return res.status(400).json({ success: false, error: 'Invalid ID format' });
        }
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
        if (!Types.ObjectId.isValid(id)) {
          return res.status(400).json({ success: false, error: 'Invalid ID format' });
        }
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
        if (!Types.ObjectId.isValid(id)) {
          return res.status(400).json({ success: false, error: 'Invalid ID format' });
        }
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
        if (!Types.ObjectId.isValid(id)) {
          return res.status(400).json({ success: false, error: 'Invalid ID format' });
        }
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
