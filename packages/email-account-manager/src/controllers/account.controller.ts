import type { Request, Response } from 'express';
import type { CreateEmailAccountInput, UpdateEmailAccountInput } from '../types/account.types';
import type { CapacityManager } from '../services/capacity-manager';
import type { HealthTracker } from '../services/health-tracker';
import type { WarmupManager } from '../services/warmup-manager';
import type { SmtpService } from '../services/smtp.service';
import type { ImapBounceChecker } from '../services/imap-bounce-checker';
import type { EmailAccountManagerConfig } from '../types/config.types';
import type { EmailAccountModel } from '../schemas/email-account.schema';

const MAX_METADATA_SIZE = 64_000;

function sanitizeMetadata(raw: Record<string, unknown>): Record<string, unknown> {
  if (typeof raw !== 'object' || raw === null || Array.isArray(raw)) return {};
  const json = JSON.stringify(raw);
  if (json.length > MAX_METADATA_SIZE) {
    throw new Error(`metadata exceeds ${MAX_METADATA_SIZE} byte limit`);
  }
  const { __proto__: _a, constructor: _b, prototype: _c, ...safe } = raw;
  return safe;
}

export function createAccountController(
  EmailAccount: EmailAccountModel,
  capacityManager: CapacityManager,
  healthTracker: HealthTracker,
  warmupManager: WarmupManager,
  smtpService: SmtpService,
  imapBounceChecker: ImapBounceChecker | null,
  config: EmailAccountManagerConfig,
) {
  return {
    async list(req: Request, res: Response) {
      try {
        const { status, provider, page, limit } = req.query;
        const filter: Record<string, unknown> = {};
        if (status) filter.status = status;
        if (provider) filter.provider = provider;

        const pageNum = Number(page) || 1;
        const limitNum = Number(limit) || 20;
        const skip = (pageNum - 1) * limitNum;

        const total = await EmailAccount.countDocuments(filter);
        const accounts = await EmailAccount.find(filter)
          .select('-smtp.pass -imap.pass')
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
        const account = await EmailAccount.findById(req.params.id).select('-smtp.pass -imap.pass');
        if (!account) {
          return res.status(404).json({ success: false, error: 'Account not found' });
        }
        res.json({ success: true, data: { account } });
      } catch (error: unknown) {
        const message = error instanceof Error ? error.message : 'Unknown error';
        res.status(500).json({ success: false, error: message });
      }
    },

    async create(req: Request, res: Response) {
      try {
        const input: CreateEmailAccountInput = req.body;

        if (!input.email || !input.senderName) {
          return res.status(400).json({ success: false, error: 'email and senderName are required' });
        }

        const existing = await EmailAccount.findOne({ email: input.email.toLowerCase() });
        if (existing) {
          return res.status(400).json({ success: false, error: 'Email account already exists' });
        }

        const healthDefaults = config.options?.healthDefaults;
        const warmupDefaults = config.options?.warmup?.defaultSchedule;

        const accountData = {
          email: input.email.toLowerCase(),
          senderName: input.senderName,
          provider: input.provider,
          smtp: input.smtp,
          ...(input.imap ? { imap: input.imap } : {}),
          ...(input.ses ? { ses: input.ses } : {}),
          limits: { dailyMax: input.limits?.dailyMax ?? 50 },
          health: {
            score: 100,
            consecutiveErrors: 0,
            bounceCount: 0,
            thresholds: {
              minScore: input.health?.thresholds?.minScore ?? healthDefaults?.minScore ?? 50,
              maxBounceRate: input.health?.thresholds?.maxBounceRate ?? healthDefaults?.maxBounceRate ?? 0.1,
              maxConsecutiveErrors: input.health?.thresholds?.maxConsecutiveErrors ?? healthDefaults?.maxConsecutiveErrors ?? 5,
            },
          },
          warmup: {
            enabled: true,
            startedAt: new Date(),
            currentDay: 1,
            schedule: input.warmup?.schedule || warmupDefaults || [],
          },
          status: 'warmup',
          ...(input.metadata !== undefined ? { metadata: sanitizeMetadata(input.metadata) } : {}),
          totalEmailsSent: 0,
        };

        const account = await EmailAccount.create(accountData);
        const saved = account.toObject();
        delete (saved as any).smtp?.pass;
        delete (saved as any).imap?.pass;

        res.status(201).json({ success: true, data: { account: saved } });
      } catch (error: unknown) {
        const message = error instanceof Error ? error.message : 'Unknown error';
        res.status(500).json({ success: false, error: message });
      }
    },

    async update(req: Request, res: Response) {
      try {
        const input: UpdateEmailAccountInput = req.body;
        const updates: Record<string, unknown> = {};

        if (input.senderName !== undefined) updates.senderName = input.senderName;
        if (input.status !== undefined) updates.status = input.status;
        if (input.smtp) {
          for (const [k, v] of Object.entries(input.smtp)) {
            if (v !== undefined && (k !== 'pass' || v !== '')) updates[`smtp.${k}`] = v;
          }
        }
        if (input.imap) {
          for (const [k, v] of Object.entries(input.imap)) {
            if (v !== undefined && (k !== 'pass' || v !== '')) updates[`imap.${k}`] = v;
          }
        }
        if (input.ses) {
          for (const [k, v] of Object.entries(input.ses)) {
            if (v !== undefined) updates[`ses.${k}`] = v;
          }
        }
        if (input.limits?.dailyMax !== undefined) updates['limits.dailyMax'] = input.limits.dailyMax;
        if (input.metadata !== undefined) updates.metadata = sanitizeMetadata(input.metadata);

        const account = await EmailAccount.findByIdAndUpdate(
          req.params.id,
          { $set: updates },
          { new: true },
        ).select('-smtp.pass -imap.pass');

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
        const result = await EmailAccount.findByIdAndDelete(req.params.id);
        if (!result) {
          return res.status(404).json({ success: false, error: 'Account not found' });
        }
        res.json({ success: true });
      } catch (error: unknown) {
        const message = error instanceof Error ? error.message : 'Unknown error';
        res.status(500).json({ success: false, error: message });
      }
    },

    async bulkUpdate(req: Request, res: Response) {
      try {
        const { accountIds, updates } = req.body;
        if (!Array.isArray(accountIds) || accountIds.length === 0) {
          return res.status(400).json({ success: false, error: 'accountIds array is required' });
        }

        const allowed: Record<string, unknown> = {};
        if (updates?.status !== undefined) allowed.status = updates.status;
        if (updates?.dailyMax !== undefined) allowed['limits.dailyMax'] = updates.dailyMax;

        if (Object.keys(allowed).length === 0) {
          return res.status(400).json({ success: false, error: 'No valid updates provided' });
        }

        const result = await EmailAccount.updateMany(
          { _id: { $in: accountIds } },
          { $set: allowed },
        );

        res.json({ success: true, data: { matched: result.matchedCount, modified: result.modifiedCount } });
      } catch (error: unknown) {
        const message = error instanceof Error ? error.message : 'Unknown error';
        res.status(500).json({ success: false, error: message });
      }
    },

    async getCapacity(_req: Request, res: Response) {
      try {
        const result = await capacityManager.getAllCapacity();
        res.json({ success: true, data: result });
      } catch (error: unknown) {
        const message = error instanceof Error ? error.message : 'Unknown error';
        res.status(500).json({ success: false, error: message });
      }
    },

    async getHealth(_req: Request, res: Response) {
      try {
        const accounts = await healthTracker.getAllHealth();
        res.json({ success: true, data: { accounts } });
      } catch (error: unknown) {
        const message = error instanceof Error ? error.message : 'Unknown error';
        res.status(500).json({ success: false, error: message });
      }
    },

    async getWarmupStatus(_req: Request, res: Response) {
      try {
        const accounts = await EmailAccount.find({ 'warmup.enabled': true });
        const statuses = await Promise.all(
          accounts.map((a) => warmupManager.getStatus((a as any)._id.toString())),
        );
        res.json({ success: true, data: { accounts: statuses.filter(Boolean) } });
      } catch (error: unknown) {
        const message = error instanceof Error ? error.message : 'Unknown error';
        res.status(500).json({ success: false, error: message });
      }
    },

    async testConnection(req: Request, res: Response) {
      try {
        const result = await smtpService.testConnection(req.params.id);
        res.json({ success: true, data: result });
      } catch (error: unknown) {
        const message = error instanceof Error ? error.message : 'Unknown error';
        res.status(500).json({ success: false, error: message });
      }
    },

    async checkBounces(req: Request, res: Response) {
      try {
        if (!imapBounceChecker) {
          return res.status(400).json({ success: false, error: 'IMAP bounce checker not available' });
        }
        const result = await imapBounceChecker.checkAccount(req.params.id);
        res.json({ success: true, data: result });
      } catch (error: unknown) {
        const message = error instanceof Error ? error.message : 'Unknown error';
        res.status(500).json({ success: false, error: message });
      }
    },

    async getWarmup(req: Request, res: Response) {
      try {
        const status = await warmupManager.getStatus(req.params.id);
        if (!status) {
          return res.status(404).json({ success: false, error: 'Account not found' });
        }
        res.json({ success: true, data: status });
      } catch (error: unknown) {
        const message = error instanceof Error ? error.message : 'Unknown error';
        res.status(500).json({ success: false, error: message });
      }
    },

    async updateWarmupSchedule(req: Request, res: Response) {
      try {
        const { schedule } = req.body;
        if (!Array.isArray(schedule)) {
          return res.status(400).json({ success: false, error: 'schedule array is required' });
        }
        await warmupManager.updateSchedule(req.params.id, schedule);
        res.json({ success: true });
      } catch (error: unknown) {
        const message = error instanceof Error ? error.message : 'Unknown error';
        res.status(500).json({ success: false, error: message });
      }
    },

    async startWarmup(req: Request, res: Response) {
      try {
        await warmupManager.startWarmup(req.params.id);
        res.json({ success: true });
      } catch (error: unknown) {
        const message = error instanceof Error ? error.message : 'Unknown error';
        res.status(500).json({ success: false, error: message });
      }
    },

    async completeWarmup(req: Request, res: Response) {
      try {
        await warmupManager.completeWarmup(req.params.id);
        res.json({ success: true });
      } catch (error: unknown) {
        const message = error instanceof Error ? error.message : 'Unknown error';
        res.status(500).json({ success: false, error: message });
      }
    },

    async resetWarmup(req: Request, res: Response) {
      try {
        await warmupManager.resetWarmup(req.params.id);
        res.json({ success: true });
      } catch (error: unknown) {
        const message = error instanceof Error ? error.message : 'Unknown error';
        res.status(500).json({ success: false, error: message });
      }
    },

    async updateHealthThresholds(req: Request, res: Response) {
      try {
        const { thresholds } = req.body;
        if (!thresholds || typeof thresholds !== 'object') {
          return res.status(400).json({ success: false, error: 'thresholds object is required' });
        }

        const updates: Record<string, unknown> = {};
        if (thresholds.minScore !== undefined) updates['health.thresholds.minScore'] = thresholds.minScore;
        if (thresholds.maxBounceRate !== undefined) updates['health.thresholds.maxBounceRate'] = thresholds.maxBounceRate;
        if (thresholds.maxConsecutiveErrors !== undefined) updates['health.thresholds.maxConsecutiveErrors'] = thresholds.maxConsecutiveErrors;

        const account = await EmailAccount.findByIdAndUpdate(
          req.params.id,
          { $set: updates },
          { new: true },
        ).select('-smtp.pass -imap.pass');

        if (!account) {
          return res.status(404).json({ success: false, error: 'Account not found' });
        }

        res.json({ success: true, data: { account } });
      } catch (error: unknown) {
        const message = error instanceof Error ? error.message : 'Unknown error';
        res.status(500).json({ success: false, error: message });
      }
    },
  };
}
