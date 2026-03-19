import type { Request, Response } from 'express';
import type { Model } from 'mongoose';
import { buildDateRangeFilter, calculatePagination } from '../utils/helpers';
import { asyncHandler } from '../utils/helpers';
import { SEND_STATUS } from '../constants';

function escapeRegex(str: string): string {
  return str.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

export function createSendLogController(SendLog: Model<any>) {
  const list = asyncHandler(async (req: Request, res: Response) => {
    const { ruleId, status, userId, from, to, page, limit } = req.query;
    const filter: Record<string, any> = {};
    if (ruleId && typeof ruleId === 'string') filter.ruleId = ruleId;
    if (status && typeof status === 'string' && Object.values(SEND_STATUS).includes(status as any)) filter.status = status;
    if (userId) filter.userId = { $regex: escapeRegex(userId as string), $options: 'i' };
    Object.assign(filter, buildDateRangeFilter('sentAt', from as string | undefined, to as string | undefined));

    const pagination = calculatePagination(Number(page) || undefined, Number(limit) || 50, 200);

    const [sends, total] = await Promise.all([
      SendLog.find(filter).sort({ sentAt: -1 }).skip(pagination.skip).limit(pagination.limit).lean(),
      SendLog.countDocuments(filter),
    ]);

    res.json({ success: true, data: { sends, total } });
  });

  return { list };
}
