import type { Request, Response } from 'express';
import type { CreateTelegramIdentifierInput, UpdateTelegramIdentifierInput } from '../types/identifier.types';
import type { TelegramIdentifierModel } from '../schemas/telegram-identifier.schema';
import type { LogAdapter } from '../types/config.types';
import { IDENTIFIER_STATUS } from '../constants';

export function createIdentifierController(
  TelegramIdentifier: TelegramIdentifierModel,
  logger: LogAdapter,
) {
  return {
    async list(req: Request, res: Response) {
      try {
        const { status, contactId, page, limit } = req.query;
        const filter: Record<string, unknown> = {};
        if (status) filter.status = status;
        if (contactId) filter.contactId = contactId;

        const pageNum = Number(page) || 1;
        const limitNum = Number(limit) || 20;
        const skip = (pageNum - 1) * limitNum;

        const total = await TelegramIdentifier.countDocuments(filter);
        const identifiers = await TelegramIdentifier.find(filter)
          .sort({ createdAt: -1 })
          .skip(skip)
          .limit(limitNum);

        res.json({ success: true, data: { identifiers, total } });
      } catch (error: unknown) {
        const message = error instanceof Error ? error.message : 'Unknown error';
        res.status(500).json({ success: false, error: message });
      }
    },

    async getById(req: Request, res: Response) {
      try {
        const identifier = await TelegramIdentifier.findById(req.params.id);
        if (!identifier) {
          return res.status(404).json({ success: false, error: 'Identifier not found' });
        }
        res.json({ success: true, data: { identifier } });
      } catch (error: unknown) {
        const message = error instanceof Error ? error.message : 'Unknown error';
        res.status(500).json({ success: false, error: message });
      }
    },

    async create(req: Request, res: Response) {
      try {
        const input: CreateTelegramIdentifierInput = req.body;

        if (!input.contactId || !input.telegramUserId) {
          return res.status(400).json({ success: false, error: 'contactId and telegramUserId are required' });
        }

        const existing = await TelegramIdentifier.findOne({ telegramUserId: input.telegramUserId });
        if (existing) {
          return res.status(400).json({ success: false, error: 'Telegram user ID already registered' });
        }

        const identifier = await TelegramIdentifier.create({
          contactId: input.contactId,
          telegramUserId: input.telegramUserId,
          username: input.username,
          firstName: input.firstName,
          lastName: input.lastName,
          phone: input.phone,
          status: IDENTIFIER_STATUS.Active,
          sentCount: 0,
        });

        res.status(201).json({ success: true, data: { identifier } });
      } catch (error: unknown) {
        const message = error instanceof Error ? error.message : 'Unknown error';
        res.status(500).json({ success: false, error: message });
      }
    },

    async update(req: Request, res: Response) {
      try {
        const input: UpdateTelegramIdentifierInput = req.body;
        const updates: Record<string, unknown> = {};

        if (input.username !== undefined) updates.username = input.username;
        if (input.firstName !== undefined) updates.firstName = input.firstName;
        if (input.lastName !== undefined) updates.lastName = input.lastName;
        if (input.phone !== undefined) updates.phone = input.phone;
        if (input.status !== undefined) updates.status = input.status;
        if (input.lastActiveAt !== undefined) updates.lastActiveAt = input.lastActiveAt;

        const identifier = await TelegramIdentifier.findByIdAndUpdate(
          req.params.id,
          { $set: updates },
          { new: true },
        );

        if (!identifier) {
          return res.status(404).json({ success: false, error: 'Identifier not found' });
        }

        res.json({ success: true, data: { identifier } });
      } catch (error: unknown) {
        const message = error instanceof Error ? error.message : 'Unknown error';
        res.status(500).json({ success: false, error: message });
      }
    },

    async updateStatus(req: Request, res: Response) {
      try {
        const { status } = req.body;
        if (!status) {
          return res.status(400).json({ success: false, error: 'status is required' });
        }

        const validStatuses = Object.values(IDENTIFIER_STATUS);
        if (!validStatuses.includes(status)) {
          return res.status(400).json({ success: false, error: `Invalid status. Must be one of: ${validStatuses.join(', ')}` });
        }

        const identifier = await TelegramIdentifier.findByIdAndUpdate(
          req.params.id,
          { $set: { status } },
          { new: true },
        );

        if (!identifier) {
          return res.status(404).json({ success: false, error: 'Identifier not found' });
        }

        res.json({ success: true, data: { identifier } });
      } catch (error: unknown) {
        const message = error instanceof Error ? error.message : 'Unknown error';
        res.status(500).json({ success: false, error: message });
      }
    },

    async remove(req: Request, res: Response) {
      try {
        const result = await TelegramIdentifier.findByIdAndDelete(req.params.id);
        if (!result) {
          return res.status(404).json({ success: false, error: 'Identifier not found' });
        }
        res.json({ success: true });
      } catch (error: unknown) {
        const message = error instanceof Error ? error.message : 'Unknown error';
        res.status(500).json({ success: false, error: message });
      }
    },
  };
}
