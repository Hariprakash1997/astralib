import { LitElement, html, css } from 'lit';
import { customElement, state, property } from 'lit/decorators.js';
import { alxBaseStyles } from '../../styles/theme.js';
import {
  alxCardStyles,
  alxLoadingStyles,
  alxBadgeStyles,
} from '../../styles/shared.js';
import { AccountAPI } from '../../api/account.api.js';

interface AccountHealth {
  _id: string;
  email: string;
  healthScore: number;
  bounceRate: number;
  consecutiveErrors: number;
  lastErrorDate?: string;
  lastError?: string;
  status: string;
}

@customElement('alx-account-health')
export class AlxAccountHealth extends LitElement {
  static override styles = [
    alxBaseStyles,
    alxCardStyles,
    alxLoadingStyles,
    alxBadgeStyles,
    css`
      .health-grid {
        display: grid;
        grid-template-columns: repeat(auto-fill, minmax(300px, 1fr));
        gap: 1rem;
      }
      .health-item {
        background: var(--alx-surface);
        border: 1px solid var(--alx-border);
        border-radius: var(--alx-radius);
        padding: 1rem;
      }
      .health-header {
        display: flex;
        align-items: center;
        justify-content: space-between;
        margin-bottom: 0.75rem;
      }
      .health-email {
        font-weight: 500;
        font-size: 0.9rem;
      }
      .health-score {
        font-size: 1.5rem;
        font-weight: 700;
      }
      .health-bar-track {
        width: 100%;
        height: 10px;
        background: var(--alx-border);
        border-radius: 5px;
        overflow: hidden;
        margin-bottom: 0.75rem;
      }
      .health-bar-fill {
        height: 100%;
        border-radius: 5px;
        transition: width 0.4s ease;
      }
      .health-stats {
        display: grid;
        grid-template-columns: 1fr 1fr;
        gap: 0.5rem;
        font-size: 0.8rem;
      }
      .stat-label {
        color: var(--alx-text-muted);
      }
      .stat-value {
        text-align: right;
      }
      .header-row {
        display: flex;
        align-items: center;
        justify-content: space-between;
        margin-bottom: 1rem;
      }
    `,
  ];

  @property({ type: Number, attribute: 'refresh-interval' }) refreshInterval = 30;

  @state() private accounts: AccountHealth[] = [];
  @state() private loading = false;
  @state() private error = '';

  private _api?: AccountAPI;
  private get api(): AccountAPI {
    if (!this._api) this._api = new AccountAPI();
    return this._api;
  }
  private intervalId?: ReturnType<typeof setInterval>;

  override connectedCallback(): void {
    super.connectedCallback();
    this.load();
    if (this.refreshInterval > 0) {
      this.intervalId = setInterval(() => this.load(), this.refreshInterval * 1000);
    }
  }

  override disconnectedCallback(): void {
    super.disconnectedCallback();
    if (this.intervalId) clearInterval(this.intervalId);
  }

  override updated(changed: Map<string, unknown>): void {
    if (changed.has('refreshInterval') && this.intervalId) {
      clearInterval(this.intervalId);
      if (this.refreshInterval > 0) {
        this.intervalId = setInterval(() => this.load(), this.refreshInterval * 1000);
      } else {
        this.intervalId = undefined;
      }
    }
  }

  async load(): Promise<void> {
    if (this.loading) return;
    this.loading = true;
    this.error = '';
    try {
      const res = (await this.api.getAllHealth()) as AccountHealth[] | { accounts: AccountHealth[] };
      this.accounts = Array.isArray(res) ? res : (res.accounts ?? []);
    } catch (e) {
      this.error = e instanceof Error ? e.message : 'Failed to load health data';
    } finally {
      this.loading = false;
    }
  }

  private healthColor(score: number): string {
    if (score > 80) return 'var(--alx-success)';
    if (score > 50) return 'var(--alx-warning)';
    return 'var(--alx-danger)';
  }

  private formatDate(dateStr?: string): string {
    if (!dateStr) return 'N/A';
    return new Date(dateStr).toLocaleString();
  }

  override render() {
    return html`
      <div class="alx-card">
        <div class="header-row">
          <h3>Account Health</h3>
          <span class="text-small text-muted">
            Auto-refresh: ${this.refreshInterval}s
          </span>
        </div>

        ${this.error ? html`<div class="alx-error">${this.error}</div>` : ''}
        ${this.loading && this.accounts.length === 0
          ? html`<div class="alx-loading"><div class="alx-spinner"></div></div>`
          : this.accounts.length === 0
            ? html`<div class="alx-empty">No health data available</div>`
            : html`
                <div class="health-grid">
                  ${this.accounts.map(
                    (a) => html`
                      <div class="health-item">
                        <div class="health-header">
                          <span class="health-email">${a.email}</span>
                          <span
                            class="health-score"
                            style="color:${this.healthColor(a.healthScore)}"
                          >
                            ${a.healthScore}
                          </span>
                        </div>
                        <div class="health-bar-track">
                          <span
                            class="health-bar-fill"
                            style="width:${a.healthScore}%;background:${this.healthColor(a.healthScore)}"
                          ></span>
                        </div>
                        <div class="health-stats">
                          <span class="stat-label">Bounce Rate</span>
                          <span class="stat-value">${(a.bounceRate * 100).toFixed(1)}%</span>
                          <span class="stat-label">Consecutive Errors</span>
                          <span class="stat-value">${a.consecutiveErrors}</span>
                          <span class="stat-label">Last Error</span>
                          <span class="stat-value">${this.formatDate(a.lastErrorDate)}</span>
                        </div>
                        ${a.lastError
                          ? html`<div class="alx-error" style="margin-top:0.5rem;padding:0.5rem;font-size:0.75rem">
                              ${a.lastError}
                            </div>`
                          : ''}
                      </div>
                    `,
                  )}
                </div>
              `}
      </div>
    `;
  }
}

declare global {
  interface HTMLElementTagNameMap {
    'alx-account-health': AlxAccountHealth;
  }
}
