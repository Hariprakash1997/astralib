import { LitElement, html, css } from 'lit';
import { state, property } from 'lit/decorators.js';
import { safeRegister } from '../../utils/safe-register.js';
import { alxBaseStyles } from '../../styles/theme.js';
import {
  alxDensityStyles,
  alxButtonStyles,
  alxInputStyles,
  alxTableStyles,
  alxBadgeStyles,
  alxLoadingStyles,
  alxCardStyles,
  alxToolbarStyles,
} from '../../styles/shared.js';
import { TelegramRuleAPI } from '../../api/rule.api.js';

interface RunLog {
  _id: string;
  runId?: string;
  triggeredBy?: string;
  status: string;
  sent?: number;
  failed?: number;
  skipped?: number;
  startedAt?: string;
  duration?: number;
}

export class AlxTgRunHistory extends LitElement {
  static override styles = [
    alxBaseStyles,
    alxDensityStyles,
    alxButtonStyles,
    alxInputStyles,
    alxTableStyles,
    alxBadgeStyles,
    alxLoadingStyles,
    alxCardStyles,
    alxToolbarStyles,
    css`
      .stats-row {
        display: flex;
        gap: 0.375rem;
        font-size: 0.75rem;
        font-variant-numeric: tabular-nums;
      }
      .stat-sent { color: var(--alx-success); }
      .stat-failed { color: var(--alx-danger); }
      .stat-skipped { color: var(--alx-text-muted); }
    `,
  ];

  @property({ type: String, reflect: true }) density: 'default' | 'compact' = 'default';
  @property({ type: Number }) page = 1;
  @property({ type: Number }) limit = 20;

  @state() private runs: RunLog[] = [];
  @state() private total = 0;
  @state() private loading = false;
  @state() private error = '';
  @state() private triggering = false;

  private _api?: TelegramRuleAPI;
  private get api(): TelegramRuleAPI {
    if (!this._api) this._api = new TelegramRuleAPI();
    return this._api;
  }
  private _loadGeneration = 0;

  override connectedCallback(): void {
    super.connectedCallback();
    this.load();
  }

  async load(): Promise<void> {
    const gen = ++this._loadGeneration;
    this.loading = true;
    this.error = '';
    try {
      const res = await this.api.getRunLogs({ page: this.page, limit: this.limit }) as {
        runs: RunLog[];
        total?: number;
      };
      if (gen !== this._loadGeneration) return;
      this.runs = res.runs ?? [];
      this.total = res.total ?? res.runs?.length ?? 0;
    } catch (e) {
      if (gen !== this._loadGeneration) return;
      this.error = e instanceof Error ? e.message : 'Failed to load run history';
    } finally {
      if (gen === this._loadGeneration) this.loading = false;
    }
  }

  private get totalPages(): number {
    return Math.max(1, Math.ceil(this.total / this.limit));
  }

  private async onRunNow(): Promise<void> {
    this.triggering = true;
    try {
      await this.api.triggerRun();
      setTimeout(() => this.load(), 2000);
    } catch (e) {
      this.error = e instanceof Error ? e.message : 'Failed to trigger run';
    } finally {
      this.triggering = false;
    }
  }

  private onPrev(): void {
    if (this.page > 1) { this.page--; this.load(); }
  }

  private onNext(): void {
    if (this.page < this.totalPages) { this.page++; this.load(); }
  }

  private statusBadgeClass(status: string): string {
    switch (status) {
      case 'completed': return 'alx-badge alx-badge-success';
      case 'running': return 'alx-badge alx-badge-info';
      case 'failed': return 'alx-badge alx-badge-danger';
      case 'cancelled': return 'alx-badge alx-badge-warning';
      default: return 'alx-badge alx-badge-muted';
    }
  }

  private formatDate(d?: string): string {
    if (!d) return '--';
    try {
      return new Date(d).toLocaleString(undefined, {
        month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit',
      });
    } catch {
      return d;
    }
  }

  private formatDuration(ms?: number): string {
    if (!ms) return '--';
    if (ms < 1000) return `${ms}ms`;
    const s = Math.round(ms / 1000);
    if (s < 60) return `${s}s`;
    return `${Math.floor(s / 60)}m ${s % 60}s`;
  }

  override render() {
    return html`
      <div class="alx-card">
        <div class="alx-card-header">
          <h3>Run History</h3>
        </div>

        <div class="toolbar">
          <span class="spacer"></span>
          <button @click=${() => this.load()}>Refresh</button>
          <button class="alx-btn-primary" ?disabled=${this.triggering} @click=${this.onRunNow}>
            ${this.triggering ? 'Triggering...' : 'Run Now'}
          </button>
        </div>

        ${this.error ? html`<div class="alx-error">${this.error}</div>` : ''}
        ${this.loading
          ? html`<div class="alx-loading"><div class="alx-spinner"></div></div>`
          : this.runs.length === 0
            ? html`<div class="alx-empty"><p>No run history yet.</p></div>`
            : html`
                <table>
                  <thead>
                    <tr>
                      <th>RUN ID</th>
                      <th>TRIGGERED BY</th>
                      <th>STATUS</th>
                      <th>SENT / FAILED / SKIPPED</th>
                      <th>STARTED</th>
                      <th>DURATION</th>
                    </tr>
                  </thead>
                  <tbody>
                    ${this.runs.map(r => html`
                      <tr>
                        <td style="font-family:monospace;font-size:0.7rem">${(r.runId ?? r._id).slice(-8)}</td>
                        <td>${r.triggeredBy ?? '--'}</td>
                        <td><span class=${this.statusBadgeClass(r.status)}>${r.status}</span></td>
                        <td>
                          <div class="stats-row">
                            <span class="stat-sent">${r.sent ?? 0}</span> /
                            <span class="stat-failed">${r.failed ?? 0}</span> /
                            <span class="stat-skipped">${r.skipped ?? 0}</span>
                          </div>
                        </td>
                        <td>${this.formatDate(r.startedAt)}</td>
                        <td>${this.formatDuration(r.duration)}</td>
                      </tr>
                    `)}
                  </tbody>
                </table>

                <div class="pagination">
                  <button class="alx-btn-sm" ?disabled=${this.page <= 1} @click=${this.onPrev}>Prev</button>
                  <span class="text-small text-muted">Page ${this.page} of ${this.totalPages}</span>
                  <button class="alx-btn-sm" ?disabled=${this.page >= this.totalPages} @click=${this.onNext}>Next</button>
                </div>
              `}
      </div>
    `;
  }
}
safeRegister('alx-tg-run-history', AlxTgRunHistory);

declare global {
  interface HTMLElementTagNameMap {
    'alx-tg-run-history': AlxTgRunHistory;
  }
}
