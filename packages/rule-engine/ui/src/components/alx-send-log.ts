import { LitElement, html, css, nothing } from 'lit';
import { state, property } from 'lit/decorators.js';
import { safeRegister } from '../utils/safe-register.js';
import { formatDate, defaultDateFrom, defaultDateTo } from '../utils/format.js';
import { alxBaseStyles } from '../styles/theme.js';
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
} from '../styles/shared.js';
import { RuleEngineAPI } from '../api/rule-engine.api.js';


const SEND_STATUS = ['sent', 'skipped', 'throttled', 'failed', 'error', 'invalid'] as const;

interface SendLog {
  _id: string;
  ruleId?: string;
  userId: string;
  contactValue?: string;
  status: string;
  sentAt: string;
  failureReason?: string;
}

function statusTooltip(status: string): string {
  switch (status) {
    case 'sent': return 'Message delivered successfully';
    case 'error': return 'Message failed to deliver';
    case 'failed': return 'Message delivery failed';
    case 'skipped': return 'Recipient already received this message or had invalid data';
    case 'throttled': return 'Recipient hit daily/weekly send limits';
    case 'invalid': return 'Recipient data was invalid or incomplete';
    default: return status;
  }
}

function renderStatusBadge(status?: string) {
  if (!status) return nothing;
  const map: Record<string, string> = {
    sent: 'alx-badge-success',
    error: 'alx-badge-danger',
    failed: 'alx-badge-danger',
    skipped: 'alx-badge-default',
    invalid: 'alx-badge-warning',
    throttled: 'alx-badge-warning',
  };
  const cls = map[status] ?? 'alx-badge-default';
  return html`<span class="alx-badge ${cls}" title="${statusTooltip(status)}">${status}</span>`;
}

export class AlxSendLog extends LitElement {
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

      .reason {
        color: var(--alx-danger);
        font-size: 0.8rem;
        max-width: 200px;
        overflow: hidden;
        text-overflow: ellipsis;
        white-space: nowrap;
      }
    `,
  ];

  @property() baseUrl = '';
  @property({ attribute: false }) api?: RuleEngineAPI;
  @property({ type: String, reflect: true }) density: 'default' | 'compact' = 'default';

  @state() private _sends: SendLog[] = [];
  @state() private _loading = false;
  @state() private _error = '';
  @state() private _page = 1;
  @state() private _totalPages = 1;
  @state() private _total = 0;
  @state() private _filterStatus = '';
  @state() private _filterRuleId = '';
  @state() private _dateFrom = defaultDateFrom();
  @state() private _dateTo = defaultDateTo();
  @state() private _contactSearch = '';

  private _apiInstance?: RuleEngineAPI;
  private readonly _limit = 50;
  private _loadGeneration = 0;

  private get _api(): RuleEngineAPI {
    if (this.api) return this.api;
    if (!this._apiInstance && this.baseUrl) {
      this._apiInstance = RuleEngineAPI.create(this.baseUrl);
    }
    return this._apiInstance!;
  }

  override connectedCallback(): void {
    super.connectedCallback();
    if (!this.api && this.baseUrl && !this._apiInstance) {
      this._apiInstance = RuleEngineAPI.create(this.baseUrl);
    }
    this._loadSends();
  }

  async load(): Promise<void> {
    return this._loadSends();
  }

  private async _loadSends(): Promise<void> {
    if (!this._api) return;
    const gen = ++this._loadGeneration;
    this._loading = true;
    this._error = '';
    try {
      const params: Record<string, unknown> = {
        page: this._page,
        limit: this._limit,
      };
      if (this._filterStatus) params['status'] = this._filterStatus;
      if (this._filterRuleId) params['ruleId'] = this._filterRuleId;
      if (this._dateFrom) params['from'] = this._dateFrom;
      if (this._dateTo) params['to'] = this._dateTo;
      if (this._contactSearch) params['contact'] = this._contactSearch;

      const res = (await this._api.listSendLogs(params)) as { sends: SendLog[]; total: number };
      if (gen !== this._loadGeneration) return;
      this._sends = res.sends ?? [];
      this._total = res.total ?? res.sends?.length ?? 0;
      this._totalPages = Math.max(1, Math.ceil(this._total / this._limit));
      if (this._page > this._totalPages) {
        this._page = this._totalPages;
      }
    } catch (err) {
      if (gen !== this._loadGeneration) return;
      this._error = err instanceof Error ? err.message : 'Failed to load send logs';
    } finally {
      if (gen === this._loadGeneration) this._loading = false;
    }
  }

  private _onFilter(): void {
    this._page = 1;
    this._loadSends();
  }

  private _goToPage(page: number): void {
    this._page = page;
    this._loadSends();
  }

  override render() {
    return html`
      <div class="alx-card">
        <div class="alx-card-header">
          <h3>Send Logs</h3>
        </div>

        <div class="alx-info">
          Individual send records. Filter by rule, status, date range, or search by contact.
        </div>

        <div class="toolbar">
          <select
            .value=${this._filterStatus}
            @change=${(e: Event) => {
              this._filterStatus = (e.target as HTMLSelectElement).value;
              this._onFilter();
            }}
          >
            <option value="">All Statuses</option>
            ${SEND_STATUS.map((s) => html`<option value=${s}>${s.charAt(0).toUpperCase() + s.slice(1)}</option>`)}
          </select>

          <input
            type="text"
            placeholder="Rule name or ID..."
            .value=${this._filterRuleId}
            @input=${(e: Event) => {
              this._filterRuleId = (e.target as HTMLInputElement).value;
            }}
            @keydown=${(e: KeyboardEvent) => {
              if (e.key === 'Enter') this._onFilter();
            }}
          />

          <label style="margin-bottom:0">From</label>
          <input
            type="date"
            .value=${this._dateFrom}
            @change=${(e: Event) => {
              this._dateFrom = (e.target as HTMLInputElement).value;
              this._onFilter();
            }}
          />
          <label style="margin-bottom:0">To</label>
          <input
            type="date"
            .value=${this._dateTo}
            @change=${(e: Event) => {
              this._dateTo = (e.target as HTMLInputElement).value;
              this._onFilter();
            }}
          />

          <input
            type="text"
            placeholder="Search by contact..."
            .value=${this._contactSearch}
            @input=${(e: Event) => {
              this._contactSearch = (e.target as HTMLInputElement).value;
            }}
            @keydown=${(e: KeyboardEvent) => {
              if (e.key === 'Enter') this._onFilter();
            }}
          />
          <button class="alx-btn-sm" @click=${this._onFilter}>Search</button>
        </div>

        ${this._error ? html`<div class="alx-error">${this._error}</div>` : nothing}

        ${this._loading
          ? html`<div class="alx-loading"><div class="alx-spinner"></div></div>`
          : this._sends.length === 0
            ? html`<div class="alx-empty">
                <p>No send logs found. Logs appear after rules are executed.</p>
              </div>`
            : html`
                <table>
                  <thead>
                    <tr>
                      <th>Contact</th>
                      <th>Status</th>
                      <th>Rule</th>
                      <th>Sent At</th>
                      <th>Reason</th>
                    </tr>
                  </thead>
                  <tbody>
                    ${this._sends.map(
                      (send) => html`
                        <tr>
                          <td>${send.contactValue ?? send.userId}</td>
                          <td>${renderStatusBadge(send.status)}</td>
                          <td class="text-muted text-small" title="${send.ruleId ?? ''}">${send.ruleId ? send.ruleId.slice(0, 8) + '...' : '--'}</td>
                          <td>${formatDate(send.sentAt)}</td>
                          <td>
                            ${send.failureReason
                              ? html`<span class="reason" title="${send.failureReason}">${send.failureReason}</span>`
                              : nothing}
                          </td>
                        </tr>
                      `,
                    )}
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
safeRegister('alx-send-log', AlxSendLog);

declare global {
  interface HTMLElementTagNameMap {
    'alx-send-log': AlxSendLog;
  }
}
