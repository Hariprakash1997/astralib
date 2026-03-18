import { LitElement, html, css, nothing } from 'lit';
import { state, property } from 'lit/decorators.js';
import { safeRegister } from '../../utils/safe-register.js';
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
  alxToolbarStyles,
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
    alxToolbarStyles,
    css`
      .toolbar input[type='date'] {
        width: auto;
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

      .run-progress {
        padding: 0.5rem 0.625rem;
        background: color-mix(in srgb, var(--alx-primary) 6%, transparent);
        border: 1px solid color-mix(in srgb, var(--alx-primary) 20%, transparent);
        border-radius: var(--alx-radius);
        margin-bottom: 0.5rem;
      }

      .run-progress-header {
        display: flex;
        justify-content: space-between;
        align-items: center;
        margin-bottom: 0.3rem;
        font-size: 0.75rem;
      }

      .run-progress-status {
        font-weight: 600;
        color: var(--alx-primary);
      }

      .run-progress-stats {
        color: var(--alx-text-muted);
      }

      .run-progress-bar {
        height: 4px;
        background: color-mix(in srgb, var(--alx-primary) 15%, transparent);
        border-radius: 2px;
        overflow: hidden;
      }

      .run-progress-fill {
        height: 100%;
        background: var(--alx-primary);
        border-radius: 2px;
        transition: width 0.3s ease;
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
  @state() private _triggering = false;
  @state() private _cancelling = '';
  @state() private _activeRunId = '';
  @state() private _activeRunProgress: { matched?: number; sent?: number; skipped?: number; errors?: number; status?: string } | null = null;
  private _pollTimer?: ReturnType<typeof setTimeout>;

  private __api?: RuleAPI;
  private get _api(): RuleAPI {
    if (!this.__api) this.__api = new RuleAPI();
    return this.__api;
  }
  private readonly _limit = 20;
  private _loadGeneration = 0;
  private _reloadTimer?: ReturnType<typeof setTimeout>;

  override connectedCallback(): void {
    super.connectedCallback();
    this._loadLogs();
  }

  override disconnectedCallback(): void {
    super.disconnectedCallback();
    if (this._pollTimer) clearTimeout(this._pollTimer);
    if (this._reloadTimer) clearTimeout(this._reloadTimer);
  }

  private _startPolling(runId: string): void {
    this._activeRunId = runId;
    this._activeRunProgress = { status: 'starting' };
    this._pollRunStatus();
  }

  private async _pollRunStatus(): Promise<void> {
    if (!this._activeRunId) return;
    try {
      const res = await this._api.getRunStatus(this._activeRunId);
      const data = res?.data ?? res;
      const progress = data.progress ?? data;
      this._activeRunProgress = {
        matched: progress.matched ?? progress.rulesTotal ?? 0,
        sent: progress.sent ?? 0,
        skipped: progress.skipped ?? 0,
        errors: progress.errors ?? 0,
        status: data.status ?? 'running',
      };
      if (data.status === 'completed' || data.status === 'failed' || data.status === 'cancelled') {
        this._activeRunId = '';
        this._loadLogs();
        return;
      }
      this._pollTimer = setTimeout(() => this._pollRunStatus(), 2000);
    } catch {
      this._activeRunId = '';
      this._activeRunProgress = null;
    }
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
      if (this._page > this._totalPages) {
        this._page = this._totalPages;
      }
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
    if (!confirm('Trigger a run now? This will process all active rules.')) return;
    this._triggering = true;
    this._successMsg = '';
    this._error = '';
    try {
      const res = (await this._api.triggerRun()) as Record<string, unknown>;
      const data = (res as any)?.data ?? res;
      const runId = String(data['runId'] ?? data['_id'] ?? '');
      if (runId && runId !== 'undefined') {
        this._successMsg = '';
        this._startPolling(runId);
      } else {
        this._showSuccess('Run triggered');
        setTimeout(() => this._loadLogs(), 2000);
      }
    } catch (err) {
      this._error = err instanceof Error ? err.message : 'Failed to trigger run';
    } finally {
      this._triggering = false;
    }
  }

  private _showSuccess(msg: string): void {
    this._successMsg = msg;
    if (this._reloadTimer) clearTimeout(this._reloadTimer);
    this._reloadTimer = setTimeout(() => { this._successMsg = ''; }, 3000);
  }

  private async _onCancelRun(log: RunLog, e: Event): Promise<void> {
    e.stopPropagation();
    if (!confirm('Cancel this run?')) return;
    const runId = log.runId ?? log._id;
    this._cancelling = runId;
    this._error = '';
    try {
      await this._api.cancelRun(runId);
      this._showSuccess('Run cancelled');
      await this._loadLogs();
    } catch (err) {
      this._error = err instanceof Error ? err.message : 'Failed to cancel run';
    } finally {
      this._cancelling = '';
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
          <button class="alx-btn-sm" ?disabled=${this._triggering} @click=${this._onRunNow}>
            ${this._triggering ? 'Running...' : 'Run Now'}
          </button>
        </div>

        ${this._error ? html`<div class="alx-error">${this._error}</div>` : nothing}
        ${this._successMsg
          ? html`<div class="alx-success-msg">${this._successMsg}</div>`
          : nothing}

        ${this._activeRunProgress ? html`
          <div class="run-progress">
            <div class="run-progress-header">
              <span class="run-progress-status">${this._activeRunProgress.status === 'starting' ? 'Starting...' : 'Running...'}</span>
              ${this._activeRunProgress.status !== 'starting' ? html`
                <span class="run-progress-stats">
                  ${this._activeRunProgress.sent ?? 0} sent,
                  ${this._activeRunProgress.skipped ?? 0} skipped,
                  ${this._activeRunProgress.errors ?? 0} errors
                  ${this._activeRunProgress.matched ? html` / ${this._activeRunProgress.matched} matched` : nothing}
                </span>
              ` : nothing}
            </div>
            ${this._activeRunProgress.matched && this._activeRunProgress.matched > 0 ? html`
              <div class="run-progress-bar">
                <div class="run-progress-fill" style="width:${Math.min(100, Math.round(((this._activeRunProgress.sent ?? 0) + (this._activeRunProgress.skipped ?? 0) + (this._activeRunProgress.errors ?? 0)) / this._activeRunProgress.matched * 100))}%"></div>
              </div>
            ` : nothing}
          </div>
        ` : nothing}

        ${this._loading
          ? html`<div class="alx-loading"><div class="alx-spinner"></div></div>`
          : this._logs.length === 0
            ? html`<div class="alx-empty">
  <p>Runs appear here when rules are executed.</p>
  <p>Set up accounts, templates, and rules first — then trigger a run.</p>
</div>`
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
                                    ?disabled=${this._cancelling === (log.runId ?? log._id)}
                                    @click=${(e: Event) => this._onCancelRun(log, e)}
                                  >
                                    ${this._cancelling === (log.runId ?? log._id) ? 'Cancelling...' : 'Cancel'}
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
safeRegister('alx-run-history', AlxRunHistory);

declare global {
  interface HTMLElementTagNameMap {
    'alx-run-history': AlxRunHistory;
  }
}
