import { LitElement, html, css, nothing } from 'lit';
import { property, state } from 'lit/decorators.js';
import { safeRegister } from '../../utils/safe-register.js';
import { ChatApiClient } from '../../api/chat-api-client.js';
import type { AgentPerformanceEntry, OverallAnalytics, ReportFilters } from '../../api/chat-api-client.js';
import {
  alxChatResetStyles,
  alxChatThemeStyles,
  alxChatDensityStyles,
  alxChatButtonStyles,
  alxChatInputStyles,
  alxChatLoadingStyles,
  alxChatCardStyles,
  alxChatTableStyles,
  alxChatBadgeStyles,
} from '../../styles/shared.js';

export class AlxChatReports extends LitElement {
  static styles = [
    alxChatResetStyles,
    alxChatThemeStyles,
    alxChatDensityStyles,
    alxChatButtonStyles,
    alxChatInputStyles,
    alxChatLoadingStyles,
    alxChatCardStyles,
    alxChatTableStyles,
    alxChatBadgeStyles,
    css`
      :host { display: block; }

      .reports-grid {
        display: grid;
        grid-template-columns: repeat(auto-fill, minmax(160px, 1fr));
        gap: 0.75rem;
        margin-bottom: 1rem;
      }

      .stat-card {
        background: var(--alx-surface);
        border: 1px solid var(--alx-border);
        border-radius: var(--alx-radius);
        padding: 1rem;
        text-align: center;
      }

      .stat-value {
        font-size: 1.5rem;
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

      .filter-bar {
        display: flex;
        gap: 0.5rem;
        align-items: center;
        padding: 0.75rem 0;
        flex-wrap: wrap;
      }

      .filter-bar label {
        font-size: 0.75rem;
        color: var(--alx-text-muted);
      }

      .filter-bar input {
        width: 150px;
      }

      .perf-table {
        width: 100%;
        border-collapse: collapse;
      }

      .perf-table th {
        text-align: left;
        font-size: 0.6875rem;
        font-weight: 600;
        text-transform: uppercase;
        letter-spacing: 0.05em;
        color: var(--alx-text-muted);
        padding: 0.5rem;
        border-bottom: 1px solid var(--alx-border);
      }

      .perf-table td {
        padding: 0.5rem;
        font-size: 0.8125rem;
        border-bottom: 1px solid color-mix(in srgb, var(--alx-border) 40%, transparent);
      }

      .perf-table tr:hover td {
        background: color-mix(in srgb, var(--alx-primary) 5%, transparent);
      }

      .section-title {
        font-size: 0.875rem;
        font-weight: 600;
        color: var(--alx-text);
        margin: 1rem 0 0.5rem;
      }

      .tag-list {
        display: flex;
        flex-wrap: wrap;
        gap: 0.375rem;
        margin-top: 0.25rem;
      }

      .tag-item {
        display: inline-flex;
        align-items: center;
        gap: 0.25rem;
        padding: 0.15rem 0.5rem;
        font-size: 0.75rem;
        background: color-mix(in srgb, var(--alx-primary) 12%, transparent);
        border: 1px solid color-mix(in srgb, var(--alx-primary) 25%, transparent);
        border-radius: 999px;
        color: var(--alx-text);
      }

      .tag-count {
        font-weight: 600;
        color: var(--alx-primary);
      }

      .export-bar {
        display: flex;
        gap: 0.375rem;
        margin-top: 0.75rem;
      }

      .empty-state {
        padding: 2rem;
        text-align: center;
        color: var(--alx-text-muted);
        font-size: 0.8125rem;
      }
    `,
  ];

  @property({ type: String }) density: 'default' | 'compact' = 'default';

  @state() private agentPerformance: AgentPerformanceEntry[] = [];
  @state() private overall: OverallAnalytics | null = null;
  @state() private loading = false;
  @state() private error = '';
  @state() private dateFrom = '';
  @state() private dateTo = '';
  @state() private exporting = false;

  private api!: ChatApiClient;

  connectedCallback() {
    super.connectedCallback();
    this.api = new ChatApiClient();
    this.loadReports();
  }

  private getFilters(): ReportFilters {
    const filters: ReportFilters = {};
    if (this.dateFrom) filters.dateFrom = this.dateFrom;
    if (this.dateTo) filters.dateTo = this.dateTo;
    return filters;
  }

  private async loadReports() {
    this.loading = true;
    this.error = '';
    try {
      const filters = this.getFilters();
      const [perfResult, overallResult] = await Promise.all([
        this.api.getAgentPerformance(filters),
        this.api.getOverallAnalytics(filters),
      ]);
      this.agentPerformance = (perfResult as any).agents ?? perfResult ?? [];
      this.overall = overallResult;
    } catch (e) {
      this.error = e instanceof Error ? e.message : 'Failed to load reports';
    } finally {
      this.loading = false;
    }
  }

  private async exportReport(format: 'json' | 'csv') {
    this.exporting = true;
    try {
      const filters = this.getFilters();
      const data = await this.api.exportBulk(filters, format);

      // Trigger download
      const blob = new Blob([typeof data === 'string' ? data : JSON.stringify(data, null, 2)], {
        type: format === 'csv' ? 'text/csv' : 'application/json',
      });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `chat-report.${format}`;
      a.click();
      URL.revokeObjectURL(url);
    } catch (e) {
      this.error = e instanceof Error ? e.message : 'Export failed';
    } finally {
      this.exporting = false;
    }
  }

  private formatDuration(ms: number): string {
    if (!ms) return '-';
    const seconds = Math.round(ms / 1000);
    if (seconds < 60) return `${seconds}s`;
    const minutes = Math.round(seconds / 60);
    return `${minutes}m`;
  }

  private formatPercent(val: number): string {
    if (val == null) return '-';
    return `${Math.round(val * 100)}%`;
  }

  render() {
    return html`
      <div class="alx-card">
        <div class="alx-card-header">
          <h3>Reports & Analytics</h3>
          <button class="alx-btn-sm" @click=${() => this.loadReports()}>Refresh</button>
        </div>

        ${this.error ? html`<div class="alx-error">${this.error}</div>` : ''}

        <div class="filter-bar">
          <label>From:</label>
          <input type="date" .value=${this.dateFrom}
            @change=${(e: Event) => { this.dateFrom = (e.target as HTMLInputElement).value; this.loadReports(); }} />
          <label>To:</label>
          <input type="date" .value=${this.dateTo}
            @change=${(e: Event) => { this.dateTo = (e.target as HTMLInputElement).value; this.loadReports(); }} />
        </div>

        ${this.loading ? html`<div class="alx-loading"><span class="alx-spinner"></span> Loading...</div>` : ''}

        ${!this.loading && this.overall ? html`
          <div class="reports-grid">
            <div class="stat-card">
              <div class="stat-value">${this.overall.totalChats ?? 0}</div>
              <div class="stat-label">Total Chats</div>
            </div>
            <div class="stat-card">
              <div class="stat-value">${this.overall.resolvedChats ?? 0}</div>
              <div class="stat-label">Resolved</div>
            </div>
            <div class="stat-card">
              <div class="stat-value">${this.formatDuration(this.overall.avgDurationMs ?? 0)}</div>
              <div class="stat-label">Avg Duration</div>
            </div>
            ${this.overall.peakHour != null ? html`
              <div class="stat-card">
                <div class="stat-value">${this.overall.peakHour}:00</div>
                <div class="stat-label">Peak Hour</div>
              </div>
            ` : nothing}
            ${this.overall.faqDeflectionRate != null ? html`
              <div class="stat-card">
                <div class="stat-value">${this.formatPercent(this.overall.faqDeflectionRate)}</div>
                <div class="stat-label">FAQ Deflection</div>
              </div>
            ` : nothing}
          </div>

          ${this.overall.topTags && this.overall.topTags.length > 0 ? html`
            <div class="section-title">Top Tags</div>
            <div class="tag-list">
              ${this.overall.topTags.map(t => html`
                <span class="tag-item">${t.tag} <span class="tag-count">${t.count}</span></span>
              `)}
            </div>
          ` : nothing}
        ` : ''}

        ${!this.loading && this.agentPerformance.length > 0 ? html`
          <div class="section-title">Agent Performance</div>
          <table class="perf-table">
            <thead>
              <tr>
                <th>Agent</th>
                <th>Chats</th>
                <th>Avg Response</th>
                <th>Resolution</th>
                <th>Rating</th>
              </tr>
            </thead>
            <tbody>
              ${this.agentPerformance.map(a => html`
                <tr>
                  <td>${a.name}</td>
                  <td>${a.chatsHandled}</td>
                  <td>${this.formatDuration(a.avgResponseTimeMs)}</td>
                  <td>${this.formatPercent(a.resolutionRate)}</td>
                  <td>${a.avgRating ? a.avgRating.toFixed(1) : '-'}</td>
                </tr>
              `)}
            </tbody>
          </table>
        ` : ''}

        ${!this.loading && this.agentPerformance.length === 0 && !this.overall ? html`
          <div class="empty-state">No report data available for the selected date range.</div>
        ` : ''}

        ${!this.loading ? html`
          <div class="export-bar">
            <button class="alx-btn-sm" ?disabled=${this.exporting}
              @click=${() => this.exportReport('csv')}>Export CSV</button>
            <button class="alx-btn-sm" ?disabled=${this.exporting}
              @click=${() => this.exportReport('json')}>Export JSON</button>
          </div>
        ` : ''}
      </div>
    `;
  }
}

safeRegister('alx-chat-reports', AlxChatReports);
