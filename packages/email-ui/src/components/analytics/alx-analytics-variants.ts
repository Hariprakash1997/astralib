import { LitElement, html, css, nothing } from 'lit';
import { state, property } from 'lit/decorators.js';
import { safeRegister } from '../../utils/safe-register.js';
import { alxBaseStyles } from '../../styles/theme.js';
import {
  alxDensityStyles,
  alxTableStyles,
  alxCardStyles,
  alxLoadingStyles,
  alxBadgeStyles,
} from '../../styles/shared.js';
import { AnalyticsAPI } from '../../api/analytics.api.js';

interface VariantRow {
  subjectIndex: number;
  bodyIndex: number;
  sent: number;
  opened: number;
  clicked: number;
  bounced: number;
  openRate: number;
  clickRate: number;
}

export class AlxAnalyticsVariants extends LitElement {
  static override styles = [
    alxBaseStyles,
    alxDensityStyles,
    alxTableStyles,
    alxCardStyles,
    alxLoadingStyles,
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

      .best-badge {
        display: inline-block;
        font-size: 0.6rem;
        font-weight: 600;
        padding: 0.1rem 0.35rem;
        border-radius: var(--alx-radius);
        background: color-mix(in srgb, var(--alx-success) 15%, transparent);
        color: var(--alx-success);
        margin-left: 0.35rem;
        vertical-align: middle;
      }

      .rate-cell {
        font-variant-numeric: tabular-nums;
      }
    `,
  ];

  @property({ type: String, reflect: true }) density: 'default' | 'compact' = 'default';
  @property({ attribute: 'date-from' }) dateFrom = '';
  @property({ attribute: 'date-to' }) dateTo = '';
  @property({ attribute: 'template-id' }) templateId = '';

  @state() private _variants: VariantRow[] = [];
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
    if (changed.has('dateFrom') || changed.has('dateTo') || changed.has('templateId')) {
      this._load();
    }
  }

  private async _load(): Promise<void> {
    this._loading = true;
    this._error = '';
    try {
      const params: Record<string, unknown> = {};
      if (this.dateFrom) params['from'] = this.dateFrom;
      if (this.dateTo) params['to'] = this.dateTo;
      if (this.templateId) params['templateId'] = this.templateId;
      const res = (await this._api.getVariantStats(params)) as { data?: VariantRow[] };
      const rows = res.data ?? (Array.isArray(res) ? res : []);
      // Sort by click rate descending
      this._variants = rows.sort((a, b) => b.clickRate - a.clickRate);
    } catch (err) {
      this._error = err instanceof Error ? err.message : 'Failed to load variant stats';
    } finally {
      this._loading = false;
    }
  }

  private _bestIndex(): number {
    if (this._variants.length === 0) return -1;
    return 0; // Already sorted by clickRate desc, first is best
  }

  override render() {
    const bestIdx = this._bestIndex();

    return html`
      <div class="alx-card">
        <div class="alx-card-header">
          <h3>A/B Variant Comparison</h3>
        </div>

        <div class="info-banner">Compares performance across subject and body variants. Data requires events with variant indices.</div>

        ${this._error ? html`<div class="alx-error">${this._error}</div>` : nothing}

        ${this._loading
          ? html`<div class="alx-loading"><div class="alx-spinner"></div></div>`
          : this._variants.length === 0
            ? html`<div class="alx-empty">
                <p>No variant data available yet.</p>
                <p>Events recorded with subjectIndex and bodyIndex fields will appear here.</p>
              </div>`
            : html`
                <table class="alx-table">
                  <thead>
                    <tr>
                      <th>Variant</th>
                      <th>Sent</th>
                      <th>Opened</th>
                      <th>Clicked</th>
                      <th>Bounced</th>
                      <th>Open Rate</th>
                      <th>Click Rate</th>
                    </tr>
                  </thead>
                  <tbody>
                    ${this._variants.map((v, i) => html`
                      <tr>
                        <td>
                          Subject #${v.subjectIndex} / Body #${v.bodyIndex}
                          ${i === bestIdx ? html`<span class="best-badge">Best</span>` : nothing}
                        </td>
                        <td>${v.sent.toLocaleString()}</td>
                        <td>${v.opened.toLocaleString()}</td>
                        <td>${v.clicked.toLocaleString()}</td>
                        <td>${v.bounced.toLocaleString()}</td>
                        <td class="rate-cell">${v.openRate}%</td>
                        <td class="rate-cell">${v.clickRate}%</td>
                      </tr>
                    `)}
                  </tbody>
                </table>
              `}
      </div>
    `;
  }
}
safeRegister('alx-analytics-variants', AlxAnalyticsVariants);

declare global {
  interface HTMLElementTagNameMap {
    'alx-analytics-variants': AlxAnalyticsVariants;
  }
}
