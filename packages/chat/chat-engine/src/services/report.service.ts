import type { LogAdapter } from '@astralibx/core';
import { ChatSessionStatus, ChatSenderType, SessionMode } from '@astralibx/chat-types';
import type { ChatSessionModel } from '../schemas/chat-session.schema.js';
import type { ChatMessageModel } from '../schemas/chat-message.schema.js';

export interface DateRange {
  from?: string;
  to?: string;
}

export interface AgentPerformanceReport {
  agentId: string;
  totalChats: number;
  resolvedChats: number;
  resolutionRate: number;
  averageResponseTimeMs: number;
  averageRating: number;
  totalRatings: number;
}

export interface OverallReport {
  chatVolumeByDay: { date: string; count: number }[];
  peakHours: { hour: number; count: number }[];
  tagDistribution: { tag: string; count: number }[];
  faqDeflectionRate: number;
  totalSessions: number;
  resolvedSessions: number;
}

interface AggregationIdCount {
  _id: string | number;
  count: number;
}

export class ReportService {
  constructor(
    private ChatSession: ChatSessionModel,
    private ChatMessage: ChatMessageModel,
    private logger: LogAdapter,
  ) {}

  async getAgentPerformance(agentId?: string, dateRange?: DateRange): Promise<AgentPerformanceReport[]> {
    const matchStage: Record<string, unknown> = {
      agentId: { $exists: true, $ne: null },
    };

    if (agentId) matchStage.agentId = agentId;
    if (dateRange?.from || dateRange?.to) {
      const dateFilter: Record<string, unknown> = {};
      if (dateRange.from) dateFilter.$gte = new Date(dateRange.from);
      if (dateRange.to) dateFilter.$lte = new Date(dateRange.to);
      matchStage.startedAt = dateFilter;
    }

    const pipeline = [
      { $match: matchStage },
      {
        $group: {
          _id: '$agentId',
          totalChats: { $sum: 1 },
          resolvedChats: {
            $sum: { $cond: [{ $eq: ['$status', ChatSessionStatus.Resolved] }, 1, 0] },
          },
          avgRating: { $avg: '$feedback.rating' },
          totalRatings: {
            $sum: { $cond: [{ $gt: ['$feedback.rating', null] }, 1, 0] },
          },
        },
      },
    ];

    const agentStats = await this.ChatSession.aggregate(pipeline);

    const results: AgentPerformanceReport[] = [];
    for (const stat of agentStats) {
      const avgResponseTime = await this.calculateAvgResponseTime(stat._id, dateRange);

      results.push({
        agentId: stat._id,
        totalChats: stat.totalChats,
        resolvedChats: stat.resolvedChats,
        resolutionRate: stat.totalChats > 0
          ? Math.round((stat.resolvedChats / stat.totalChats) * 10000) / 100
          : 0,
        averageResponseTimeMs: avgResponseTime,
        averageRating: stat.avgRating ? Math.round(stat.avgRating * 100) / 100 : 0,
        totalRatings: stat.totalRatings,
      });
    }

    return results;
  }

  async getOverallReport(dateRange?: DateRange): Promise<OverallReport> {
    const matchStage: Record<string, unknown> = {};
    if (dateRange?.from || dateRange?.to) {
      const dateFilter: Record<string, unknown> = {};
      if (dateRange.from) dateFilter.$gte = new Date(dateRange.from);
      if (dateRange.to) dateFilter.$lte = new Date(dateRange.to);
      matchStage.startedAt = dateFilter;
    }

    // Chat volume by day
    const volumePipeline = [
      { $match: matchStage },
      {
        $group: {
          _id: { $dateToString: { format: '%Y-%m-%d', date: '$startedAt' } },
          count: { $sum: 1 },
        },
      },
      { $sort: { _id: 1 as const } },
    ];

    // Peak hours
    const peakPipeline = [
      { $match: matchStage },
      {
        $group: {
          _id: { $hour: '$startedAt' },
          count: { $sum: 1 },
        },
      },
      { $sort: { _id: 1 as const } },
    ];

    // Tag distribution
    const tagPipeline = [
      { $match: { ...matchStage, tags: { $exists: true, $ne: [] } } },
      { $unwind: '$tags' },
      {
        $group: {
          _id: '$tags',
          count: { $sum: 1 },
        },
      },
      { $sort: { count: -1 as const } },
    ];

    // FAQ deflection: sessions resolved without human agent (mode stayed AI)
    const faqPipeline = [
      { $match: matchStage },
      {
        $group: {
          _id: null,
          total: { $sum: 1 },
          resolved: {
            $sum: { $cond: [{ $eq: ['$status', ChatSessionStatus.Resolved] }, 1, 0] },
          },
          deflected: {
            $sum: {
              $cond: [
                {
                  $and: [
                    { $eq: ['$status', ChatSessionStatus.Resolved] },
                    { $eq: ['$mode', SessionMode.AI] },
                    { $in: ['$agentId', [null, undefined]] },
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

    const [volumeResult, peakResult, tagResult, faqResult] = await Promise.all([
      this.ChatSession.aggregate(volumePipeline),
      this.ChatSession.aggregate(peakPipeline),
      this.ChatSession.aggregate(tagPipeline),
      this.ChatSession.aggregate(faqPipeline),
    ]);

    const faqData = faqResult[0] || { total: 0, resolved: 0, deflected: 0 };

    return {
      chatVolumeByDay: volumeResult.map((r: AggregationIdCount) => ({ date: String(r._id), count: r.count })),
      peakHours: peakResult.map((r: AggregationIdCount) => ({ hour: Number(r._id), count: r.count })),
      tagDistribution: tagResult.map((r: AggregationIdCount) => ({ tag: String(r._id), count: r.count })),
      faqDeflectionRate: faqData.total > 0
        ? Math.round((faqData.deflected / faqData.total) * 10000) / 100
        : 0,
      totalSessions: faqData.total,
      resolvedSessions: faqData.resolved,
    };
  }

  private async calculateAvgResponseTime(agentId: string, dateRange?: DateRange): Promise<number> {
    // Get sessions for this agent
    const sessionFilter: Record<string, unknown> = { agentId };
    if (dateRange?.from || dateRange?.to) {
      const dateFilter: Record<string, unknown> = {};
      if (dateRange.from) dateFilter.$gte = new Date(dateRange.from);
      if (dateRange.to) dateFilter.$lte = new Date(dateRange.to);
      sessionFilter.startedAt = dateFilter;
    }

    const sessions = await this.ChatSession.find(sessionFilter).select('sessionId');
    if (sessions.length === 0) return 0;

    const sessionIds = sessions.map(s => s.sessionId);

    // Get all messages for these sessions ordered by time
    const messages = await this.ChatMessage
      .find({ sessionId: { $in: sessionIds } })
      .sort({ sessionId: 1, createdAt: 1 })
      .select('sessionId senderType createdAt');

    // Calculate response times: time between visitor message and next agent reply
    let totalResponseTime = 0;
    let responseCount = 0;

    const messagesBySession = new Map<string, typeof messages>();
    for (const msg of messages) {
      const list = messagesBySession.get(msg.sessionId) || [];
      list.push(msg);
      messagesBySession.set(msg.sessionId, list);
    }

    for (const [, sessionMessages] of messagesBySession) {
      for (let i = 0; i < sessionMessages.length - 1; i++) {
        const current = sessionMessages[i];
        const next = sessionMessages[i + 1];

        if (
          current.senderType === ChatSenderType.Visitor &&
          next.senderType === ChatSenderType.Agent
        ) {
          const responseTime = new Date(next.createdAt).getTime() - new Date(current.createdAt).getTime();
          if (responseTime > 0) {
            totalResponseTime += responseTime;
            responseCount++;
          }
        }
      }
    }

    return responseCount > 0 ? Math.round(totalResponseTime / responseCount) : 0;
  }
}
