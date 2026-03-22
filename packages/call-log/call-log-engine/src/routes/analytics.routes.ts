import { Router } from 'express';
import type { Request, Response } from 'express';
import { sendSuccess, sendError } from '@astralibx/core';
import type { LogAdapter } from '@astralibx/core';
import type { AnalyticsService } from '../services/analytics.service.js';
import type { PipelineAnalyticsService } from '../services/pipeline-analytics.service.js';
import { AlxCallLogError } from '../errors/index.js';

export function createAnalyticsRoutes(
  analytics: AnalyticsService,
  pipelineAnalytics: PipelineAnalyticsService,
  logger: LogAdapter,
  enableAgentScoping = false,
): Router {
  const router = Router();

  function getScopedAgentId(req: Request): string | undefined {
    if (!enableAgentScoping) return undefined;
    const user = (req as unknown as { user?: { adminUserId?: string; role?: string } }).user;
    if (!user) return undefined;
    if (user.role === 'owner') return undefined;
    return user.adminUserId;
  }

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
      const scopedAgentId = getScopedAgentId(req);
      // Non-owners can only view their own stats
      if (scopedAgentId && scopedAgentId !== req.params['agentId']) {
        sendError(res, 'Forbidden: you may only view your own agent stats', 403);
        return;
      }
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

  // GET /pipeline/:id — pipeline stats (delegated to PipelineAnalyticsService)
  router.get('/pipeline/:id', async (req: Request, res: Response) => {
    try {
      const dateRange = parseDateRange(req.query as Record<string, string | undefined>);
      const result = await pipelineAnalytics.getPipelineStats(req.params['id']!, dateRange);
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

  // GET /pipeline/:id/funnel — funnel (delegated to PipelineAnalyticsService)
  router.get('/pipeline/:id/funnel', async (req: Request, res: Response) => {
    try {
      const dateRange = parseDateRange(req.query as Record<string, string | undefined>);
      const result = await pipelineAnalytics.getPipelineFunnel(req.params['id']!, dateRange);
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

  // GET /channel-distribution — channel distribution
  router.get('/channel-distribution', async (req: Request, res: Response) => {
    try {
      const dateRange = parseDateRange(req.query as Record<string, string | undefined>);
      const result = await pipelineAnalytics.getChannelDistribution(dateRange);
      sendSuccess(res, result);
    } catch (error: unknown) {
      const message = error instanceof Error ? error.message : 'Unknown error';
      logger.error('Failed to get channel distribution', { error: message });
      sendError(res, message, 500);
    }
  });

  // GET /outcome-distribution — outcome distribution
  router.get('/outcome-distribution', async (req: Request, res: Response) => {
    try {
      const dateRange = parseDateRange(req.query as Record<string, string | undefined>);
      const result = await pipelineAnalytics.getOutcomeDistribution(dateRange);
      sendSuccess(res, result);
    } catch (error: unknown) {
      const message = error instanceof Error ? error.message : 'Unknown error';
      logger.error('Failed to get outcome distribution', { error: message });
      sendError(res, message, 500);
    }
  });

  // GET /follow-up-stats — follow-up ratio stats
  router.get('/follow-up-stats', async (req: Request, res: Response) => {
    try {
      const dateRange = parseDateRange(req.query as Record<string, string | undefined>);
      const result = await pipelineAnalytics.getFollowUpStats(dateRange);
      sendSuccess(res, result);
    } catch (error: unknown) {
      const message = error instanceof Error ? error.message : 'Unknown error';
      logger.error('Failed to get follow-up stats', { error: message });
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
      const scopedAgentId = getScopedAgentId(req);
      const dateRange = parseDateRange(req.query as Record<string, string | undefined>);
      const result = await analytics.getDailyReport(dateRange, scopedAgentId);
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
