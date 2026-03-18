import type { Request, Response } from 'express';
import type { Model } from 'mongoose';
import { buildDateRangeFilter, calculatePagination } from '../utils';
import { asyncHandler } from '../utils/controller';

export function createSendLogController(EmailRuleSend: Model<any>) {
  const list = asyncHandler(async (req: Request, res: Response) => {
    const { ruleId, status, email, from, to, page, limit } = req.query;
    const filter: Record<string, any> = {};
    if (ruleId) filter.ruleId = ruleId;
    if (status) filter.status = status;
    if (email) filter.userId = { $regex: email, $options: 'i' };
    Object.assign(filter, buildDateRangeFilter('sentAt', from as string | undefined, to as string | undefined));

    const pagination = calculatePagination(Number(page) || undefined, Number(limit) || 50, 200);

    const [sends, total] = await Promise.all([
      EmailRuleSend.find(filter).sort({ sentAt: -1 }).skip(pagination.skip).limit(pagination.limit).lean(),
      EmailRuleSend.countDocuments(filter),
    ]);

    res.json({ success: true, data: { sends, total } });
  });

  return { list };
}
