import { Router } from 'express';
import type { Request, Response } from 'express';
import type { SessionService } from '../services/session.service.js';
import type { MessageService } from '../services/message.service.js';
import type { SettingsService } from '../services/settings.service.js';
import { sendSuccess, sendError, getParam } from '@astralibx/core';
import type { LogAdapter } from '@astralibx/core';
import type { ExportService } from '../services/export.service.js';
import type { ExportFormat } from '../services/export.service.js';
import type { WebhookService } from '../services/webhook.service.js';
import { ERROR_CODE, RATING_TYPE, WEBHOOK_EVENT } from '../constants/index.js';
import { InvalidConfigError, AlxChatError } from '../errors/index.js';
import type { RatingType } from '../constants/index.js';

function getErrorCode(error: unknown): string | undefined {
  if (error instanceof AlxChatError) return error.code;
  return undefined;
}

export interface SessionRouteOptions {
  enrichSessionContext?: (context: Record<string, unknown>) => Promise<Record<string, unknown>>;
  fileStorage?: {
    upload(file: Buffer, fileName: string, mimeType: string): Promise<string>;
    delete(fileUrl: string): Promise<void>;
    getSignedUrl?(fileUrl: string, expiresIn?: number): Promise<string>;
  };
  settingsService?: SettingsService;
  exportService?: ExportService;
  webhookService?: WebhookService;
}

/**
 * Check if a MIME type matches an allowed pattern.
 * Supports wildcard patterns like 'image/*'.
 */
function isMimeTypeAllowed(mimeType: string, allowedTypes: string[]): boolean {
  for (const pattern of allowedTypes) {
    if (pattern === mimeType) return true;
    if (pattern.endsWith('/*')) {
      const prefix = pattern.slice(0, -1); // 'image/*' -> 'image/'
      if (mimeType.startsWith(prefix)) return true;
    }
  }
  return false;
}

export function createSessionRoutes(
  sessionService: SessionService,
  messageService: MessageService,
  logger: LogAdapter,
  options?: SessionRouteOptions,
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

  // GET /user-history/:visitorId — conversation history for a visitor
  router.get('/user-history/:visitorId', async (req: Request, res: Response) => {
    try {
      const visitorId = getParam(req, 'visitorId');
      const limit = Number(req.query.limit) || undefined;
      const sessions = await sessionService.getUserHistory(visitorId, limit);
      sendSuccess(res, { sessions: sessions.map(s => sessionService.toSummary(s)) });
    } catch (error: unknown) {
      const message = error instanceof Error ? error.message : 'Unknown error';
      logger.error('Failed to get user history', { error });
      sendError(res, message, 500);
    }
  });

  // POST /export — bulk export sessions
  router.post('/export', async (req: Request, res: Response) => {
    try {
      if (!options?.exportService) {
        return sendError(res, 'Export service not configured', 501);
      }
      const format = (req.query.format as ExportFormat) || 'json';
      if (format !== 'json' && format !== 'csv') {
        return sendError(res, 'format must be "json" or "csv"', 400);
      }
      const { dateFrom, dateTo, agentId, tags, status } = req.body;
      const result = await options.exportService.exportSessions(
        { dateFrom, dateTo, agentId, tags, status },
        format,
      );
      const contentType = format === 'csv' ? 'text/csv' : 'application/json';
      res.setHeader('Content-Type', contentType);
      res.setHeader('Content-Disposition', `attachment; filename="sessions-export.${format}"`);
      res.send(result);
    } catch (error: unknown) {
      const message = error instanceof Error ? error.message : 'Unknown error';
      logger.error('Failed to export sessions', { error });
      sendError(res, message, 500);
    }
  });

  // GET / — paginated session list
  router.get('/', async (req: Request, res: Response) => {
    try {
      const { status, channel, mode, tag, userCategory, search, dateFrom, dateTo, page, limit } = req.query;
      const filter: Record<string, unknown> = {};

      if (status) filter.status = status;
      if (channel) filter.channel = channel;
      if (mode) filter.mode = mode;
      if (tag) filter.tags = tag;
      if (userCategory) filter.userCategory = userCategory;
      if (search) {
        const escaped = String(search).replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
        filter.$or = [
          { visitorId: { $regex: escaped, $options: 'i' } },
          { conversationSummary: { $regex: escaped, $options: 'i' } },
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

  // GET /:sessionId/export?format=json|csv — export single session transcript
  router.get('/:sessionId/export', async (req: Request, res: Response) => {
    try {
      if (!options?.exportService) {
        return sendError(res, 'Export service not configured', 501);
      }
      const format = (req.query.format as ExportFormat) || 'json';
      if (format !== 'json' && format !== 'csv') {
        return sendError(res, 'format must be "json" or "csv"', 400);
      }
      const result = await options.exportService.exportSession(
        getParam(req, 'sessionId'),
        format,
      );
      const contentType = format === 'csv' ? 'text/csv' : 'application/json';
      res.setHeader('Content-Type', contentType);
      res.setHeader('Content-Disposition', `attachment; filename="session-${getParam(req, 'sessionId')}.${format}"`);
      res.send(result);
    } catch (error: unknown) {
      const message = error instanceof Error ? error.message : 'Unknown error';
      const statusCode = message.includes('not found') ? 404 : 500;
      logger.error('Failed to export session', { error });
      sendError(res, message, statusCode);
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

  // GET /:sessionId/context — rich session context for integrations
  router.get('/:sessionId/context', async (req: Request, res: Response) => {
    try {
      let context = await sessionService.getSessionContext(getParam(req, 'sessionId'));

      if (options?.enrichSessionContext) {
        context = await options.enrichSessionContext(context);
      }

      sendSuccess(res, context);
    } catch (error: unknown) {
      const message = error instanceof Error ? error.message : 'Unknown error';
      const statusCode = getErrorCode(error) === 'CHAT_SESSION_NOT_FOUND' ? 404 : 500;
      logger.error('Failed to get session context', { error });
      sendError(res, message, statusCode);
    }
  });

  // POST /:sessionId/resolve
  router.post('/:sessionId/resolve', async (req: Request, res: Response) => {
    try {
      const session = await sessionService.resolve(getParam(req, 'sessionId'));
      sendSuccess(res, { session: sessionService.toSummary(session) });
    } catch (error: unknown) {
      const message = error instanceof Error ? error.message : 'Unknown error';
      const statusCode = getErrorCode(error) === 'CHAT_SESSION_NOT_FOUND' ? 404 : 500;
      logger.error('Failed to resolve session', { error });
      sendError(res, message, statusCode);
    }
  });

  // GET /:sessionId/tags
  router.get('/:sessionId/tags', async (req: Request, res: Response) => {
    try {
      const tags = await sessionService.getTags(getParam(req, 'sessionId'));
      sendSuccess(res, { tags });
    } catch (error: unknown) {
      const message = error instanceof Error ? error.message : 'Unknown error';
      const statusCode = getErrorCode(error) === 'CHAT_SESSION_NOT_FOUND' ? 404 : 500;
      logger.error('Failed to get tags', { error });
      sendError(res, message, statusCode);
    }
  });

  // POST /:sessionId/tags — add a tag
  router.post('/:sessionId/tags', async (req: Request, res: Response) => {
    try {
      const { tag } = req.body;
      if (!tag || typeof tag !== 'string') {
        return sendError(res, 'tag is required and must be a string', 400);
      }
      const tags = await sessionService.addTag(getParam(req, 'sessionId'), tag);
      sendSuccess(res, { tags });
    } catch (error: unknown) {
      const message = error instanceof Error ? error.message : 'Unknown error';
      const statusCode = getErrorCode(error) === 'CHAT_SESSION_NOT_FOUND' ? 404 : 500;
      logger.error('Failed to add tag', { error });
      sendError(res, message, statusCode);
    }
  });

  // DELETE /:sessionId/tags/:tag — remove a tag
  router.delete('/:sessionId/tags/:tag', async (req: Request, res: Response) => {
    try {
      const tags = await sessionService.removeTag(getParam(req, 'sessionId'), getParam(req, 'tag'));
      sendSuccess(res, { tags });
    } catch (error: unknown) {
      const message = error instanceof Error ? error.message : 'Unknown error';
      const statusCode = getErrorCode(error) === 'CHAT_SESSION_NOT_FOUND' ? 404 : 500;
      logger.error('Failed to remove tag', { error });
      sendError(res, message, statusCode);
    }
  });

  // PUT /:sessionId/user-info — update user info
  router.put('/:sessionId/user-info', async (req: Request, res: Response) => {
    try {
      const { name, email, mobile } = req.body;
      if (name === undefined && email === undefined && mobile === undefined) {
        return sendError(res, 'At least one of name, email, or mobile is required', 400);
      }
      const session = await sessionService.updateUserInfo(getParam(req, 'sessionId'), { name, email, mobile });
      sendSuccess(res, { userInfo: session.userInfo });
    } catch (error: unknown) {
      const message = error instanceof Error ? error.message : 'Unknown error';
      const statusCode = getErrorCode(error) === 'CHAT_SESSION_NOT_FOUND' ? 404 : 500;
      logger.error('Failed to update user info', { error });
      sendError(res, message, statusCode);
    }
  });

  // PUT /:sessionId/user-category — set user category on a session
  router.put('/:sessionId/user-category', async (req: Request, res: Response) => {
    try {
      const { category } = req.body;
      if (category !== null && (typeof category !== 'string' || category.trim() === '')) {
        return sendError(res, 'category must be a non-empty string or null', 400);
      }
      const userCategory = await sessionService.setUserCategory(
        getParam(req, 'sessionId'),
        category,
        options?.settingsService,
      );
      sendSuccess(res, { userCategory });
    } catch (error: unknown) {
      if (error instanceof InvalidConfigError) {
        sendError(res, error.message, 400);
        return;
      }
      const message = error instanceof Error ? error.message : 'Unknown error';
      const statusCode = getErrorCode(error) === 'CHAT_SESSION_NOT_FOUND' ? 404 : 500;
      logger.error('Failed to set user category', { error });
      sendError(res, message, statusCode);
    }
  });

  // POST /:sessionId/notes — add a note
  router.post('/:sessionId/notes', async (req: Request, res: Response) => {
    try {
      const { note } = req.body;
      if (!note || typeof note !== 'string') {
        return sendError(res, 'note is required and must be a string', 400);
      }
      const notes = await sessionService.addNote(getParam(req, 'sessionId'), note);
      sendSuccess(res, { notes });
    } catch (error: unknown) {
      const message = error instanceof Error ? error.message : 'Unknown error';
      const statusCode = getErrorCode(error) === 'CHAT_SESSION_NOT_FOUND' ? 404 : 500;
      logger.error('Failed to add note', { error });
      sendError(res, message, statusCode);
    }
  });

  // DELETE /:sessionId/notes/:index — remove a note by index
  router.delete('/:sessionId/notes/:index', async (req: Request, res: Response) => {
    try {
      const index = Number(getParam(req, 'index'));
      if (!Number.isInteger(index) || index < 0) {
        return sendError(res, 'index must be a non-negative integer', 400);
      }
      const notes = await sessionService.removeNote(getParam(req, 'sessionId'), index);
      sendSuccess(res, { notes });
    } catch (error: unknown) {
      const message = error instanceof Error ? error.message : 'Unknown error';
      const statusCode = getErrorCode(error) === 'CHAT_SESSION_NOT_FOUND' ? 404 : 500;
      logger.error('Failed to remove note', { error });
      sendError(res, message, statusCode);
    }
  });

  // POST /:sessionId/upload — file upload via file storage adapter
  router.post('/:sessionId/upload', async (req: Request, res: Response) => {
    try {
      if (!options?.fileStorage) {
        return sendError(res, 'File storage not configured', 501);
      }

      const session = await sessionService.findById(getParam(req, 'sessionId'));
      if (!session) {
        return sendError(res, 'Session not found', 404);
      }

      // Load file sharing settings
      if (!options.settingsService) {
        return sendError(res, 'Settings service not available', 500);
      }
      const settings = await options.settingsService.get();
      if (!settings.fileSharing.enabled) {
        return sendError(res, 'File sharing is disabled', 403);
      }

      // Parse the raw body — expect multipart/form-data or raw buffer
      // The consuming app is expected to use multer or similar middleware
      const file = (req as any).file;
      if (!file) {
        return sendError(res, 'No file provided. Use multipart/form-data with field name "file"', 400);
      }

      // Validate file size
      const fileSizeBytes = file.size || file.buffer?.length || 0;
      const maxSizeBytes = settings.fileSharing.maxFileSizeMb * 1024 * 1024;
      if (fileSizeBytes > maxSizeBytes) {
        return sendError(res, `File exceeds maximum size of ${settings.fileSharing.maxFileSizeMb}MB`, 413);
      }

      // Validate file type
      const mimeType = file.mimetype || 'application/octet-stream';
      if (settings.fileSharing.allowedTypes.length > 0 && !isMimeTypeAllowed(mimeType, settings.fileSharing.allowedTypes)) {
        return sendError(res, `File type ${mimeType} is not allowed`, 415);
      }

      const fileName = file.originalname || 'upload';
      const url = await options.fileStorage.upload(file.buffer, fileName, mimeType);

      sendSuccess(res, { url, fileName, mimeType, size: fileSizeBytes });
    } catch (error: unknown) {
      const message = error instanceof Error ? error.message : 'Unknown error';
      logger.error('Failed to upload file', { error });
      sendError(res, message, 500);
    }
  });

  // POST /:sessionId/feedback
  router.post('/:sessionId/feedback', async (req: Request, res: Response) => {
    try {
      const { rating, survey, ratingType, ratingValue, followUpSelections, comment } = req.body;

      // Load rating config from settings if available
      const settings = options?.settingsService ? await options.settingsService.get() : null;
      const ratingConfig = settings?.ratingConfig;

      // Two-step rating flow (new fields)
      if (ratingType != null || ratingValue != null) {
        if (!ratingType || typeof ratingType !== 'string') {
          return sendError(res, 'ratingType is required when using two-step rating', 400);
        }

        // Validate ratingType matches settings if rating config is enabled
        if (ratingConfig?.enabled && ratingConfig.ratingType !== ratingType) {
          return sendError(res, `ratingType must be '${ratingConfig.ratingType}' (configured type)`, 400);
        }

        // Validate ratingValue based on type
        if (ratingValue == null) {
          return sendError(res, 'ratingValue is required', 400);
        }

        if (ratingType === RATING_TYPE.Thumbs) {
          if (ratingValue !== 0 && ratingValue !== 1) {
            return sendError(res, 'ratingValue must be 0 or 1 for thumbs type', 400);
          }
        } else if (ratingType === RATING_TYPE.Stars || ratingType === RATING_TYPE.Emoji) {
          const numVal = Number(ratingValue);
          if (!Number.isInteger(numVal) || numVal < 1 || numVal > 5) {
            return sendError(res, 'ratingValue must be an integer from 1 to 5 for stars/emoji type', 400);
          }
        } else {
          return sendError(res, `Invalid ratingType: ${ratingType}`, 400);
        }

        // Validate followUpSelections
        if (followUpSelections != null) {
          if (!Array.isArray(followUpSelections) || followUpSelections.some((s: unknown) => typeof s !== 'string')) {
            return sendError(res, 'followUpSelections must be an array of strings', 400);
          }
        }

        // Validate comment
        if (comment != null && typeof comment !== 'string') {
          return sendError(res, 'comment must be a string', 400);
        }

        const feedback = { ratingType, ratingValue, followUpSelections, comment };
        await sessionService.submitFeedback(getParam(req, 'sessionId'), feedback);

        // Trigger webhook if configured
        if (options?.webhookService) {
          options.webhookService.trigger(WEBHOOK_EVENT.RatingSubmitted, {
            sessionId: getParam(req, 'sessionId'),
            ratingType,
            ratingValue,
            followUpSelections,
            comment,
          });
        }

        sendSuccess(res, undefined);
        return;
      }

      // Legacy rating flow (backward compatible)
      if (rating != null) {
        if (typeof rating !== 'number' || rating < 1 || rating > 5 || !Number.isInteger(rating)) {
          return sendError(res, 'Rating must be an integer from 1 to 5', 400);
        }
      }

      await sessionService.submitFeedback(getParam(req, 'sessionId'), { rating, survey });

      // Trigger webhook for legacy flow too
      if (options?.webhookService && rating != null) {
        options.webhookService.trigger(WEBHOOK_EVENT.RatingSubmitted, {
          sessionId: getParam(req, 'sessionId'),
          ratingType: 'stars',
          ratingValue: rating,
        });
      }

      sendSuccess(res, undefined);
    } catch (error: unknown) {
      const message = error instanceof Error ? error.message : 'Unknown error';
      logger.error('Failed to submit feedback', { error });
      sendError(res, message, 500);
    }
  });

  return router;
}
