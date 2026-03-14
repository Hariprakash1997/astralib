import { LitElement, html, css } from 'lit';
import { customElement, property, state } from 'lit/decorators.js';
import { alxBaseStyles } from '../../styles/theme.js';
import {
  alxCardStyles,
  alxLoadingStyles,
  alxTypographyStyles,
} from '../../styles/shared.js';
import { AnalyticsAPI } from '../../api/analytics.api.js';

interface EngagementData {
  sent: number;
  opened: number;
  clicked: number;
  unsubscribed: number;
}

@customElement('alx-analytics-engagement')
export class AlxAnalyticsEngagement extends LitElement {
  static override styles = [
    alxBaseStyles,
    alxCardStyles,
    alxLoadingStyles,
    alxTypographyStyles,
    css`
      .header {
        display: flex;
        align-items: center;
        justify-content: space-between;
        margin-bottom: 1rem;
      }

      .metrics-grid {
        display: grid;
        grid-template-columns: repeat(auto-fill, minmax(200px, 1fr));
        gap: 1rem;
      }

      .metric-card {
        background: var(--alx-surface);
        border: 1px solid var(--alx-border);
        border-radius: var(--alx-radius);
        padding: 1.25rem;
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

      .metric-card .rate {
        font-size: 2rem;
        font-weight: 700;
        line-height: 1.2;
        color: var(--alx-info);
      }

      .metric-card .detail {
        font-size: 0.8rem;
        color: var(--alx-text-muted);
      }

      .rate-unsub {
        color: var(--alx-warning) !important;
      }

      .info-banner {
        display: flex;
        align-items: flex-start;
        gap: 0.5rem;
        padding: 0.75rem 1rem;
        background: color-mix(in srgb, var(--alx-info) 10%, transparent);
        border: 1px solid color-mix(in srgb, var(--alx-info) 30%, transparent);
        border-radius: var(--alx-radius);
        color: var(--alx-info);
        font-size: 0.85rem;
        margin-bottom: 1rem;
      }

      .info-icon {
        font-weight: 700;
        flex-shrink: 0;
      }
    `,
  ];

  @property({ attribute: 'date-from' }) dateFrom = '';
  @property({ attribute: 'date-to' }) dateTo = '';

  @state() private _loading = false;
  @state() private _error = '';
  @state() private _data: EngagementData | null = null;
  @state() private _showSesNote = false;

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
      const data = await this._api.getOverview({ from: range.from, to: range.to }) as EngagementData;
      this._data = data;
      this._showSesNote = (data.opened ?? 0) === 0 && (data.clicked ?? 0) === 0 && (data.sent ?? 0) > 0;
    } catch (err) {
      this._error = err instanceof Error ? err.message : 'Failed to load engagement data';
    } finally {
      this._loading = false;
    }
  }

  private _pct(numerator: number, denominator: number): string {
    if (denominator === 0) return '0.0';
    return (Math.round((numerator / denominator) * 1000) / 10).toFixed(1);
  }

  override render() {
    if (this._loading) {
      return html`<div class="alx-loading"><div class="alx-spinner"></div></div>`;
    }

    if (this._error) {
      return html`<div class="alx-error">${this._error}</div>`;
    }

    if (!this._data) {
      return html`<div class="alx-empty">No engagement data available for the selected period.</div>`;
    }

    const d = this._data;
    const sent = d.sent ?? 0;
    const opened = d.opened ?? 0;
    const clicked = d.clicked ?? 0;
    const unsubscribed = d.unsubscribed ?? 0;

    const openRate = this._pct(opened, sent);
    const clickRate = this._pct(clicked, sent);
    const unsubRate = this._pct(unsubscribed, sent);

    return html`
      <div class="header">
        <h3>Engagement Metrics</h3>
      </div>

      ${this._showSesNote
        ? html`
            <div class="info-banner">
              <span class="info-icon">i</span>
              <span>
                Open and click tracking data is only available for SES accounts with tracking enabled.
                Gmail/SMTP accounts do not report engagement metrics.
              </span>
            </div>
          `
        : ''}

      <div class="metrics-grid">
        <div class="metric-card">
          <span class="label">Open Rate</span>
          <span class="rate">${openRate}%</span>
          <span class="detail">${opened.toLocaleString()} of ${sent.toLocaleString()} sent</span>
        </div>

        <div class="metric-card">
          <span class="label">Click Rate</span>
          <span class="rate">${clickRate}%</span>
          <span class="detail">${clicked.toLocaleString()} of ${sent.toLocaleString()} sent</span>
        </div>

        <div class="metric-card">
          <span class="label">Unsubscribe Rate</span>
          <span class="rate rate-unsub">${unsubRate}%</span>
          <span class="detail">${unsubscribed.toLocaleString()} of ${sent.toLocaleString()} sent</span>
        </div>
      </div>
    `;
  }
}

declare global {
  interface HTMLElementTagNameMap {
    'alx-analytics-engagement': AlxAnalyticsEngagement;
  }
}
