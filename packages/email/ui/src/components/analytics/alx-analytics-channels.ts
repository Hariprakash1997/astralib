import { LitElement, html, css, nothing } from 'lit';
import { state, property } from 'lit/decorators.js';
import { safeRegister } from '../../utils/safe-register.js';
import { alxBaseStyles } from '../../styles/theme.js';
import {
  alxDensityStyles,
  alxButtonStyles,
  alxInputStyles,
  alxCardStyles,
  alxLoadingStyles,
  alxToolbarStyles,
  alxBadgeStyles,
} from '../../styles/shared.js';
import { AnalyticsAPI } from '../../api/analytics.api.js';

interface ChannelStat {
  channel: string;
  count: number;
  sent: number;
  opened: number;
  clicked: number;
  bounced: number;
  unsubscribed: number;
}

const CHANNEL_COLORS: Record<string, string> = {
  email: '#2563eb',
  whatsapp: '#25d366',
  telegram: '#0088cc',
  sms: '#8b5cf6',
  web: '#f59e0b',
  form: '#10b981',
  phone: '#ef4444',
  other: '#64748b',
};

const CHANNEL_LABELS: Record<string, string> = {
  email: 'Email',
  whatsapp: 'WhatsApp',
  telegram: 'Telegram',
  sms: 'SMS',
  web: 'Web',
  form: 'Form',
  phone: 'Phone',
  other: 'Other',
};

export class AlxAnalyticsChannels extends LitElement {
  static override styles = [
    alxBaseStyles,
    alxDensityStyles,
    alxButtonStyles,
    alxInputStyles,
    alxCardStyles,
    alxLoadingStyles,
    alxToolbarStyles,
    alxBadgeStyles,
    css`
      .info-banner {
        font-size: 0.75rem;
        color: var(--alx-text-muted);
        padding: 0.375rem 0.625rem;
        background: color-mix(in srgb, var(--alx-info) 6%, transparent);
        border-radius: var(--alx-radius);
        margin-bottom: 0.75rem;
        line-height: 1.5;
      }

      .channels-grid {
        display: grid;
        grid-template-columns: repeat(auto-fill, minmax(200px, 1fr));
        gap: 0.5rem;
        margin-bottom: 0.75rem;
      }

      .channel-card {
        border: 1px solid var(--alx-border);
        border-radius: var(--alx-radius);
        padding: 0.625rem;
        background: var(--alx-surface);
        display: flex;
        flex-direction: column;
        gap: 0.375rem;
      }

      .channel-header {
        display: flex;
        align-items: center;
        gap: 0.375rem;
      }

      .channel-dot {
        width: 8px;
        height: 8px;
        border-radius: 50%;
        flex-shrink: 0;
      }

      .channel-name {
        font-weight: 600;
        font-size: 0.8rem;
        color: var(--alx-text);
      }

      .channel-count {
        font-size: 1.25rem;
        font-weight: 700;
        font-variant-numeric: tabular-nums;
        color: var(--alx-text);
        line-height: 1.2;
      }

      .channel-metrics {
        display: flex;
        gap: 0.5rem;
        flex-wrap: wrap;
      }

      .channel-metric {
        font-size: 0.65rem;
        color: var(--alx-text-muted);
      }

      .channel-metric strong {
        color: var(--alx-text);
        font-weight: 600;
      }

      .bar-container {
        margin-top: 0.75rem;
      }

      .bar-row {
        display: flex;
        align-items: center;
        gap: 0.5rem;
        margin-bottom: 0.375rem;
      }

      .bar-label {
        min-width: 70px;
        font-size: 0.75rem;
        font-weight: 500;
        color: var(--alx-text);
        text-align: right;
      }

      .bar-track {
        flex: 1;
        height: 16px;
        background: color-mix(in srgb, var(--alx-border) 50%, transparent);
        border-radius: 3px;
        overflow: hidden;
      }

      .bar-fill {
        height: 100%;
        border-radius: 3px;
        transition: width 0.3s ease;
        min-width: 2px;
      }

      .bar-value {
        min-width: 40px;
        font-size: 0.75rem;
        font-variant-numeric: tabular-nums;
        color: var(--alx-text-muted);
      }

      .toolbar input[type='date'] {
        width: auto;
      }
    `,
  ];

  @property({ type: String, reflect: true }) density: 'default' | 'compact' = 'default';
  @property({ attribute: 'date-from' }) dateFrom = '';
  @property({ attribute: 'date-to' }) dateTo = '';
  @property({ attribute: 'event-type' }) eventType = 'clicked';

  @state() private _channels: ChannelStat[] = [];
  @state() private _loading = false;
  @state() private _error = '';

  private __api?: AnalyticsAPI;
  private get _api(): AnalyticsAPI {
    if (!this.__api) this.__api = new AnalyticsAPI();
    return this.__api;
  }

  override connectedCallback(): void {
    super.connectedCallback();
    this._load();
  }

  override updated(changed: Map<string, unknown>): void {
    if (changed.has('dateFrom') || changed.has('dateTo') || changed.has('eventType')) {
      this._load();
    }
  }

  private async _load(): Promise<void> {
    this._loading = true;
    this._error = '';
    try {
      const params: Record<string, unknown> = {};
      if (this.dateFrom) params['dateFrom'] = this.dateFrom;
      if (this.dateTo) params['dateTo'] = this.dateTo;
      if (this.eventType) params['type'] = this.eventType;
      const res = (await this._api.getChannelStats(params)) as { channels?: ChannelStat[]; total?: number };
      this._channels = res.channels ?? (Array.isArray(res) ? res : []);
    } catch (err) {
      this._error = err instanceof Error ? err.message : 'Failed to load channel stats';
    } finally {
      this._loading = false;
    }
  }

  private _getColor(channel: string): string {
    return CHANNEL_COLORS[channel] ?? CHANNEL_COLORS['other'];
  }

  private _getLabel(channel: string): string {
    return CHANNEL_LABELS[channel] ?? channel;
  }

  private _maxCount(): number {
    return Math.max(1, ...this._channels.map(c => c.count || c.sent || 0));
  }

  override render() {
    return html`
      <div class="alx-card">
        <div class="alx-card-header">
          <h3>Channel Breakdown</h3>
        </div>

        <div class="info-banner">Shows which CTAs and channels drive the most engagement. Data populates when events include a channel attribute.</div>

        ${this._error ? html`<div class="alx-error">${this._error}</div>` : nothing}

        ${this._loading
          ? html`<div class="alx-loading"><div class="alx-spinner"></div></div>`
          : this._channels.length === 0
            ? html`<div class="alx-empty">
                <p>No channel data available yet.</p>
                <p>Events recorded via the tracking endpoint with a channel attribute will appear here.</p>
              </div>`
            : html`
                <div class="channels-grid">
                  ${this._channels.map(ch => html`
                    <div class="channel-card">
                      <div class="channel-header">
                        <span class="channel-dot" style="background:${this._getColor(ch.channel)}"></span>
                        <span class="channel-name">${this._getLabel(ch.channel)}</span>
                      </div>
                      <div class="channel-count">${(ch.count || ch.sent || 0).toLocaleString()}</div>
                      <div class="channel-metrics">
                        ${ch.opened != null ? html`<span class="channel-metric"><strong>${ch.opened}</strong> opened</span>` : nothing}
                        ${ch.clicked != null ? html`<span class="channel-metric"><strong>${ch.clicked}</strong> clicked</span>` : nothing}
                        ${ch.bounced != null && ch.bounced > 0 ? html`<span class="channel-metric"><strong>${ch.bounced}</strong> bounced</span>` : nothing}
                      </div>
                    </div>
                  `)}
                </div>

                <div class="bar-container">
                  ${this._channels.map(ch => {
                    const val = ch.count || ch.sent || 0;
                    const pct = (val / this._maxCount()) * 100;
                    return html`
                      <div class="bar-row">
                        <span class="bar-label">${this._getLabel(ch.channel)}</span>
                        <div class="bar-track">
                          <div class="bar-fill" style="width:${pct}%;background:${this._getColor(ch.channel)}"></div>
                        </div>
                        <span class="bar-value">${val.toLocaleString()}</span>
                      </div>
                    `;
                  })}
                </div>
              `}
      </div>
    `;
  }
}
safeRegister('alx-analytics-channels', AlxAnalyticsChannels);

declare global {
  interface HTMLElementTagNameMap {
    'alx-analytics-channels': AlxAnalyticsChannels;
  }
}
