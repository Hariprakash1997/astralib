import { LitElement, html, css } from 'lit';
import { property, state } from 'lit/decorators.js';
import { safeRegister } from '../../utils/safe-register.js';
import { alxBaseStyles } from '../../styles/theme.js';
import { alxDensityStyles, alxLoadingStyles, alxTypographyStyles } from '../../styles/shared.js';
import { AnalyticsAPI } from '../../api/analytics.api.js';

interface TimelineEntry {
  date: string;
  count: number;
}

export class AlxAnalyticsTimeline extends LitElement {
  static override styles = [
    alxBaseStyles,
    alxDensityStyles,
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

      .chart-container {
        background: var(--alx-surface);
        border: 1px solid var(--alx-border);
        border-radius: var(--alx-radius);
        padding: var(--alx-density-gap, 1.25rem);
      }

      .chart {
        display: flex;
        align-items: flex-end;
        gap: 2px;
        height: 200px;
        padding-top: 1rem;
      }

      .bar-wrapper {
        flex: 1;
        display: flex;
        flex-direction: column;
        align-items: center;
        height: 100%;
        justify-content: flex-end;
        position: relative;
        min-width: 0;
      }

      .bar {
        width: 100%;
        max-width: 40px;
        background: var(--alx-info);
        border-radius: 2px 2px 0 0;
        min-height: 2px;
        transition: background 0.15s;
        position: relative;
        cursor: pointer;
      }

      .bar:hover {
        background: var(--alx-primary);
      }

      .tooltip {
        display: none;
        position: absolute;
        bottom: calc(100% + 6px);
        left: 50%;
        transform: translateX(-50%);
        background: var(--alx-bg);
        border: 1px solid var(--alx-border);
        border-radius: var(--alx-radius);
        padding: 0.35rem 0.5rem;
        font-size: 0.75rem;
        white-space: nowrap;
        color: var(--alx-text);
        z-index: 10;
        pointer-events: none;
      }

      .bar:hover .tooltip {
        display: block;
      }

      .x-axis {
        display: flex;
        gap: 2px;
        margin-top: 0.5rem;
        overflow: hidden;
      }

      .x-axis .x-label {
        flex: 1;
        text-align: center;
        font-size: 0.65rem;
        color: var(--alx-text-muted);
        min-width: 0;
        overflow: hidden;
        text-overflow: ellipsis;
        white-space: nowrap;
      }

      .y-axis-label {
        font-size: 0.75rem;
        color: var(--alx-text-muted);
        margin-bottom: 0.25rem;
      }
    `,
  ];

  @property({ type: String, reflect: true }) density: 'default' | 'compact' = 'default';
  @property({ attribute: 'date-from' }) dateFrom = '';
  @property({ attribute: 'date-to' }) dateTo = '';
  @property() interval: 'daily' | 'weekly' | 'monthly' = 'daily';

  @state() private _loading = false;
  @state() private _error = '';
  @state() private _entries: TimelineEntry[] = [];

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
    const watchKeys = ['dateFrom', 'dateTo', 'interval'];
    for (const key of watchKeys) {
      if (changed.has(key) && changed.get(key) !== undefined) {
        this._loadData();
        return;
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
      const data = await this._api.getTimeline({
        from: range.from,
        to: range.to,
        interval: this.interval,
      }) as TimelineEntry[];
      this._entries = Array.isArray(data) ? data : [];
    } catch (err) {
      this._error = err instanceof Error ? err.message : 'Failed to load timeline data';
    } finally {
      this._loading = false;
    }
  }

  private _formatDate(dateStr: string): string {
    try {
      const d = new Date(dateStr);
      return d.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
    } catch {
      return dateStr;
    }
  }

  override render() {
    if (this._loading) {
      return html`<div class="alx-loading"><div class="alx-spinner"></div></div>`;
    }

    if (this._error) {
      return html`<div class="alx-error">${this._error}</div>`;
    }

    if (this._entries.length === 0) {
      return html`<div class="alx-empty">No timeline data available for the selected period.</div>`;
    }

    const maxValue = Math.max(...this._entries.map((e) => e.count), 1);
    const showEveryNth = this._entries.length > 15 ? Math.ceil(this._entries.length / 15) : 1;

    return html`
      <div class="header">
        <h3>Send Volume</h3>
      </div>
      <div class="chart-container">
        <div class="y-axis-label">Max: ${maxValue.toLocaleString()}</div>
        <div class="chart">
          ${this._entries.map(
            (entry) => html`
              <div class="bar-wrapper">
                <div
                  class="bar"
                  style="height: ${(entry.count / maxValue) * 100}%"
                >
                  <span class="tooltip">${this._formatDate(entry.date)}: ${entry.count.toLocaleString()}</span>
                </div>
              </div>
            `,
          )}
        </div>
        <div class="x-axis">
          ${this._entries.map(
            (entry, i) => html`
              <span class="x-label">
                ${i % showEveryNth === 0 ? this._formatDate(entry.date) : ''}
              </span>
            `,
          )}
        </div>
      </div>
    `;
  }
}
safeRegister('alx-analytics-timeline', AlxAnalyticsTimeline);

declare global {
  interface HTMLElementTagNameMap {
    'alx-analytics-timeline': AlxAnalyticsTimeline;
  }
}
