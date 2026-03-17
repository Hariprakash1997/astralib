import { Router } from 'express';
import type { Request, Response } from 'express';
import type { SessionService } from '../services/session.service';
import type { MessageService } from '../services/message.service';
import { sendSuccess, sendError, getParam } from '@astralibx/core';
import type { LogAdapter } from '@astralibx/core';

export function createSessionRoutes(
  sessionService: SessionService,
  messageService: MessageService,
  logger: LogAdapter,
): Router {
  const router = Router();

  // GET /feedback-stats — must be before /:sessionId to avoid conflict
  router.get('/feedback-stats', async (_req: Request, res: Response) => {
    try {
      const sessions = await sessionService.findAllWithFeedback();
      const stats = {
        totalRatings: 0,
        averageRating: 0,
        countByRating: { 1: 0, 2: 0, 3: 0, 4: 0, 5: 0 } as Record<number, number>,
      };

      for (const session of sessions) {
        if (session.feedback?.rating) {
          stats.totalRatings++;
          stats.countByRating[session.feedback.rating] =
            (stats.countByRating[session.feedback.rating] || 0) + 1;
        }
      }

      if (stats.totalRatings > 0) {
        const sum = Object.entries(stats.countByRating).reduce(
          (acc, [rating, count]) => acc + Number(rating) * count,
          0,
        );
        stats.averageRating = Math.round((sum / stats.totalRatings) * 100) / 100;
      }

      sendSuccess(res, stats);
    } catch (error: unknown) {
      const message = error instanceof Error ? error.message : 'Unknown error';
      logger.error('Failed to get feedback stats', { error });
      sendError(res, message, 500);
    }
  });

  // GET / — paginated session list
  router.get('/', async (req: Request, res: Response) => {
    try {
      const { status, channel, mode, search, dateFrom, dateTo, page, limit } = req.query;
      const filter: Record<string, unknown> = {};

      if (status) filter.status = status;
      if (channel) filter.channel = channel;
      if (mode) filter.mode = mode;
      if (search) {
        filter.$or = [
          { visitorId: { $regex: search, $options: 'i' } },
          { conversationSummary: { $regex: search, $options: 'i' } },
        ];
      }
      if (dateFrom || dateTo) {
        const dateFilter: Record<string, unknown> = {};
        if (dateFrom) dateFilter.$gte = new Date(dateFrom as string);
        if (dateTo) dateFilter.$lte = new Date(dateTo as string);
        filter.startedAt = dateFilter;
      }

      const pageNum = Number(page) || 1;
      const limitNum = Number(limit) || 20;

      const result = await sessionService.findPaginated(filter, pageNum, limitNum);
      sendSuccess(res, result);
    } catch (error: unknown) {
      const message = error instanceof Error ? error.message : 'Unknown error';
      logger.error('Failed to list sessions', { error });
      sendError(res, message, 500);
    }
  });

  // GET /:sessionId
  router.get('/:sessionId', async (req: Request, res: Response) => {
    try {
      const session = await sessionService.findById(getParam(req, 'sessionId'));
      if (!session) {
        return sendError(res, 'Session not found', 404);
      }
      sendSuccess(res, { session });
    } catch (error: unknown) {
      const message = error instanceof Error ? error.message : 'Unknown error';
      logger.error('Failed to get session', { error });
      sendError(res, message, 500);
    }
  });

  // GET /:sessionId/messages
  router.get('/:sessionId/messages', async (req: Request, res: Response) => {
    try {
      const { before, limit } = req.query;
      const limitNum = Number(limit) || 50;
      const messages = await messageService.findBySession(
        getParam(req, 'sessionId'),
        limitNum,
        before as string | undefined,
      );
      sendSuccess(res, { messages });
    } catch (error: unknown) {
      const message = error instanceof Error ? error.message : 'Unknown error';
      logger.error('Failed to get messages', { error });
      sendError(res, message, 500);
    }
  });

  // POST /:sessionId/resolve
  router.post('/:sessionId/resolve', async (req: Request, res: Response) => {
    try {
      const session = await sessionService.resolve(getParam(req, 'sessionId'));
      sendSuccess(res, { session: sessionService.toSummary(session) });
    } catch (error: unknown) {
      const message = error instanceof Error ? error.message : 'Unknown error';
      const statusCode = (error as any).code === 'SESSION_NOT_FOUND' ? 404 : 500;
      logger.error('Failed to resolve session', { error });
      sendError(res, message, statusCode);
    }
  });

  // POST /:sessionId/feedback
  router.post('/:sessionId/feedback', async (req: Request, res: Response) => {
    try {
      const { rating, survey } = req.body;
      await sessionService.submitFeedback(getParam(req, 'sessionId'), { rating, survey });
      sendSuccess(res, undefined);
    } catch (error: unknown) {
      const message = error instanceof Error ? error.message : 'Unknown error';
      logger.error('Failed to submit feedback', { error });
      sendError(res, message, 500);
    }
  });

  return router;
}
