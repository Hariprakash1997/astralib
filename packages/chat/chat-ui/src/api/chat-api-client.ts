import { HttpClient } from './http-client.js';
import { AlxChatConfig } from '../config.js';

// ── Type definitions for API payloads ──────────────────────────────────

export interface TeamTreeNode {
  agentId: string;
  name: string;
  level?: number;
  status: string;
  parentId?: string;
  teamId?: string;
  children?: TeamTreeNode[];
}

export interface HierarchyData {
  parentId?: string | null;
  level?: number;
  teamId?: string | null;
}

export interface AiSettings {
  aiMode: string;
  aiCharacter: {
    globalCharacter: AiCharacterProfile | null;
  };
  showAiTag: boolean;
}

export interface AiCharacterProfile {
  name: string;
  tone: string;
  personality: string;
  rules: string[];
  responseStyle: string;
}

export interface RatingConfig {
  enabled: boolean;
  ratingType: string;
  followUpOptions: Record<string, string[]>;
}

export interface BusinessHoursSchedule {
  day: number;
  open: string;
  close: string;
  isOpen: boolean;
}

export interface BusinessHours {
  enabled: boolean;
  timezone: string;
  schedule: BusinessHoursSchedule[];
  holidayDates: string[];
  outsideHoursMessage: string;
  outsideHoursBehavior: string;
}

export interface BusinessHoursResponse {
  isOpen: boolean;
  businessHours: BusinessHours;
}

export interface WebhookConfig {
  _id?: string;
  webhookId?: string;
  url: string;
  events: string[];
  secret?: string;
  description?: string;
  isActive?: boolean;
  createdAt?: string;
}

export interface AgentPerformanceReport {
  agents: AgentPerformanceEntry[];
}

export interface AgentPerformanceEntry {
  agentId: string;
  name: string;
  chatsHandled: number;
  avgResponseTimeMs: number;
  resolutionRate: number;
  avgRating: number;
}

export interface OverallAnalytics {
  totalChats: number;
  resolvedChats: number;
  avgDurationMs: number;
  peakHour?: number;
  topTags?: Array<{ tag: string; count: number }>;
  faqDeflectionRate?: number;
}

export interface ReportFilters {
  dateFrom?: string;
  dateTo?: string;
  agentId?: string;
}

export interface ExportFilters {
  dateFrom?: string;
  dateTo?: string;
  agentId?: string;
  tags?: string[];
  status?: string;
}

/**
 * High-level API client that wraps HttpClient with domain-specific methods
 * for all chat-engine endpoints.
 */
export class ChatApiClient {
  private http: HttpClient;

  constructor(baseUrl?: string) {
    this.http = new HttpClient(baseUrl || AlxChatConfig.getApiUrl('chatEngine'));
  }

  // ── Team Hierarchy ────────────────────────────────────────────────────

  async getTeamTree(agentId: string): Promise<TeamTreeNode[]> {
    return this.http.get<TeamTreeNode[]>(`/agents/${agentId}/team-tree`);
  }

  async getDirectReports(agentId: string): Promise<unknown[]> {
    return this.http.get<unknown[]>(`/agents/${agentId}/reports`);
  }

  async setHierarchy(agentId: string, data: HierarchyData): Promise<unknown> {
    return this.http.put(`/agents/${agentId}/hierarchy`, data);
  }

  // ── Settings: AI ──────────────────────────────────────────────────────

  async getAiSettings(): Promise<AiSettings> {
    return this.http.get<AiSettings>('/settings/ai');
  }

  async updateAiSettings(data: Partial<AiSettings>): Promise<AiSettings> {
    return this.http.put<AiSettings>('/settings/ai', data);
  }

  // ── Settings: Rating ──────────────────────────────────────────────────

  async getRatingConfig(): Promise<RatingConfig> {
    return this.http.get<RatingConfig>('/settings/rating');
  }

  async updateRatingConfig(data: Partial<RatingConfig>): Promise<RatingConfig> {
    return this.http.put<RatingConfig>('/settings/rating', data);
  }

  // ── Settings: Business Hours ──────────────────────────────────────────

  async getBusinessHours(): Promise<BusinessHoursResponse> {
    return this.http.get<BusinessHoursResponse>('/settings/business-hours');
  }

  async updateBusinessHours(data: Partial<BusinessHours>): Promise<BusinessHours> {
    return this.http.put<BusinessHours>('/settings/business-hours', data);
  }

  // ── Settings: Chat Mode ───────────────────────────────────────────────

  async getChatMode(): Promise<string> {
    const result = await this.http.get<{ chatMode: string }>('/settings/chat-mode');
    return (result as any).chatMode ?? result;
  }

  async updateChatMode(chatMode: string): Promise<string> {
    const result = await this.http.put<{ chatMode: string }>('/settings/chat-mode', { chatMode });
    return (result as any).chatMode ?? result;
  }

  // ── Settings: Available Tags ──────────────────────────────────────────

  async getAvailableTags(): Promise<string[]> {
    const result = await this.http.get<{ availableTags: string[] }>('/settings/available-tags');
    return (result as any).availableTags ?? result;
  }

  async updateAvailableTags(availableTags: string[]): Promise<string[]> {
    const result = await this.http.put<{ availableTags: string[] }>('/settings/available-tags', { availableTags });
    return (result as any).availableTags ?? result;
  }

  // ── Settings: User Categories ─────────────────────────────────────────

  async getUserCategories(): Promise<string[]> {
    const result = await this.http.get<{ availableUserCategories: string[] }>('/settings/user-categories');
    return (result as any).availableUserCategories ?? result;
  }

  async updateUserCategories(availableUserCategories: string[]): Promise<string[]> {
    const result = await this.http.put<{ availableUserCategories: string[] }>('/settings/user-categories', { availableUserCategories });
    return (result as any).availableUserCategories ?? result;
  }

  // ── Settings: Full Settings ───────────────────────────────────────────

  async getSettings(): Promise<Record<string, unknown>> {
    return this.http.get<Record<string, unknown>>('/settings');
  }

  async updateSettings(data: Record<string, unknown>): Promise<Record<string, unknown>> {
    return this.http.put<Record<string, unknown>>('/settings', data);
  }

  // ── Export ────────────────────────────────────────────────────────────

  async exportTranscript(sessionId: string, format: 'json' | 'csv' = 'json'): Promise<string> {
    return this.http.get<string>(`/sessions/${sessionId}/export`, { format });
  }

  async exportBulk(filters: ExportFilters, format: 'json' | 'csv' = 'json'): Promise<string> {
    return this.http.post<string>(`/sessions/export?format=${format}`, filters);
  }

  // ── Reports ───────────────────────────────────────────────────────────

  async getAgentPerformance(filters?: ReportFilters): Promise<AgentPerformanceReport> {
    return this.http.get<AgentPerformanceReport>('/reports/agent-performance', filters as Record<string, unknown>);
  }

  async getOverallAnalytics(filters?: ReportFilters): Promise<OverallAnalytics> {
    return this.http.get<OverallAnalytics>('/reports/overall', filters as Record<string, unknown>);
  }

  // ── Webhooks ──────────────────────────────────────────────────────────

  async listWebhooks(): Promise<WebhookConfig[]> {
    return this.http.get<WebhookConfig[]>('/webhooks');
  }

  async createWebhook(data: { url: string; events: string[]; secret?: string; description?: string }): Promise<WebhookConfig> {
    return this.http.post<WebhookConfig>('/webhooks', data);
  }

  async deleteWebhook(id: string): Promise<void> {
    await this.http.delete(`/webhooks/${id}`);
  }

  // ── Session Tags ──────────────────────────────────────────────────────

  async addTag(sessionId: string, tag: string): Promise<string[]> {
    return this.http.post<string[]>(`/sessions/${sessionId}/tags`, { tag });
  }

  async removeTag(sessionId: string, tag: string): Promise<string[]> {
    return this.http.delete<string[]>(`/sessions/${sessionId}/tags/${encodeURIComponent(tag)}`);
  }

  // ── User Category ─────────────────────────────────────────────────────

  async setUserCategory(sessionId: string, category: string | null): Promise<string | null> {
    const result = await this.http.put<{ userCategory: string | null }>(`/sessions/${sessionId}/user-category`, { category });
    return (result as any).userCategory ?? result;
  }
}
