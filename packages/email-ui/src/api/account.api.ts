import { AlxConfig } from '../config.js';
import { HttpClient, type PaginationParams } from './http-client.js';

/**
 * API client for the @astralibx/email-account-manager backend.
 *
 * @example
 * ```typescript
 * const api = new AccountAPI();
 * const accounts = await api.list({ page: 1, limit: 20 });
 * ```
 */
export class AccountAPI {
  private http: HttpClient;

  constructor(baseUrl?: string) {
    this.http = new HttpClient(baseUrl ?? AlxConfig.getApiUrl('accountManager'));
  }

  list(params?: PaginationParams & Record<string, unknown>): Promise<any> {
    return this.http.get('/accounts', params);
  }

  getById(id: string): Promise<any> {
    return this.http.get(`/accounts/${id}`);
  }

  create(data: Record<string, unknown>): Promise<any> {
    return this.http.post('/accounts', data);
  }

  update(id: string, data: Record<string, unknown>): Promise<any> {
    return this.http.put(`/accounts/${id}`, data);
  }

  remove(id: string): Promise<any> {
    return this.http.delete(`/accounts/${id}`);
  }

  testConnection(id: string): Promise<any> {
    return this.http.post(`/accounts/${id}/test`);
  }

  getHealth(id: string): Promise<any> {
    return this.http.get(`/accounts/${id}/health`);
  }

  getAllHealth(): Promise<any> {
    return this.http.get('/accounts/health');
  }

  getCapacity(): Promise<any> {
    return this.http.get('/accounts/capacity');
  }

  getWarmupStatus(id: string): Promise<any> {
    return this.http.get(`/accounts/${id}/warmup`);
  }

  startWarmup(id: string): Promise<any> {
    return this.http.post(`/accounts/${id}/warmup/start`);
  }

  getSettings(): Promise<any> {
    return this.http.get('/settings');
  }

  updateSettings(data: Record<string, unknown>): Promise<any> {
    return this.http.patch('/settings', data);
  }

  listIdentifiers(params?: PaginationParams & Record<string, unknown>): Promise<any> {
    return this.http.get('/identifiers', params);
  }

  listDrafts(params?: PaginationParams & Record<string, unknown>): Promise<any> {
    return this.http.get('/drafts', params);
  }

  approveDraft(id: string): Promise<any> {
    return this.http.post(`/drafts/${id}/approve`);
  }

  rejectDraft(id: string): Promise<any> {
    return this.http.post(`/drafts/${id}/reject`);
  }

  bulkApprove(ids: string[]): Promise<any> {
    return this.http.post('/drafts/bulk-approve', { ids });
  }
}
