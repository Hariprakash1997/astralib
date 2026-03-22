import type { Model } from 'mongoose';
import type { LogAdapter } from '@astralibx/core';
import type {
  AgentCallStats,
  PipelineReport,
  PipelineFunnel,
  DailyReport,
  OverallCallReport,
  DateRange,
  AgentInfo,
  DashboardStats,
} from '@astralibx/call-log-types';
import type { ICallLogDocument } from '../schemas/call-log.schema.js';
import type { IPipelineDocument } from '../schemas/pipeline.schema.js';

// ── Internal aggregate result helpers ────────────────────────────────────────

interface AggIdCount {
  _id: string | number | null;
  count: number;
}

interface AgentAggResult {
  _id: string;
  totalCalls: number;
  callsClosed: number;
  followUpsCompleted: number;
  overdueFollowUps: number;
  pipelineCounts: { pipelineId: string; count: number }[];
}

interface PipelineStageAggResult {
  stageId: string;
  count: number;
  totalTimeMs: number;
}

interface WeeklySummary {
  week: string;
  year: number;
  totalCalls: number;
  closedCalls: number;
}

export interface TeamStats {
  teamId: string | null;
  agentStats: AgentCallStats[];
  totalCalls: number;
}

// ── Service ───────────────────────────────────────────────────────────────────

export class AnalyticsService {
  constructor(
    private CallLog: Model<ICallLogDocument>,
    private Pipeline: Model<IPipelineDocument>,
    private logger: LogAdapter,
    private resolveAgent?: (agentId: string) => Promise<AgentInfo | null>,
  ) {}

  private async getAgentName(agentId: string): Promise<string> {
    if (!this.resolveAgent) return String(agentId);
    try {
      const agent = await this.resolveAgent(String(agentId));
      return agent?.displayName ?? String(agentId);
    } catch {
      return String(agentId);
    }
  }

  private buildDateMatch(dateRange: DateRange, field = 'callDate'): Record<string, unknown> {
    if (!dateRange.from && !dateRange.to) return {};
    const dateFilter: Record<string, unknown> = {};
    if (dateRange.from) dateFilter.$gte = new Date(dateRange.from);
    if (dateRange.to) dateFilter.$lte = new Date(dateRange.to);
    return { [field]: dateFilter };
  }

  async getAgentStats(agentId: string, dateRange: DateRange): Promise<AgentCallStats> {
    const now = new Date();
    const matchStage: Record<string, unknown> = {
      agentId,
      ...this.buildDateMatch(dateRange),
    };

    const pipeline = [
      { $match: matchStage },
      {
        $group: {
          _id: '$agentId',
          totalCalls: { $sum: 1 },
          callsClosed: {
            $sum: { $cond: [{ $eq: ['$isClosed', true] }, 1, 0] },
          },
          followUpsCompleted: {
            $sum: {
              $cond: [
                {
                  $and: [
                    { $ne: ['$nextFollowUpDate', null] },
                    { $eq: ['$isClosed', true] },
                  ],
                },
                1,
                0,
              ],
            },
          },
          overdueFollowUps: {
            $sum: {
              $cond: [
                {
                  $and: [
                    { $ne: ['$nextFollowUpDate', null] },
                    { $lt: ['$nextFollowUpDate', now] },
                    { $eq: ['$isClosed', false] },
                  ],
                },
                1,
                0,
              ],
            },
          },
        },
      },
    ];

    const [results, pipelineCounts] = await Promise.all([
      this.CallLog.aggregate<AgentAggResult>(pipeline),
      this.CallLog.aggregate<{ _id: string; count: number }>([
        { $match: matchStage },
        { $group: { _id: '$pipelineId', count: { $sum: 1 } } },
      ]),
    ]);

    const stat = results[0];
    const agentName = await this.getAgentName(agentId);
    if (!stat) {
      return {
        agentId,
        agentName,
        totalCalls: 0,
        avgCallsPerDay: 0,
        followUpsCompleted: 0,
        overdueFollowUps: 0,
        callsByPipeline: [],
        callsClosed: 0,
        closeRate: 0,
      };
    }

    // Compute avgCallsPerDay
    let avgCallsPerDay = 0;
    if (dateRange.from && dateRange.to) {
      const days = Math.max(
        1,
        Math.ceil((new Date(dateRange.to).getTime() - new Date(dateRange.from).getTime()) / 86_400_000),
      );
      avgCallsPerDay = Math.round((stat.totalCalls / days) * 100) / 100;
    }

    const callsByPipeline = pipelineCounts.map((p) => ({
      pipelineId: p._id,
      pipelineName: p._id,
      count: p.count,
    }));

    return {
      agentId,
      agentName,
      totalCalls: stat.totalCalls,
      avgCallsPerDay,
      followUpsCompleted: stat.followUpsCompleted,
      overdueFollowUps: stat.overdueFollowUps,
      callsByPipeline,
      callsClosed: stat.callsClosed,
      closeRate: stat.totalCalls > 0
        ? Math.round((stat.callsClosed / stat.totalCalls) * 10000) / 100
        : 0,
    };
  }

  async getAgentLeaderboard(dateRange: DateRange): Promise<AgentCallStats[]> {
    const now = new Date();
    const matchStage: Record<string, unknown> = this.buildDateMatch(dateRange);

    const pipeline = [
      { $match: matchStage },
      {
        $group: {
          _id: '$agentId',
          totalCalls: { $sum: 1 },
          callsClosed: {
            $sum: { $cond: [{ $eq: ['$isClosed', true] }, 1, 0] },
          },
          followUpsCompleted: {
            $sum: {
              $cond: [
                {
                  $and: [
                    { $ne: ['$nextFollowUpDate', null] },
                    { $eq: ['$isClosed', true] },
                  ],
                },
                1,
                0,
              ],
            },
          },
          overdueFollowUps: {
            $sum: {
              $cond: [
                {
                  $and: [
                    { $ne: ['$nextFollowUpDate', null] },
                    { $lt: ['$nextFollowUpDate', now] },
                    { $eq: ['$isClosed', false] },
                  ],
                },
                1,
                0,
              ],
            },
          },
        },
      },
      { $sort: { totalCalls: -1 as const } },
    ];

    const results = await this.CallLog.aggregate<AgentAggResult>(pipeline);

    return Promise.all(results.map(async (stat) => ({
      agentId: String(stat._id),
      agentName: await this.getAgentName(String(stat._id)),
      totalCalls: stat.totalCalls,
      avgCallsPerDay: 0,
      followUpsCompleted: stat.followUpsCompleted,
      overdueFollowUps: stat.overdueFollowUps,
      callsByPipeline: [],
      callsClosed: stat.callsClosed,
      closeRate: stat.totalCalls > 0
        ? Math.round((stat.callsClosed / stat.totalCalls) * 10000) / 100
        : 0,
    })));
  }

  async getPipelineStats(pipelineId: string, dateRange: DateRange): Promise<PipelineReport> {
    const pipeline = await this.Pipeline.findOne({ pipelineId, isDeleted: false });
    const pipelineName = pipeline?.name ?? pipelineId;
    const stages = pipeline?.stages ?? [];

    const matchStage: Record<string, unknown> = {
      pipelineId,
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

  async getTeamStats(teamId?: string, dateRange: DateRange = {}): Promise<TeamStats> {
    const now = new Date();
    const matchStage: Record<string, unknown> = this.buildDateMatch(dateRange);

    // Aggregate agent stats without filtering by team (team resolution requires external agent collection)
    const pipeline = [
      { $match: matchStage },
      {
        $group: {
          _id: '$agentId',
          totalCalls: { $sum: 1 },
          callsClosed: {
            $sum: { $cond: [{ $eq: ['$isClosed', true] }, 1, 0] },
          },
          followUpsCompleted: {
            $sum: {
              $cond: [
                {
                  $and: [
                    { $ne: ['$nextFollowUpDate', null] },
                    { $eq: ['$isClosed', true] },
                  ],
                },
                1,
                0,
              ],
            },
          },
          overdueFollowUps: {
            $sum: {
              $cond: [
                {
                  $and: [
                    { $ne: ['$nextFollowUpDate', null] },
                    { $lt: ['$nextFollowUpDate', now] },
                    { $eq: ['$isClosed', false] },
                  ],
                },
                1,
                0,
              ],
            },
          },
        },
      },
    ];

    const results = await this.CallLog.aggregate<AgentAggResult>(pipeline);

    const agentStats: AgentCallStats[] = await Promise.all(results.map(async (stat) => ({
      agentId: String(stat._id),
      agentName: await this.getAgentName(String(stat._id)),
      totalCalls: stat.totalCalls,
      avgCallsPerDay: 0,
      followUpsCompleted: stat.followUpsCompleted,
      overdueFollowUps: stat.overdueFollowUps,
      callsByPipeline: [],
      callsClosed: stat.callsClosed,
      closeRate: stat.totalCalls > 0
        ? Math.round((stat.callsClosed / stat.totalCalls) * 10000) / 100
        : 0,
    })));

    const totalCalls = agentStats.reduce((sum, a) => sum + a.totalCalls, 0);

    return { teamId: teamId ?? null, agentStats, totalCalls };
  }

  async getDailyReport(dateRange: DateRange): Promise<DailyReport[]> {
    const matchStage: Record<string, unknown> = this.buildDateMatch(dateRange);

    const [dailyAgg, directionAgg, pipelineAgg, agentAgg] = await Promise.all([
      this.CallLog.aggregate<{ _id: string; count: number }>([
        { $match: matchStage },
        {
          $group: {
            _id: { $dateToString: { format: '%Y-%m-%d', date: '$callDate' } },
            count: { $sum: 1 },
          },
        },
        { $sort: { _id: 1 as const } },
      ]),
      this.CallLog.aggregate<{ _id: { date: string; direction: string }; count: number }>([
        { $match: matchStage },
        {
          $group: {
            _id: {
              date: { $dateToString: { format: '%Y-%m-%d', date: '$callDate' } },
              direction: '$direction',
            },
            count: { $sum: 1 },
          },
        },
      ]),
      this.CallLog.aggregate<{ _id: { date: string; pipelineId: string }; count: number }>([
        { $match: matchStage },
        {
          $group: {
            _id: {
              date: { $dateToString: { format: '%Y-%m-%d', date: '$callDate' } },
              pipelineId: '$pipelineId',
            },
            count: { $sum: 1 },
          },
        },
      ]),
      this.CallLog.aggregate<{ _id: { date: string; agentId: string }; count: number }>([
        { $match: matchStage },
        {
          $group: {
            _id: {
              date: { $dateToString: { format: '%Y-%m-%d', date: '$callDate' } },
              agentId: { $toString: '$agentId' },
            },
            count: { $sum: 1 },
          },
        },
      ]),
    ]);

    // Build lookup maps
    const directionByDate = new Map<string, { direction: string; count: number }[]>();
    for (const r of directionAgg) {
      const date = r._id.date;
      if (!directionByDate.has(date)) directionByDate.set(date, []);
      directionByDate.get(date)!.push({ direction: r._id.direction, count: r.count });
    }

    const pipelineByDate = new Map<string, { pipelineId: string; pipelineName: string; count: number }[]>();
    for (const r of pipelineAgg) {
      const date = r._id.date;
      if (!pipelineByDate.has(date)) pipelineByDate.set(date, []);
      pipelineByDate.get(date)!.push({ pipelineId: r._id.pipelineId, pipelineName: r._id.pipelineId, count: r.count });
    }

    const agentByDate = new Map<string, { agentId: string; agentName: string; count: number }[]>();
    await Promise.all(agentAgg.map(async (r) => {
      const date = r._id.date;
      if (!agentByDate.has(date)) agentByDate.set(date, []);
      const agentName = await this.getAgentName(r._id.agentId);
      agentByDate.get(date)!.push({ agentId: r._id.agentId, agentName, count: r.count });
    }));

    return dailyAgg.map((d) => ({
      date: d._id,
      total: d.count,
      byDirection: directionByDate.get(d._id) ?? [],
      byPipeline: pipelineByDate.get(d._id) ?? [],
      byAgent: agentByDate.get(d._id) ?? [],
    }));
  }

  async getDashboardStats(): Promise<DashboardStats> {
    const now = new Date();
    const midnight = new Date(now.getFullYear(), now.getMonth(), now.getDate());

    const [openCalls, closedToday, overdueFollowUps, callsToday] = await Promise.all([
      this.CallLog.countDocuments({ isClosed: false }),
      this.CallLog.countDocuments({ closedAt: { $gte: midnight } }),
      this.CallLog.countDocuments({
        nextFollowUpDate: { $lt: now },
        isClosed: false,
      }),
      this.CallLog.countDocuments({ callDate: { $gte: midnight } }),
    ]);

    return {
      openCalls,
      closedToday,
      overdueFollowUps,
      totalAgents: 0,
      callsToday,
    };
  }

  async getWeeklyTrends(weeks: number): Promise<WeeklySummary[]> {
    const now = new Date();
    const from = new Date(now.getTime() - weeks * 7 * 24 * 60 * 60 * 1000);

    const results = await this.CallLog.aggregate<WeeklySummary>([
      { $match: { callDate: { $gte: from, $lte: now } } },
      {
        $group: {
          _id: {
            week: { $isoWeek: '$callDate' },
            year: { $isoWeekYear: '$callDate' },
          },
          totalCalls: { $sum: 1 },
          closedCalls: {
            $sum: { $cond: [{ $eq: ['$isClosed', true] }, 1, 0] },
          },
        },
      },
      { $sort: { '_id.year': 1 as const, '_id.week': 1 as const } },
      {
        $project: {
          _id: 0,
          week: { $toString: '$_id.week' },
          year: '$_id.year',
          totalCalls: 1,
          closedCalls: 1,
        },
      },
    ]);

    return results;
  }

  async getOverallReport(dateRange: DateRange): Promise<OverallCallReport> {
    const matchStage: Record<string, unknown> = this.buildDateMatch(dateRange);

    const [summaryAgg, tagAgg, categoryAgg, peakHoursAgg, followUpAgg] = await Promise.all([
      this.CallLog.aggregate<{
        _id: null;
        totalCalls: number;
        closedCalls: number;
        avgTimeToCloseMs: number;
      }>([
        { $match: matchStage },
        {
          $group: {
            _id: null,
            totalCalls: { $sum: 1 },
            closedCalls: {
              $sum: { $cond: [{ $eq: ['$isClosed', true] }, 1, 0] },
            },
            avgTimeToCloseMs: {
              $avg: {
                $cond: [
                  { $and: [{ $eq: ['$isClosed', true] }, { $ne: ['$closedAt', null] }] },
                  { $subtract: ['$closedAt', '$createdAt'] },
                  null,
                ],
              },
            },
          },
        },
      ]),
      this.CallLog.aggregate<AggIdCount>([
        { $match: { ...matchStage, tags: { $exists: true, $ne: [] } } },
        { $unwind: '$tags' },
        { $group: { _id: '$tags', count: { $sum: 1 } } },
        { $sort: { count: -1 as const } },
      ]),
      this.CallLog.aggregate<AggIdCount>([
        { $match: { ...matchStage, category: { $exists: true, $ne: null } } },
        { $group: { _id: '$category', count: { $sum: 1 } } },
        { $sort: { count: -1 as const } },
      ]),
      this.CallLog.aggregate<AggIdCount>([
        { $match: matchStage },
        { $group: { _id: { $hour: '$callDate' }, count: { $sum: 1 } } },
        { $sort: { _id: 1 as const } },
      ]),
      this.CallLog.aggregate<{ _id: null; total: number; withFollowUp: number; completed: number }>([
        { $match: matchStage },
        {
          $group: {
            _id: null,
            total: { $sum: 1 },
            withFollowUp: {
              $sum: { $cond: [{ $ne: ['$nextFollowUpDate', null] }, 1, 0] },
            },
            completed: {
              $sum: {
                $cond: [
                  {
                    $and: [
                      { $ne: ['$nextFollowUpDate', null] },
                      { $eq: ['$isClosed', true] },
                    ],
                  },
                  1,
                  0,
                ],
              },
            },
          },
        },
      ]),
    ]);

    const summary = summaryAgg[0] ?? { totalCalls: 0, closedCalls: 0, avgTimeToCloseMs: 0 };
    const followUp = followUpAgg[0] ?? { total: 0, withFollowUp: 0, completed: 0 };

    const followUpComplianceRate = followUp.withFollowUp > 0
      ? Math.round((followUp.completed / followUp.withFollowUp) * 10000) / 100
      : 0;

    return {
      totalCalls: summary.totalCalls,
      closedCalls: summary.closedCalls,
      avgTimeToCloseMs: Math.round(summary.avgTimeToCloseMs ?? 0),
      followUpComplianceRate,
      tagDistribution: tagAgg.map((r) => ({ tag: String(r._id), count: r.count })),
      categoryDistribution: categoryAgg.map((r) => ({ category: String(r._id), count: r.count })),
      peakCallHours: peakHoursAgg.map((r) => ({ hour: Number(r._id), count: r.count })),
    };
  }
}
