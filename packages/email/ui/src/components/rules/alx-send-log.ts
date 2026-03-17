import { LitElement, html, css, nothing } from 'lit';
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
import { RuleAPI } from '../../api/rule.api.js';

interface SendLog {
  _id: string;
  ruleId: string;
  userId: string;
  email?: string;
  status: string;
  accountId?: string;
  subject?: string;
  subjectIndex?: number;
  bodyIndex?: number;
  sentAt: string;
  failureReason?: string;
}

export class AlxSendLog extends LitElement {
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

      .variant {
        font-size: 0.8rem;
        color: var(--alx-text-muted);
        font-variant-numeric: tabular-nums;
      }
    `,
  ];

  @property({ type: String, reflect: true }) density: 'default' | 'compact' = 'default';

  @state() private _sends: SendLog[] = [];
  @state() private _loading = false;
  @state() private _error = '';
  @state() private _page = 1;
  @state() private _totalPages = 1;
  @state() private _total = 0;
  @state() private _statusFilter = '';
  @state() private _dateFrom = '';
  @state() private _dateTo = '';
  @state() private _emailSearch = '';

  private __api?: RuleAPI;
  private get _api(): RuleAPI {
    if (!this.__api) this.__api = new RuleAPI();
    return this.__api;
  }
  private readonly _limit = 50;
  private _loadGeneration = 0;

  override connectedCallback(): void {
    super.connectedCallback();
    this._loadSends();
  }

  private async _loadSends(): Promise<void> {
    const gen = ++this._loadGeneration;
    this._loading = true;
    this._error = '';
    try {
      const params: Record<string, unknown> = {
        page: this._page,
        limit: this._limit,
      };
      if (this._statusFilter) params['status'] = this._statusFilter;
      if (this._dateFrom) params['from'] = this._dateFrom;
      if (this._dateTo) params['to'] = this._dateTo;
      if (this._emailSearch) params['email'] = this._emailSearch;

      const res = (await this._api.getSendLogs(params)) as { sends: SendLog[]; total: number };
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

  private _formatDate(dateStr: string): string {
    return new Date(dateStr).toLocaleString();
  }

  private _renderStatusBadge(status?: string): unknown {
    if (!status) return nothing;
    const classMap: Record<string, string> = {
      sent: 'alx-badge alx-badge-success',
      error: 'alx-badge alx-badge-danger',
      skipped: 'alx-badge alx-badge-warning',
      invalid: 'alx-badge alx-badge-muted',
      throttled: 'alx-badge alx-badge-info',
    };
    const cls = classMap[status] ?? 'alx-badge';
    return html`<span class="${cls}">${status}</span>`;
  }

  private _renderVariant(send: SendLog): unknown {
    if (send.subjectIndex == null && send.bodyIndex == null) return nothing;
    const parts: string[] = [];
    if (send.subjectIndex != null) parts.push(`S${send.subjectIndex}`);
    if (send.bodyIndex != null) parts.push(`B${send.bodyIndex}`);
    return html`<span class="variant">#${parts.join('/')}</span>`;
  }

  override render() {
    return html`
      <div class="alx-card">
        <div class="alx-card-header">
          <h3>Send Logs</h3>
        </div>

        <div class="alx-info">
          Individual email send records. Filter by status, date range, or search by email.
        </div>

        <div class="toolbar">
          <select
            .value=${this._statusFilter}
            @change=${(e: Event) => {
              this._statusFilter = (e.target as HTMLSelectElement).value;
              this._onFilter();
            }}
          >
            <option value="">All Statuses</option>
            <option value="sent">Sent</option>
            <option value="error">Error</option>
            <option value="skipped">Skipped</option>
            <option value="invalid">Invalid</option>
            <option value="throttled">Throttled</option>
          </select>

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
            placeholder="Search by email..."
            .value=${this._emailSearch}
            @input=${(e: Event) => {
              this._emailSearch = (e.target as HTMLInputElement).value;
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
                      <th>Email</th>
                      <th>Status</th>
                      <th>Subject</th>
                      <th>Variant</th>
                      <th>Sent At</th>
                      <th>Reason</th>
                    </tr>
                  </thead>
                  <tbody>
                    ${this._sends.map(
                      (send) => html`
                        <tr>
                          <td>${send.email ?? send.userId}</td>
                          <td>${this._renderStatusBadge(send.status)}</td>
                          <td>${send.subject ?? ''}</td>
                          <td>${this._renderVariant(send)}</td>
                          <td>${this._formatDate(send.sentAt)}</td>
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
