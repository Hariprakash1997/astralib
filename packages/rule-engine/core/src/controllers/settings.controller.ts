import { Request, Response } from 'express';
import type { ThrottleConfigModel } from '../schemas/throttle-config.schema';
import { asyncHandler } from '../utils/helpers';

export function createSettingsController(ThrottleConfig: ThrottleConfigModel) {

  const getThrottleConfig = asyncHandler(async (_req: Request, res: Response) => {
    const config = await ThrottleConfig.getConfig();
    res.json({ success: true, data: { config } });
  });

  const updateThrottleConfig = asyncHandler(async (req: Request, res: Response) => {
    const { maxPerUserPerDay, maxPerUserPerWeek, minGapDays, sendWindow } = req.body;

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
    if (sendWindow !== undefined) {
      if (sendWindow === null) {
        updates.sendWindow = undefined;
      } else {
        const { startHour, endHour, timezone } = sendWindow;
        if (!Number.isInteger(startHour) || startHour < 0 || startHour > 23) {
          return res.status(400).json({ success: false, error: 'sendWindow.startHour must be an integer 0-23' });
        }
        if (!Number.isInteger(endHour) || endHour < 0 || endHour > 23) {
          return res.status(400).json({ success: false, error: 'sendWindow.endHour must be an integer 0-23' });
        }
        if (typeof timezone !== 'string' || !timezone.trim()) {
          return res.status(400).json({ success: false, error: 'sendWindow.timezone must be a non-empty string' });
        }
        updates.sendWindow = { startHour, endHour, timezone: timezone.trim() };
      }
    }

    if (Object.keys(updates).length === 0) {
      return res.status(400).json({ success: false, error: 'No valid fields to update' });
    }

    const config = await ThrottleConfig.getConfig();
    const finalDaily = (updates.maxPerUserPerDay as number) ?? config.maxPerUserPerDay;
    const finalWeekly = (updates.maxPerUserPerWeek as number) ?? config.maxPerUserPerWeek;
    if (finalWeekly < finalDaily) {
      return res.status(400).json({ success: false, error: 'maxPerUserPerWeek must be >= maxPerUserPerDay' });
    }

    const setFields: Record<string, unknown> = {};
    const unsetFields: Record<string, unknown> = {};
    for (const [key, value] of Object.entries(updates)) {
      if (value === undefined) {
        unsetFields[key] = '';
      } else {
        setFields[key] = value;
      }
    }

    const updateOp: Record<string, unknown> = {};
    if (Object.keys(setFields).length > 0) updateOp['$set'] = setFields;
    if (Object.keys(unsetFields).length > 0) updateOp['$unset'] = unsetFields;

    const updated = await ThrottleConfig.findByIdAndUpdate(
      config._id,
      updateOp,
      { new: true }
    );

    res.json({ success: true, data: { config: updated } });
  });

  return { getThrottleConfig, updateThrottleConfig };
}
