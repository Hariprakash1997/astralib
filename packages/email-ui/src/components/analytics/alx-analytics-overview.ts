import { LitElement, html, css, nothing } from 'lit';
import { customElement, property, state } from 'lit/decorators.js';
import { alxBaseStyles } from '../../styles/theme.js';
import {
  alxDensityStyles,
  alxCardStyles,
  alxLoadingStyles,
  alxTypographyStyles,
} from '../../styles/shared.js';
import { AnalyticsAPI } from '../../api/analytics.api.js';

interface OverviewMetric {
  key: string;
  label: string;
  count: number;
  percentage: number;
  color: 'success' | 'danger' | 'info' | 'muted';
}

@customElement('alx-analytics-overview')
export class AlxAnalyticsOverview extends LitElement {
  static override styles = [
    alxBaseStyles,
    alxDensityStyles,
    alxCardStyles,
    alxLoadingStyles,
    alxTypographyStyles,
    css`
      .metrics-grid {
        display: grid;
        grid-template-columns: repeat(auto-fill, minmax(180px, 1fr));
        gap: var(--alx-density-gap, 1rem);
      }

      .metric-card {
        background: var(--alx-surface);
        border: 1px solid var(--alx-border);
        border-radius: var(--alx-radius);
        padding: var(--alx-density-gap, 1.25rem);
        display: flex;
        flex-direction: column;
        gap: 0.25rem;
      }

      .metric-card .label {
        font-size: 0.8rem;
        text-transform: uppercase;
        letter-spacing: 0.05em;
        color: var(--alx-text-muted);
      }

      .metric-card .count {
        font-size: 1.75rem;
        font-weight: 700;
        line-height: 1.2;
      }

      .metric-card .percentage {
        font-size: 0.85rem;
      }

      .color-success .count,
      .color-success .percentage {
        color: var(--alx-success);
      }

      .color-danger .count,
      .color-danger .percentage {
        color: var(--alx-danger);
      }

      .color-info .count,
      .color-info .percentage {
        color: var(--alx-info);
      }

      .color-muted .count,
      .color-muted .percentage {
        color: var(--alx-text);
      }

      .header {
        display: flex;
        align-items: center;
        justify-content: space-between;
        margin-bottom: var(--alx-density-gap, 1rem);
      }

      .header h3 {
        font-size: var(--alx-density-header-size, 1.25rem);
      }
    `,
  ];

  @property({ type: String, reflect: true }) density: 'default' | 'compact' = 'default';
  @property({ attribute: 'date-from' }) dateFrom = '';
  @property({ attribute: 'date-to' }) dateTo = '';

  @state() private _loading = false;
  @state() private _error = '';
  @state() private _metrics: OverviewMetric[] = [];

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
      const data = await this._api.getOverview({ from: range.from, to: range.to }) as Record<string, number>;
      this._buildMetrics(data);
    } catch (err) {
      this._error = err instanceof Error ? err.message : 'Failed to load analytics overview';
    } finally {
      this._loading = false;
    }
  }

  private _buildMetrics(data: Record<string, number>) {
    const sent = data['sent'] ?? 0;
    const pct = (val: number) => (sent > 0 ? Math.round((val / sent) * 1000) / 10 : 0);

    const defs: Array<{ key: string; label: string; color: OverviewMetric['color'] }> = [
      { key: 'sent', label: 'Total Sent', color: 'muted' },
      { key: 'delivered', label: 'Delivered', color: 'success' },
      { key: 'failed', label: 'Failed', color: 'danger' },
      { key: 'bounced', label: 'Bounced', color: 'danger' },
      { key: 'complained', label: 'Complained', color: 'danger' },
      { key: 'opened', label: 'Opened', color: 'info' },
      { key: 'clicked', label: 'Clicked', color: 'info' },
      { key: 'unsubscribed', label: 'Unsubscribed', color: 'danger' },
    ];

    this._metrics = defs.map((d) => ({
      ...d,
      count: data[d.key] ?? 0,
      percentage: d.key === 'sent' ? 100 : pct(data[d.key] ?? 0),
    }));
  }

  private _formatCount(n: number): string {
    if (n >= 1_000_000) return (n / 1_000_000).toFixed(1) + 'M';
    if (n >= 1_000) return (n / 1_000).toFixed(1) + 'K';
    return String(n);
  }

  override render() {
    if (this._loading) {
      return html`<div class="alx-loading"><div class="alx-spinner"></div></div>`;
    }

    if (this._error) {
      return html`<div class="alx-error">${this._error}</div>`;
    }

    if (this._metrics.length === 0) {
      return html`<div class="alx-empty">No analytics data available for the selected period.</div>`;
    }

    return html`
      <div class="header">
        <h3>Analytics Overview</h3>
      </div>
      <div class="metrics-grid">
        ${this._metrics.map(
          (m) => html`
            <div class="metric-card color-${m.color}">
              <span class="label">${m.label}</span>
              <span class="count">${this._formatCount(m.count)}</span>
              <span class="percentage">${m.percentage}%</span>
            </div>
          `,
        )}
      </div>
    `;
  }
}

declare global {
  interface HTMLElementTagNameMap {
    'alx-analytics-overview': AlxAnalyticsOverview;
  }
}
