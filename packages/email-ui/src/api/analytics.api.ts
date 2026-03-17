import { AlxConfig } from '../config.js';
import { HttpClient } from './http-client.js';

/**
 * API client for the @astralibx/email-analytics backend.
 *
 * @example
 * ```typescript
 * const api = new AnalyticsAPI();
 * const overview = await api.getOverview({ from: '2025-01-01', to: '2025-01-31' });
 * ```
 */
export class AnalyticsAPI {
  private http: HttpClient;

  constructor(baseUrl?: string) {
    this.http = new HttpClient(baseUrl ?? AlxConfig.getApiUrl('analytics'));
  }

  getOverview(params?: Record<string, unknown>): Promise<any> {
    return this.http.get('/overview', params);
  }

  getTimeline(params?: Record<string, unknown>): Promise<any> {
    return this.http.get('/timeline', params);
  }

  getAccountStats(params?: Record<string, unknown>): Promise<any> {
    return this.http.get('/accounts', params);
  }

  getRuleStats(params?: Record<string, unknown>): Promise<any> {
    return this.http.get('/rules', params);
  }

  getTemplateStats(params?: Record<string, unknown>): Promise<any> {
    return this.http.get('/templates', params);
  }

  getChannelStats(params?: Record<string, unknown>): Promise<any> {
    return this.http.get('/channels', params);
  }

  getVariantStats(params?: Record<string, unknown>): Promise<any> {
    return this.http.get('/variants', params);
  }

  trackEvent(data: Record<string, unknown>): Promise<any> {
    return this.http.post('/track', data);
  }

  triggerAggregation(data?: Record<string, unknown>): Promise<any> {
    return this.http.post('/aggregate', data);
  }
}
