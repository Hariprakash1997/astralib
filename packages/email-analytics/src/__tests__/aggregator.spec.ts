import { describe, it, expect, vi, beforeEach } from 'vitest';
import { AggregatorService } from '../services/aggregator';
import { InvalidDateRangeError, AggregationError } from '../errors';

function createMockEmailEventModel() {
  return {
    aggregate: vi.fn().mockResolvedValue([]),
  };
}

function createMockAnalyticsStatsModel() {
  return {
    bulkWrite: vi.fn().mockResolvedValue({}),
    updateOne: vi.fn().mockResolvedValue({}),
  };
}

function createMockLogger() {
  return {
    info: vi.fn(),
    warn: vi.fn(),
    error: vi.fn(),
  };
}

function makeAggResult(id: string) {
  return {
    _id: id,
    sent: 10,
    failed: 1,
    delivered: 9,
    bounced: 0,
    complained: 0,
    opened: 5,
    clicked: 2,
    unsubscribed: 0,
  };
}

function localDate(year: number, month: number, day: number): Date {
  return new Date(year, month - 1, day, 12, 0, 0, 0);
}

function expectedDateKey(date: Date): string {
  const formatter = new Intl.DateTimeFormat('en-CA', {
    timeZone: 'UTC',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  });
  return formatter.format(date);
}

describe('AggregatorService', () => {
  let service: AggregatorService;
  let mockEmailEvent: ReturnType<typeof createMockEmailEventModel>;
  let mockAnalyticsStats: ReturnType<typeof createMockAnalyticsStatsModel>;
  let mockLogger: ReturnType<typeof createMockLogger>;

  beforeEach(() => {
    mockEmailEvent = createMockEmailEventModel();
    mockAnalyticsStats = createMockAnalyticsStatsModel();
    mockLogger = createMockLogger();
    service = new AggregatorService(
      mockEmailEvent as any,
      mockAnalyticsStats as any,
      'UTC',
      mockLogger,
    );
  });

  describe('aggregateDaily()', () => {
    it('should run 4 aggregation pipelines', async () => {
      await service.aggregateDaily(localDate(2024, 6, 15));

      expect(mockEmailEvent.aggregate).toHaveBeenCalledTimes(4);
    });

    it('should call bulkWrite when byAccount returns results', async () => {
      mockEmailEvent.aggregate
        .mockResolvedValueOnce([makeAggResult('acc1')])
        .mockResolvedValueOnce([])
        .mockResolvedValueOnce([])
        .mockResolvedValueOnce([]);

      const date = localDate(2024, 6, 15);
      await service.aggregateDaily(date);

      expect(mockAnalyticsStats.bulkWrite).toHaveBeenCalledOnce();
      const ops = mockAnalyticsStats.bulkWrite.mock.calls[0][0];
      expect(ops).toHaveLength(1);
      expect(ops[0].updateOne.update.$set.accountId).toBe('acc1');
      expect(ops[0].updateOne.update.$set.sent).toBe(10);
      expect(ops[0].updateOne.upsert).toBe(true);
    });

    it('should use null for absent dimensions in byAccount bulk ops', async () => {
      mockEmailEvent.aggregate
        .mockResolvedValueOnce([makeAggResult('acc1')])
        .mockResolvedValueOnce([])
        .mockResolvedValueOnce([])
        .mockResolvedValueOnce([]);

      await service.aggregateDaily(localDate(2024, 6, 15));

      const ops = mockAnalyticsStats.bulkWrite.mock.calls[0][0];
      expect(ops[0].updateOne.filter.ruleId).toBeNull();
      expect(ops[0].updateOne.filter.templateId).toBeNull();
    });

    it('should call bulkWrite when byRule returns results', async () => {
      mockEmailEvent.aggregate
        .mockResolvedValueOnce([])
        .mockResolvedValueOnce([makeAggResult('rule1')])
        .mockResolvedValueOnce([])
        .mockResolvedValueOnce([]);

      await service.aggregateDaily(localDate(2024, 6, 15));

      expect(mockAnalyticsStats.bulkWrite).toHaveBeenCalledOnce();
      const ops = mockAnalyticsStats.bulkWrite.mock.calls[0][0];
      expect(ops[0].updateOne.update.$set.ruleId).toBe('rule1');
    });

    it('should call bulkWrite when byTemplate returns results', async () => {
      mockEmailEvent.aggregate
        .mockResolvedValueOnce([])
        .mockResolvedValueOnce([])
        .mockResolvedValueOnce([makeAggResult('tmpl1')])
        .mockResolvedValueOnce([]);

      await service.aggregateDaily(localDate(2024, 6, 15));

      expect(mockAnalyticsStats.bulkWrite).toHaveBeenCalledOnce();
      const ops = mockAnalyticsStats.bulkWrite.mock.calls[0][0];
      expect(ops[0].updateOne.update.$set.templateId).toBe('tmpl1');
    });

    it('should call updateOne for overall aggregation with results', async () => {
      const overallResult = { ...makeAggResult(null as any), _id: null };
      mockEmailEvent.aggregate
        .mockResolvedValueOnce([])
        .mockResolvedValueOnce([])
        .mockResolvedValueOnce([])
        .mockResolvedValueOnce([overallResult]);

      const date = localDate(2024, 6, 15);
      const dateKey = expectedDateKey(date);
      await service.aggregateDaily(date);

      expect(mockAnalyticsStats.updateOne).toHaveBeenCalledOnce();
      const [filter, update, opts] = mockAnalyticsStats.updateOne.mock.calls[0];
      expect(filter.date).toBe(dateKey);
      expect(filter.interval).toBe('daily');
      expect(filter.accountId).toBeNull();
      expect(filter.ruleId).toBeNull();
      expect(filter.templateId).toBeNull();
      expect(update.$set.sent).toBe(10);
      expect(opts.upsert).toBe(true);
    });

    it('should not call updateOne for overall when no results', async () => {
      await service.aggregateDaily(localDate(2024, 6, 15));

      expect(mockAnalyticsStats.updateOne).not.toHaveBeenCalled();
    });

    it('should not call bulkWrite when pipelines return empty results', async () => {
      await service.aggregateDaily(localDate(2024, 6, 15));

      expect(mockAnalyticsStats.bulkWrite).not.toHaveBeenCalled();
    });

    it('should use current date when no date is provided', async () => {
      await service.aggregateDaily();

      const logCall = mockLogger.info.mock.calls[0];
      expect(logCall[0]).toBe('Running daily aggregation');
      expect(logCall[1].date).toMatch(/^\d{4}-\d{2}-\d{2}$/);
    });

    it('should log start and completion', async () => {
      const date = localDate(2024, 6, 15);
      const dateKey = expectedDateKey(date);

      await service.aggregateDaily(date);

      expect(mockLogger.info).toHaveBeenCalledWith('Running daily aggregation', {
        date: dateKey,
      });
      expect(mockLogger.info).toHaveBeenCalledWith('Daily aggregation complete', {
        date: dateKey,
      });
    });

    it('should set date key in bulk ops as YYYY-MM-DD', async () => {
      mockEmailEvent.aggregate
        .mockResolvedValueOnce([makeAggResult('acc1')])
        .mockResolvedValueOnce([])
        .mockResolvedValueOnce([])
        .mockResolvedValueOnce([]);

      const date = localDate(2024, 12, 25);
      const dateKey = expectedDateKey(date);
      await service.aggregateDaily(date);

      const ops = mockAnalyticsStats.bulkWrite.mock.calls[0][0];
      expect(ops[0].updateOne.filter.date).toBe(dateKey);
      expect(ops[0].updateOne.filter.interval).toBe('daily');
    });

    it('should throw AggregationError when aggregate pipeline fails', async () => {
      mockEmailEvent.aggregate.mockRejectedValueOnce(new Error('connection lost'));

      await expect(service.aggregateDaily(localDate(2024, 6, 15))).rejects.toThrow(AggregationError);
    });
  });

  describe('aggregateRange()', () => {
    it('should call aggregateDaily for each day in range', async () => {
      const spy = vi.spyOn(service, 'aggregateDaily');

      await service.aggregateRange(
        localDate(2024, 6, 1),
        localDate(2024, 6, 3),
      );

      expect(spy).toHaveBeenCalledTimes(3);
    });

    it('should call aggregateDaily once for same-day range', async () => {
      const spy = vi.spyOn(service, 'aggregateDaily');

      await service.aggregateRange(
        localDate(2024, 6, 15),
        localDate(2024, 6, 15),
      );

      expect(spy).toHaveBeenCalledTimes(1);
    });

    it('should log range start and completion', async () => {
      const from = localDate(2024, 6, 1);
      const to = localDate(2024, 6, 2);
      const fromKey = expectedDateKey(from);
      const toKey = expectedDateKey(to);

      await service.aggregateRange(from, to);

      expect(mockLogger.info).toHaveBeenCalledWith(
        'Running range aggregation',
        expect.objectContaining({
          from: fromKey,
          to: toKey,
        }),
      );
      expect(mockLogger.info).toHaveBeenCalledWith('Range aggregation complete');
    });

    it('should throw InvalidDateRangeError when from > to', async () => {
      await expect(
        service.aggregateRange(localDate(2024, 6, 15), localDate(2024, 6, 10)),
      ).rejects.toThrow(InvalidDateRangeError);
    });

    it('should throw InvalidDateRangeError for invalid dates', async () => {
      await expect(
        service.aggregateRange(new Date('invalid'), localDate(2024, 6, 10)),
      ).rejects.toThrow(InvalidDateRangeError);
    });
  });
});
