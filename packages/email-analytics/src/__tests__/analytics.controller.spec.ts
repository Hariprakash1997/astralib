import { describe, it, expect, vi, beforeEach } from 'vitest';
import { createAnalyticsController } from '../controllers/analytics.controller';
import { InvalidDateRangeError } from '../errors';

function createMockQueryService() {
  return {
    getOverview: vi.fn().mockResolvedValue({ sent: 100, delivered: 95 }),
    getTimeline: vi.fn().mockResolvedValue([{ date: '2024-06-01', sent: 10 }]),
    getAccountStats: vi.fn().mockResolvedValue([{ accountId: 'acc1', sent: 50 }]),
    getRuleStats: vi.fn().mockResolvedValue([{ ruleId: 'rule1', sent: 30 }]),
    getTemplateStats: vi.fn().mockResolvedValue([{ templateId: 'tmpl1', sent: 20 }]),
  };
}

function createMockAggregator() {
  return {
    aggregateDaily: vi.fn().mockResolvedValue(undefined),
    aggregateRange: vi.fn().mockResolvedValue(undefined),
  };
}

function createMockEventRecorder() {
  return {
    record: vi.fn().mockResolvedValue(undefined),
  };
}

function createMockReq(query: Record<string, string> = {}, body: Record<string, any> = {}) {
  return {
    query,
    body,
  } as any;
}

function createMockRes() {
  const res: any = {
    statusCode: 200,
    body: null,
  };
  res.status = vi.fn((code: number) => {
    res.statusCode = code;
    return res;
  });
  res.json = vi.fn((data: any) => {
    res.body = data;
    return res;
  });
  return res;
}

describe('AnalyticsController', () => {
  let controller: ReturnType<typeof createAnalyticsController>;
  let mockQueryService: ReturnType<typeof createMockQueryService>;
  let mockAggregator: ReturnType<typeof createMockAggregator>;
  let mockEventRecorder: ReturnType<typeof createMockEventRecorder>;

  beforeEach(() => {
    mockQueryService = createMockQueryService();
    mockAggregator = createMockAggregator();
    mockEventRecorder = createMockEventRecorder();
    controller = createAnalyticsController(
      mockEventRecorder as any,
      mockAggregator as any,
      mockQueryService as any,
    );
  });

  describe('getOverview()', () => {
    it('should call queryService.getOverview with parsed date params', async () => {
      const req = createMockReq({ from: '2024-06-01', to: '2024-06-30' });
      const res = createMockRes();

      await controller.getOverview(req, res);

      expect(mockQueryService.getOverview).toHaveBeenCalledWith(
        new Date('2024-06-01'),
        new Date('2024-06-30'),
      );
      expect(res.json).toHaveBeenCalledWith({
        success: true,
        data: { sent: 100, delivered: 95 },
      });
    });

    it('should use default date range (last 30 days) when no params provided', async () => {
      const req = createMockReq();
      const res = createMockRes();

      await controller.getOverview(req, res);

      expect(mockQueryService.getOverview).toHaveBeenCalledOnce();
      const [dateFrom, dateTo] = mockQueryService.getOverview.mock.calls[0];
      const now = new Date();
      const thirtyDaysAgo = new Date();
      thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);

      // dateFrom should be approximately 30 days ago (within 5 seconds tolerance)
      expect(Math.abs(dateFrom.getTime() - thirtyDaysAgo.getTime())).toBeLessThan(5000);
      // dateTo should be approximately now
      expect(Math.abs(dateTo.getTime() - now.getTime())).toBeLessThan(5000);
    });

    it('should return 400 for invalid from date', async () => {
      const req = createMockReq({ from: 'not-a-date' });
      const res = createMockRes();

      await controller.getOverview(req, res);

      expect(res.status).toHaveBeenCalledWith(400);
      expect(res.json).toHaveBeenCalledWith({
        success: false,
        error: "Invalid 'from' date: not-a-date",
      });
    });

    it('should return 400 for invalid to date', async () => {
      const req = createMockReq({ from: '2024-06-01', to: 'not-a-date' });
      const res = createMockRes();

      await controller.getOverview(req, res);

      expect(res.status).toHaveBeenCalledWith(400);
      expect(res.json).toHaveBeenCalledWith({
        success: false,
        error: "Invalid 'to' date: not-a-date",
      });
    });

    it('should return 500 on service error', async () => {
      mockQueryService.getOverview.mockRejectedValue(new Error('DB connection failed'));
      const req = createMockReq({ from: '2024-06-01', to: '2024-06-30' });
      const res = createMockRes();

      await controller.getOverview(req, res);

      expect(res.status).toHaveBeenCalledWith(500);
      expect(res.json).toHaveBeenCalledWith({
        success: false,
        error: 'DB connection failed',
      });
    });

    it('should return 500 with "Unknown error" for non-Error throws', async () => {
      mockQueryService.getOverview.mockRejectedValue('string error');
      const req = createMockReq({ from: '2024-06-01', to: '2024-06-30' });
      const res = createMockRes();

      await controller.getOverview(req, res);

      expect(res.status).toHaveBeenCalledWith(500);
      expect(res.json).toHaveBeenCalledWith({
        success: false,
        error: 'Unknown error',
      });
    });
  });

  describe('getTimeline()', () => {
    it('should call queryService.getTimeline with interval param', async () => {
      const req = createMockReq({ from: '2024-06-01', to: '2024-06-30', interval: 'weekly' });
      const res = createMockRes();

      await controller.getTimeline(req, res);

      expect(mockQueryService.getTimeline).toHaveBeenCalledWith(
        new Date('2024-06-01'),
        new Date('2024-06-30'),
        'weekly',
      );
      expect(res.json).toHaveBeenCalledWith({
        success: true,
        data: [{ date: '2024-06-01', sent: 10 }],
      });
    });

    it('should default interval to daily', async () => {
      const req = createMockReq({ from: '2024-06-01', to: '2024-06-30' });
      const res = createMockRes();

      await controller.getTimeline(req, res);

      expect(mockQueryService.getTimeline).toHaveBeenCalledWith(
        new Date('2024-06-01'),
        new Date('2024-06-30'),
        'daily',
      );
    });

    it('should accept monthly interval', async () => {
      const req = createMockReq({ from: '2024-06-01', to: '2024-06-30', interval: 'monthly' });
      const res = createMockRes();

      await controller.getTimeline(req, res);

      expect(mockQueryService.getTimeline).toHaveBeenCalledWith(
        new Date('2024-06-01'),
        new Date('2024-06-30'),
        'monthly',
      );
    });

    it('should return 400 for invalid interval', async () => {
      const req = createMockReq({ from: '2024-06-01', to: '2024-06-30', interval: 'yearly' });
      const res = createMockRes();

      await controller.getTimeline(req, res);

      expect(res.status).toHaveBeenCalledWith(400);
      expect(res.json).toHaveBeenCalledWith({
        success: false,
        error: 'interval must be daily, weekly, or monthly',
      });
    });

    it('should return 400 for invalid date', async () => {
      const req = createMockReq({ from: 'bad-date' });
      const res = createMockRes();

      await controller.getTimeline(req, res);

      expect(res.status).toHaveBeenCalledWith(400);
    });

    it('should return 500 on service error', async () => {
      mockQueryService.getTimeline.mockRejectedValue(new Error('timeout'));
      const req = createMockReq({ from: '2024-06-01', to: '2024-06-30' });
      const res = createMockRes();

      await controller.getTimeline(req, res);

      expect(res.status).toHaveBeenCalledWith(500);
      expect(res.json).toHaveBeenCalledWith({
        success: false,
        error: 'timeout',
      });
    });
  });

  describe('getAccountStats()', () => {
    it('should call queryService.getAccountStats with date range', async () => {
      const req = createMockReq({ from: '2024-06-01', to: '2024-06-30' });
      const res = createMockRes();

      await controller.getAccountStats(req, res);

      expect(mockQueryService.getAccountStats).toHaveBeenCalledWith(
        new Date('2024-06-01'),
        new Date('2024-06-30'),
      );
      expect(res.json).toHaveBeenCalledWith({
        success: true,
        data: [{ accountId: 'acc1', sent: 50 }],
      });
    });

    it('should return 400 for invalid date', async () => {
      const req = createMockReq({ from: 'invalid' });
      const res = createMockRes();

      await controller.getAccountStats(req, res);

      expect(res.status).toHaveBeenCalledWith(400);
    });

    it('should return 500 on service error', async () => {
      mockQueryService.getAccountStats.mockRejectedValue(new Error('fail'));
      const req = createMockReq({ from: '2024-06-01', to: '2024-06-30' });
      const res = createMockRes();

      await controller.getAccountStats(req, res);

      expect(res.status).toHaveBeenCalledWith(500);
    });
  });

  describe('getRuleStats()', () => {
    it('should call queryService.getRuleStats with date range', async () => {
      const req = createMockReq({ from: '2024-06-01', to: '2024-06-30' });
      const res = createMockRes();

      await controller.getRuleStats(req, res);

      expect(mockQueryService.getRuleStats).toHaveBeenCalledWith(
        new Date('2024-06-01'),
        new Date('2024-06-30'),
      );
      expect(res.json).toHaveBeenCalledWith({
        success: true,
        data: [{ ruleId: 'rule1', sent: 30 }],
      });
    });

    it('should return 400 for invalid date', async () => {
      const req = createMockReq({ to: 'garbage' });
      const res = createMockRes();

      await controller.getRuleStats(req, res);

      expect(res.status).toHaveBeenCalledWith(400);
    });

    it('should return 500 on service error', async () => {
      mockQueryService.getRuleStats.mockRejectedValue(new Error('fail'));
      const req = createMockReq({ from: '2024-06-01', to: '2024-06-30' });
      const res = createMockRes();

      await controller.getRuleStats(req, res);

      expect(res.status).toHaveBeenCalledWith(500);
    });
  });

  describe('getTemplateStats()', () => {
    it('should call queryService.getTemplateStats with date range', async () => {
      const req = createMockReq({ from: '2024-06-01', to: '2024-06-30' });
      const res = createMockRes();

      await controller.getTemplateStats(req, res);

      expect(mockQueryService.getTemplateStats).toHaveBeenCalledWith(
        new Date('2024-06-01'),
        new Date('2024-06-30'),
      );
      expect(res.json).toHaveBeenCalledWith({
        success: true,
        data: [{ templateId: 'tmpl1', sent: 20 }],
      });
    });

    it('should return 400 for invalid date', async () => {
      const req = createMockReq({ from: 'nope' });
      const res = createMockRes();

      await controller.getTemplateStats(req, res);

      expect(res.status).toHaveBeenCalledWith(400);
    });

    it('should return 500 on service error', async () => {
      mockQueryService.getTemplateStats.mockRejectedValue(new Error('fail'));
      const req = createMockReq({ from: '2024-06-01', to: '2024-06-30' });
      const res = createMockRes();

      await controller.getTemplateStats(req, res);

      expect(res.status).toHaveBeenCalledWith(500);
    });
  });

  describe('triggerAggregation()', () => {
    it('should call aggregator.aggregateRange when from and to are provided', async () => {
      const req = createMockReq({}, { from: '2024-06-01', to: '2024-06-30' });
      const res = createMockRes();

      await controller.triggerAggregation(req, res);

      expect(mockAggregator.aggregateRange).toHaveBeenCalledWith(
        new Date('2024-06-01'),
        new Date('2024-06-30'),
      );
      expect(res.json).toHaveBeenCalledWith({
        success: true,
        message: 'Range aggregation complete',
      });
    });

    it('should call aggregator.aggregateDaily when only from is provided', async () => {
      const req = createMockReq({}, { from: '2024-06-15' });
      const res = createMockRes();

      await controller.triggerAggregation(req, res);

      expect(mockAggregator.aggregateDaily).toHaveBeenCalledWith(new Date('2024-06-15'));
      expect(res.json).toHaveBeenCalledWith({
        success: true,
        message: 'Daily aggregation complete',
      });
    });

    it('should call aggregator.aggregateDaily with undefined when no dates provided', async () => {
      const req = createMockReq({}, {});
      const res = createMockRes();

      await controller.triggerAggregation(req, res);

      expect(mockAggregator.aggregateDaily).toHaveBeenCalledWith(undefined);
      expect(res.json).toHaveBeenCalledWith({
        success: true,
        message: 'Daily aggregation complete',
      });
    });

    it('should return 400 for invalid from/to date format', async () => {
      const req = createMockReq({}, { from: 'bad', to: 'worse' });
      const res = createMockRes();

      await controller.triggerAggregation(req, res);

      expect(res.status).toHaveBeenCalledWith(400);
      expect(res.json).toHaveBeenCalledWith({
        success: false,
        error: 'Invalid date format for from/to',
      });
    });

    it('should return 400 when from is after to', async () => {
      const req = createMockReq({}, { from: '2024-06-30', to: '2024-06-01' });
      const res = createMockRes();

      await controller.triggerAggregation(req, res);

      expect(res.status).toHaveBeenCalledWith(400);
      expect(res.json).toHaveBeenCalledWith({
        success: false,
        error: "Invalid date range: 'from' must be before 'to'",
      });
    });

    it('should return 400 when date range exceeds 365 days', async () => {
      const req = createMockReq({}, { from: '2023-01-01', to: '2024-06-01' });
      const res = createMockRes();

      await controller.triggerAggregation(req, res);

      expect(res.status).toHaveBeenCalledWith(400);
      expect(res.json).toHaveBeenCalledWith({
        success: false,
        error: 'Date range exceeds maximum of 365 days',
      });
    });

    it('should return 400 for invalid from date when only from is provided', async () => {
      const req = createMockReq({}, { from: 'not-valid' });
      const res = createMockRes();

      await controller.triggerAggregation(req, res);

      expect(res.status).toHaveBeenCalledWith(400);
      expect(res.json).toHaveBeenCalledWith({
        success: false,
        error: 'Invalid date format for from',
      });
    });

    it('should return 400 when aggregator throws InvalidDateRangeError', async () => {
      mockAggregator.aggregateRange.mockRejectedValue(
        new InvalidDateRangeError('2024-06-30', '2024-06-01'),
      );
      const req = createMockReq({}, { from: '2024-06-01', to: '2024-06-30' });
      const res = createMockRes();

      await controller.triggerAggregation(req, res);

      expect(res.status).toHaveBeenCalledWith(400);
      expect(res.body.success).toBe(false);
    });

    it('should return 500 on unexpected service error', async () => {
      mockAggregator.aggregateRange.mockRejectedValue(new Error('disk full'));
      const req = createMockReq({}, { from: '2024-06-01', to: '2024-06-30' });
      const res = createMockRes();

      await controller.triggerAggregation(req, res);

      expect(res.status).toHaveBeenCalledWith(500);
      expect(res.json).toHaveBeenCalledWith({
        success: false,
        error: 'disk full',
      });
    });

    it('should return 500 with "Unknown error" for non-Error throws', async () => {
      mockAggregator.aggregateDaily.mockRejectedValue(42);
      const req = createMockReq({}, {});
      const res = createMockRes();

      await controller.triggerAggregation(req, res);

      expect(res.status).toHaveBeenCalledWith(500);
      expect(res.json).toHaveBeenCalledWith({
        success: false,
        error: 'Unknown error',
      });
    });
  });
});
