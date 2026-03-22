import { LitElement, html, css, nothing } from 'lit';
import { state } from 'lit/decorators.js';
import type { OverallCallReport, DailyReport } from '@astralibx/call-log-types';
import { safeRegister } from '../../utils/safe-register.js';
import { CallLogApiClient } from '../../api/call-log-api-client.js';

export class AlxCallAnalyticsDashboard extends LitElement {
  static styles = css`
    :host { display: block; font-family: inherit; }
    .toolbar { display: flex; gap: 0.5rem; align-items: center; margin-bottom: 1rem; flex-wrap: wrap; }
    input { padding: 0.375rem 0.5rem; border: 1px solid var(--alx-border, #e2e8f0); border-radius: 6px; font-size: 0.8rem; font-family: inherit; }
    button { padding: 0.375rem 0.75rem; font-size: 0.8rem; border-radius: 6px; border: 1px solid #3b82f6; cursor: pointer; background: #3b82f6; color: #fff; font-family: inherit; }
    .stats-grid { display: grid; grid-template-columns: repeat(auto-fit, minmax(160px, 1fr)); gap: 1rem; margin-bottom: 1.5rem; }
    .stat-card { background: var(--alx-surface, #fff); border: 1px solid var(--alx-border, #e2e8f0); border-radius: 8px; padding: 1rem; }
    .stat-label { font-size: 0.7rem; font-weight: 600; text-transform: uppercase; letter-spacing: 0.04em; color: var(--alx-text-muted, #64748b); margin-bottom: 0.25rem; }
    .stat-value { font-size: 1.5rem; font-weight: 700; }
    .stat-sub { font-size: 0.75rem; color: var(--alx-text-muted, #64748b); margin-top: 0.25rem; }
    .tabs { display: flex; gap: 0; border-bottom: 1px solid var(--alx-border, #e2e8f0); margin-bottom: 1rem; }
    .tab { padding: 0.5rem 1rem; font-size: 0.8rem; font-weight: 500; cursor: pointer; border: none; background: none; border-bottom: 2px solid transparent; margin-bottom: -1px; color: var(--alx-text-muted, #64748b); font-family: inherit; }
    .tab.active { color: #3b82f6; border-bottom-color: #3b82f6; }
    .card { background: var(--alx-surface, #fff); border: 1px solid var(--alx-border, #e2e8f0); border-radius: 8px; padding: 1rem; }
    .card h4 { margin: 0 0 0.75rem; font-size: 0.875rem; font-weight: 600; }
    table { width: 100%; border-collapse: collapse; font-size: 0.8rem; }
    th, td { text-align: left; padding: 0.4rem 0.5rem; border-bottom: 1px solid var(--alx-border, #e2e8f0); }
    th { font-size: 0.7rem; font-weight: 600; color: var(--alx-text-muted, #64748b); }
    .bar-row { display: flex; align-items: center; gap: 0.5rem; margin-bottom: 0.25rem; font-size: 0.75rem; }
    .bar { height: 12px; border-radius: 3px; background: #3b82f6; min-width: 2px; }
    .error { color: #dc2626; font-size: 0.875rem; padding: 0.5rem; }
    .loading { color: var(--alx-text-muted, #64748b); padding: 1rem; text-align: center; }
    .dist-grid { display: grid; grid-template-columns: repeat(auto-fit, minmax(140px, 1fr)); gap: 0.75rem; }
    .dist-card { background: var(--alx-surface, #fff); border: 1px solid var(--alx-border, #e2e8f0); border-radius: 6px; padding: 0.75rem; }
    .dist-label { font-size: 0.75rem; font-weight: 600; color: var(--alx-text-muted, #64748b); margin-bottom: 0.25rem; }
    .dist-value { font-size: 1.25rem; font-weight: 700; }
    .stat-card-highlight { background: #eff6ff; border-color: #bfdbfe; }
  `;

  @state() private overall: OverallCallReport | null = null;
  @state() private daily: DailyReport[] = [];
  @state() private loading = false;
  @state() private error = '';
  @state() private dateFrom = '';
  @state() private dateTo = '';
  @state() private activeTab: 'overview' | 'daily' | 'tags' | 'peak' | 'channels' | 'outcomes' = 'overview';
  @state() private exporting = false;

  private api = new CallLogApiClient();

  connectedCallback() {
    super.connectedCallback();
    this.load();
  }

  async load() {
    this.loading = true;
    this.error = '';
    const dr = {
      from: this.dateFrom || undefined,
      to: this.dateTo || undefined,
    };
    try {
      const [overall, daily] = await Promise.all([
        this.api.getOverallReport(dr),
        this.api.getDailyReport(dr),
      ]);
      this.overall = overall;
      this.daily = Array.isArray(daily) ? daily : [];
    } catch (e) {
      this.error = e instanceof Error ? e.message : 'Failed to load analytics';
    } finally {
      this.loading = false;
    }
  }

  private formatMs(ms: number): string {
    const mins = Math.round(ms / 60000);
    if (mins < 60) return `${mins}m`;
    return `${Math.floor(mins / 60)}h ${mins % 60}m`;
  }

  private pct(n: number): string {
    return (n * 100).toFixed(1) + '%';
  }

  private renderOverview() {
    if (!this.overall) return nothing;
    const o = this.overall;
    return html`
      <div class="stats-grid">
        <div class="stat-card">
          <div class="stat-label">Total Calls</div>
          <div class="stat-value">${o.totalCalls.toLocaleString()}</div>
        </div>
        <div class="stat-card">
          <div class="stat-label">Closed</div>
          <div class="stat-value">${o.closedCalls.toLocaleString()}</div>
          <div class="stat-sub">${o.totalCalls > 0 ? this.pct(o.closedCalls / o.totalCalls) : '—'} close rate</div>
        </div>
        <div class="stat-card">
          <div class="stat-label">Avg Time to Close</div>
          <div class="stat-value">${o.avgTimeToCloseMs > 0 ? this.formatMs(o.avgTimeToCloseMs) : '—'}</div>
        </div>
        <div class="stat-card">
          <div class="stat-label">Follow-Up Compliance</div>
          <div class="stat-value">${this.pct(o.followUpComplianceRate)}</div>
        </div>
        <div class="stat-card stat-card-highlight">
          <div class="stat-label">Follow-up Calls</div>
          <div class="stat-value">${(o.followUpCalls ?? 0).toLocaleString()}</div>
          <div class="stat-sub">${this.pct(o.followUpRatio ?? 0)} of total</div>
        </div>
      </div>
    `;
  }

  private renderChannelDistribution() {
    if (!this.overall) return nothing;
    const items = this.overall.channelDistribution ?? [];
    if (items.length === 0) return html`<div class="loading">No channel data</div>`;
    return html`
      <div class="card">
        <h4>Channel Distribution</h4>
        <div class="dist-grid">
          ${items.map(ch => html`
            <div class="dist-card">
              <div class="dist-label">${ch.channel}</div>
              <div class="dist-value">${ch.count.toLocaleString()}</div>
              <div style="font-size:0.7rem;color:#64748b;">
                ${this.overall!.totalCalls > 0 ? this.pct(ch.count / this.overall!.totalCalls) : '—'}
              </div>
            </div>
          `)}
        </div>
      </div>
    `;
  }

  private renderOutcomeDistribution() {
    if (!this.overall) return nothing;
    const items = this.overall.outcomeDistribution ?? [];
    if (items.length === 0) return html`<div class="loading">No outcome data</div>`;
    const max = Math.max(...items.map(i => i.count), 1);
    return html`
      <div class="card">
        <h4>Outcome Distribution</h4>
        <div class="dist-grid" style="margin-bottom:1rem;">
          ${items.map(oc => html`
            <div class="dist-card">
              <div class="dist-label">${oc.outcome}</div>
              <div class="dist-value">${oc.count.toLocaleString()}</div>
              <div style="font-size:0.7rem;color:#64748b;">
                ${this.overall!.totalCalls > 0 ? this.pct(oc.count / this.overall!.totalCalls) : '—'}
              </div>
            </div>
          `)}
        </div>
        ${items.map(oc => html`
          <div class="bar-row">
            <span style="min-width:100px;">${oc.outcome}</span>
            <div class="bar" style="width:${(oc.count / max) * 200}px;"></div>
            <span>${oc.count}</span>
          </div>
        `)}
      </div>
    `;
  }

  private renderDaily() {
    if (this.daily.length === 0) return html`<div class="loading">No daily data</div>`;
    return html`
      <div class="card">
        <h4>Daily Call Volume</h4>
        <table>
          <thead>
            <tr><th>Date</th><th>Total</th><th>Inbound</th><th>Outbound</th></tr>
          </thead>
          <tbody>
            ${this.daily.slice(-14).map(d => {
              const inbound = d.byDirection.find(x => x.direction === 'inbound')?.count ?? 0;
              const outbound = d.byDirection.find(x => x.direction === 'outbound')?.count ?? 0;
              return html`
                <tr>
                  <td>${d.date}</td>
                  <td><strong>${d.total}</strong></td>
                  <td>${inbound}</td>
                  <td>${outbound}</td>
                </tr>
              `;
            })}
          </tbody>
        </table>
      </div>
    `;
  }

  private renderTags() {
    if (!this.overall || !this.overall.tagDistribution.length) return html`<div class="loading">No tag data</div>`;
    const max = Math.max(...this.overall.tagDistribution.map(t => t.count), 1);
    return html`
      <div class="card">
        <h4>Tag Distribution</h4>
        ${this.overall.tagDistribution.slice(0, 15).map(t => html`
          <div class="bar-row">
            <span style="min-width:100px;">${t.tag}</span>
            <div class="bar" style="width:${(t.count / max) * 200}px;"></div>
            <span>${t.count}</span>
          </div>
        `)}
      </div>
    `;
  }

  private async onExportReport() {
    this.exporting = true;
    try {
      const filter = { dateFrom: this.dateFrom || undefined, dateTo: this.dateTo || undefined };
      const data = await this.api.exportCallLogs(filter, 'json');
      const blob = new Blob([typeof data === 'string' ? data : JSON.stringify(data, null, 2)], { type: 'application/json' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url; a.download = 'call-log-report.json'; a.click();
      URL.revokeObjectURL(url);
    } catch { /* non-fatal */ } finally {
      this.exporting = false;
    }
  }

  private renderPeakHours() {
    if (!this.overall || !this.overall.peakCallHours.length) return html`<div class="loading">No peak hour data</div>`;
    const max = Math.max(...this.overall.peakCallHours.map(h => h.count), 1);
    return html`
      <div class="card">
        <h4>Peak Call Hours</h4>
        ${this.overall.peakCallHours.map(h => html`
          <div class="bar-row">
            <span style="min-width:40px;">${String(h.hour).padStart(2, '0')}:00</span>
            <div class="bar" style="width:${(h.count / max) * 200}px;"></div>
            <span>${h.count}</span>
          </div>
        `)}
      </div>
    `;
  }

  render() {
    return html`
      <div class="toolbar">
        <input type="date" .value=${this.dateFrom} @change=${(e: Event) => this.dateFrom = (e.target as HTMLInputElement).value} />
        <input type="date" .value=${this.dateTo} @change=${(e: Event) => this.dateTo = (e.target as HTMLInputElement).value} />
        <button @click=${() => this.load()}>Load</button>
        <button ?disabled=${this.exporting} @click=${this.onExportReport}>${this.exporting ? 'Exporting...' : 'Export Report'}</button>
      </div>

      ${this.error ? html`<div class="error">${this.error}</div>` : ''}
      ${this.loading ? html`<div class="loading">Loading analytics...</div>` : ''}

      ${!this.loading ? html`
        ${this.renderOverview()}

        <div class="tabs">
          ${(['overview', 'daily', 'tags', 'peak', 'channels', 'outcomes'] as const).map(t => html`
            <button class="tab ${this.activeTab === t ? 'active' : ''}" @click=${() => this.activeTab = t}>
              ${t.charAt(0).toUpperCase() + t.slice(1)}
            </button>
          `)}
        </div>

        ${this.activeTab === 'overview' ? this.renderOverview() : ''}
        ${this.activeTab === 'daily' ? this.renderDaily() : ''}
        ${this.activeTab === 'tags' ? this.renderTags() : ''}
        ${this.activeTab === 'peak' ? this.renderPeakHours() : ''}
        ${this.activeTab === 'channels' ? this.renderChannelDistribution() : ''}
        ${this.activeTab === 'outcomes' ? this.renderOutcomeDistribution() : ''}
      ` : ''}
    `;
  }
}

safeRegister('alx-call-analytics-dashboard', AlxCallAnalyticsDashboard);
