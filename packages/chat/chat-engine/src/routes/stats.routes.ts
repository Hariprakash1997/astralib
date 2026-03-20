import { Router } from 'express';
import type { Request, Response } from 'express';
import type { SessionService } from '../services/session.service.js';
import type { AgentService } from '../services/agent.service.js';
import { sendSuccess, sendError } from '@astralibx/core';
import type { LogAdapter } from '@astralibx/core';

export function createStatsRoutes(
  sessionService: SessionService,
  agentService: AgentService,
  logger: LogAdapter,
): Router {
  const router = Router();

  // GET /
  router.get('/', async (_req: Request, res: Response) => {
    try {
      const dashboardStats = await sessionService.getDashboardStats();

      // Enrich with real agent counts
      const [totalAgents, activeAgents] = await Promise.all([
        agentService.getTotalAgentCount(),
        agentService.getOnlineAgentCount(),
      ]);

      sendSuccess(res, {
        ...dashboardStats,
        totalAgents,
        activeAgents,
      });
    } catch (error: unknown) {
      const message = error instanceof Error ? error.message : 'Unknown error';
      logger.error('Failed to get dashboard stats', { error });
      sendError(res, message, 500);
    }
  });

  return router;
}
