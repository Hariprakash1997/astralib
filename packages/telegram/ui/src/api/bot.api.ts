import { AlxTelegramConfig } from '../config.js';
import { HttpClient } from './http-client.js';

/**
 * API client for the @astralibx/telegram bot backend.
 *
 * @example
 * ```typescript
 * const api = new TelegramBotAPI();
 * const status = await api.getStatus();
 * ```
 */
export class TelegramBotAPI {
  private http: HttpClient;

  constructor(baseUrl?: string) {
    this.http = new HttpClient(baseUrl ?? AlxTelegramConfig.getApiUrl('bot'));
  }

  getStatus(): Promise<any> {
    return this.http.get('/status');
  }

  getStats(): Promise<any> {
    return this.http.get('/stats');
  }

  getUsers(params?: Record<string, unknown>): Promise<any> {
    return this.http.get('/users', params);
  }

  getUser(id: string): Promise<any> {
    return this.http.get(`/users/${id}`);
  }
}
