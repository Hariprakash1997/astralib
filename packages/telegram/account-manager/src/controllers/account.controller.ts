import type { Request, Response } from 'express';
import type { CreateTelegramAccountInput, UpdateTelegramAccountInput } from '../types/account.types';
import type { TelegramAccountModel } from '../schemas/telegram-account.schema';
import type { TelegramDailyStatsModel } from '../schemas/telegram-daily-stats.schema';
import type { ConnectionService } from '../services/connection.service';
import type { CapacityManager } from '../services/capacity-manager';
import type { QuarantineService } from '../services/quarantine.service';
import type { HealthTracker } from '../services/health-tracker';
import type { LogAdapter, TelegramAccountManagerConfig } from '../types/config.types';
import { ACCOUNT_STATUS, DEFAULT_DAILY_LIMIT, DEFAULT_WARMUP_SCHEDULE } from '../constants';

export function createAccountController(
  TelegramAccount: TelegramAccountModel,
  TelegramDailyStats: TelegramDailyStatsModel,
  connectionService: ConnectionService,
  config: TelegramAccountManagerConfig,
  logger: LogAdapter,
  capacityManager: CapacityManager,
  quarantineService: QuarantineService,
  healthTracker: HealthTracker,
) {
  return {
    async list(req: Request, res: Response) {
      try {
        const { status, page, limit } = req.query;
        const filter: Record<string, unknown> = {};
        if (status) filter.status = status;

        const pageNum = Number(page) || 1;
        const limitNum = Number(limit) || 20;
        const skip = (pageNum - 1) * limitNum;

        const total = await TelegramAccount.countDocuments(filter);
        const accounts = await TelegramAccount.find(filter)
          .select('-session')
          .sort({ createdAt: -1 })
          .skip(skip)
          .limit(limitNum);

        res.json({ success: true, data: { accounts, total } });
      } catch (error: unknown) {
        const message = error instanceof Error ? error.message : 'Unknown error';
        res.status(500).json({ success: false, error: message });
      }
    },

    async getById(req: Request, res: Response) {
      try {
        const id = req.params.id as string;
        const account = await TelegramAccount.findById(id).select('-session');
        if (!account) {
          return res.status(404).json({ success: false, error: 'Account not found' });
        }
        res.json({ success: true, data: { account } });
      } catch (error: unknown) {
        const message = error instanceof Error ? error.message : 'Unknown error';
        res.status(500).json({ success: false, error: message });
      }
    },

    async getCapacity(req: Request, res: Response) {
      try {
        const id = req.params.id as string;
        const capacity = await capacityManager.getAccountCapacity(id);
        res.json({ success: true, data: capacity });
      } catch (error: unknown) {
        const message = error instanceof Error ? error.message : 'Unknown error';
        res.status(500).json({ success: false, error: message });
      }
    },

    async getHealth(req: Request, res: Response) {
      try {
        const id = req.params.id as string;
        const health = await healthTracker.getHealth(id);
        if (!health) {
          return res.status(404).json({ success: false, error: 'Account not found' });
        }
        res.json({ success: true, data: health });
      } catch (error: unknown) {
        const message = error instanceof Error ? error.message : 'Unknown error';
        res.status(500).json({ success: false, error: message });
      }
    },

    async create(req: Request, res: Response) {
      try {
        const input: CreateTelegramAccountInput = req.body;

        if (!input.phone || !input.name || !input.session) {
          return res.status(400).json({ success: false, error: 'phone, name, and session are required' });
        }

        const existing = await TelegramAccount.findOne({ phone: input.phone });
        if (existing) {
          return res.status(400).json({ success: false, error: 'Phone number already registered' });
        }

        const warmupSchedule = config.options?.warmup?.defaultSchedule || DEFAULT_WARMUP_SCHEDULE;
        const warmupEnabled = config.options?.warmup?.enabled !== false;

        const accountData = {
          phone: input.phone,
          name: input.name,
          session: input.session,
          status: warmupEnabled ? ACCOUNT_STATUS.Warmup : ACCOUNT_STATUS.Disconnected,
          healthScore: 100,
          consecutiveErrors: 0,
          floodWaitCount: 0,
          currentDailyLimit: DEFAULT_DAILY_LIMIT,
          totalMessagesSent: 0,
          currentDelayMin: warmupSchedule[0]?.delayMinMs ?? 30000,
          currentDelayMax: warmupSchedule[0]?.delayMaxMs ?? 60000,
          warmup: {
            enabled: warmupEnabled,
            currentDay: warmupEnabled ? 1 : 0,
            startedAt: warmupEnabled ? new Date() : undefined,
            schedule: warmupSchedule,
          },
        };

        const account = await TelegramAccount.create(accountData);
        const saved = account.toObject();
        delete (saved as any).session;

        res.status(201).json({ success: true, data: { account: saved } });
      } catch (error: unknown) {
        const message = error instanceof Error ? error.message : 'Unknown error';
        res.status(500).json({ success: false, error: message });
      }
    },

    async update(req: Request, res: Response) {
      try {
        const input: UpdateTelegramAccountInput = req.body;
        const updates: Record<string, unknown> = {};

        if (input.name !== undefined) updates.name = input.name;
        if (input.session !== undefined) updates.session = input.session;
        if (input.currentDailyLimit !== undefined) updates.currentDailyLimit = input.currentDailyLimit;
        if (input.currentDelayMin !== undefined) updates.currentDelayMin = input.currentDelayMin;
        if (input.currentDelayMax !== undefined) updates.currentDelayMax = input.currentDelayMax;

        const id = req.params.id as string;
        const account = await TelegramAccount.findByIdAndUpdate(
          id,
          { $set: updates },
          { new: true },
        ).select('-session');

        if (!account) {
          return res.status(404).json({ success: false, error: 'Account not found' });
        }

        res.json({ success: true, data: { account } });
      } catch (error: unknown) {
        const message = error instanceof Error ? error.message : 'Unknown error';
        res.status(500).json({ success: false, error: message });
      }
    },

    async remove(req: Request, res: Response) {
      try {
        const id = req.params.id as string;
        const client = connectionService.getClient(id);
        if (client) {
          return res.status(400).json({ success: false, error: 'Account must be disconnected before deletion' });
        }

        const result = await TelegramAccount.findByIdAndDelete(id);
        if (!result) {
          return res.status(404).json({ success: false, error: 'Account not found' });
        }

        res.json({ success: true });
      } catch (error: unknown) {
        const message = error instanceof Error ? error.message : 'Unknown error';
        res.status(500).json({ success: false, error: message });
      }
    },

    async connect(req: Request, res: Response) {
      try {
        const id = req.params.id as string;
        await connectionService.connect(id);
        res.json({ success: true });
      } catch (error: unknown) {
        const message = error instanceof Error ? error.message : 'Unknown error';
        res.status(500).json({ success: false, error: message });
      }
    },

    async disconnect(req: Request, res: Response) {
      try {
        const id = req.params.id as string;
        await connectionService.disconnect(id);
        res.json({ success: true });
      } catch (error: unknown) {
        const message = error instanceof Error ? error.message : 'Unknown error';
        res.status(500).json({ success: false, error: message });
      }
    },

    async reconnect(req: Request, res: Response) {
      try {
        const id = req.params.id as string;
        await connectionService.reconnect(id);
        res.json({ success: true });
      } catch (error: unknown) {
        const message = error instanceof Error ? error.message : 'Unknown error';
        res.status(500).json({ success: false, error: message });
      }
    },

    async quarantine(req: Request, res: Response) {
      try {
        const { reason, durationMs } = req.body;
        if (!reason) {
          return res.status(400).json({ success: false, error: 'reason is required' });
        }

        const id = req.params.id as string;
        await quarantineService.quarantine(id, reason, durationMs);
        res.json({ success: true });
      } catch (error: unknown) {
        const message = error instanceof Error ? error.message : 'Unknown error';
        res.status(500).json({ success: false, error: message });
      }
    },

    async release(req: Request, res: Response) {
      try {
        const id = req.params.id as string;
        await quarantineService.release(id);
        res.json({ success: true });
      } catch (error: unknown) {
        const message = error instanceof Error ? error.message : 'Unknown error';
        res.status(500).json({ success: false, error: message });
      }
    },

    async getAllCapacity(_req: Request, res: Response) {
      try {
        const result = await capacityManager.getAllCapacity();
        res.json({ success: true, data: result });
      } catch (error: unknown) {
        const message = error instanceof Error ? error.message : 'Unknown error';
        res.status(500).json({ success: false, error: message });
      }
    },

    async getAllHealth(_req: Request, res: Response) {
      try {
        const healthData = await healthTracker.getAllHealth();
        res.json({ success: true, data: { accounts: healthData } });
      } catch (error: unknown) {
        const message = error instanceof Error ? error.message : 'Unknown error';
        res.status(500).json({ success: false, error: message });
      }
    },
  };
}
