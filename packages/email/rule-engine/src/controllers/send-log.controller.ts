import type { Request, Response } from 'express';
import type { Model } from 'mongoose';

export function createSendLogController(EmailRuleSend: Model<any>) {
  async function list(req: Request, res: Response) {
    try {
      const { ruleId, status, email, from, to, page, limit } = req.query;
      const filter: Record<string, any> = {};
      if (ruleId) filter.ruleId = ruleId;
      if (status) filter.status = status;
      if (email) filter.userId = { $regex: email, $options: 'i' };
      if (from || to) {
        filter.sentAt = {};
        if (from) filter.sentAt.$gte = new Date(from as string);
        if (to) filter.sentAt.$lte = new Date(to as string);
      }

      const pageNum = Number(page) || 1;
      const limitNum = Math.min(Number(limit) || 50, 200);
      const skip = (pageNum - 1) * limitNum;

      const [sends, total] = await Promise.all([
        EmailRuleSend.find(filter).sort({ sentAt: -1 }).skip(skip).limit(limitNum).lean(),
        EmailRuleSend.countDocuments(filter),
      ]);

      res.json({ success: true, data: { sends, total } });
    } catch (error: unknown) {
      const message = error instanceof Error ? error.message : 'Failed to query send logs';
      res.status(500).json({ success: false, error: message });
    }
  }

  return { list };
}
