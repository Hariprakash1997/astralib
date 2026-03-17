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

interface SendLog {
  _id: string;
  ruleId?: string;
  ruleName?: string;
  identifier?: string;
  status: string;
  error?: string;
  createdAt?: string;
}

interface ErrorLog {
  _id: string;
  ruleId?: string;
  ruleName?: string;
  error: string;
  accountId?: string;
  createdAt?: string;
}

export class AlxTgAnalytics extends LitElement {
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
      .stats-grid {
        display: grid;
        grid-template-columns: repeat(auto-fit, minmax(140px, 1fr));
        gap: 0.625rem;
        margin-bottom: 1rem;
      }
      .stat-card {
        padding: 0.75rem;
        background: var(--alx-surface);
        border: 1px solid var(--alx-border);
        border-radius: var(--alx-radius);
        text-align: center;
      }
      .stat-value {
        font-size: 1.5rem;
        font-weight: 700;
        font-variant-numeric: tabular-nums;
      }
      .stat-label {
        font-size: 0.7rem;
        color: var(--alx-text-muted);
        text-transform: uppercase;
        letter-spacing: 0.03em;
        margin-top: 0.15rem;
      }
      .stat-sent .stat-value { color: var(--alx-success); }
      .stat-failed .stat-value { color: var(--alx-danger); }
      .stat-skipped .stat-value { color: var(--alx-text-muted); }
      .section + .section {
        margin-top: 1rem;
      }
      .error-text {
        font-size: 0.7rem;
        color: var(--alx-danger);
        max-width: 300px;
        overflow: hidden;
        text-overflow: ellipsis;
        white-space: nowrap;
      }
    `,
  ];

  @property({ type: String, reflect: true }) density: 'default' | 'compact' = 'default';

  @state() private totalSent = 0;
  @state() private totalFailed = 0;
  @state() private totalSkipped = 0;
  @state() private sendLogs: SendLog[] = [];
  @state() private errorLogs: ErrorLog[] = [];
  @state() private loading = false;
  @state() private error = '';
  @state() private statusFilter = '';
  @state() private dateFrom = '';
  @state() private dateTo = '';

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
      const params: Record<string, unknown> = { limit: 50 };
      if (this.statusFilter) params['status'] = this.statusFilter;
      if (this.dateFrom) params['from'] = this.dateFrom;
      if (this.dateTo) params['to'] = this.dateTo;

      const [statsRes, sendsRes, errorsRes] = await Promise.all([
        this.api.getStats(params) as Promise<Record<string, unknown>>,
        this.api.getSendLogs(params) as Promise<{ sends: SendLog[] }>,
        this.api.getErrorLogs(params) as Promise<{ errors: ErrorLog[] }>,
      ]);
      if (gen !== this._loadGeneration) return;
      this.totalSent = (statsRes['totalSent'] as number) ?? 0;
      this.totalFailed = (statsRes['totalFailed'] as number) ?? 0;
      this.totalSkipped = (statsRes['totalSkipped'] as number) ?? 0;
      this.sendLogs = sendsRes.sends ?? [];
      this.errorLogs = errorsRes.errors ?? [];
    } catch (e) {
      if (gen !== this._loadGeneration) return;
      this.error = e instanceof Error ? e.message : 'Failed to load analytics';
    } finally {
      if (gen === this._loadGeneration) this.loading = false;
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

  private statusBadgeClass(status: string): string {
    switch (status) {
      case 'sent': return 'alx-badge alx-badge-success';
      case 'failed': return 'alx-badge alx-badge-danger';
      case 'skipped': return 'alx-badge alx-badge-muted';
      default: return 'alx-badge alx-badge-muted';
    }
  }

  override render() {
    if (this.loading) {
      return html`<div class="alx-loading"><div class="alx-spinner"></div></div>`;
    }

    return html`
      ${this.error ? html`<div class="alx-error">${this.error}</div>` : ''}

      <div class="stats-grid">
        <div class="stat-card stat-sent">
          <div class="stat-value">${this.totalSent}</div>
          <div class="stat-label">Total Sent</div>
        </div>
        <div class="stat-card stat-failed">
          <div class="stat-value">${this.totalFailed}</div>
          <div class="stat-label">Total Failed</div>
        </div>
        <div class="stat-card stat-skipped">
          <div class="stat-value">${this.totalSkipped}</div>
          <div class="stat-label">Total Skipped</div>
        </div>
      </div>

      <div class="section">
        <div class="alx-card">
          <div class="alx-card-header">
            <h3>Send Logs</h3>
          </div>

          <div class="toolbar">
            <select @change=${(e: Event) => { this.statusFilter = (e.target as HTMLSelectElement).value; this.load(); }}>
              <option value="">All Statuses</option>
              <option value="sent">Sent</option>
              <option value="failed">Failed</option>
              <option value="skipped">Skipped</option>
            </select>
            <input type="date" .value=${this.dateFrom} @change=${(e: Event) => { this.dateFrom = (e.target as HTMLInputElement).value; this.load(); }} />
            <input type="date" .value=${this.dateTo} @change=${(e: Event) => { this.dateTo = (e.target as HTMLInputElement).value; this.load(); }} />
            <span class="spacer"></span>
            <button @click=${() => this.load()}>Refresh</button>
          </div>

          ${this.sendLogs.length === 0
            ? html`<div class="alx-empty"><p>No send logs yet.</p></div>`
            : html`
                <table>
                  <thead>
                    <tr>
                      <th>RULE</th>
                      <th>IDENTIFIER</th>
                      <th>STATUS</th>
                      <th>DATE</th>
                    </tr>
                  </thead>
                  <tbody>
                    ${this.sendLogs.map(s => html`
                      <tr>
                        <td>${s.ruleName ?? s.ruleId ?? '--'}</td>
                        <td style="font-family:monospace;font-size:0.75rem">${s.identifier ?? '--'}</td>
                        <td><span class=${this.statusBadgeClass(s.status)}>${s.status}</span></td>
                        <td>${this.formatDate(s.createdAt)}</td>
                      </tr>
                    `)}
                  </tbody>
                </table>
              `}
        </div>
      </div>

      <div class="section">
        <div class="alx-card">
          <div class="alx-card-header">
            <h3>Error Logs</h3>
          </div>

          ${this.errorLogs.length === 0
            ? html`<div class="alx-empty"><p>No errors logged.</p></div>`
            : html`
                <table>
                  <thead>
                    <tr>
                      <th>RULE</th>
                      <th>ERROR</th>
                      <th>ACCOUNT</th>
                      <th>DATE</th>
                    </tr>
                  </thead>
                  <tbody>
                    ${this.errorLogs.map(e => html`
                      <tr>
                        <td>${e.ruleName ?? e.ruleId ?? '--'}</td>
                        <td><span class="error-text" title=${e.error}>${e.error}</span></td>
                        <td style="font-family:monospace;font-size:0.75rem">${e.accountId ?? '--'}</td>
                        <td>${this.formatDate(e.createdAt)}</td>
                      </tr>
                    `)}
                  </tbody>
                </table>
              `}
        </div>
      </div>
    `;
  }
}
safeRegister('alx-tg-analytics', AlxTgAnalytics);

declare global {
  interface HTMLElementTagNameMap {
    'alx-tg-analytics': AlxTgAnalytics;
  }
}
