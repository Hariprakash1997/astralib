import type { AnalyticsStatsModel } from '../schemas/analytics-stats.schema';
import type { LogAdapter } from '@astralibx/core';
import type {
  OverviewStats,
  TimelineEntry,
  AccountStats,
  RuleStats,
  TemplateStats,
} from '../types/stats.types';
import type { AggregationInterval } from '../constants';

export class QueryService {
  constructor(
    private AnalyticsStats: AnalyticsStatsModel,
    private logger: LogAdapter,
  ) {}

  async getOverview(dateFrom: Date, dateTo: Date): Promise<OverviewStats> {
    const fromKey = this.toDateKey(dateFrom);
    const toKey = this.toDateKey(dateTo);

    const pipeline = [
      {
        $match: {
          interval: 'daily',
          date: { $gte: fromKey, $lte: toKey },
          accountId: null,
          ruleId: null,
          templateId: null,
        },
      },
      {
        $group: {
          _id: null,
          sent: { $sum: '$sent' },
          failed: { $sum: '$failed' },
          delivered: { $sum: '$delivered' },
          bounced: { $sum: '$bounced' },
          complained: { $sum: '$complained' },
          opened: { $sum: '$opened' },
          clicked: { $sum: '$clicked' },
          unsubscribed: { $sum: '$unsubscribed' },
        },
      },
    ];

    const results = await this.AnalyticsStats.aggregate(pipeline);

    const empty = {
      startDate: fromKey,
      endDate: toKey,
      sent: 0,
      failed: 0,
      delivered: 0,
      bounced: 0,
      complained: 0,
      opened: 0,
      clicked: 0,
      unsubscribed: 0,
    };

    if (results.length === 0) return empty;

    const r = results[0];
    return {
      startDate: fromKey,
      endDate: toKey,
      sent: r.sent,
      failed: r.failed,
      delivered: r.delivered,
      bounced: r.bounced,
      complained: r.complained,
      opened: r.opened,
      clicked: r.clicked,
      unsubscribed: r.unsubscribed,
    };
  }

  async getTimeline(
    dateFrom: Date,
    dateTo: Date,
    interval: AggregationInterval = 'daily',
  ): Promise<TimelineEntry[]> {
    const fromKey = this.toDateKey(dateFrom);
    const toKey = this.toDateKey(dateTo);

    const groupId = this.buildTimeGroupId(interval);

    const pipeline = [
      {
        $match: {
          interval: 'daily',
          date: { $gte: fromKey, $lte: toKey },
          accountId: null,
          ruleId: null,
          templateId: null,
        },
      },
      {
        $group: {
          _id: groupId,
          sent: { $sum: '$sent' },
          failed: { $sum: '$failed' },
          delivered: { $sum: '$delivered' },
          bounced: { $sum: '$bounced' },
          complained: { $sum: '$complained' },
          opened: { $sum: '$opened' },
          clicked: { $sum: '$clicked' },
          unsubscribed: { $sum: '$unsubscribed' },
        },
      },
      { $sort: { _id: 1 as const } },
    ];

    const results = await this.AnalyticsStats.aggregate(pipeline);

    return results.map((r) => ({
      date: r._id,
      interval,
      sent: r.sent,
      failed: r.failed,
      delivered: r.delivered,
      bounced: r.bounced,
      complained: r.complained,
      opened: r.opened,
      clicked: r.clicked,
      unsubscribed: r.unsubscribed,
    }));
  }

  async getAccountStats(dateFrom: Date, dateTo: Date): Promise<AccountStats[]> {
    const fromKey = this.toDateKey(dateFrom);
    const toKey = this.toDateKey(dateTo);

    const results = await this.AnalyticsStats.aggregate([
      {
        $match: {
          interval: 'daily',
          date: { $gte: fromKey, $lte: toKey },
          accountId: { $ne: null },
          ruleId: null,
          templateId: null,
        },
      },
      {
        $group: {
          _id: '$accountId',
          sent: { $sum: '$sent' },
          failed: { $sum: '$failed' },
          delivered: { $sum: '$delivered' },
          bounced: { $sum: '$bounced' },
          complained: { $sum: '$complained' },
          opened: { $sum: '$opened' },
          clicked: { $sum: '$clicked' },
          unsubscribed: { $sum: '$unsubscribed' },
        },
      },
      { $sort: { sent: -1 as const } },
    ]);

    return results.map((r) => ({
      accountId: r._id.toString(),
      sent: r.sent,
      failed: r.failed,
      delivered: r.delivered,
      bounced: r.bounced,
      complained: r.complained,
      opened: r.opened,
      clicked: r.clicked,
      unsubscribed: r.unsubscribed,
    }));
  }

  async getRuleStats(dateFrom: Date, dateTo: Date): Promise<RuleStats[]> {
    const fromKey = this.toDateKey(dateFrom);
    const toKey = this.toDateKey(dateTo);

    const results = await this.AnalyticsStats.aggregate([
      {
        $match: {
          interval: 'daily',
          date: { $gte: fromKey, $lte: toKey },
          ruleId: { $ne: null },
          accountId: null,
          templateId: null,
        },
      },
      {
        $group: {
          _id: '$ruleId',
          sent: { $sum: '$sent' },
          failed: { $sum: '$failed' },
          delivered: { $sum: '$delivered' },
          bounced: { $sum: '$bounced' },
          complained: { $sum: '$complained' },
          opened: { $sum: '$opened' },
          clicked: { $sum: '$clicked' },
          unsubscribed: { $sum: '$unsubscribed' },
        },
      },
      { $sort: { sent: -1 as const } },
    ]);

    return results.map((r) => ({
      ruleId: r._id.toString(),
      sent: r.sent,
      failed: r.failed,
      delivered: r.delivered,
      bounced: r.bounced,
      complained: r.complained,
      opened: r.opened,
      clicked: r.clicked,
      unsubscribed: r.unsubscribed,
    }));
  }

  async getTemplateStats(dateFrom: Date, dateTo: Date): Promise<TemplateStats[]> {
    const fromKey = this.toDateKey(dateFrom);
    const toKey = this.toDateKey(dateTo);

    const results = await this.AnalyticsStats.aggregate([
      {
        $match: {
          interval: 'daily',
          date: { $gte: fromKey, $lte: toKey },
          templateId: { $ne: null },
          accountId: null,
          ruleId: null,
        },
      },
      {
        $group: {
          _id: '$templateId',
          sent: { $sum: '$sent' },
          failed: { $sum: '$failed' },
          delivered: { $sum: '$delivered' },
          bounced: { $sum: '$bounced' },
          complained: { $sum: '$complained' },
          opened: { $sum: '$opened' },
          clicked: { $sum: '$clicked' },
          unsubscribed: { $sum: '$unsubscribed' },
        },
      },
      { $sort: { sent: -1 as const } },
    ]);

    return results.map((r) => ({
      templateId: r._id.toString(),
      sent: r.sent,
      failed: r.failed,
      delivered: r.delivered,
      bounced: r.bounced,
      complained: r.complained,
      opened: r.opened,
      clicked: r.clicked,
      unsubscribed: r.unsubscribed,
    }));
  }

  private buildTimeGroupId(interval: AggregationInterval): string | Record<string, unknown> {
    switch (interval) {
      case 'weekly': {
        const dateExpr = { $dateFromString: { dateString: '$date' } };
        return {
          $concat: [
            { $substr: ['$date', 0, 4] },
            '-W',
            {
              $cond: [
                { $lt: [{ $isoWeek: dateExpr }, 10] },
                { $concat: ['0', { $toString: { $isoWeek: dateExpr } }] },
                { $toString: { $isoWeek: dateExpr } },
              ],
            },
          ],
        };
      }
      case 'monthly':
        return { $substr: ['$date', 0, 7] };
      case 'daily':
      default:
        return '$date';
    }
  }

  private toDateKey(date: Date): string {
    return date.toISOString().slice(0, 10);
  }
}
