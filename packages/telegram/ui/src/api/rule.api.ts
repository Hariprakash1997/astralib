import { AlxTelegramConfig } from '../config.js';
import { HttpClient, type PaginationParams } from './http-client.js';

/**
 * API client for the @astralibx/telegram rule engine backend.
 *
 * @example
 * ```typescript
 * const api = new TelegramRuleAPI();
 * const templates = await api.listTemplates({ page: 1, limit: 20 });
 * ```
 */
export class TelegramRuleAPI {
  private http: HttpClient;

  constructor(baseUrl?: string) {
    this.http = new HttpClient(baseUrl ?? AlxTelegramConfig.getApiUrl('ruleEngine'));
  }

  // Templates

  listTemplates(params?: PaginationParams & Record<string, unknown>): Promise<any> {
    return this.http.get('/templates', params);
  }

  getTemplate(id: string): Promise<any> {
    return this.http.get(`/templates/${id}`);
  }

  createTemplate(data: Record<string, unknown>): Promise<any> {
    return this.http.post('/templates', data);
  }

  updateTemplate(id: string, data: Record<string, unknown>): Promise<any> {
    return this.http.put(`/templates/${id}`, data);
  }

  deleteTemplate(id: string): Promise<any> {
    return this.http.delete(`/templates/${id}`);
  }

  previewTemplate(id: string, data: Record<string, unknown>): Promise<any> {
    return this.http.post(`/templates/${id}/preview`, data);
  }

  // Rules

  listRules(params?: PaginationParams & Record<string, unknown>): Promise<any> {
    return this.http.get('/rules', params);
  }

  getRule(id: string): Promise<any> {
    return this.http.get(`/rules/${id}`);
  }

  createRule(data: Record<string, unknown>): Promise<any> {
    return this.http.post('/rules', data);
  }

  updateRule(id: string, data: Record<string, unknown>): Promise<any> {
    return this.http.put(`/rules/${id}`, data);
  }

  deleteRule(id: string): Promise<any> {
    return this.http.delete(`/rules/${id}`);
  }

  activateRule(id: string): Promise<any> {
    return this.http.post(`/rules/${id}/activate`);
  }

  deactivateRule(id: string): Promise<any> {
    return this.http.post(`/rules/${id}/deactivate`);
  }

  dryRunRule(id: string): Promise<any> {
    return this.http.post(`/rules/${id}/dry-run`);
  }

  // Runner

  triggerRun(): Promise<any> {
    return this.http.post('/runner/trigger');
  }

  getRunStatus(runId?: string): Promise<any> {
    return this.http.get(runId ? `/runner/status/${runId}` : '/runner/status');
  }

  cancelRun(runId: string): Promise<any> {
    return this.http.post(`/runner/cancel/${runId}`);
  }

  // Settings

  getThrottleConfig(): Promise<any> {
    return this.http.get('/settings/throttle');
  }

  updateThrottleConfig(data: Record<string, unknown>): Promise<any> {
    return this.http.put('/settings/throttle', data);
  }

  // Send Logs

  getSendLogs(params?: PaginationParams & Record<string, unknown>): Promise<any> {
    return this.http.get('/sends', params);
  }

  // Run Logs

  getRunLogs(params?: PaginationParams & Record<string, unknown>): Promise<any> {
    return this.http.get('/runner/logs', params);
  }
}
