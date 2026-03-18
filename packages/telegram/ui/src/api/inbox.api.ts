import { AlxTelegramConfig } from '../config.js';
import { HttpClient, type PaginationParams } from './http-client.js';

/**
 * API client for the @astralibx/telegram inbox backend.
 *
 * @example
 * ```typescript
 * const api = new TelegramInboxAPI();
 * const conversations = await api.listConversations({ page: 1, limit: 20 });
 * ```
 */
export class TelegramInboxAPI {
  private http: HttpClient;

  constructor(baseUrl?: string) {
    this.http = new HttpClient(baseUrl ?? AlxTelegramConfig.getApiUrl('inbox'));
  }

  // Conversations

  listConversations(params?: PaginationParams & Record<string, unknown>): Promise<any> {
    return this.http.get('/conversations', params);
  }

  getMessages(conversationId: string, params?: PaginationParams & Record<string, unknown>): Promise<any> {
    return this.http.get(`/conversations/${conversationId}/messages`, params);
  }

  sendMessage(conversationId: string, data: Record<string, unknown>): Promise<any> {
    return this.http.post(`/conversations/${conversationId}/send`, data);
  }

  markAsRead(conversationId: string): Promise<any> {
    return this.http.post(`/conversations/${conversationId}/read`);
  }

  getUnreadCount(): Promise<any> {
    return this.http.get('/conversations/unread');
  }

  syncHistory(conversationId: string): Promise<any> {
    return this.http.post(`/conversations/${conversationId}/sync`);
  }

  syncDialogs(accountId: string, limit = 50): Promise<any> {
    return this.http.post(`/conversations/sync-dialogs?accountId=${encodeURIComponent(accountId)}&limit=${limit}`);
  }

  // Sessions

  listSessions(params?: PaginationParams & Record<string, unknown>): Promise<any> {
    return this.http.get('/sessions', params);
  }

  getSession(id: string): Promise<any> {
    return this.http.get(`/sessions/${id}`);
  }

  closeSession(id: string): Promise<any> {
    return this.http.post(`/sessions/${id}/close`);
  }

  pauseSession(id: string): Promise<any> {
    return this.http.post(`/sessions/${id}/pause`);
  }

  resumeSession(id: string): Promise<any> {
    return this.http.post(`/sessions/${id}/resume`);
  }
}
