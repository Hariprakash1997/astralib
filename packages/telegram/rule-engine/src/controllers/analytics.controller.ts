import { Request, Response } from 'express';
import type { TelegramSendLogModel } from '../schemas/send-log.schema';
import type { TelegramErrorLogModel } from '../schemas/error-log.schema';
import type { TelegramRunLogModel } from '../schemas/run-log.schema';
import { noopLogger } from '@astralibx/core';
import type { LogAdapter } from '../types/config.types';

export function createAnalyticsController(
  TelegramSendLog: TelegramSendLogModel,
  TelegramErrorLog: TelegramErrorLogModel,
  TelegramRunLog: TelegramRunLogModel,
  logger?: LogAdapter
) {
  const log = logger || noopLogger;

  function buildDateFilter(from?: string, to?: string): Record<string, Date> | undefined {
    if (!from && !to) return undefined;
    const filter: Record<string, Date> = {};
    if (from) filter.$gte = new Date(from);
    if (to) filter.$lte = new Date(to);
    return filter;
  }

  function parsePagination(query: Record<string, any>): { skip: number; limit: number } {
    const page = Number(query.page) || 1;
    const limit = Math.min(Number(query.limit) || 50, 200);
    const skip = (page - 1) * limit;
    return { skip, limit };
  }

  async function sendLogs(req: Request, res: Response) {
    try {
      const { ruleId, runId, contactId, status, from, to } = req.query;
      const filter: Record<string, any> = {};

      if (ruleId) filter.ruleId = ruleId;
      if (runId) filter.runId = runId;
      if (contactId) filter.contactId = contactId;
      if (status) filter.deliveryStatus = status;

      const dateFilter = buildDateFilter(from as string, to as string);
      if (dateFilter) filter.sentAt = dateFilter;

      const { skip, limit } = parsePagination(req.query);

      const [logs, total] = await Promise.all([
        TelegramSendLog.find(filter).sort({ sentAt: -1 }).skip(skip).limit(limit).lean(),
        TelegramSendLog.countDocuments(filter),
      ]);

      res.json({ success: true, data: { logs, total } });
    } catch (error: unknown) {
      const message = error instanceof Error ? error.message : 'Failed to query send logs';
      log.error(`Analytics sendLogs error: ${message}`);
      res.status(500).json({ success: false, error: message });
    }
  }

  async function errorLogs(req: Request, res: Response) {
    try {
      const { errorCategory, operation, from, to } = req.query;
      const filter: Record<string, any> = {};

      if (errorCategory) filter.errorCategory = errorCategory;
      if (operation) filter.operation = operation;

      const dateFilter = buildDateFilter(from as string, to as string);
      if (dateFilter) filter.createdAt = dateFilter;

      const { skip, limit } = parsePagination(req.query);

      const [logs, total] = await Promise.all([
        TelegramErrorLog.find(filter).sort({ createdAt: -1 }).skip(skip).limit(limit).lean(),
        TelegramErrorLog.countDocuments(filter),
      ]);

      res.json({ success: true, data: { logs, total } });
    } catch (error: unknown) {
      const message = error instanceof Error ? error.message : 'Failed to query error logs';
      log.error(`Analytics errorLogs error: ${message}`);
      res.status(500).json({ success: false, error: message });
    }
  }

  async function runLogs(req: Request, res: Response) {
    try {
      const { status, from, to } = req.query;
      const filter: Record<string, any> = {};

      if (status) filter.status = status;

      const dateFilter = buildDateFilter(from as string, to as string);
      if (dateFilter) filter.startedAt = dateFilter;

      const { skip, limit } = parsePagination(req.query);

      const [logs, total] = await Promise.all([
        TelegramRunLog.find(filter).sort({ startedAt: -1 }).skip(skip).limit(limit).lean(),
        TelegramRunLog.countDocuments(filter),
      ]);

      res.json({ success: true, data: { logs, total } });
    } catch (error: unknown) {
      const message = error instanceof Error ? error.message : 'Failed to query run logs';
      log.error(`Analytics runLogs error: ${message}`);
      res.status(500).json({ success: false, error: message });
    }
  }

  async function stats(req: Request, res: Response) {
    try {
      const { from, to } = req.query;
      const matchStage: Record<string, any> = {};

      const dateFilter = buildDateFilter(from as string, to as string);
      if (dateFilter) matchStage.sentAt = dateFilter;

      const pipeline: any[] = [];
      if (Object.keys(matchStage).length > 0) {
        pipeline.push({ $match: matchStage });
      }
      pipeline.push({
        $group: {
          _id: null,
          totalSent: { $sum: { $cond: [{ $eq: ['$deliveryStatus', 'sent'] }, 1, 0] } },
          totalDelivered: { $sum: { $cond: [{ $eq: ['$deliveryStatus', 'delivered'] }, 1, 0] } },
          totalRead: { $sum: { $cond: [{ $eq: ['$deliveryStatus', 'read'] }, 1, 0] } },
          totalFailed: { $sum: { $cond: [{ $eq: ['$deliveryStatus', 'failed'] }, 1, 0] } },
          totalPending: { $sum: { $cond: [{ $eq: ['$deliveryStatus', 'pending'] }, 1, 0] } },
          total: { $sum: 1 },
        },
      });

      const [result] = await TelegramSendLog.aggregate(pipeline);
      const data = result || { totalSent: 0, totalDelivered: 0, totalRead: 0, totalFailed: 0, totalPending: 0, total: 0 };
      delete data._id;

      res.json({ success: true, data });
    } catch (error: unknown) {
      const message = error instanceof Error ? error.message : 'Failed to compute stats';
      log.error(`Analytics stats error: ${message}`);
      res.status(500).json({ success: false, error: message });
    }
  }

  return { sendLogs, errorLogs, runLogs, stats };
}
