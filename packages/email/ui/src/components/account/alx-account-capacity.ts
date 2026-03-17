import { LitElement, html, css } from 'lit';
import { state, property } from 'lit/decorators.js';
import { safeRegister } from '../../utils/safe-register.js';
import { alxBaseStyles } from '../../styles/theme.js';
import {
  alxDensityStyles,
  alxCardStyles,
  alxLoadingStyles,
  alxButtonStyles,
  alxProgressBarStyles,
} from '../../styles/shared.js';
import { AccountAPI } from '../../api/account.api.js';

interface AccountCapacity {
  _id: string;
  email: string;
  dailyLimit: number;
  sentToday: number;
  remaining: number;
}

interface CapacityResponse {
  accounts: AccountCapacity[];
  totalLimit: number;
  totalSent: number;
  totalRemaining: number;
}

export class AlxAccountCapacity extends LitElement {
  static override styles = [
    alxBaseStyles,
    alxDensityStyles,
    alxCardStyles,
    alxLoadingStyles,
    alxButtonStyles,
    alxProgressBarStyles,
    css`
      .aggregate {
        display: grid;
        grid-template-columns: repeat(3, 1fr);
        gap: var(--alx-density-gap, 1rem);
        margin-bottom: var(--alx-density-gap, 1.25rem);
      }
      .aggregate-box {
        text-align: center;
        padding: var(--alx-density-padding, 1rem);
        background: var(--alx-bg);
        border: 1px solid var(--alx-border);
        border-radius: var(--alx-radius);
      }
      .aggregate-value {
        font-size: 1.75rem;
        font-weight: 700;
      }
      .aggregate-label {
        font-size: 0.75rem;
        color: var(--alx-text-muted);
        margin-top: 0.25rem;
      }
      .capacity-list {
        display: flex;
        flex-direction: column;
        gap: var(--alx-density-gap, 0.75rem);
      }
      .capacity-item {
        display: flex;
        align-items: center;
        gap: var(--alx-density-gap, 1rem);
        padding: var(--alx-density-padding, 0.75rem);
        background: var(--alx-surface);
        border: 1px solid var(--alx-border);
        border-radius: var(--alx-radius);
      }
      .capacity-email {
        width: 200px;
        font-size: 0.85rem;
        font-weight: 500;
        overflow: hidden;
        text-overflow: ellipsis;
        white-space: nowrap;
      }
      .capacity-bar-container {
        flex: 1;
      }
      .header-row {
        display: flex;
        align-items: center;
        justify-content: space-between;
        margin-bottom: 1rem;
      }
      .progress-track {
        width: 100%;
        height: 6px;
      }
    `,
  ];

  @property({ type: String, reflect: true }) density: 'default' | 'compact' = 'default';

  @state() private capacity: CapacityResponse | null = null;
  @state() private loading = false;
  @state() private error = '';

  private _api?: AccountAPI;
  private get api(): AccountAPI {
    if (!this._api) this._api = new AccountAPI();
    return this._api;
  }

  override connectedCallback(): void {
    super.connectedCallback();
    this.load();
  }

  async load(): Promise<void> {
    this.loading = true;
    this.error = '';
    try {
      this.capacity = (await this.api.getCapacity()) as CapacityResponse;
    } catch (e) {
      this.error = e instanceof Error ? e.message : 'Failed to load capacity';
    } finally {
      this.loading = false;
    }
  }

  private capacityColor(remaining: number, limit: number): string {
    if (limit === 0) return 'var(--alx-text-muted)';
    const pct = remaining / limit;
    if (pct > 0.5) return 'var(--alx-success)';
    if (pct > 0.2) return 'var(--alx-warning)';
    return 'var(--alx-danger)';
  }

  private usagePercent(sent: number, limit: number): number {
    if (limit === 0) return 0;
    return Math.min(100, (sent / limit) * 100);
  }

  override render() {
    return html`
      <div class="alx-card">
        <div class="header-row">
          <h3>Sending Capacity</h3>
          <button @click=${() => this.load()}>Refresh</button>
        </div>

        ${this.error ? html`<div class="alx-error">${this.error}</div>` : ''}
        ${this.loading
          ? html`<div class="alx-loading"><div class="alx-spinner"></div></div>`
          : !this.capacity
            ? html`<div class="alx-empty">No capacity data</div>`
            : html`
                <div class="aggregate">
                  <div class="aggregate-box">
                    <div class="aggregate-value">${this.capacity.totalLimit}</div>
                    <div class="aggregate-label">Total Limit</div>
                  </div>
                  <div class="aggregate-box">
                    <div class="aggregate-value">${this.capacity.totalSent}</div>
                    <div class="aggregate-label">Sent Today</div>
                  </div>
                  <div class="aggregate-box">
                    <div
                      class="aggregate-value"
                      style="color:${this.capacityColor(this.capacity.totalRemaining, this.capacity.totalLimit)}"
                    >
                      ${this.capacity.totalRemaining}
                    </div>
                    <div class="aggregate-label">Remaining</div>
                  </div>
                </div>

                <div class="capacity-list">
                  ${this.capacity.accounts.map(
                    (a) => html`
                      <div class="capacity-item">
                        <span class="capacity-email">${a.email}</span>
                        <span class="capacity-bar-container progress-bar">
                          <span class="progress-track">
                            <span
                              class="progress-fill"
                              style="width:${this.usagePercent(a.sentToday, a.dailyLimit)}%;background:${this.capacityColor(a.remaining, a.dailyLimit)}"
                            ></span>
                          </span>
                          <span class="progress-label">
                            ${a.sentToday}/${a.dailyLimit}
                          </span>
                        </span>
                      </div>
                    `,
                  )}
                </div>
              `}
      </div>
    `;
  }
}
safeRegister('alx-account-capacity', AlxAccountCapacity);

declare global {
  interface HTMLElementTagNameMap {
    'alx-account-capacity': AlxAccountCapacity;
  }
}
