import { describe, it, expect, vi, beforeEach } from 'vitest';
import { QueryService } from '../services/query.service';

function createMockStatsModel() {
  return {
    aggregate: vi.fn().mockResolvedValue([]),
  };
}

function createMockLogger() {
  return {
    info: vi.fn(),
    warn: vi.fn(),
    error: vi.fn(),
  };
}

describe('QueryService', () => {
  let service: QueryService;
  let mockModel: ReturnType<typeof createMockStatsModel>;
  let mockLogger: ReturnType<typeof createMockLogger>;

  const dateFrom = new Date('2024-06-01');
  const dateTo = new Date('2024-06-30');

  beforeEach(() => {
    mockModel = createMockStatsModel();
    mockLogger = createMockLogger();
    service = new QueryService(mockModel as any, mockLogger);
  });

  describe('getOverview()', () => {
    it('should return zeroes when no results', async () => {
      mockModel.aggregate.mockResolvedValue([]);

      const result = await service.getOverview(dateFrom, dateTo);

      expect(result.startDate).toBe('2024-06-01');
      expect(result.endDate).toBe('2024-06-30');
      expect(result.sent).toBe(0);
      expect(result.delivered).toBe(0);
      expect(result.bounced).toBe(0);
      expect(result.complained).toBe(0);
      expect(result.opened).toBe(0);
      expect(result.clicked).toBe(0);
      expect(result.unsubscribed).toBe(0);
      expect(result.failed).toBe(0);
    });

    it('should return aggregated totals when results exist', async () => {
      mockModel.aggregate.mockResolvedValue([
        {
          _id: null,
          sent: 100,
          failed: 5,
          delivered: 95,
          bounced: 3,
          complained: 1,
          opened: 50,
          clicked: 20,
          unsubscribed: 2,
        },
      ]);

      const result = await service.getOverview(dateFrom, dateTo);

      expect(result.sent).toBe(100);
      expect(result.delivered).toBe(95);
      expect(result.failed).toBe(5);
      expect(result.bounced).toBe(3);
      expect(result.complained).toBe(1);
      expect(result.opened).toBe(50);
      expect(result.clicked).toBe(20);
      expect(result.unsubscribed).toBe(2);
    });

    it('should pass correct match filters in pipeline', async () => {
      await service.getOverview(dateFrom, dateTo);

      const pipeline = mockModel.aggregate.mock.calls[0][0];
      const match = pipeline[0].$match;
      expect(match.interval).toBe('daily');
      expect(match.date.$gte).toBe('2024-06-01');
      expect(match.date.$lte).toBe('2024-06-30');
      expect(match.accountId).toBeNull();
      expect(match.ruleId).toBeNull();
      expect(match.templateId).toBeNull();
    });
  });

  describe('getTimeline()', () => {
    it('should return empty array when no results', async () => {
      const result = await service.getTimeline(dateFrom, dateTo);
      expect(result).toEqual([]);
    });

    it('should map results to TimelineEntry format', async () => {
      mockModel.aggregate.mockResolvedValue([
        {
          _id: '2024-06-01',
          sent: 10,
          failed: 0,
          delivered: 10,
          bounced: 0,
          complained: 0,
          opened: 5,
          clicked: 2,
          unsubscribed: 0,
        },
      ]);

      const result = await service.getTimeline(dateFrom, dateTo, 'daily');

      expect(result).toHaveLength(1);
      expect(result[0].date).toBe('2024-06-01');
      expect(result[0].interval).toBe('daily');
      expect(result[0].sent).toBe(10);
    });

    it('should default interval to daily', async () => {
      await service.getTimeline(dateFrom, dateTo);

      const pipeline = mockModel.aggregate.mock.calls[0][0];
      const groupId = pipeline[1].$group._id;
      expect(groupId).toBe('$date');
    });

    it('should use ISO week grouping for weekly interval', async () => {
      await service.getTimeline(dateFrom, dateTo, 'weekly');

      const pipeline = mockModel.aggregate.mock.calls[0][0];
      const groupId = pipeline[1].$group._id;
      expect(groupId).toHaveProperty('$concat');
      expect(groupId.$concat[0]).toEqual({ $substr: ['$date', 0, 4] });
      expect(groupId.$concat[1]).toBe('-W');
    });

    it('should use substring for monthly interval', async () => {
      await service.getTimeline(dateFrom, dateTo, 'monthly');

      const pipeline = mockModel.aggregate.mock.calls[0][0];
      const groupId = pipeline[1].$group._id;
      expect(groupId).toEqual({ $substr: ['$date', 0, 7] });
    });

    it('should include sort stage ascending by _id', async () => {
      await service.getTimeline(dateFrom, dateTo);

      const pipeline = mockModel.aggregate.mock.calls[0][0];
      const sortStage = pipeline[2];
      expect(sortStage.$sort._id).toBe(1);
    });

    it('should filter for overall stats (no account/rule/template)', async () => {
      await service.getTimeline(dateFrom, dateTo);

      const pipeline = mockModel.aggregate.mock.calls[0][0];
      const match = pipeline[0].$match;
      expect(match.accountId).toBeNull();
      expect(match.ruleId).toBeNull();
      expect(match.templateId).toBeNull();
    });
  });

  describe('getAccountStats()', () => {
    it('should return empty array when no results', async () => {
      const result = await service.getAccountStats(dateFrom, dateTo);
      expect(result).toEqual([]);
    });

    it('should filter for accountId not null', async () => {
      await service.getAccountStats(dateFrom, dateTo);

      const pipeline = mockModel.aggregate.mock.calls[0][0];
      const match = pipeline[0].$match;
      expect(match.accountId).toEqual({ $ne: null });
      expect(match.ruleId).toBeNull();
      expect(match.templateId).toBeNull();
    });

    it('should group by accountId', async () => {
      await service.getAccountStats(dateFrom, dateTo);

      const pipeline = mockModel.aggregate.mock.calls[0][0];
      expect(pipeline[1].$group._id).toBe('$accountId');
    });

    it('should sort by sent descending', async () => {
      await service.getAccountStats(dateFrom, dateTo);

      const pipeline = mockModel.aggregate.mock.calls[0][0];
      expect(pipeline[2].$sort.sent).toBe(-1);
    });

    it('should map _id to accountId in results', async () => {
      mockModel.aggregate.mockResolvedValue([
        {
          _id: 'acc123',
          sent: 50,
          failed: 2,
          delivered: 48,
          bounced: 1,
          complained: 0,
          opened: 25,
          clicked: 10,
          unsubscribed: 1,
        },
      ]);

      const result = await service.getAccountStats(dateFrom, dateTo);

      expect(result[0].accountId).toBe('acc123');
      expect(result[0].sent).toBe(50);
    });
  });

  describe('getRuleStats()', () => {
    it('should filter for ruleId not null', async () => {
      await service.getRuleStats(dateFrom, dateTo);

      const pipeline = mockModel.aggregate.mock.calls[0][0];
      const match = pipeline[0].$match;
      expect(match.ruleId).toEqual({ $ne: null });
      expect(match.accountId).toBeNull();
      expect(match.templateId).toBeNull();
    });

    it('should group by ruleId', async () => {
      await service.getRuleStats(dateFrom, dateTo);

      const pipeline = mockModel.aggregate.mock.calls[0][0];
      expect(pipeline[1].$group._id).toBe('$ruleId');
    });

    it('should map _id to ruleId in results', async () => {
      mockModel.aggregate.mockResolvedValue([
        {
          _id: 'rule456',
          sent: 30,
          failed: 0,
          delivered: 30,
          bounced: 0,
          complained: 0,
          opened: 15,
          clicked: 5,
          unsubscribed: 0,
        },
      ]);

      const result = await service.getRuleStats(dateFrom, dateTo);

      expect(result[0].ruleId).toBe('rule456');
      expect(result[0].delivered).toBe(30);
    });
  });

  describe('getTemplateStats()', () => {
    it('should filter for templateId not null', async () => {
      await service.getTemplateStats(dateFrom, dateTo);

      const pipeline = mockModel.aggregate.mock.calls[0][0];
      const match = pipeline[0].$match;
      expect(match.templateId).toEqual({ $ne: null });
      expect(match.accountId).toBeNull();
      expect(match.ruleId).toBeNull();
    });

    it('should group by templateId', async () => {
      await service.getTemplateStats(dateFrom, dateTo);

      const pipeline = mockModel.aggregate.mock.calls[0][0];
      expect(pipeline[1].$group._id).toBe('$templateId');
    });

    it('should map _id to templateId in results', async () => {
      mockModel.aggregate.mockResolvedValue([
        {
          _id: 'tmpl789',
          sent: 20,
          failed: 1,
          delivered: 19,
          bounced: 0,
          complained: 0,
          opened: 10,
          clicked: 3,
          unsubscribed: 0,
        },
      ]);

      const result = await service.getTemplateStats(dateFrom, dateTo);

      expect(result[0].templateId).toBe('tmpl789');
      expect(result[0].opened).toBe(10);
    });

    it('should sort by sent descending', async () => {
      await service.getTemplateStats(dateFrom, dateTo);

      const pipeline = mockModel.aggregate.mock.calls[0][0];
      expect(pipeline[2].$sort.sent).toBe(-1);
    });
  });
});
