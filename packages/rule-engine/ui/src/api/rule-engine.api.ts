import { RuleEngineUIConfig } from '../config.js';
import { HttpClient } from './http-client.js';

/**
 * API client for the @astralibx/rule-engine backend.
 *
 * @example
 * ```typescript
 * const api = new RuleEngineAPI(new HttpClient('/api/rule-engine'));
 * const templates = await api.listTemplates({ page: 1, limit: 20 });
 * ```
 */
export class RuleEngineAPI {
  constructor(private http: HttpClient) {}

  static create(baseUrl?: string): RuleEngineAPI {
    return new RuleEngineAPI(new HttpClient(baseUrl ?? RuleEngineUIConfig.getApiUrl()));
  }

  // Templates
  listTemplates(params?: Record<string, unknown>): Promise<any> { return this.http.get('/templates', params); }
  createTemplate(data: Record<string, unknown>): Promise<any> { return this.http.post('/templates', data); }
  getTemplate(id: string): Promise<any> { return this.http.get(`/templates/${id}`); }
  updateTemplate(id: string, data: Record<string, unknown>): Promise<any> { return this.http.put(`/templates/${id}`, data); }
  deleteTemplate(id: string): Promise<any> { return this.http.delete(`/templates/${id}`); }
  toggleTemplate(id: string): Promise<any> { return this.http.patch(`/templates/${id}/toggle`); }
  previewTemplate(id: string, data: Record<string, unknown>): Promise<any> { return this.http.post(`/templates/${id}/preview`, data); }
  previewTemplateRaw(data: Record<string, unknown>): Promise<any> { return this.http.post('/templates/preview', data); }
  validateTemplate(data: Record<string, unknown>): Promise<any> { return this.http.post('/templates/validate', data); }
  cloneTemplate(id: string): Promise<any> { return this.http.post(`/templates/${id}/clone`); }
  sendTest(id: string, data: Record<string, unknown>): Promise<any> { return this.http.post(`/templates/${id}/test-send`, data); }
  previewWithRecipient(id: string, data: Record<string, unknown>): Promise<any> { return this.http.post(`/templates/${id}/preview-with-data`, data); }

  // Rules
  listRules(params?: Record<string, unknown>): Promise<any> { return this.http.get('/rules', params); }
  createRule(data: Record<string, unknown>): Promise<any> { return this.http.post('/rules', data); }
  getRule(id: string): Promise<any> { return this.http.get(`/rules/${id}`); }
  updateRule(id: string, data: Record<string, unknown>): Promise<any> { return this.http.patch(`/rules/${id}`, data); }
  deleteRule(id: string): Promise<any> { return this.http.delete(`/rules/${id}`); }
  toggleRule(id: string): Promise<any> { return this.http.post(`/rules/${id}/toggle`); }
  dryRun(id: string): Promise<any> { return this.http.post(`/rules/${id}/dry-run`); }
  cloneRule(id: string): Promise<any> { return this.http.post(`/rules/${id}/clone`); }
  previewConditions(data: Record<string, unknown>): Promise<any> { return this.http.post('/rules/preview-conditions', data); }

  // Collections
  listCollections(): Promise<any> { return this.http.get('/collections'); }
  getCollectionFields(name: string, joins?: string[]): Promise<any> {
    const params = joins?.length ? `?joins=${joins.join(',')}` : '';
    return this.http.get(`/collections/${name}/fields${params}`);
  }

  // Runner
  triggerRun(): Promise<any> { return this.http.post('/runner'); }
  getRunStatus(runId: string): Promise<any> { return this.http.get(`/runner/status/${runId}`); }
  getLatestRunStatus(): Promise<any> { return this.http.get('/runner/status'); }
  cancelRun(runId: string): Promise<any> { return this.http.post(`/runner/cancel/${runId}`); }
  getRunHistory(params?: Record<string, unknown>): Promise<any> { return this.http.get('/runner/logs', params); }

  // Settings
  getThrottleConfig(): Promise<any> { return this.http.get('/throttle'); }
  updateThrottleConfig(data: Record<string, unknown>): Promise<any> { return this.http.put('/throttle', data); }

  // Send logs
  listSendLogs(params?: Record<string, unknown>): Promise<any> { return this.http.get('/sends', params); }
}
