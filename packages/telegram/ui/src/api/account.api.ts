import { AlxTelegramConfig } from '../config.js';
import { HttpClient, type PaginationParams } from './http-client.js';

/**
 * API client for the @astralibx/telegram account manager backend.
 *
 * @example
 * ```typescript
 * const api = new TelegramAccountAPI();
 * const accounts = await api.listAccounts({ page: 1, limit: 20 });
 * ```
 */
export class TelegramAccountAPI {
  private http: HttpClient;

  constructor(baseUrl?: string) {
    this.http = new HttpClient(baseUrl ?? AlxTelegramConfig.getApiUrl('accountManager'));
  }

  listAccounts(params?: PaginationParams & Record<string, unknown>): Promise<any> {
    return this.http.get('/accounts', params);
  }

  getAccount(id: string): Promise<any> {
    return this.http.get(`/accounts/${id}`);
  }

  createAccount(data: Record<string, unknown>): Promise<any> {
    return this.http.post('/accounts', data);
  }

  updateAccount(id: string, data: Record<string, unknown>): Promise<any> {
    return this.http.put(`/accounts/${id}`, data);
  }

  deleteAccount(id: string): Promise<any> {
    return this.http.delete(`/accounts/${id}`);
  }

  connectAccount(id: string): Promise<any> {
    return this.http.post(`/accounts/${id}/connect`);
  }

  disconnectAccount(id: string): Promise<any> {
    return this.http.post(`/accounts/${id}/disconnect`);
  }

  reconnectAccount(id: string): Promise<any> {
    return this.http.post(`/accounts/${id}/reconnect`);
  }

  quarantineAccount(id: string, data: Record<string, unknown>): Promise<any> {
    return this.http.post(`/accounts/${id}/quarantine`, data);
  }

  releaseAccount(id: string): Promise<any> {
    return this.http.post(`/accounts/${id}/release`);
  }

  getCapacity(id: string): Promise<any> {
    return this.http.get(`/accounts/${id}/capacity`);
  }

  getAllCapacity(): Promise<any> {
    return this.http.get('/accounts/capacity');
  }

  getHealth(id: string): Promise<any> {
    return this.http.get(`/accounts/${id}/health`);
  }

  getAllHealth(): Promise<any> {
    return this.http.get('/accounts/health');
  }

  // Identifiers

  listIdentifiers(params?: PaginationParams & Record<string, unknown>): Promise<any> {
    return this.http.get('/identifiers', params);
  }

  getIdentifier(id: string): Promise<any> {
    return this.http.get(`/identifiers/${id}`);
  }

  createIdentifier(data: Record<string, unknown>): Promise<any> {
    return this.http.post('/identifiers', data);
  }

  updateIdentifier(id: string, data: Record<string, unknown>): Promise<any> {
    return this.http.put(`/identifiers/${id}`, data);
  }

  deleteIdentifier(id: string): Promise<any> {
    return this.http.delete(`/identifiers/${id}`);
  }
}
