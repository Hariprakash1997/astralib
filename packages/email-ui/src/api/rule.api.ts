import { AlxConfig } from '../config.js';
import { HttpClient, type PaginationParams } from './http-client.js';

/**
 * API client for the @astralibx/email-rule-engine backend.
 *
 * @example
 * ```typescript
 * const api = new RuleAPI();
 * const templates = await api.listTemplates({ page: 1, limit: 20 });
 * ```
 */
export class RuleAPI {
  private http: HttpClient;

  constructor(baseUrl?: string) {
    this.http = new HttpClient(baseUrl ?? AlxConfig.getApiUrl('ruleEngine'));
  }

  listTemplates(params?: PaginationParams & Record<string, unknown>): Promise<any> {
    return this.http.get('/templates', params);
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

  previewTemplate(data: Record<string, unknown>): Promise<any> {
    return this.http.post('/templates/preview', data);
  }

  listRules(params?: PaginationParams & Record<string, unknown>): Promise<any> {
    return this.http.get('/rules', params);
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

  toggleRule(id: string): Promise<any> {
    return this.http.post(`/rules/${id}/toggle`);
  }

  dryRun(id: string): Promise<any> {
    return this.http.post(`/rules/${id}/dry-run`);
  }

  triggerRun(): Promise<any> {
    return this.http.post('/runner');
  }

  getRunHistory(params?: PaginationParams & Record<string, unknown>): Promise<any> {
    return this.http.get('/runner/logs', params);
  }

  getThrottleSettings(): Promise<any> {
    return this.http.get('/throttle');
  }

  updateThrottleSettings(data: Record<string, unknown>): Promise<any> {
    return this.http.put('/throttle', data);
  }
}
