import { Router } from 'express';
import type { Request, Response } from 'express';
import { sendSuccess, sendError } from '@astralibx/core';
import type { LogAdapter } from '@astralibx/core';
import type { AnalyticsService } from '../services/analytics.service.js';
import { AlxCallLogError } from '../errors/index.js';

export function createAnalyticsRoutes(
  analytics: AnalyticsService,
  logger: LogAdapter,
): Router {
  const router = Router();

  function parseDateRange(query: Record<string, string | undefined>) {
    return {
      from: query['from'],
      to: query['to'],
    };
  }

  // GET /stats — quick dashboard stats
  router.get('/stats', async (req: Request, res: Response) => {
    try {
      const result = await analytics.getDashboardStats();
      sendSuccess(res, result);
    } catch (error: unknown) {
      const message = error instanceof Error ? error.message : 'Unknown error';
      logger.error('Failed to get dashboard stats', { error: message });
      sendError(res, message, 500);
    }
  });

  // GET /agent/:agentId — agent stats
  router.get('/agent/:agentId', async (req: Request, res: Response) => {
    try {
      const dateRange = parseDateRange(req.query as Record<string, string | undefined>);
      const result = await analytics.getAgentStats(req.params['agentId']!, dateRange);
      sendSuccess(res, result);
    } catch (error: unknown) {
      if (error instanceof AlxCallLogError) {
        sendError(res, error.message, 400);
        return;
      }
      const message = error instanceof Error ? error.message : 'Unknown error';
      logger.error('Failed to get agent stats', { agentId: req.params['agentId'], error: message });
      sendError(res, message, 500);
    }
  });

  // GET /agent-leaderboard — ranking
  router.get('/agent-leaderboard', async (req: Request, res: Response) => {
    try {
      const dateRange = parseDateRange(req.query as Record<string, string | undefined>);
      const result = await analytics.getAgentLeaderboard(dateRange);
      sendSuccess(res, result);
    } catch (error: unknown) {
      const message = error instanceof Error ? error.message : 'Unknown error';
      logger.error('Failed to get agent leaderboard', { error: message });
      sendError(res, message, 500);
    }
  });

  // GET /pipeline/:id — pipeline stats
  router.get('/pipeline/:id', async (req: Request, res: Response) => {
    try {
      const dateRange = parseDateRange(req.query as Record<string, string | undefined>);
      const result = await analytics.getPipelineStats(req.params['id']!, dateRange);
      sendSuccess(res, result);
    } catch (error: unknown) {
      if (error instanceof AlxCallLogError) {
        sendError(res, error.message, 400);
        return;
      }
      const message = error instanceof Error ? error.message : 'Unknown error';
      logger.error('Failed to get pipeline stats', { id: req.params['id'], error: message });
      sendError(res, message, 500);
    }
  });

  // GET /pipeline/:id/funnel — funnel
  router.get('/pipeline/:id/funnel', async (req: Request, res: Response) => {
    try {
      const dateRange = parseDateRange(req.query as Record<string, string | undefined>);
      const result = await analytics.getPipelineFunnel(req.params['id']!, dateRange);
      sendSuccess(res, result);
    } catch (error: unknown) {
      if (error instanceof AlxCallLogError) {
        sendError(res, error.message, 400);
        return;
      }
      const message = error instanceof Error ? error.message : 'Unknown error';
      logger.error('Failed to get pipeline funnel', { id: req.params['id'], error: message });
      sendError(res, message, 500);
    }
  });

  // GET /team — team stats
  router.get('/team', async (req: Request, res: Response) => {
    try {
      const { teamId } = req.query as { teamId?: string };
      const dateRange = parseDateRange(req.query as Record<string, string | undefined>);
      const result = await analytics.getTeamStats(teamId, dateRange);
      sendSuccess(res, result);
    } catch (error: unknown) {
      const message = error instanceof Error ? error.message : 'Unknown error';
      logger.error('Failed to get team stats', { error: message });
      sendError(res, message, 500);
    }
  });

  // GET /daily — daily report
  router.get('/daily', async (req: Request, res: Response) => {
    try {
      const dateRange = parseDateRange(req.query as Record<string, string | undefined>);
      const result = await analytics.getDailyReport(dateRange);
      sendSuccess(res, result);
    } catch (error: unknown) {
      const message = error instanceof Error ? error.message : 'Unknown error';
      logger.error('Failed to get daily report', { error: message });
      sendError(res, message, 500);
    }
  });

  // GET /weekly-trends — weekly trends
  router.get('/weekly-trends', async (req: Request, res: Response) => {
    try {
      const weeks = parseInt(req.query['weeks'] as string || '4', 10);
      const result = await analytics.getWeeklyTrends(weeks);
      sendSuccess(res, result);
    } catch (error: unknown) {
      const message = error instanceof Error ? error.message : 'Unknown error';
      logger.error('Failed to get weekly trends', { error: message });
      sendError(res, message, 500);
    }
  });

  // GET /overall — overall report
  router.get('/overall', async (req: Request, res: Response) => {
    try {
      const dateRange = parseDateRange(req.query as Record<string, string | undefined>);
      const result = await analytics.getOverallReport(dateRange);
      sendSuccess(res, result);
    } catch (error: unknown) {
      const message = error instanceof Error ? error.message : 'Unknown error';
      logger.error('Failed to get overall report', { error: message });
      sendError(res, message, 500);
    }
  });

  return router;
}
