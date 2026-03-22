import type { Model } from 'mongoose';
import type { LogAdapter } from '@astralibx/core';
import type {
  PipelineReport,
  PipelineFunnel,
  DateRange,
  AgentInfo,
  ChannelDistribution,
  OutcomeDistribution,
  FollowUpStats,
} from '@astralibx/call-log-types';
import type { ICallLogDocument } from '../schemas/call-log.schema.js';
import type { IPipelineDocument } from '../schemas/pipeline.schema.js';

// ── Internal aggregate result helpers ────────────────────────────────────────

interface AggIdCount {
  _id: string | number | null;
  count: number;
}

interface PipelineStageAggResult {
  stageId: string;
  count: number;
  totalTimeMs: number;
}

// ── Service ───────────────────────────────────────────────────────────────────

export class PipelineAnalyticsService {
  constructor(
    private CallLog: Model<ICallLogDocument>,
    private Pipeline: Model<IPipelineDocument>,
    private logger: LogAdapter,
    private resolveAgent?: (agentId: string) => Promise<AgentInfo | null>,
    private tenantId?: string,
  ) {}

  private buildDateMatch(dateRange: DateRange, field = 'callDate'): Record<string, unknown> {
    if (!dateRange.from && !dateRange.to) return {};
    const dateFilter: Record<string, unknown> = {};
    if (dateRange.from) dateFilter.$gte = new Date(dateRange.from);
    if (dateRange.to) dateFilter.$lte = new Date(dateRange.to);
    return { [field]: dateFilter };
  }

  async getPipelineStats(pipelineId: string, dateRange: DateRange): Promise<PipelineReport> {
    const pipeline = await this.Pipeline.findOne({ pipelineId, isDeleted: false });
    const pipelineName = pipeline?.name ?? pipelineId;
    const stages = pipeline?.stages ?? [];

    const matchStage: Record<string, unknown> = {
      pipelineId,
      isDeleted: { $ne: true },
      ...this.buildDateMatch(dateRange),
    };

    const [totalResult, stageAgg] = await Promise.all([
      this.CallLog.countDocuments(matchStage),
      this.CallLog.aggregate<PipelineStageAggResult>([
        { $match: matchStage },
        { $unwind: { path: '$stageHistory', preserveNullAndEmptyArrays: false } },
        {
          $group: {
            _id: '$stageHistory.toStageId',
            count: { $sum: 1 },
            totalTimeMs: { $sum: '$stageHistory.timeInStageMs' },
          },
        },
        {
          $project: {
            stageId: '$_id',
            count: 1,
            totalTimeMs: 1,
          },
        },
      ]),
    ]);

    const totalCalls = totalResult;
    const stageMap = new Map(stageAgg.map((s) => [s.stageId, s]));

    let bottleneckStage: string | null = null;
    let maxAvgTime = 0;

    const stageStats = stages.map((s) => {
      const agg = stageMap.get(s.stageId);
      const count = agg?.count ?? 0;
      const avgTimeMs = count > 0 ? Math.round((agg?.totalTimeMs ?? 0) / count) : 0;
      const conversionRate = totalCalls > 0 ? Math.round((count / totalCalls) * 10000) / 100 : 0;

      if (avgTimeMs > maxAvgTime) {
        maxAvgTime = avgTimeMs;
        bottleneckStage = s.stageId;
      }

      return {
        stageId: s.stageId,
        stageName: s.name,
        count,
        avgTimeMs,
        conversionRate,
      };
    });

    this.logger.info('Pipeline stats computed', { pipelineId, totalCalls });

    return {
      pipelineId,
      pipelineName,
      totalCalls,
      stages: stageStats,
      bottleneckStage,
    };
  }

  async getPipelineFunnel(pipelineId: string, dateRange: DateRange): Promise<PipelineFunnel> {
    const pipeline = await this.Pipeline.findOne({ pipelineId, isDeleted: false });
    const pipelineName = pipeline?.name ?? pipelineId;
    const stages = pipeline?.stages ?? [];

    const matchStage: Record<string, unknown> = {
      pipelineId,
      isDeleted: { $ne: true },
      ...this.buildDateMatch(dateRange),
    };

    const [enteredAgg, exitedAgg] = await Promise.all([
      this.CallLog.aggregate<AggIdCount>([
        { $match: matchStage },
        { $unwind: '$stageHistory' },
        { $group: { _id: '$stageHistory.toStageId', count: { $sum: 1 } } },
      ]),
      this.CallLog.aggregate<AggIdCount>([
        { $match: matchStage },
        { $unwind: '$stageHistory' },
        { $group: { _id: '$stageHistory.fromStageId', count: { $sum: 1 } } },
      ]),
    ]);

    const enteredMap = new Map(enteredAgg.map((r) => [String(r._id), r.count]));
    const exitedMap = new Map(exitedAgg.map((r) => [String(r._id), r.count]));

    const funnelStages = stages.map((s) => {
      const entered = enteredMap.get(s.stageId) ?? 0;
      const exited = exitedMap.get(s.stageId) ?? 0;
      return {
        stageId: s.stageId,
        stageName: s.name,
        entered,
        exited,
        dropOff: Math.max(0, entered - exited),
      };
    });

    return { pipelineId, pipelineName, stages: funnelStages };
  }

  async getChannelDistribution(dateRange: DateRange): Promise<ChannelDistribution[]> {
    const matchStage: Record<string, unknown> = {
      isDeleted: { $ne: true },
      ...this.buildDateMatch(dateRange),
    };

    const results = await this.CallLog.aggregate<AggIdCount>([
      { $match: matchStage },
      { $group: { _id: '$channel', count: { $sum: 1 } } },
      { $sort: { count: -1 as const } },
    ]);

    return results.map((r) => ({
      channel: r._id != null ? String(r._id) : 'unknown',
      count: r.count,
    }));
  }

  async getOutcomeDistribution(dateRange: DateRange): Promise<OutcomeDistribution[]> {
    const matchStage: Record<string, unknown> = {
      isDeleted: { $ne: true },
      ...this.buildDateMatch(dateRange),
    };

    const results = await this.CallLog.aggregate<AggIdCount>([
      { $match: matchStage },
      { $group: { _id: '$outcome', count: { $sum: 1 } } },
      { $sort: { count: -1 as const } },
    ]);

    return results.map((r) => ({
      outcome: r._id != null ? String(r._id) : 'unknown',
      count: r.count,
    }));
  }

  async getFollowUpStats(dateRange: DateRange): Promise<FollowUpStats> {
    const matchStage: Record<string, unknown> = {
      isDeleted: { $ne: true },
      ...this.buildDateMatch(dateRange),
    };

    const results = await this.CallLog.aggregate<{ _id: null; total: number; followUpCalls: number }>([
      { $match: matchStage },
      {
        $group: {
          _id: null,
          total: { $sum: 1 },
          followUpCalls: {
            $sum: { $cond: [{ $eq: ['$isFollowUp', true] }, 1, 0] },
          },
        },
      },
    ]);

    const stat = results[0] ?? { total: 0, followUpCalls: 0 };
    const followUpRatio =
      stat.total > 0 ? Math.round((stat.followUpCalls / stat.total) * 10000) / 100 : 0;

    return {
      followUpCalls: stat.followUpCalls,
      totalCalls: stat.total,
      followUpRatio,
    };
  }
}
