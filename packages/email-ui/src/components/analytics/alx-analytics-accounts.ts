import { LitElement, html, css } from 'lit';
import { customElement, property, state } from 'lit/decorators.js';
import { alxBaseStyles } from '../../styles/theme.js';
import {
  alxDensityStyles,
  alxLoadingStyles,
  alxTableStyles,
  alxTypographyStyles,
} from '../../styles/shared.js';
import { AnalyticsAPI } from '../../api/analytics.api.js';

interface AccountStat {
  accountId: string;
  email: string;
  sent: number;
  delivered: number;
  bounced: number;
  failed: number;
  deliveryRate: number;
}

type SortKey = 'email' | 'sent' | 'delivered' | 'bounced' | 'failed' | 'deliveryRate';

@customElement('alx-analytics-accounts')
export class AlxAnalyticsAccounts extends LitElement {
  static override styles = [
    alxBaseStyles,
    alxDensityStyles,
    alxTableStyles,
    alxLoadingStyles,
    alxTypographyStyles,
    css`
      .header {
        display: flex;
        align-items: center;
        justify-content: space-between;
        margin-bottom: var(--alx-density-gap, 1rem);
      }

      .header h3 {
        font-size: var(--alx-density-header-size, 1.25rem);
      }

      .table-wrapper {
        background: var(--alx-surface);
        border: 1px solid var(--alx-border);
        border-radius: var(--alx-radius);
        overflow-x: auto;
      }

      th {
        cursor: pointer;
        user-select: none;
      }

      th:hover {
        color: var(--alx-primary);
      }

      .sort-indicator {
        margin-left: 0.25rem;
        font-size: 0.7rem;
      }

      .rate-good { color: var(--alx-success); }
      .rate-warn { color: var(--alx-warning); }
      .rate-bad { color: var(--alx-danger); }
    `,
  ];

  @property({ type: String, reflect: true }) density: 'default' | 'compact' = 'default';
  @property({ attribute: 'date-from' }) dateFrom = '';
  @property({ attribute: 'date-to' }) dateTo = '';

  @state() private _loading = false;
  @state() private _error = '';
  @state() private _accounts: AccountStat[] = [];
  @state() private _sortKey: SortKey = 'sent';
  @state() private _sortAsc = false;

  private __api?: AnalyticsAPI;
  private get _api(): AnalyticsAPI {
    if (!this.__api) this.__api = new AnalyticsAPI();
    return this.__api;
  }

  override connectedCallback() {
    super.connectedCallback();
    this._loadData();
  }

  override updated(changed: Map<string, unknown>) {
    if (changed.has('dateFrom') || changed.has('dateTo')) {
      if (changed.has('dateFrom') && changed.get('dateFrom') !== undefined) {
        this._loadData();
      } else if (changed.has('dateTo') && changed.get('dateTo') !== undefined) {
        this._loadData();
      }
    }
  }

  private _getDefaultRange() {
    const to = new Date();
    const from = new Date();
    from.setDate(from.getDate() - 30);
    return {
      from: this.dateFrom || from.toISOString().split('T')[0],
      to: this.dateTo || to.toISOString().split('T')[0],
    };
  }

  private async _loadData() {
    this._loading = true;
    this._error = '';
    try {
      const range = this._getDefaultRange();
      const data = await this._api.getAccountStats({ from: range.from, to: range.to }) as AccountStat[];
      this._accounts = (Array.isArray(data) ? data : []).map((a) => ({
        ...a,
        deliveryRate: a.sent > 0 ? Math.round((a.delivered / a.sent) * 1000) / 10 : 0,
      }));
    } catch (err) {
      this._error = err instanceof Error ? err.message : 'Failed to load account stats';
    } finally {
      this._loading = false;
    }
  }

  private _sort(key: SortKey) {
    if (this._sortKey === key) {
      this._sortAsc = !this._sortAsc;
    } else {
      this._sortKey = key;
      this._sortAsc = key === 'email';
    }
  }

  private get _sortedAccounts(): AccountStat[] {
    const sorted = [...this._accounts].sort((a, b) => {
      const aVal = a[this._sortKey];
      const bVal = b[this._sortKey];
      if (typeof aVal === 'string' && typeof bVal === 'string') {
        return aVal.localeCompare(bVal);
      }
      return (aVal as number) - (bVal as number);
    });
    return this._sortAsc ? sorted : sorted.reverse();
  }

  private _sortIndicator(key: SortKey) {
    if (this._sortKey !== key) return '';
    return this._sortAsc ? '\u25B2' : '\u25BC';
  }

  private _rateClass(rate: number): string {
    if (rate >= 95) return 'rate-good';
    if (rate >= 90) return 'rate-warn';
    return 'rate-bad';
  }

  override render() {
    if (this._loading) {
      return html`<div class="alx-loading"><div class="alx-spinner"></div></div>`;
    }

    if (this._error) {
      return html`<div class="alx-error">${this._error}</div>`;
    }

    if (this._accounts.length === 0) {
      return html`<div class="alx-empty">No account stats available for the selected period.</div>`;
    }

    const cols: Array<{ key: SortKey; label: string }> = [
      { key: 'email', label: 'Account' },
      { key: 'sent', label: 'Sent' },
      { key: 'delivered', label: 'Delivered' },
      { key: 'bounced', label: 'Bounced' },
      { key: 'failed', label: 'Failed' },
      { key: 'deliveryRate', label: 'Delivery Rate' },
    ];

    return html`
      <div class="header">
        <h3>Account Performance</h3>
      </div>
      <div class="table-wrapper">
        <table>
          <thead>
            <tr>
              ${cols.map(
                (c) => html`
                  <th @click=${() => this._sort(c.key)}>
                    ${c.label}
                    <span class="sort-indicator">${this._sortIndicator(c.key)}</span>
                  </th>
                `,
              )}
            </tr>
          </thead>
          <tbody>
            ${this._sortedAccounts.map(
              (a) => html`
                <tr>
                  <td>${a.email || a.accountId}</td>
                  <td>${a.sent.toLocaleString()}</td>
                  <td>${a.delivered.toLocaleString()}</td>
                  <td>${a.bounced.toLocaleString()}</td>
                  <td>${a.failed.toLocaleString()}</td>
                  <td class="${this._rateClass(a.deliveryRate)}">${a.deliveryRate}%</td>
                </tr>
              `,
            )}
          </tbody>
        </table>
      </div>
    `;
  }
}

declare global {
  interface HTMLElementTagNameMap {
    'alx-analytics-accounts': AlxAnalyticsAccounts;
  }
}
