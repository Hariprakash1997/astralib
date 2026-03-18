import type { Request, Response } from 'express';
import type { CreateTelegramAccountInput, UpdateTelegramAccountInput } from '../types/account.types';
import type { TelegramAccountModel } from '../schemas/telegram-account.schema';
import type { TelegramDailyStatsModel } from '../schemas/telegram-daily-stats.schema';
import type { ConnectionService } from '../services/connection.service';
import type { CapacityManager } from '../services/capacity-manager';
import type { QuarantineService } from '../services/quarantine.service';
import type { HealthTracker } from '../services/health-tracker';
import type { LogAdapter, TelegramAccountManagerConfig } from '../types/config.types';
import { Types } from 'mongoose';
import { ACCOUNT_STATUS, DEFAULT_DAILY_LIMIT, DEFAULT_HEALTH_SCORE, DEFAULT_MAX_ACCOUNTS, DEFAULT_WARMUP_SCHEDULE, MAX_PAGE_LIMIT } from '../constants';

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
  const validateId = (id: string, res: Response): boolean => {
    if (!Types.ObjectId.isValid(id)) {
      res.status(400).json({ success: false, error: 'Invalid ID format' });
      return false;
    }
    return true;
  };

  return {
    async list(req: Request, res: Response) {
      try {
        const { status, tag, page, limit } = req.query;

        const validStatuses: string[] = Object.values(ACCOUNT_STATUS);
        if (status && !validStatuses.includes(status as string)) {
          return res.status(400).json({ success: false, error: `Invalid status. Must be one of: ${validStatuses.join(', ')}` });
        }

        const filter: Record<string, unknown> = {};
        if (status) filter.status = status;
        if (tag) filter.tags = tag;

        const pageNum = Math.max(Number(page) || 1, 1);
        const limitNum = Math.min(Number(limit) || 20, MAX_PAGE_LIMIT);
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
        if (!validateId(id, res)) return;
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
        if (!validateId(id, res)) return;
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
        if (!validateId(id, res)) return;
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

        const totalAccounts = await TelegramAccount.countDocuments();
        const maxAccounts = config.options?.maxAccounts ?? DEFAULT_MAX_ACCOUNTS;
        if (totalAccounts >= maxAccounts) {
          return res.status(400).json({ success: false, error: `Maximum accounts (${maxAccounts}) reached` });
        }

        const warmupSchedule = config.options?.warmup?.defaultSchedule || DEFAULT_WARMUP_SCHEDULE;
        const warmupEnabled = config.options?.warmup?.enabled !== false;

        const accountData = {
          phone: input.phone,
          name: input.name,
          session: input.session,
          tags: input.tags || [],
          status: warmupEnabled ? ACCOUNT_STATUS.Warmup : ACCOUNT_STATUS.Disconnected,
          healthScore: DEFAULT_HEALTH_SCORE,
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
        const id = req.params.id as string;
        if (!validateId(id, res)) return;

        if (input.session !== undefined) {
          const client = connectionService.getClient(id);
          if (client) {
            return res.status(400).json({ success: false, error: 'Disconnect account before updating session' });
          }
        }

        if (input.currentDailyLimit !== undefined && input.currentDailyLimit < 0) {
          return res.status(400).json({ success: false, error: 'currentDailyLimit must be non-negative' });
        }
        if (input.currentDelayMin !== undefined && input.currentDelayMax !== undefined && input.currentDelayMin > input.currentDelayMax) {
          return res.status(400).json({ success: false, error: 'currentDelayMin must not exceed currentDelayMax' });
        }

        const updates: Record<string, unknown> = {};

        if (input.name !== undefined) updates.name = input.name;
        if (input.session !== undefined) updates.session = input.session;
        if (input.currentDailyLimit !== undefined) updates.currentDailyLimit = input.currentDailyLimit;
        if (input.currentDelayMin !== undefined) updates.currentDelayMin = input.currentDelayMin;
        if (input.currentDelayMax !== undefined) updates.currentDelayMax = input.currentDelayMax;
        if (input.tags !== undefined) updates.tags = input.tags;

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
        if (!validateId(id, res)) return;
        const client = connectionService.getClient(id);
        if (client) {
          return res.status(400).json({ success: false, error: 'Account must be disconnected before deletion' });
        }

        const result = await TelegramAccount.findByIdAndDelete(id);
        if (!result) {
          return res.status(404).json({ success: false, error: 'Account not found' });
        }

        await TelegramDailyStats.deleteMany({ accountId: new Types.ObjectId(id) });

        res.json({ success: true });
      } catch (error: unknown) {
        const message = error instanceof Error ? error.message : 'Unknown error';
        res.status(500).json({ success: false, error: message });
      }
    },

    async connect(req: Request, res: Response) {
      try {
        const id = req.params.id as string;
        if (!validateId(id, res)) return;
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
        if (!validateId(id, res)) return;
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
        if (!validateId(id, res)) return;
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
        if (durationMs !== undefined && (typeof durationMs !== 'number' || durationMs <= 0)) {
          return res.status(400).json({ success: false, error: 'durationMs must be a positive number' });
        }

        const id = req.params.id as string;
        if (!validateId(id, res)) return;
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
        if (!validateId(id, res)) return;
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

    async sendMessage(req: Request, res: Response) {
      try {
        const id = req.params.id as string;
        if (!validateId(id, res)) return;
        const { chatId, text } = req.body;
        if (!chatId || !text) {
          return res.status(400).json({ success: false, error: 'chatId and text are required' });
        }

        const result = await connectionService.sendMessage(id, chatId, text);
        res.json({ success: true, data: result });
      } catch (error: unknown) {
        const message = error instanceof Error ? error.message : 'Unknown error';
        res.status(500).json({ success: false, error: message });
      }
    },

    async connectAll(_req: Request, res: Response) {
      try {
        const result = await connectionService.connectAll();
        res.json({ success: true, data: result });
      } catch (error: unknown) {
        const message = error instanceof Error ? error.message : 'Unknown error';
        res.status(500).json({ success: false, error: message });
      }
    },

    async disconnectAll(_req: Request, res: Response) {
      try {
        await connectionService.disconnectAll();
        res.json({ success: true });
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
