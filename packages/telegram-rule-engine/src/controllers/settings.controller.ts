import { Request, Response } from 'express';
import type { TelegramThrottleConfigModel } from '../schemas/throttle-config.schema';

export function createSettingsController(TelegramThrottleConfig: TelegramThrottleConfigModel) {

  async function getThrottleConfig(_req: Request, res: Response) {
    try {
      const config = await TelegramThrottleConfig.getConfig();
      res.json({ success: true, data: { config } });
    } catch (error: unknown) {
      const message = error instanceof Error ? error.message : 'Unknown error';
      res.status(500).json({ success: false, error: message });
    }
  }

  async function updateThrottleConfig(req: Request, res: Response) {
    try {
      const { maxPerUserPerDay, maxPerUserPerWeek, minGapDays, throttleWindow } = req.body;

      const updates: Record<string, unknown> = {};
      if (maxPerUserPerDay !== undefined) {
        if (!Number.isInteger(maxPerUserPerDay) || maxPerUserPerDay < 1) {
          return res.status(400).json({ success: false, error: 'maxPerUserPerDay must be a positive integer' });
        }
        updates.maxPerUserPerDay = maxPerUserPerDay;
      }
      if (maxPerUserPerWeek !== undefined) {
        if (!Number.isInteger(maxPerUserPerWeek) || maxPerUserPerWeek < 1) {
          return res.status(400).json({ success: false, error: 'maxPerUserPerWeek must be a positive integer' });
        }
        updates.maxPerUserPerWeek = maxPerUserPerWeek;
      }
      if (minGapDays !== undefined) {
        if (!Number.isInteger(minGapDays) || minGapDays < 0) {
          return res.status(400).json({ success: false, error: 'minGapDays must be a non-negative integer' });
        }
        updates.minGapDays = minGapDays;
      }
      if (throttleWindow !== undefined) {
        if (throttleWindow !== 'rolling' && throttleWindow !== 'fixed') {
          return res.status(400).json({ success: false, error: 'throttleWindow must be "rolling" or "fixed"' });
        }
        updates.throttleWindow = throttleWindow;
      }

      if (Object.keys(updates).length === 0) {
        return res.status(400).json({ success: false, error: 'No valid fields to update' });
      }

      const config = await TelegramThrottleConfig.getConfig();
      const finalDaily = (updates.maxPerUserPerDay as number) ?? config.maxPerUserPerDay;
      const finalWeekly = (updates.maxPerUserPerWeek as number) ?? config.maxPerUserPerWeek;
      if (finalWeekly < finalDaily) {
        return res.status(400).json({ success: false, error: 'maxPerUserPerWeek must be >= maxPerUserPerDay' });
      }

      const updated = await TelegramThrottleConfig.findByIdAndUpdate(
        config._id,
        { $set: updates },
        { new: true }
      );

      res.json({ success: true, data: { config: updated } });
    } catch (error: unknown) {
      const message = error instanceof Error ? error.message : 'Unknown error';
      res.status(500).json({ success: false, error: message });
    }
  }

  return { getThrottleConfig, updateThrottleConfig };
}
