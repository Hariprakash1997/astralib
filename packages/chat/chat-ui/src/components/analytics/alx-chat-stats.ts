import { LitElement, html, css } from 'lit';
import { property, state } from 'lit/decorators.js';
import type { DashboardStats } from '@astralibx/chat-types';
import { safeRegister } from '../../utils/safe-register.js';
import { HttpClient } from '../../api/http-client.js';
import { AlxChatConfig } from '../../config.js';
import {
  alxChatResetStyles,
  alxChatThemeStyles,
  alxChatDensityStyles,
  alxChatLoadingStyles,
} from '../../styles/shared.js';

export class AlxChatStats extends LitElement {
  static styles = [
    alxChatResetStyles,
    alxChatThemeStyles,
    alxChatDensityStyles,
    alxChatLoadingStyles,
    css`
      :host { display: block; }

      .stats-grid {
        display: grid;
        grid-template-columns: repeat(auto-fill, minmax(160px, 1fr));
        gap: 0.75rem;
      }

      .stat-card {
        background: var(--alx-surface);
        border: 1px solid var(--alx-border);
        border-radius: var(--alx-radius);
        padding: 1rem;
        text-align: center;
        transition: border-color 0.15s;
      }

      .stat-card:hover {
        border-color: color-mix(in srgb, var(--alx-primary) 40%, var(--alx-border));
      }

      .stat-value {
        font-size: 1.75rem;
        font-weight: 700;
        color: var(--alx-text);
        line-height: 1;
        margin-bottom: 0.375rem;
        font-variant-numeric: tabular-nums;
      }

      .stat-label {
        font-size: 0.6875rem;
        font-weight: 600;
        text-transform: uppercase;
        letter-spacing: 0.05em;
        color: var(--alx-text-muted);
      }

      .stat-card.active .stat-value { color: var(--alx-success); }
      .stat-card.waiting .stat-value { color: var(--alx-warning); }
      .stat-card.resolved .stat-value { color: var(--alx-info); }
    `,
  ];

  @property({ type: String }) density: 'default' | 'compact' = 'default';
  @state() private stats: DashboardStats | null = null;
  @state() private loading = false;
  @state() private error = '';

  private http!: HttpClient;
  private refreshTimer?: ReturnType<typeof setInterval>;

  connectedCallback() {
    super.connectedCallback();
    this.http = new HttpClient(AlxChatConfig.getApiUrl('chatEngine'));
    this.loadStats();
    this.refreshTimer = setInterval(() => this.loadStats(), 30000);
  }

  disconnectedCallback() {
    super.disconnectedCallback();
    if (this.refreshTimer) clearInterval(this.refreshTimer);
  }

  async loadStats() {
    if (!this.loading) {
      this.loading = !this.stats; // Only show loading on first load
    }
    try {
      this.stats = await this.http.get<DashboardStats>('/stats');
      this.error = '';
    } catch (e) {
      if (!this.stats) {
        this.error = e instanceof Error ? e.message : 'Failed to load stats';
      }
    } finally {
      this.loading = false;
    }
  }

  render() {
    if (this.loading) {
      return html`<div class="alx-loading"><span class="alx-spinner"></span> Loading stats...</div>`;
    }
    if (this.error) {
      return html`<div class="alx-error">${this.error}</div>`;
    }
    if (!this.stats) return html``;

    return html`
      <div class="stats-grid">
        <div class="stat-card active">
          <div class="stat-value">${this.stats.activeSessions}</div>
          <div class="stat-label">Active Sessions</div>
        </div>
        <div class="stat-card waiting">
          <div class="stat-value">${this.stats.waitingSessions}</div>
          <div class="stat-label">Waiting Sessions</div>
        </div>
        <div class="stat-card resolved">
          <div class="stat-value">${this.stats.resolvedToday}</div>
          <div class="stat-label">Resolved Today</div>
        </div>
        <div class="stat-card">
          <div class="stat-value">${this.stats.totalAgents}</div>
          <div class="stat-label">Total Agents</div>
        </div>
        <div class="stat-card active">
          <div class="stat-value">${this.stats.activeAgents}</div>
          <div class="stat-label">Active Agents</div>
        </div>
      </div>
    `;
  }
}

safeRegister('alx-chat-stats', AlxChatStats);
