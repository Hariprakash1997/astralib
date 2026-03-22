export type ExportFormat = 'json' | 'csv';

export interface CallLogMetric {
  name: string;
  labels: Record<string, string>;
  value?: number;
}

export interface DateRange {
  from?: string;
  to?: string;
}

export interface AgentCallStats {
  agentId: string;
  agentName: string;
  totalCalls: number;
  avgCallsPerDay: number;
  followUpsCompleted: number;
  overdueFollowUps: number;
  callsByPipeline: { pipelineId: string; pipelineName: string; count: number }[];
  callsClosed: number;
  closeRate: number;
}

export interface PipelineStageStats {
  stageId: string;
  stageName: string;
  count: number;
  avgTimeMs: number;
  conversionRate: number;
}

export interface PipelineReport {
  pipelineId: string;
  pipelineName: string;
  totalCalls: number;
  stages: PipelineStageStats[];
  bottleneckStage: string | null;
}

export interface PipelineFunnel {
  pipelineId: string;
  pipelineName: string;
  stages: { stageId: string; stageName: string; entered: number; exited: number; dropOff: number }[];
}

export interface DailyReport {
  date: string;
  total: number;
  byDirection: { direction: string; count: number }[];
  byPipeline: { pipelineId: string; pipelineName: string; count: number }[];
  byAgent: { agentId: string; agentName: string; count: number }[];
}

export interface OverallCallReport {
  totalCalls: number;
  closedCalls: number;
  avgTimeToCloseMs: number;
  followUpComplianceRate: number;
  tagDistribution: { tag: string; count: number }[];
  categoryDistribution: { category: string; count: number }[];
  peakCallHours: { hour: number; count: number }[];
}

export interface WeeklyTrend {
  weekLabel: string;
  totalCalls: number;
  byDirection: { direction: string; count: number }[];
  byPipeline: { pipelineId: string; count: number }[];
}

export interface DashboardStats {
  openCalls: number;
  closedToday: number;
  overdueFollowUps: number;
  totalAgents: number;
  callsToday: number;
}

export interface ExportFilter {
  pipelineId?: string;
  stageId?: string;
  agentId?: string;
  tags?: string[];
  category?: string;
  isClosed?: boolean;
  dateFrom?: string;
  dateTo?: string;
}
