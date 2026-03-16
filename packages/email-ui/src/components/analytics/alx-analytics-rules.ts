import { LitElement, html, css } from 'lit';
import { property, state } from 'lit/decorators.js';
import { safeRegister } from '../../utils/safe-register.js';
import { alxBaseStyles } from '../../styles/theme.js';
import {
  alxDensityStyles,
  alxLoadingStyles,
  alxTableStyles,
  alxTypographyStyles,
} from '../../styles/shared.js';
import { AnalyticsAPI } from '../../api/analytics.api.js';

interface RuleStat {
  ruleId: string;
  name: string;
  sent: number;
  delivered: number;
  bounced: number;
  failed: number;
  skipped: number;
  errorRate: number;
}

type SortKey = 'name' | 'sent' | 'delivered' | 'bounced' | 'failed' | 'skipped' | 'errorRate';

export class AlxAnalyticsRules extends LitElement {
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

      .error-rate-high {
        color: var(--alx-danger);
        font-weight: 600;
      }

      .error-rate-low {
        color: var(--alx-success);
      }
    `,
  ];

  @property({ type: String, reflect: true }) density: 'default' | 'compact' = 'default';
  @property({ attribute: 'date-from' }) dateFrom = '';
  @property({ attribute: 'date-to' }) dateTo = '';

  @state() private _loading = false;
  @state() private _error = '';
  @state() private _rules: RuleStat[] = [];
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
      const data = await this._api.getRuleStats({ from: range.from, to: range.to }) as RuleStat[];
      this._rules = (Array.isArray(data) ? data : []).map((r) => ({
        ...r,
        errorRate: r.sent > 0
          ? Math.round(((r.bounced + r.failed) / r.sent) * 1000) / 10
          : 0,
      }));
    } catch (err) {
      this._error = err instanceof Error ? err.message : 'Failed to load rule stats';
    } finally {
      this._loading = false;
    }
  }

  private _sort(key: SortKey) {
    if (this._sortKey === key) {
      this._sortAsc = !this._sortAsc;
    } else {
      this._sortKey = key;
      this._sortAsc = key === 'name';
    }
  }

  private get _sortedRules(): RuleStat[] {
    const sorted = [...this._rules].sort((a, b) => {
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

  override render() {
    if (this._loading) {
      return html`<div class="alx-loading"><div class="alx-spinner"></div></div>`;
    }

    if (this._error) {
      return html`<div class="alx-error">${this._error}</div>`;
    }

    if (this._rules.length === 0) {
      return html`<div class="alx-empty">No rule stats available for the selected period.</div>`;
    }

    const cols: Array<{ key: SortKey; label: string }> = [
      { key: 'name', label: 'Rule' },
      { key: 'sent', label: 'Sent' },
      { key: 'delivered', label: 'Delivered' },
      { key: 'bounced', label: 'Bounced' },
      { key: 'failed', label: 'Failed' },
      { key: 'skipped', label: 'Skipped' },
      { key: 'errorRate', label: 'Error Rate' },
    ];

    return html`
      <div class="header">
        <h3>Rule Performance</h3>
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
            ${this._sortedRules.map(
              (r) => html`
                <tr>
                  <td>${r.name || r.ruleId}</td>
                  <td>${r.sent.toLocaleString()}</td>
                  <td>${r.delivered.toLocaleString()}</td>
                  <td>${r.bounced.toLocaleString()}</td>
                  <td>${r.failed.toLocaleString()}</td>
                  <td>${r.skipped.toLocaleString()}</td>
                  <td class="${r.errorRate > 5 ? 'error-rate-high' : 'error-rate-low'}">
                    ${r.errorRate}%
                  </td>
                </tr>
              `,
            )}
          </tbody>
        </table>
      </div>
    `;
  }
}
safeRegister('alx-analytics-rules', AlxAnalyticsRules);

declare global {
  interface HTMLElementTagNameMap {
    'alx-analytics-rules': AlxAnalyticsRules;
  }
}
