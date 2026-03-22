import { HttpClient } from './http-client.js';
import { CallLogUIConfig } from '../config.js';
import type {
  IPipeline,
  IPipelineStage,
  ICallLog,
  ITimelineEntry,
  ICallLogSettings,
  AgentCallStats,
  PipelineReport,
  PipelineFunnel,
  DailyReport,
  OverallCallReport,
  DateRange,
  ExportFilter,
} from '@astralibx/call-log-types';

// ── Payload types ──────────────────────────────────────────────────────────

export interface CreatePipelinePayload {
  name: string;
  description?: string;
  isDefault?: boolean;
  stages?: Omit<IPipelineStage, 'stageId'>[];
}

export interface UpdatePipelinePayload {
  name?: string;
  description?: string;
  isActive?: boolean;
  isDefault?: boolean;
}

export interface CreateStagePayload {
  name: string;
  color?: string;
  order?: number;
  isTerminal?: boolean;
  isDefault?: boolean;
}

export interface UpdateStagePayload {
  name?: string;
  color?: string;
  order?: number;
  isTerminal?: boolean;
  isDefault?: boolean;
}

export interface ListCallLogsFilter {
  pipelineId?: string;
  currentStageId?: string;
  agentId?: string;
  category?: string;
  isClosed?: boolean;
  contactExternalId?: string;
  priority?: string;
  direction?: string;
  channel?: string;
  outcome?: string;
  isFollowUp?: boolean;
  includeDeleted?: boolean;
  page?: number;
  limit?: number;
  from?: string;
  to?: string;
}

export interface CreateCallLogPayload {
  pipelineId: string;
  contactRef: { externalId: string; displayName: string; phone?: string; email?: string };
  direction: string;
  agentId: string;
  callDate?: string;
  priority?: string;
  channel?: string;
  outcome?: string;
  isFollowUp?: boolean;
  tags?: string[];
  category?: string;
  nextFollowUpDate?: string;
  initialNote?: string;
}

export interface UpdateCallLogPayload {
  priority?: string;
  channel?: string;
  outcome?: string;
  isFollowUp?: boolean;
  tags?: string[];
  category?: string;
  nextFollowUpDate?: string;
  metadata?: Record<string, unknown>;
}

export interface PaginatedCallLogs {
  data: ICallLog[];
  total: number;
  page: number;
  totalPages: number;
}

export interface PaginatedTimeline {
  data: ITimelineEntry[];
  total: number;
  page: number;
  totalPages: number;
}

export interface AgentLeaderboard {
  agents: AgentCallStats[];
}

/**
 * Typed API client for all @astralibx/call-log-engine REST endpoints.
 */
export class CallLogApiClient {
  private http: HttpClient;

  constructor(baseUrl?: string) {
    this.http = new HttpClient(baseUrl ?? CallLogUIConfig.getApiUrl());
  }

  // ── Pipelines ──────────────────────────────────────────────────────────

  async listPipelines(filter?: { isActive?: boolean }): Promise<IPipeline[]> {
    return this.http.get<IPipeline[]>('/pipelines', filter as Record<string, unknown>);
  }

  async getPipeline(id: string): Promise<IPipeline> {
    return this.http.get<IPipeline>(`/pipelines/${id}`);
  }

  async createPipeline(data: CreatePipelinePayload): Promise<IPipeline> {
    return this.http.post<IPipeline>('/pipelines', data);
  }

  async updatePipeline(id: string, data: UpdatePipelinePayload): Promise<IPipeline> {
    return this.http.put<IPipeline>(`/pipelines/${id}`, data);
  }

  async deletePipeline(id: string): Promise<void> {
    await this.http.delete(`/pipelines/${id}`);
  }

  async addStage(pipelineId: string, data: CreateStagePayload): Promise<IPipeline> {
    return this.http.post<IPipeline>(`/pipelines/${pipelineId}/stages`, data);
  }

  async updateStage(pipelineId: string, stageId: string, data: UpdateStagePayload): Promise<IPipeline> {
    return this.http.put<IPipeline>(`/pipelines/${pipelineId}/stages/${stageId}`, data);
  }

  async removeStage(pipelineId: string, stageId: string): Promise<void> {
    await this.http.delete(`/pipelines/${pipelineId}/stages/${stageId}`);
  }

  async reorderStages(pipelineId: string, stageIds: string[]): Promise<IPipeline> {
    return this.http.put<IPipeline>(`/pipelines/${pipelineId}/stages/reorder`, { stageIds });
  }

  // ── Call Logs ──────────────────────────────────────────────────────────

  async listCallLogs(filter?: ListCallLogsFilter): Promise<PaginatedCallLogs> {
    return this.http.get<PaginatedCallLogs>('/calls', filter as Record<string, unknown>);
  }

  async getCallLog(id: string): Promise<ICallLog> {
    return this.http.get<ICallLog>(`/calls/${id}`);
  }

  async createCallLog(data: CreateCallLogPayload): Promise<ICallLog> {
    return this.http.post<ICallLog>('/calls', data);
  }

  async updateCallLog(id: string, data: UpdateCallLogPayload): Promise<ICallLog> {
    return this.http.put<ICallLog>(`/calls/${id}`, data);
  }

  async changeStage(id: string, newStageId: string, agentId: string): Promise<ICallLog> {
    return this.http.put<ICallLog>(`/calls/${id}/stage`, { newStageId, agentId });
  }

  async assignCallLog(id: string, agentId: string, assignedBy: string): Promise<ICallLog> {
    return this.http.put<ICallLog>(`/calls/${id}/assign`, { agentId, assignedBy });
  }

  async closeCallLog(id: string, agentId: string): Promise<ICallLog> {
    return this.http.put<ICallLog>(`/calls/${id}/close`, { agentId });
  }

  async reopenCallLog(id: string, agentId: string): Promise<ICallLog> {
    return this.http.put<ICallLog>(`/calls/${id}/reopen`, { agentId });
  }

  async deleteCallLog(id: string): Promise<void> {
    await this.http.delete(`/calls/${id}`);
  }

  async bulkChangeStage(callLogIds: string[], newStageId: string, agentId: string): Promise<{ updated: number }> {
    return this.http.put<{ updated: number }>('/calls/-/bulk/stage', { callLogIds, newStageId, agentId });
  }

  async getFollowUpsDue(agentId?: string, dateRange?: DateRange): Promise<ICallLog[]> {
    return this.http.get<ICallLog[]>('/calls/follow-ups', {
      agentId,
      from: dateRange?.from,
      to: dateRange?.to,
    });
  }

  // ── Timeline ──────────────────────────────────────────────────────────

  async getTimeline(callLogId: string, page = 1, limit = 50): Promise<PaginatedTimeline> {
    return this.http.get<PaginatedTimeline>(`/calls/${callLogId}/timeline`, { page, limit });
  }

  async addNote(callLogId: string, content: string, authorId: string, authorName: string): Promise<ITimelineEntry> {
    return this.http.post<ITimelineEntry>(`/calls/${callLogId}/notes`, { content, authorId, authorName });
  }

  // ── Contacts ──────────────────────────────────────────────────────────

  async getContactCalls(externalId: string): Promise<ICallLog[]> {
    return this.http.get<ICallLog[]>(`/contacts/${externalId}/calls`);
  }

  async getContactTimeline(externalId: string): Promise<ITimelineEntry[]> {
    return this.http.get<ITimelineEntry[]>(`/contacts/${externalId}/timeline`);
  }

  // ── Analytics ──────────────────────────────────────────────────────────

  async getAgentStats(agentId: string, dateRange?: DateRange): Promise<AgentCallStats> {
    return this.http.get<AgentCallStats>(`/analytics/agent/${agentId}`, dateRange as Record<string, unknown>);
  }

  async getAgentLeaderboard(dateRange?: DateRange): Promise<AgentLeaderboard> {
    return this.http.get<AgentLeaderboard>('/analytics/agent-leaderboard', dateRange as Record<string, unknown>);
  }

  async getPipelineStats(pipelineId: string, dateRange?: DateRange): Promise<PipelineReport> {
    return this.http.get<PipelineReport>(`/analytics/pipeline/${pipelineId}`, dateRange as Record<string, unknown>);
  }

  async getPipelineFunnel(pipelineId: string, dateRange?: DateRange): Promise<PipelineFunnel> {
    return this.http.get<PipelineFunnel>(`/analytics/pipeline/${pipelineId}/funnel`, dateRange as Record<string, unknown>);
  }

  async getDailyReport(dateRange?: DateRange): Promise<DailyReport[]> {
    return this.http.get<DailyReport[]>('/analytics/daily', dateRange as Record<string, unknown>);
  }

  async getWeeklyTrends(weeks = 4): Promise<DailyReport[]> {
    return this.http.get<DailyReport[]>('/analytics/weekly-trends', { weeks });
  }

  async getOverallReport(dateRange?: DateRange): Promise<OverallCallReport> {
    return this.http.get<OverallCallReport>('/analytics/overall', dateRange as Record<string, unknown>);
  }

  async getTeamStats(teamId?: string, dateRange?: DateRange): Promise<AgentCallStats[]> {
    return this.http.get<AgentCallStats[]>('/analytics/team', {
      teamId,
      from: dateRange?.from,
      to: dateRange?.to,
    });
  }

  // ── Settings ──────────────────────────────────────────────────────────

  async getSettings(): Promise<ICallLogSettings> {
    return this.http.get<ICallLogSettings>('/settings');
  }

  async updateSettings(data: Partial<ICallLogSettings>): Promise<ICallLogSettings> {
    return this.http.put<ICallLogSettings>('/settings', data);
  }

  // ── Export ──────────────────────────────────────────────────────────────

  async exportCallLogs(filter?: ExportFilter, format: 'json' | 'csv' = 'json'): Promise<string> {
    return this.http.get<string>('/export/calls', { ...filter, format } as Record<string, unknown>);
  }

  async exportCallLog(id: string, format: 'json' | 'csv' = 'json'): Promise<string> {
    return this.http.get<string>(`/export/calls/${id}`, { format });
  }

  async exportPipelineReport(pipelineId: string, dateRange?: DateRange, format: 'json' | 'csv' = 'json'): Promise<string> {
    return this.http.get<string>(`/export/pipeline/${pipelineId}`, {
      format,
      from: dateRange?.from,
      to: dateRange?.to,
    });
  }
}
