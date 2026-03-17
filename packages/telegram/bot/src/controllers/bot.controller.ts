import type { Request, Response } from 'express';
import type { BotService } from '../services/bot.service';
import type { UserTrackerService } from '../services/user-tracker.service';
import type { LogAdapter } from '../types/config.types';

export function createBotController(
  botService: BotService,
  userTracker: UserTrackerService,
  logger: LogAdapter,
) {
  return {
    async getStatus(_req: Request, res: Response) {
      try {
        const running = botService.isRunning();
        const botInfo = botService.getBotInfo();
        const uptimeMs = botService.getUptime();

        res.json({
          success: true,
          data: {
            running,
            botInfo,
            uptimeMs,
          },
        });
      } catch (error: unknown) {
        const message = error instanceof Error ? error.message : 'Unknown error';
        res.status(500).json({ success: false, error: message });
      }
    },

    async getStats(_req: Request, res: Response) {
      try {
        const botInfo = botService.getBotInfo();
        const botUsername = botInfo?.username || '';

        const totalUsers = await userTracker.getUserCount(botUsername);
        const activeUsers = await userTracker.getActiveUsers(botUsername);
        const stats = await userTracker.getStats(botUsername);

        res.json({
          success: true,
          data: {
            totalUsers,
            activeUsers,
            blockedUsers: stats?.blockedUsers ?? 0,
            stoppedUsers: stats?.stoppedUsers ?? 0,
            newUsersToday: stats?.newUsersToday ?? 0,
            newUsersThisWeek: stats?.newUsersThisWeek ?? 0,
            returningUsers: stats?.returningUsers ?? 0,
            blockRate: stats?.blockRate ?? 0,
          },
        });
      } catch (error: unknown) {
        const message = error instanceof Error ? error.message : 'Unknown error';
        res.status(500).json({ success: false, error: message });
      }
    },

    async getUsers(req: Request, res: Response) {
      try {
        const { status, page, limit } = req.query;
        const botInfo = botService.getBotInfo();

        const filters: Record<string, unknown> = {};
        if (status) filters.status = status as string;
        if (botInfo?.username) filters.botUsername = botInfo.username;

        const result = await userTracker.getAllUsers(
          filters as any,
          { page: Number(page) || 1, limit: Number(limit) || 20 },
        );

        res.json({ success: true, data: { users: result.users, total: result.total } });
      } catch (error: unknown) {
        const message = error instanceof Error ? error.message : 'Unknown error';
        res.status(500).json({ success: false, error: message });
      }
    },

    async getUser(req: Request, res: Response) {
      try {
        const userId = req.params.userId as string;
        const user = await userTracker.getUser(userId);
        if (!user) {
          return res.status(404).json({ success: false, error: 'User not found' });
        }
        res.json({ success: true, data: { user } });
      } catch (error: unknown) {
        const message = error instanceof Error ? error.message : 'Unknown error';
        res.status(500).json({ success: false, error: message });
      }
    },
  };
}
