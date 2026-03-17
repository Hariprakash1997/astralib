import type { Request, Response } from 'express';
import type { EventRecorderService } from '../services/event-recorder';
import type { AggregatorService } from '../services/aggregator';
import type { QueryService } from '../services/query.service';
import { InvalidDateRangeError } from '../errors';

const MAX_AGGREGATION_RANGE_DAYS = 365;

function parseDateRange(req: Request): { dateFrom: Date; dateTo: Date } | { error: string } {
  const now = new Date();
  const thirtyDaysAgo = new Date();
  thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);

  const dateFrom = req.query.from
    ? new Date(req.query.from as string)
    : thirtyDaysAgo;
  const dateTo = req.query.to
    ? new Date(req.query.to as string)
    : now;

  if (isNaN(dateFrom.getTime())) {
    return { error: `Invalid 'from' date: ${req.query.from}` };
  }
  if (isNaN(dateTo.getTime())) {
    return { error: `Invalid 'to' date: ${req.query.to}` };
  }

  return { dateFrom, dateTo };
}

export function createAnalyticsController(
  eventRecorder: EventRecorderService,
  aggregator: AggregatorService,
  queryService: QueryService,
) {
  return {
    async getOverview(req: Request, res: Response) {
      try {
        const parsed = parseDateRange(req);
        if ('error' in parsed) {
          return res.status(400).json({ success: false, error: parsed.error });
        }
        const data = await queryService.getOverview(parsed.dateFrom, parsed.dateTo);
        res.json({ success: true, data });
      } catch (error: unknown) {
        const message = error instanceof Error ? error.message : 'Unknown error';
        res.status(500).json({ success: false, error: message });
      }
    },

    async getTimeline(req: Request, res: Response) {
      try {
        const parsed = parseDateRange(req);
        if ('error' in parsed) {
          return res.status(400).json({ success: false, error: parsed.error });
        }
        const interval = (req.query.interval as string) || 'daily';

        if (!['daily', 'weekly', 'monthly'].includes(interval)) {
          return res.status(400).json({
            success: false,
            error: 'interval must be daily, weekly, or monthly',
          });
        }

        const data = await queryService.getTimeline(
          parsed.dateFrom,
          parsed.dateTo,
          interval as 'daily' | 'weekly' | 'monthly',
        );
        res.json({ success: true, data });
      } catch (error: unknown) {
        const message = error instanceof Error ? error.message : 'Unknown error';
        res.status(500).json({ success: false, error: message });
      }
    },

    async getAccountStats(req: Request, res: Response) {
      try {
        const parsed = parseDateRange(req);
        if ('error' in parsed) {
          return res.status(400).json({ success: false, error: parsed.error });
        }
        const data = await queryService.getAccountStats(parsed.dateFrom, parsed.dateTo);
        res.json({ success: true, data });
      } catch (error: unknown) {
        const message = error instanceof Error ? error.message : 'Unknown error';
        res.status(500).json({ success: false, error: message });
      }
    },

    async getRuleStats(req: Request, res: Response) {
      try {
        const parsed = parseDateRange(req);
        if ('error' in parsed) {
          return res.status(400).json({ success: false, error: parsed.error });
        }
        const data = await queryService.getRuleStats(parsed.dateFrom, parsed.dateTo);
        res.json({ success: true, data });
      } catch (error: unknown) {
        const message = error instanceof Error ? error.message : 'Unknown error';
        res.status(500).json({ success: false, error: message });
      }
    },

    async getTemplateStats(req: Request, res: Response) {
      try {
        const parsed = parseDateRange(req);
        if ('error' in parsed) {
          return res.status(400).json({ success: false, error: parsed.error });
        }
        const data = await queryService.getTemplateStats(parsed.dateFrom, parsed.dateTo);
        res.json({ success: true, data });
      } catch (error: unknown) {
        const message = error instanceof Error ? error.message : 'Unknown error';
        res.status(500).json({ success: false, error: message });
      }
    },

    async getChannelStats(req: Request, res: Response) {
      try {
        const parsed = parseDateRange(req);
        if ('error' in parsed) {
          return res.status(400).json({ success: false, error: parsed.error });
        }
        const data = await queryService.getChannelBreakdown(parsed.dateFrom, parsed.dateTo);
        res.json({ success: true, data });
      } catch (error: unknown) {
        const message = error instanceof Error ? error.message : 'Unknown error';
        res.status(500).json({ success: false, error: message });
      }
    },

    async getVariantStats(req: Request, res: Response) {
      try {
        const parsed = parseDateRange(req);
        if ('error' in parsed) {
          return res.status(400).json({ success: false, error: parsed.error });
        }
        const templateId = req.query.templateId as string | undefined;
        const data = await queryService.getVariantBreakdown(parsed.dateFrom, parsed.dateTo, templateId);
        res.json({ success: true, data });
      } catch (error: unknown) {
        const message = error instanceof Error ? error.message : 'Unknown error';
        res.status(500).json({ success: false, error: message });
      }
    },

    async trackEvent(req: Request, res: Response) {
      try {
        const { type, recipientEmail, externalUserId, channel, ruleId, templateId, accountId, metadata } = req.body;

        if (!type) {
          return res.status(400).json({ success: false, error: 'type is required' });
        }
        if (!recipientEmail && !externalUserId) {
          return res.status(400).json({ success: false, error: 'recipientEmail or externalUserId is required' });
        }

        await eventRecorder.record({
          type,
          recipientEmail: recipientEmail || '',
          externalUserId,
          channel,
          ruleId,
          templateId,
          accountId: accountId || '',
          metadata,
        });

        res.json({ success: true, data: { ok: true } });
      } catch (err) {
        res.status(500).json({ success: false, error: err instanceof Error ? err.message : 'Failed to track event' });
      }
    },

    async triggerAggregation(req: Request, res: Response) {
      try {
        const { from, to } = req.body;

        if (from && to) {
          const fromDate = new Date(from);
          const toDate = new Date(to);

          if (isNaN(fromDate.getTime()) || isNaN(toDate.getTime())) {
            return res.status(400).json({
              success: false,
              error: 'Invalid date format for from/to',
            });
          }

          if (fromDate > toDate) {
            return res.status(400).json({
              success: false,
              error: `Invalid date range: 'from' must be before 'to'`,
            });
          }

          const diffDays = (toDate.getTime() - fromDate.getTime()) / (1000 * 60 * 60 * 24);
          if (diffDays > MAX_AGGREGATION_RANGE_DAYS) {
            return res.status(400).json({
              success: false,
              error: `Date range exceeds maximum of ${MAX_AGGREGATION_RANGE_DAYS} days`,
            });
          }

          await aggregator.aggregateRange(fromDate, toDate);
          res.json({ success: true, message: 'Range aggregation complete' });
        } else {
          let date: Date | undefined;
          if (from) {
            date = new Date(from);
            if (isNaN(date.getTime())) {
              return res.status(400).json({
                success: false,
                error: 'Invalid date format for from',
              });
            }
          }
          await aggregator.aggregateDaily(date);
          res.json({ success: true, message: 'Daily aggregation complete' });
        }
      } catch (error: unknown) {
        if (error instanceof InvalidDateRangeError) {
          return res.status(400).json({ success: false, error: error.message });
        }
        const message = error instanceof Error ? error.message : 'Unknown error';
        res.status(500).json({ success: false, error: message });
      }
    },
  };
}
