import { describe, it, expect, vi, beforeEach } from 'vitest';
import { AnalyticsService } from '../../services/analytics.service.js';
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

describe('AnalyticsService', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  // ── getAgentStats ──────────────────────────────────────────────────────────

  describe('getAgentStats()', () => {
    it('returns AgentCallStats with correct shape', async () => {
      const agentAgg = [
        {
          _id: 'agent-1',
          totalCalls: 10,
          callsClosed: 7,
          followUpsCompleted: 3,
          overdueFollowUps: 1,
        },
      ];
      const pipelineAgg = [{ _id: 'pipe-1', count: 10 }];
      const CallLog = makeCallLogModel([agentAgg, pipelineAgg]);
      const Pipeline = makePipelineModel();
      const service = new AnalyticsService(CallLog as any, Pipeline as any, mockLogger);

      const result = await service.getAgentStats('agent-1', dateRange);

      expect(result.agentId).toBe('agent-1');
      expect(result.totalCalls).toBe(10);
      expect(result.callsClosed).toBe(7);
      expect(result.followUpsCompleted).toBe(3);
      expect(result.overdueFollowUps).toBe(1);
      expect(result.closeRate).toBe(70);
      expect(result.callsByPipeline).toHaveLength(1);
      expect(result.callsByPipeline[0].pipelineId).toBe('pipe-1');
    });

    it('returns zero-stats when agent has no calls', async () => {
      const CallLog = makeCallLogModel([[], []]);
      const Pipeline = makePipelineModel();
      const service = new AnalyticsService(CallLog as any, Pipeline as any, mockLogger);

      const result = await service.getAgentStats('agent-99', dateRange);

      expect(result.totalCalls).toBe(0);
      expect(result.closeRate).toBe(0);
      expect(result.callsByPipeline).toHaveLength(0);
    });

    it('computes avgCallsPerDay from dateRange', async () => {
      const agentAgg = [{ _id: 'agent-1', totalCalls: 30, callsClosed: 0, followUpsCompleted: 0, overdueFollowUps: 0 }];
      const CallLog = makeCallLogModel([agentAgg, []]);
      const Pipeline = makePipelineModel();
      const service = new AnalyticsService(CallLog as any, Pipeline as any, mockLogger);

      const result = await service.getAgentStats('agent-1', { from: '2026-01-01', to: '2026-01-31' });

      expect(result.avgCallsPerDay).toBeGreaterThan(0);
    });
  });

  // ── getAgentLeaderboard ────────────────────────────────────────────────────

  describe('getAgentLeaderboard()', () => {
    it('returns array of AgentCallStats sorted by totalCalls', async () => {
      const agg = [
        { _id: 'agent-1', totalCalls: 20, callsClosed: 15, followUpsCompleted: 5, overdueFollowUps: 0 },
        { _id: 'agent-2', totalCalls: 10, callsClosed: 8, followUpsCompleted: 2, overdueFollowUps: 1 },
      ];
      const CallLog = makeCallLogModel([agg]);
      const Pipeline = makePipelineModel();
      const service = new AnalyticsService(CallLog as any, Pipeline as any, mockLogger);

      const result = await service.getAgentLeaderboard(dateRange);

      expect(result).toHaveLength(2);
      expect(result[0].agentId).toBe('agent-1');
      expect(result[0].totalCalls).toBe(20);
    });

    it('returns empty array when no calls', async () => {
      const CallLog = makeCallLogModel([[]]);
      const Pipeline = makePipelineModel();
      const service = new AnalyticsService(CallLog as any, Pipeline as any, mockLogger);

      const result = await service.getAgentLeaderboard(dateRange);

      expect(result).toHaveLength(0);
    });
  });

  // ── getTeamStats ───────────────────────────────────────────────────────────

  describe('getTeamStats()', () => {
    it('returns TeamStats with agentStats array and totalCalls', async () => {
      const agg = [
        { _id: 'agent-1', totalCalls: 10, callsClosed: 5, followUpsCompleted: 2, overdueFollowUps: 0 },
      ];
      const CallLog = makeCallLogModel([agg]);
      const Pipeline = makePipelineModel();
      const service = new AnalyticsService(CallLog as any, Pipeline as any, mockLogger);

      const result = await service.getTeamStats('team-1', dateRange);

      expect(result.teamId).toBe('team-1');
      expect(result.agentStats).toHaveLength(1);
      expect(result.totalCalls).toBe(10);
    });
  });

  // ── getDailyReport ─────────────────────────────────────────────────────────

  describe('getDailyReport()', () => {
    it('returns DailyReport array with correct shape', async () => {
      const dailyAgg = [{ _id: '2026-01-01', count: 5 }];
      const directionAgg = [{ _id: { date: '2026-01-01', direction: 'inbound' }, count: 3 }];
      const pipelineAgg = [{ _id: { date: '2026-01-01', pipelineId: 'pipe-1' }, count: 5 }];
      const agentAgg = [{ _id: { date: '2026-01-01', agentId: 'agent-1' }, count: 5 }];
      const CallLog = makeCallLogModel([dailyAgg, directionAgg, pipelineAgg, agentAgg]);
      const Pipeline = makePipelineModel();
      const service = new AnalyticsService(CallLog as any, Pipeline as any, mockLogger);

      const result = await service.getDailyReport(dateRange);

      expect(result).toHaveLength(1);
      expect(result[0].date).toBe('2026-01-01');
      expect(result[0].total).toBe(5);
      expect(result[0].byDirection).toHaveLength(1);
      expect(result[0].byPipeline).toHaveLength(1);
      expect(result[0].byAgent).toHaveLength(1);
    });

    it('returns empty array when no calls', async () => {
      const CallLog = makeCallLogModel([[], [], [], []]);
      const Pipeline = makePipelineModel();
      const service = new AnalyticsService(CallLog as any, Pipeline as any, mockLogger);

      const result = await service.getDailyReport(dateRange);

      expect(result).toHaveLength(0);
    });
  });

  // ── getWeeklyTrends ────────────────────────────────────────────────────────

  describe('getWeeklyTrends()', () => {
    it('returns weekly summaries', async () => {
      const agg = [
        { week: '1', year: 2026, totalCalls: 30, closedCalls: 20 },
        { week: '2', year: 2026, totalCalls: 25, closedCalls: 15 },
      ];
      const CallLog = makeCallLogModel([agg]);
      const Pipeline = makePipelineModel();
      const service = new AnalyticsService(CallLog as any, Pipeline as any, mockLogger);

      const result = await service.getWeeklyTrends(4);

      expect(result).toHaveLength(2);
      expect(result[0].totalCalls).toBe(30);
    });
  });

  // ── getOverallReport ───────────────────────────────────────────────────────

  describe('getOverallReport()', () => {
    it('returns OverallCallReport with correct shape including distributions', async () => {
      const summaryAgg = [{ _id: null, totalCalls: 100, closedCalls: 70, avgTimeToCloseMs: 86400000 }];
      const tagAgg = [{ _id: 'vip', count: 20 }];
      const categoryAgg = [{ _id: 'sales', count: 50 }];
      const peakAgg = [{ _id: 10, count: 15 }];
      const followUpAgg = [{ _id: null, total: 100, withFollowUp: 40, completed: 30 }];
      const channelAgg = [{ _id: 'phone', count: 60 }, { _id: 'email', count: 40 }];
      const outcomeAgg = [{ _id: 'closed-won', count: 70 }];
      const CallLog = makeCallLogModel([summaryAgg, tagAgg, categoryAgg, peakAgg, followUpAgg, channelAgg, outcomeAgg]);
      const Pipeline = makePipelineModel();
      const service = new AnalyticsService(CallLog as any, Pipeline as any, mockLogger);

      const result = await service.getOverallReport(dateRange);

      expect(result.totalCalls).toBe(100);
      expect(result.closedCalls).toBe(70);
      expect(result.avgTimeToCloseMs).toBe(86400000);
      expect(result.followUpComplianceRate).toBe(75);
      expect(result.tagDistribution).toHaveLength(1);
      expect(result.categoryDistribution).toHaveLength(1);
      expect(result.peakCallHours).toHaveLength(1);
      expect(result.channelDistribution).toHaveLength(2);
      expect(result.channelDistribution[0]).toEqual({ channel: 'phone', count: 60 });
      expect(result.outcomeDistribution).toHaveLength(1);
      expect(result.outcomeDistribution[0]).toEqual({ outcome: 'closed-won', count: 70 });
      expect(result.followUpCalls).toBe(40);
      expect(result.followUpRatio).toBe(40);
    });

    it('handles empty aggregate results with zero values', async () => {
      const CallLog = makeCallLogModel([[], [], [], [], [], [], []]);
      const Pipeline = makePipelineModel();
      const service = new AnalyticsService(CallLog as any, Pipeline as any, mockLogger);

      const result = await service.getOverallReport(dateRange);

      expect(result.totalCalls).toBe(0);
      expect(result.closedCalls).toBe(0);
      expect(result.avgTimeToCloseMs).toBe(0);
      expect(result.followUpComplianceRate).toBe(0);
      expect(result.tagDistribution).toHaveLength(0);
      expect(result.channelDistribution).toHaveLength(0);
      expect(result.outcomeDistribution).toHaveLength(0);
      expect(result.followUpCalls).toBe(0);
      expect(result.followUpRatio).toBe(0);
    });

    it('excludes deleted calls from match stage', async () => {
      const summaryAgg = [{ _id: null, totalCalls: 5, closedCalls: 3, avgTimeToCloseMs: 0 }];
      const CallLog = makeCallLogModel([summaryAgg, [], [], [], [], [], []]);
      const Pipeline = makePipelineModel();
      const service = new AnalyticsService(CallLog as any, Pipeline as any, mockLogger);

      await service.getOverallReport(dateRange);

      const firstAggCall = CallLog.aggregate.mock.calls[0][0];
      expect(firstAggCall[0].$match).toMatchObject({ isDeleted: { $ne: true } });
    });
  });
});
