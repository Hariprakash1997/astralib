import { LitElement, html, css } from 'lit';
import { customElement, state, property } from 'lit/decorators.js';
import { alxBaseStyles } from '../../styles/theme.js';
import {
  alxButtonStyles,
  alxCardStyles,
  alxBadgeStyles,
  alxLoadingStyles,
} from '../../styles/shared.js';
import { AccountAPI } from '../../api/account.api.js';

interface WarmupPhase {
  day: number;
  dailyLimit: number;
  label?: string;
}

interface WarmupStatus {
  active: boolean;
  currentDay: number;
  currentPhase?: string;
  dailyLimit: number;
  schedule: WarmupPhase[];
  startedAt?: string;
  completedAt?: string;
}

@customElement('alx-account-warmup')
export class AlxAccountWarmup extends LitElement {
  static override styles = [
    alxBaseStyles,
    alxButtonStyles,
    alxCardStyles,
    alxBadgeStyles,
    alxLoadingStyles,
    css`
      .warmup-progress {
        margin: 1.25rem 0;
      }
      .progress-bar-track {
        width: 100%;
        height: 16px;
        background: var(--alx-border);
        border-radius: 8px;
        overflow: hidden;
      }
      .progress-bar-fill {
        height: 100%;
        background: var(--alx-primary);
        border-radius: 8px;
        transition: width 0.4s ease;
      }
      .progress-info {
        display: flex;
        justify-content: space-between;
        margin-top: 0.5rem;
        font-size: 0.8rem;
        color: var(--alx-text-muted);
      }
      .stats-row {
        display: grid;
        grid-template-columns: repeat(3, 1fr);
        gap: 1rem;
        margin-bottom: 1.25rem;
      }
      .stat-box {
        text-align: center;
        padding: 0.75rem;
        background: var(--alx-bg);
        border-radius: var(--alx-radius);
        border: 1px solid var(--alx-border);
      }
      .stat-value {
        font-size: 1.5rem;
        font-weight: 700;
        color: var(--alx-primary);
      }
      .stat-label {
        font-size: 0.75rem;
        color: var(--alx-text-muted);
        margin-top: 0.25rem;
      }
      .actions {
        display: flex;
        gap: 0.75rem;
        margin-top: 1rem;
      }
      .schedule-list {
        list-style: none;
        margin: 1rem 0 0;
        padding: 0;
      }
      .schedule-item {
        display: flex;
        align-items: center;
        gap: 0.75rem;
        padding: 0.5rem 0;
        border-bottom: 1px solid var(--alx-border);
        font-size: 0.85rem;
      }
      .schedule-day {
        width: 60px;
        font-weight: 600;
        color: var(--alx-text-muted);
      }
      .schedule-limit {
        color: var(--alx-text);
      }
      .schedule-active {
        color: var(--alx-primary);
        font-weight: 600;
      }
    `,
  ];

  @property({ attribute: 'account-id' }) accountId = '';

  @state() private warmup: WarmupStatus | null = null;
  @state() private loading = false;
  @state() private error = '';
  @state() private actionLoading = false;

  private _api?: AccountAPI;
  private get api(): AccountAPI {
    if (!this._api) this._api = new AccountAPI();
    return this._api;
  }

  override connectedCallback(): void {
    super.connectedCallback();
    if (this.accountId) this.load();
  }

  async load(): Promise<void> {
    if (!this.accountId) return;
    this.loading = true;
    this.error = '';
    try {
      this.warmup = (await this.api.getWarmupStatus(this.accountId)) as WarmupStatus;
    } catch (e) {
      this.error = e instanceof Error ? e.message : 'Failed to load warmup status';
    } finally {
      this.loading = false;
    }
  }

  private async onStart(): Promise<void> {
    this.actionLoading = true;
    try {
      await this.api.startWarmup(this.accountId);
      await this.load();
    } catch (e) {
      this.error = e instanceof Error ? e.message : 'Failed to start warmup';
    } finally {
      this.actionLoading = false;
    }
  }

  private get totalDays(): number {
    if (!this.warmup?.schedule?.length) return 1;
    return this.warmup.schedule[this.warmup.schedule.length - 1].day;
  }

  private get progressPercent(): number {
    if (!this.warmup) return 0;
    return Math.min(100, (this.warmup.currentDay / this.totalDays) * 100);
  }

  override render() {
    if (this.loading) {
      return html`<div class="alx-loading"><div class="alx-spinner"></div></div>`;
    }
    if (this.error) {
      return html`<div class="alx-card"><div class="alx-error">${this.error}</div></div>`;
    }
    if (!this.warmup) {
      return html`<div class="alx-card"><div class="alx-empty">No warmup data</div></div>`;
    }

    const w = this.warmup;

    return html`
      <div class="alx-card">
        <div class="alx-card-header">
          <h3>Warmup Status</h3>
          ${w.active
            ? html`<span class="alx-badge alx-badge-warning">Active</span>`
            : w.completedAt
              ? html`<span class="alx-badge alx-badge-success">Completed</span>`
              : html`<span class="alx-badge alx-badge-muted">Inactive</span>`}
        </div>

        <div class="stats-row">
          <div class="stat-box">
            <div class="stat-value">${w.currentDay}</div>
            <div class="stat-label">Current Day</div>
          </div>
          <div class="stat-box">
            <div class="stat-value">${w.currentPhase ?? 'N/A'}</div>
            <div class="stat-label">Phase</div>
          </div>
          <div class="stat-box">
            <div class="stat-value">${w.dailyLimit}</div>
            <div class="stat-label">Daily Limit</div>
          </div>
        </div>

        <div class="warmup-progress">
          <div class="progress-bar-track">
            <div
              class="progress-bar-fill"
              style="width:${this.progressPercent}%"
            ></div>
          </div>
          <div class="progress-info">
            <span>Day ${w.currentDay}</span>
            <span>${this.progressPercent.toFixed(0)}%</span>
            <span>Day ${this.totalDays}</span>
          </div>
        </div>

        ${w.schedule?.length
          ? html`
              <h4 style="margin-top:1rem">Phase Schedule</h4>
              <ul class="schedule-list">
                ${w.schedule.map(
                  (phase) => html`
                    <li class="schedule-item">
                      <span class="schedule-day">Day ${phase.day}</span>
                      <span class=${w.currentDay === phase.day ? 'schedule-active' : 'schedule-limit'}>
                        ${phase.dailyLimit} emails/day
                      </span>
                      ${phase.label ? html`<span class="text-muted text-small">${phase.label}</span>` : ''}
                    </li>
                  `,
                )}
              </ul>
            `
          : ''}

        <div class="actions">
          ${!w.active
            ? html`<button class="alx-btn-primary" ?disabled=${this.actionLoading} @click=${this.onStart}>
                ${this.actionLoading ? 'Starting...' : 'Start Warmup'}
              </button>`
            : ''}
          <button @click=${() => this.load()}>Refresh</button>
        </div>
      </div>
    `;
  }
}

declare global {
  interface HTMLElementTagNameMap {
    'alx-account-warmup': AlxAccountWarmup;
  }
}
