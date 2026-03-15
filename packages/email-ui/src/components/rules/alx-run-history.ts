import { LitElement, html, css, nothing } from 'lit';
import { customElement, state, property } from 'lit/decorators.js';
import { alxBaseStyles } from '../../styles/theme.js';
import {
  alxDensityStyles,
  alxResetStyles,
  alxTypographyStyles,
  alxButtonStyles,
  alxInputStyles,
  alxTableStyles,
  alxBadgeStyles,
  alxLoadingStyles,
  alxCardStyles,
} from '../../styles/shared.js';
import { RuleAPI } from '../../api/rule.api.js';


interface PerRuleStat {
  ruleName: string;
  ruleId: string;
  sent: number;
  skipped: number;
  errors: number;
}

interface RunLog {
  _id: string;
  runId?: string;
  runAt: string;
  status?: string;
  triggeredBy: string;
  duration: number;
  rulesProcessed: number;
  totalSent: number;
  totalSkipped: number;
  totalErrors: number;
  perRuleStats: PerRuleStat[];
}

@customElement('alx-run-history')
export class AlxRunHistory extends LitElement {
  static override styles = [
    alxBaseStyles,
    alxDensityStyles,
    alxResetStyles,
    alxTypographyStyles,
    alxButtonStyles,
    alxInputStyles,
    alxTableStyles,
    alxBadgeStyles,
    alxLoadingStyles,
    alxCardStyles,
    css`
      .toolbar {
        display: flex;
        align-items: center;
        gap: var(--alx-density-gap, 0.75rem);
        flex-wrap: wrap;
        margin-bottom: var(--alx-density-gap, 1rem);
      }

      .toolbar input[type='date'] {
        width: auto;
      }

      .spacer {
        flex: 1;
      }

      .pagination {
        display: flex;
        align-items: center;
        justify-content: center;
        gap: var(--alx-density-gap, 1rem);
        margin-top: var(--alx-density-gap, 1rem);
      }

      .expandable {
        cursor: pointer;
      }

      .expand-icon {
        display: inline-block;
        transition: transform 0.2s;
        margin-right: 0.5rem;
      }

      .expand-icon.open {
        transform: rotate(90deg);
      }

      .sub-table {
        padding: 0.75rem 1.5rem;
        background: var(--alx-bg);
      }

      .sub-table table {
        font-size: 0.8rem;
      }

      .stat {
        font-variant-numeric: tabular-nums;
      }

      .duration {
        color: var(--alx-text-muted);
        font-size: 0.8rem;
      }

      .alx-success-msg {
        color: var(--alx-success, #16a34a);
        font-size: 0.8rem;
        margin-top: 0.5rem;
      }
    `,
  ];

  @property({ type: String, reflect: true }) density: 'default' | 'compact' = 'default';

  @state() private _logs: RunLog[] = [];
  @state() private _loading = false;
  @state() private _error = '';
  @state() private _successMsg = '';
  @state() private _page = 1;
  @state() private _totalPages = 1;
  @state() private _total = 0;
  @state() private _expandedIds = new Set<string>();
  @state() private _dateFrom = '';
  @state() private _dateTo = '';

  private __api?: RuleAPI;
  private get _api(): RuleAPI {
    if (!this.__api) this.__api = new RuleAPI();
    return this.__api;
  }
  private readonly _limit = 20;
  private _loadGeneration = 0;

  override connectedCallback(): void {
    super.connectedCallback();
    this._loadLogs();
  }

  private async _loadLogs(): Promise<void> {
    const gen = ++this._loadGeneration;
    this._loading = true;
    this._error = '';
    try {
      const params: Record<string, unknown> = {
        page: this._page,
        limit: this._limit,
      };
      if (this._dateFrom) params['from'] = this._dateFrom;
      if (this._dateTo) params['to'] = this._dateTo;

      const res = (await this._api.getRunHistory(params)) as { logs: RunLog[]; total?: number };
      if (gen !== this._loadGeneration) return;
      this._logs = res.logs ?? [];
      this._total = res.total ?? res.logs?.length ?? 0;
      this._totalPages = Math.max(1, Math.ceil(this._total / this._limit));
    } catch (err) {
      if (gen !== this._loadGeneration) return;
      this._error = err instanceof Error ? err.message : 'Failed to load run history';
    } finally {
      if (gen === this._loadGeneration) this._loading = false;
    }
  }

  private _toggleExpand(id: string): void {
    const next = new Set(this._expandedIds);
    if (next.has(id)) {
      next.delete(id);
    } else {
      next.add(id);
    }
    this._expandedIds = next;
  }

  private _onDateFilter(): void {
    this._page = 1;
    this._loadLogs();
  }

  private _goToPage(page: number): void {
    this._page = page;
    this._loadLogs();
  }

  private async _onRunNow(): Promise<void> {
    this._successMsg = '';
    this._error = '';
    try {
      const res = (await this._api.triggerRun()) as { data?: { runId?: string } };
      const runId = res.data?.runId ?? 'unknown';
      this._successMsg = `Run started (ID: ${runId})`;
    } catch (err) {
      this._error = err instanceof Error ? err.message : 'Failed to trigger run';
    }
  }

  private async _onCancelRun(log: RunLog, e: Event): Promise<void> {
    e.stopPropagation();
    const runId = log.runId ?? log._id;
    this._error = '';
    try {
      await this._api.cancelRun(runId);
      await this._loadLogs();
    } catch (err) {
      this._error = err instanceof Error ? err.message : 'Failed to cancel run';
    }
  }

  private _formatDate(dateStr: string): string {
    return new Date(dateStr).toLocaleString();
  }

  private _formatDuration(ms: number): string {
    if (ms < 1000) return `${ms}ms`;
    return `${(ms / 1000).toFixed(1)}s`;
  }

  private _renderStatusBadge(status?: string): unknown {
    if (!status) return nothing;
    const cls =
      status === 'running'
        ? 'alx-badge alx-badge-warning'
        : status === 'failed'
          ? 'alx-badge alx-badge-danger'
          : status === 'cancelled'
            ? 'alx-badge alx-badge-muted'
            : 'alx-badge alx-badge-success';
    return html`<span class="${cls}">${status}</span>`;
  }

  override render() {
    return html`
      <div class="alx-card">
        <div class="alx-card-header">
          <h3>Run History</h3>
        </div>

        <div class="toolbar">
          <label style="margin-bottom:0">From</label>
          <input
            type="date"
            .value=${this._dateFrom}
            @change=${(e: Event) => {
              this._dateFrom = (e.target as HTMLInputElement).value;
              this._onDateFilter();
            }}
          />
          <label style="margin-bottom:0">To</label>
          <input
            type="date"
            .value=${this._dateTo}
            @change=${(e: Event) => {
              this._dateTo = (e.target as HTMLInputElement).value;
              this._onDateFilter();
            }}
          />
          <span class="spacer"></span>
          <button class="alx-btn-sm" @click=${this._onRunNow}>Run Now</button>
        </div>

        ${this._error ? html`<div class="alx-error">${this._error}</div>` : nothing}
        ${this._successMsg
          ? html`<div class="alx-success-msg">${this._successMsg}</div>`
          : nothing}

        ${this._loading
          ? html`<div class="alx-loading"><div class="alx-spinner"></div></div>`
          : this._logs.length === 0
            ? html`<div class="alx-empty">No run history found</div>`
            : html`
                <table>
                  <thead>
                    <tr>
                      <th></th>
                      <th>Run At</th>
                      <th>Status</th>
                      <th>Triggered By</th>
                      <th>Duration</th>
                      <th>Rules</th>
                      <th>Sent</th>
                      <th>Skipped</th>
                      <th>Errors</th>
                      <th></th>
                    </tr>
                  </thead>
                  <tbody>
                    ${this._logs.map((log) => {
                      const expanded = this._expandedIds.has(log._id);
                      return html`
                        <tr class="expandable" @click=${() => this._toggleExpand(log._id)}>
                          <td>
                            <span class="expand-icon ${expanded ? 'open' : ''}">&#9654;</span>
                          </td>
                          <td>${this._formatDate(log.runAt)}</td>
                          <td>${this._renderStatusBadge(log.status)}</td>
                          <td>${log.triggeredBy}</td>
                          <td class="duration">${this._formatDuration(log.duration)}</td>
                          <td class="stat">${log.rulesProcessed}</td>
                          <td class="stat">${log.totalSent}</td>
                          <td class="stat">${log.totalSkipped}</td>
                          <td class="stat">
                            ${log.totalErrors > 0
                              ? html`<span class="alx-badge alx-badge-danger">${log.totalErrors}</span>`
                              : '0'}
                          </td>
                          <td>
                            ${log.status === 'running'
                              ? html`
                                  <button
                                    class="alx-btn-sm alx-btn-danger"
                                    @click=${(e: Event) => this._onCancelRun(log, e)}
                                  >
                                    Cancel
                                  </button>
                                `
                              : nothing}
                          </td>
                        </tr>
                        ${expanded && log.perRuleStats?.length > 0
                          ? html`
                              <tr>
                                <td colspan="10" class="sub-table">
                                  <table>
                                    <thead>
                                      <tr>
                                        <th>Rule</th>
                                        <th>Sent</th>
                                        <th>Skipped</th>
                                        <th>Errors</th>
                                      </tr>
                                    </thead>
                                    <tbody>
                                      ${log.perRuleStats.map(
                                        (stat) => html`
                                          <tr>
                                            <td>${stat.ruleName}</td>
                                            <td class="stat">${stat.sent}</td>
                                            <td class="stat">${stat.skipped}</td>
                                            <td class="stat">${stat.errors}</td>
                                          </tr>
                                        `,
                                      )}
                                    </tbody>
                                  </table>
                                </td>
                              </tr>
                            `
                          : nothing}
                      `;
                    })}
                  </tbody>
                </table>

                <div class="pagination">
                  <button
                    class="alx-btn-sm"
                    ?disabled=${this._page <= 1}
                    @click=${() => this._goToPage(this._page - 1)}
                  >
                    Prev
                  </button>
                  <span class="text-muted text-small">
                    Page ${this._page} of ${this._totalPages} (${this._total} total)
                  </span>
                  <button
                    class="alx-btn-sm"
                    ?disabled=${this._page >= this._totalPages}
                    @click=${() => this._goToPage(this._page + 1)}
                  >
                    Next
                  </button>
                </div>
              `}
      </div>
    `;
  }
}

declare global {
  interface HTMLElementTagNameMap {
    'alx-run-history': AlxRunHistory;
  }
}
