import { Router } from 'express';
import type { Request, Response } from 'express';
import { sendSuccess, sendError } from '@astralibx/core';
import type { LogAdapter } from '@astralibx/core';
import type { ReportService } from '../services/report.service';

export function createReportRoutes(
  reportService: ReportService,
  logger: LogAdapter,
): Router {
  const router = Router();

  // GET /agent-performance?dateFrom=&dateTo=&agentId=
  router.get('/agent-performance', async (req: Request, res: Response) => {
    try {
      const { dateFrom, dateTo, agentId } = req.query;
      const dateRange = (dateFrom || dateTo)
        ? { from: dateFrom as string | undefined, to: dateTo as string | undefined }
        : undefined;

      const report = await reportService.getAgentPerformance(
        agentId as string | undefined,
        dateRange,
      );
      sendSuccess(res, report);
    } catch (error: unknown) {
      const message = error instanceof Error ? error.message : 'Unknown error';
      logger.error('Failed to get agent performance report', { error });
      sendError(res, message, 500);
    }
  });

  // GET /overall?dateFrom=&dateTo=
  router.get('/overall', async (req: Request, res: Response) => {
    try {
      const { dateFrom, dateTo } = req.query;
      const dateRange = (dateFrom || dateTo)
        ? { from: dateFrom as string | undefined, to: dateTo as string | undefined }
        : undefined;

      const report = await reportService.getOverallReport(dateRange);
      sendSuccess(res, report);
    } catch (error: unknown) {
      const message = error instanceof Error ? error.message : 'Unknown error';
      logger.error('Failed to get overall report', { error });
      sendError(res, message, 500);
    }
  });

  return router;
}
