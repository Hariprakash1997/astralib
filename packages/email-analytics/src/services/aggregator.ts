import type { EmailEventModel } from '../schemas/email-event.schema';
import type { AnalyticsStatsModel } from '../schemas/analytics-stats.schema';
import type { LogAdapter } from '@astralibx/core';
import { EVENT_TYPE, AGGREGATION_INTERVAL } from '../constants';
import { InvalidDateRangeError, AggregationError } from '../errors';

const METRIC_CONDS = {
  sent: { $cond: [{ $eq: ['$type', EVENT_TYPE.Sent] }, 1, 0] },
  failed: { $cond: [{ $eq: ['$type', EVENT_TYPE.Failed] }, 1, 0] },
  delivered: { $cond: [{ $eq: ['$type', EVENT_TYPE.Delivered] }, 1, 0] },
  bounced: { $cond: [{ $eq: ['$type', EVENT_TYPE.Bounced] }, 1, 0] },
  complained: { $cond: [{ $eq: ['$type', EVENT_TYPE.Complained] }, 1, 0] },
  opened: { $cond: [{ $eq: ['$type', EVENT_TYPE.Opened] }, 1, 0] },
  clicked: { $cond: [{ $eq: ['$type', EVENT_TYPE.Clicked] }, 1, 0] },
  unsubscribed: { $cond: [{ $eq: ['$type', EVENT_TYPE.Unsubscribed] }, 1, 0] },
};

function buildSumGroup() {
  return {
    sent: { $sum: METRIC_CONDS.sent },
    failed: { $sum: METRIC_CONDS.failed },
    delivered: { $sum: METRIC_CONDS.delivered },
    bounced: { $sum: METRIC_CONDS.bounced },
    complained: { $sum: METRIC_CONDS.complained },
    opened: { $sum: METRIC_CONDS.opened },
    clicked: { $sum: METRIC_CONDS.clicked },
    unsubscribed: { $sum: METRIC_CONDS.unsubscribed },
  };
}

export class AggregatorService {
  constructor(
    private EmailEvent: EmailEventModel,
    private AnalyticsStats: AnalyticsStatsModel,
    private timezone: string,
    private logger: LogAdapter,
  ) {}

  async aggregateDaily(date?: Date): Promise<void> {
    const targetDate = date || new Date();
    const dayStart = this.getDayStart(targetDate);
    const dayEnd = this.getDayEnd(targetDate);
    const dateKey = this.toDateKey(dayStart);

    this.logger.info('Running daily aggregation', { date: dateKey });

    await this.aggregateByAccount(dayStart, dayEnd, dateKey);
    await this.aggregateByRule(dayStart, dayEnd, dateKey);
    await this.aggregateByTemplate(dayStart, dayEnd, dateKey);
    await this.aggregateOverall(dayStart, dayEnd, dateKey);

    this.logger.info('Daily aggregation complete', { date: dateKey });
  }

  async aggregateRange(from: Date, to: Date): Promise<void> {
    if (!(from instanceof Date) || isNaN(from.getTime())) {
      throw new InvalidDateRangeError(String(from), String(to));
    }
    if (!(to instanceof Date) || isNaN(to.getTime())) {
      throw new InvalidDateRangeError(String(from), String(to));
    }
    if (from > to) {
      throw new InvalidDateRangeError(from.toISOString(), to.toISOString());
    }

    const current = this.getDayStart(from);
    const end = this.getDayStart(to);

    this.logger.info('Running range aggregation', {
      from: this.toDateKey(current),
      to: this.toDateKey(end),
    });

    while (current <= end) {
      await this.aggregateDaily(new Date(current));
      current.setDate(current.getDate() + 1);
    }

    this.logger.info('Range aggregation complete');
  }

  private async aggregateByAccount(
    dayStart: Date,
    dayEnd: Date,
    dateKey: string,
  ): Promise<void> {
    let results: any[];
    try {
      results = await this.EmailEvent.aggregate([
        { $match: { timestamp: { $gte: dayStart, $lt: dayEnd } } },
        { $group: { _id: '$accountId', ...buildSumGroup() } },
      ]);
    } catch (error) {
      throw new AggregationError('byAccount', error instanceof Error ? error : new Error(String(error)));
    }

    const bulkOps = results.map((r) => ({
      updateOne: {
        filter: { date: dateKey, interval: AGGREGATION_INTERVAL.Daily, accountId: r._id, ruleId: null, templateId: null },
        update: {
          $set: {
            date: dateKey,
            interval: AGGREGATION_INTERVAL.Daily,
            accountId: r._id,
            ruleId: null,
            templateId: null,
            sent: r.sent, failed: r.failed, delivered: r.delivered,
            bounced: r.bounced, complained: r.complained, opened: r.opened,
            clicked: r.clicked, unsubscribed: r.unsubscribed,
            updatedAt: new Date(),
          },
        },
        upsert: true,
      },
    }));

    if (bulkOps.length > 0) {
      await this.AnalyticsStats.bulkWrite(bulkOps as any);
    }
  }

  private async aggregateByRule(
    dayStart: Date,
    dayEnd: Date,
    dateKey: string,
  ): Promise<void> {
    let results: any[];
    try {
      results = await this.EmailEvent.aggregate([
        { $match: { timestamp: { $gte: dayStart, $lt: dayEnd }, ruleId: { $exists: true, $ne: null } } },
        { $group: { _id: '$ruleId', ...buildSumGroup() } },
      ]);
    } catch (error) {
      throw new AggregationError('byRule', error instanceof Error ? error : new Error(String(error)));
    }

    const bulkOps = results.map((r) => ({
      updateOne: {
        filter: { date: dateKey, interval: AGGREGATION_INTERVAL.Daily, ruleId: r._id, accountId: null, templateId: null },
        update: {
          $set: {
            date: dateKey,
            interval: AGGREGATION_INTERVAL.Daily,
            ruleId: r._id,
            accountId: null,
            templateId: null,
            sent: r.sent, failed: r.failed, delivered: r.delivered,
            bounced: r.bounced, complained: r.complained, opened: r.opened,
            clicked: r.clicked, unsubscribed: r.unsubscribed,
            updatedAt: new Date(),
          },
        },
        upsert: true,
      },
    }));

    if (bulkOps.length > 0) {
      await this.AnalyticsStats.bulkWrite(bulkOps as any);
    }
  }

  private async aggregateByTemplate(
    dayStart: Date,
    dayEnd: Date,
    dateKey: string,
  ): Promise<void> {
    let results: any[];
    try {
      results = await this.EmailEvent.aggregate([
        { $match: { timestamp: { $gte: dayStart, $lt: dayEnd }, templateId: { $exists: true, $ne: null } } },
        { $group: { _id: '$templateId', ...buildSumGroup() } },
      ]);
    } catch (error) {
      throw new AggregationError('byTemplate', error instanceof Error ? error : new Error(String(error)));
    }

    const bulkOps = results.map((r) => ({
      updateOne: {
        filter: { date: dateKey, interval: AGGREGATION_INTERVAL.Daily, templateId: r._id, accountId: null, ruleId: null },
        update: {
          $set: {
            date: dateKey,
            interval: AGGREGATION_INTERVAL.Daily,
            templateId: r._id,
            accountId: null,
            ruleId: null,
            sent: r.sent, failed: r.failed, delivered: r.delivered,
            bounced: r.bounced, complained: r.complained, opened: r.opened,
            clicked: r.clicked, unsubscribed: r.unsubscribed,
            updatedAt: new Date(),
          },
        },
        upsert: true,
      },
    }));

    if (bulkOps.length > 0) {
      await this.AnalyticsStats.bulkWrite(bulkOps as any);
    }
  }

  private async aggregateOverall(
    dayStart: Date,
    dayEnd: Date,
    dateKey: string,
  ): Promise<void> {
    let results: any[];
    try {
      results = await this.EmailEvent.aggregate([
        { $match: { timestamp: { $gte: dayStart, $lt: dayEnd } } },
        { $group: { _id: null, ...buildSumGroup() } },
      ]);
    } catch (error) {
      throw new AggregationError('overall', error instanceof Error ? error : new Error(String(error)));
    }

    if (results.length > 0) {
      const r = results[0];
      await this.AnalyticsStats.updateOne(
        { date: dateKey, interval: AGGREGATION_INTERVAL.Daily, accountId: null, ruleId: null, templateId: null },
        {
          $set: {
            date: dateKey,
            interval: AGGREGATION_INTERVAL.Daily,
            accountId: null,
            ruleId: null,
            templateId: null,
            sent: r.sent, failed: r.failed, delivered: r.delivered,
            bounced: r.bounced, complained: r.complained, opened: r.opened,
            clicked: r.clicked, unsubscribed: r.unsubscribed,
            updatedAt: new Date(),
          },
        },
        { upsert: true },
      );
    }
  }

  private getDayStart(date: Date): Date {
    const formatter = new Intl.DateTimeFormat('en-CA', {
      timeZone: this.timezone,
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
    });
    const parts = formatter.formatToParts(date);
    const year = parseInt(parts.find((p) => p.type === 'year')!.value, 10);
    const month = parseInt(parts.find((p) => p.type === 'month')!.value, 10) - 1;
    const day = parseInt(parts.find((p) => p.type === 'day')!.value, 10);

    const localMidnight = new Date(Date.UTC(year, month, day));
    const offsetMs = this.getTimezoneOffsetMs(localMidnight);
    return new Date(localMidnight.getTime() - offsetMs);
  }

  private getDayEnd(date: Date): Date {
    const dayStart = this.getDayStart(date);
    return new Date(dayStart.getTime() + 24 * 60 * 60 * 1000);
  }

  private getTimezoneOffsetMs(utcDate: Date): number {
    const utcStr = utcDate.toLocaleString('en-US', { timeZone: 'UTC' });
    const tzStr = utcDate.toLocaleString('en-US', { timeZone: this.timezone });
    return new Date(tzStr).getTime() - new Date(utcStr).getTime();
  }

  private toDateKey(date: Date): string {
    const formatter = new Intl.DateTimeFormat('en-CA', {
      timeZone: this.timezone,
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
    });
    return formatter.format(date);
  }
}
