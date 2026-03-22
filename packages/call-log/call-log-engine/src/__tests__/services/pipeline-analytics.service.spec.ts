import { describe, it, expect, vi, beforeEach } from 'vitest';
import { PipelineAnalyticsService } from '../../services/pipeline-analytics.service.js';
import type { DateRange } from '@astralibx/call-log-types';

// ── Mock helpers ───────────────────────────────────────────────────────────────

const mockLogger = {
  info: vi.fn(),
  warn: vi.fn(),
  error: vi.fn(),
  debug: vi.fn(),
};

function makeCallLogModel(aggregateResults: unknown[][] = [[]]) {
  let callCount = 0;
  return {
    aggregate: vi.fn().mockImplementation(() => {
      const result = aggregateResults[callCount] ?? aggregateResults[aggregateResults.length - 1];
      callCount++;
      return Promise.resolve(result);
    }),
    countDocuments: vi.fn().mockResolvedValue(0),
    find: vi.fn().mockResolvedValue([]),
  };
}

function makePipelineModel(doc: unknown = null) {
  return {
    findOne: vi.fn().mockResolvedValue(doc),
  };
}

function makePipeline() {
  return {
    pipelineId: 'pipe-1',
    name: 'Test Pipeline',
    stages: [
      { stageId: 'stage-1', name: 'New', isDefault: true, isTerminal: false },
      { stageId: 'stage-2', name: 'Closed', isDefault: false, isTerminal: true },
    ],
    isDeleted: false,
  };
}

const dateRange: DateRange = { from: '2026-01-01', to: '2026-01-31' };

// ── Tests ─────────────────────────────────────────────────────────────────────

describe('PipelineAnalyticsService', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  // ── getPipelineStats ───────────────────────────────────────────────────────

  describe('getPipelineStats()', () => {
    it('returns PipelineReport with stages', async () => {
      const pipeline = makePipeline();
      const Pipeline = makePipelineModel(pipeline);
      const CallLog = makeCallLogModel();
      CallLog.countDocuments.mockResolvedValue(10);
      CallLog.aggregate.mockResolvedValue([
        { stageId: 'stage-1', count: 10, totalTimeMs: 100000 },
      ]);
      const service = new PipelineAnalyticsService(CallLog as any, Pipeline as any, mockLogger);

      const result = await service.getPipelineStats('pipe-1', dateRange);

      expect(result.pipelineId).toBe('pipe-1');
      expect(result.pipelineName).toBe('Test Pipeline');
      expect(result.stages).toHaveLength(2);
      expect(result.totalCalls).toBe(10);
    });

    it('identifies bottleneckStage as stage with highest avgTimeMs', async () => {
      const pipeline = makePipeline();
      const Pipeline = makePipelineModel(pipeline);
      const CallLog = makeCallLogModel();
      CallLog.countDocuments.mockResolvedValue(10);
      CallLog.aggregate.mockResolvedValue([
        { stageId: 'stage-1', count: 5, totalTimeMs: 50000 },
        { stageId: 'stage-2', count: 5, totalTimeMs: 200000 },
      ]);
      const service = new PipelineAnalyticsService(CallLog as any, Pipeline as any, mockLogger);

      const result = await service.getPipelineStats('pipe-1', dateRange);

      expect(result.bottleneckStage).toBe('stage-2');
    });

    it('excludes deleted calls from match stage', async () => {
      const pipeline = makePipeline();
      const Pipeline = makePipelineModel(pipeline);
      const CallLog = makeCallLogModel();
      CallLog.countDocuments.mockResolvedValue(5);
      CallLog.aggregate.mockResolvedValue([]);
      const service = new PipelineAnalyticsService(CallLog as any, Pipeline as any, mockLogger);

      await service.getPipelineStats('pipe-1', dateRange);

      const countDocumentsCall = CallLog.countDocuments.mock.calls[0][0];
      expect(countDocumentsCall).toMatchObject({ isDeleted: { $ne: true } });
    });
  });

  // ── getPipelineFunnel ──────────────────────────────────────────────────────

  describe('getPipelineFunnel()', () => {
    it('returns PipelineFunnel with entered/exited/dropOff per stage', async () => {
      const pipeline = makePipeline();
      const Pipeline = makePipelineModel(pipeline);
      const enteredAgg = [
        { _id: 'stage-1', count: 10 },
        { _id: 'stage-2', count: 6 },
      ];
      const exitedAgg = [
        { _id: 'stage-1', count: 6 },
      ];
      const CallLog = makeCallLogModel([enteredAgg, exitedAgg]);
      const service = new PipelineAnalyticsService(CallLog as any, Pipeline as any, mockLogger);

      const result = await service.getPipelineFunnel('pipe-1', dateRange);

      expect(result.pipelineId).toBe('pipe-1');
      expect(result.stages).toHaveLength(2);
      const stage1 = result.stages.find((s) => s.stageId === 'stage-1');
      expect(stage1?.entered).toBe(10);
      expect(stage1?.exited).toBe(6);
      expect(stage1?.dropOff).toBe(4);
    });

    it('excludes deleted calls from match stage', async () => {
      const pipeline = makePipeline();
      const Pipeline = makePipelineModel(pipeline);
      const CallLog = makeCallLogModel([[], []]);
      const service = new PipelineAnalyticsService(CallLog as any, Pipeline as any, mockLogger);

      await service.getPipelineFunnel('pipe-1', dateRange);

      const firstAggCall = CallLog.aggregate.mock.calls[0][0];
      expect(firstAggCall[0].$match).toMatchObject({ isDeleted: { $ne: true } });
    });
  });

  // ── getChannelDistribution ─────────────────────────────────────────────────

  describe('getChannelDistribution()', () => {
    it('returns channel counts sorted by count descending', async () => {
      const agg = [
        { _id: 'phone', count: 50 },
        { _id: 'email', count: 30 },
        { _id: 'chat', count: 10 },
      ];
      const CallLog = makeCallLogModel([agg]);
      const Pipeline = makePipelineModel();
      const service = new PipelineAnalyticsService(CallLog as any, Pipeline as any, mockLogger);

      const result = await service.getChannelDistribution(dateRange);

      expect(result).toHaveLength(3);
      expect(result[0]).toEqual({ channel: 'phone', count: 50 });
      expect(result[1]).toEqual({ channel: 'email', count: 30 });
      expect(result[2]).toEqual({ channel: 'chat', count: 10 });
    });

    it('maps null _id to "unknown"', async () => {
      const agg = [{ _id: null, count: 5 }];
      const CallLog = makeCallLogModel([agg]);
      const Pipeline = makePipelineModel();
      const service = new PipelineAnalyticsService(CallLog as any, Pipeline as any, mockLogger);

      const result = await service.getChannelDistribution(dateRange);

      expect(result[0]).toEqual({ channel: 'unknown', count: 5 });
    });

    it('returns empty array when no calls', async () => {
      const CallLog = makeCallLogModel([[]]);
      const Pipeline = makePipelineModel();
      const service = new PipelineAnalyticsService(CallLog as any, Pipeline as any, mockLogger);

      const result = await service.getChannelDistribution(dateRange);

      expect(result).toHaveLength(0);
    });

    it('excludes deleted calls in match stage', async () => {
      const CallLog = makeCallLogModel([[]]);
      const Pipeline = makePipelineModel();
      const service = new PipelineAnalyticsService(CallLog as any, Pipeline as any, mockLogger);

      await service.getChannelDistribution(dateRange);

      const matchStage = CallLog.aggregate.mock.calls[0][0][0].$match;
      expect(matchStage).toMatchObject({ isDeleted: { $ne: true } });
    });
  });

  // ── getOutcomeDistribution ─────────────────────────────────────────────────

  describe('getOutcomeDistribution()', () => {
    it('returns outcome counts sorted by count descending', async () => {
      const agg = [
        { _id: 'closed-won', count: 40 },
        { _id: 'no-answer', count: 25 },
      ];
      const CallLog = makeCallLogModel([agg]);
      const Pipeline = makePipelineModel();
      const service = new PipelineAnalyticsService(CallLog as any, Pipeline as any, mockLogger);

      const result = await service.getOutcomeDistribution(dateRange);

      expect(result).toHaveLength(2);
      expect(result[0]).toEqual({ outcome: 'closed-won', count: 40 });
      expect(result[1]).toEqual({ outcome: 'no-answer', count: 25 });
    });

    it('maps null _id to "unknown"', async () => {
      const agg = [{ _id: null, count: 3 }];
      const CallLog = makeCallLogModel([agg]);
      const Pipeline = makePipelineModel();
      const service = new PipelineAnalyticsService(CallLog as any, Pipeline as any, mockLogger);

      const result = await service.getOutcomeDistribution(dateRange);

      expect(result[0]).toEqual({ outcome: 'unknown', count: 3 });
    });

    it('excludes deleted calls in match stage', async () => {
      const CallLog = makeCallLogModel([[]]);
      const Pipeline = makePipelineModel();
      const service = new PipelineAnalyticsService(CallLog as any, Pipeline as any, mockLogger);

      await service.getOutcomeDistribution(dateRange);

      const matchStage = CallLog.aggregate.mock.calls[0][0][0].$match;
      expect(matchStage).toMatchObject({ isDeleted: { $ne: true } });
    });
  });

  // ── getFollowUpStats ───────────────────────────────────────────────────────

  describe('getFollowUpStats()', () => {
    it('computes followUpRatio correctly', async () => {
      const agg = [{ _id: null, total: 100, followUpCalls: 40 }];
      const CallLog = makeCallLogModel([agg]);
      const Pipeline = makePipelineModel();
      const service = new PipelineAnalyticsService(CallLog as any, Pipeline as any, mockLogger);

      const result = await service.getFollowUpStats(dateRange);

      expect(result.followUpCalls).toBe(40);
      expect(result.totalCalls).toBe(100);
      expect(result.followUpRatio).toBe(40);
    });

    it('returns zero ratio when no calls', async () => {
      const CallLog = makeCallLogModel([[]]);
      const Pipeline = makePipelineModel();
      const service = new PipelineAnalyticsService(CallLog as any, Pipeline as any, mockLogger);

      const result = await service.getFollowUpStats(dateRange);

      expect(result.followUpCalls).toBe(0);
      expect(result.totalCalls).toBe(0);
      expect(result.followUpRatio).toBe(0);
    });

    it('handles zero followUpCalls gracefully', async () => {
      const agg = [{ _id: null, total: 50, followUpCalls: 0 }];
      const CallLog = makeCallLogModel([agg]);
      const Pipeline = makePipelineModel();
      const service = new PipelineAnalyticsService(CallLog as any, Pipeline as any, mockLogger);

      const result = await service.getFollowUpStats(dateRange);

      expect(result.followUpRatio).toBe(0);
    });

    it('excludes deleted calls in match stage', async () => {
      const CallLog = makeCallLogModel([[]]);
      const Pipeline = makePipelineModel();
      const service = new PipelineAnalyticsService(CallLog as any, Pipeline as any, mockLogger);

      await service.getFollowUpStats(dateRange);

      const matchStage = CallLog.aggregate.mock.calls[0][0][0].$match;
      expect(matchStage).toMatchObject({ isDeleted: { $ne: true } });
    });
  });
});
