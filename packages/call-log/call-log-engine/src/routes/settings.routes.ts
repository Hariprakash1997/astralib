import { Router } from 'express';
import type { Request, Response } from 'express';
import { sendSuccess, sendError } from '@astralibx/core';
import type { LogAdapter } from '@astralibx/core';
import type { SettingsService } from '../services/settings.service.js';
import type { ExportService } from '../services/export.service.js';
import { AlxCallLogError } from '../errors/index.js';

export function createSettingsRoutes(
  settings: SettingsService,
  exportSvc: ExportService,
  logger: LogAdapter,
): Router {
  const router = Router();

  // NOTE: These are mounted at root level (not under /settings prefix)

  // GET /settings — get settings
  router.get('/settings', async (_req: Request, res: Response) => {
    try {
      const result = await settings.get();
      sendSuccess(res, result);
    } catch (error: unknown) {
      const message = error instanceof Error ? error.message : 'Unknown error';
      logger.error('Failed to get settings', { error: message });
      sendError(res, message, 500);
    }
  });

  // PUT /settings — update settings
  router.put('/settings', async (req: Request, res: Response) => {
    try {
      const result = await settings.update(req.body);
      sendSuccess(res, result);
    } catch (error: unknown) {
      if (error instanceof AlxCallLogError) {
        sendError(res, error.message, 400);
        return;
      }
      const message = error instanceof Error ? error.message : 'Unknown error';
      logger.error('Failed to update settings', { error: message });
      sendError(res, message, 500);
    }
  });

  // GET /export/calls — bulk export
  router.get('/export/calls', async (req: Request, res: Response) => {
    try {
      const { format = 'json', ...filterParams } = req.query as Record<string, string | undefined>;
      const filter: Record<string, unknown> = {};
      if (filterParams['pipelineId']) filter['pipelineId'] = filterParams['pipelineId'];
      if (filterParams['agentId']) filter['agentId'] = filterParams['agentId'];
      if (filterParams['isClosed'] !== undefined) filter['isClosed'] = filterParams['isClosed'] === 'true';
      if (filterParams['from'] || filterParams['to']) {
        filter['dateRange'] = { from: filterParams['from'], to: filterParams['to'] };
      }
      const result = await exportSvc.exportCallLogs(
        filter as Parameters<typeof exportSvc.exportCallLogs>[0],
        format as 'json' | 'csv',
      );
      const contentType = format === 'csv' ? 'text/csv' : 'application/json';
      res.setHeader('Content-Type', contentType);
      res.send(result);
    } catch (error: unknown) {
      const message = error instanceof Error ? error.message : 'Unknown error';
      logger.error('Failed to export call logs', { error: message });
      sendError(res, message, 500);
    }
  });

  // GET /export/calls/:id — single call export
  router.get('/export/calls/:id', async (req: Request, res: Response) => {
    try {
      const format = (req.query['format'] as string || 'json') as 'json' | 'csv';
      const result = await exportSvc.exportCallLog(req.params['id']!, format);
      const contentType = format === 'csv' ? 'text/csv' : 'application/json';
      res.setHeader('Content-Type', contentType);
      res.send(result);
    } catch (error: unknown) {
      if (error instanceof AlxCallLogError) {
        sendError(res, error.message, 404);
        return;
      }
      const message = error instanceof Error ? error.message : 'Unknown error';
      logger.error('Failed to export call log', { id: req.params['id'], error: message });
      sendError(res, message, 500);
    }
  });

  // GET /export/pipeline/:id — pipeline report export
  router.get('/export/pipeline/:id', async (req: Request, res: Response) => {
    try {
      const format = (req.query['format'] as string || 'json') as 'json' | 'csv';
      const dateRange = {
        from: req.query['from'] as string | undefined,
        to: req.query['to'] as string | undefined,
      };
      const result = await exportSvc.exportPipelineReport(req.params['id']!, dateRange, format);
      const contentType = format === 'csv' ? 'text/csv' : 'application/json';
      res.setHeader('Content-Type', contentType);
      res.send(result);
    } catch (error: unknown) {
      if (error instanceof AlxCallLogError) {
        sendError(res, error.message, 400);
        return;
      }
      const message = error instanceof Error ? error.message : 'Unknown error';
      logger.error('Failed to export pipeline report', { id: req.params['id'], error: message });
      sendError(res, message, 500);
    }
  });

  return router;
}
