import { LitElement, html, css } from 'lit';
import { state, property } from 'lit/decorators.js';
import { safeRegister } from '../../utils/safe-register.js';
import { alxBaseStyles } from '../../styles/theme.js';
import {
  alxDensityStyles,
  alxButtonStyles,
  alxCardStyles,
  alxBadgeStyles,
  alxLoadingStyles,
  alxProgressBarStyles,
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

export class AlxAccountWarmup extends LitElement {
  static override styles = [
    alxBaseStyles,
    alxDensityStyles,
    alxButtonStyles,
    alxCardStyles,
    alxBadgeStyles,
    alxLoadingStyles,
    alxProgressBarStyles,
    css`
      .warmup-progress {
        margin: var(--alx-density-gap, 1rem) 0;
      }
      .progress-info {
        display: flex;
        justify-content: space-between;
        margin-top: calc(var(--alx-density-gap, 1rem) / 2);
        font-size: var(--alx-density-font-size, 0.875rem);
        color: var(--alx-text-muted);
      }
      .stats-row {
        display: grid;
        grid-template-columns: repeat(3, 1fr);
        gap: var(--alx-density-gap, 1rem);
        margin-bottom: var(--alx-density-gap, 1rem);
      }
      .stat-box {
        text-align: center;
        padding: var(--alx-density-padding, 0.75rem);
        background: var(--alx-bg);
        border-radius: var(--alx-radius);
        border: 1px solid var(--alx-border);
      }
      .stat-value {
        font-size: var(--alx-density-header-size, 1.25rem);
        font-weight: 700;
        color: var(--alx-primary);
      }
      .stat-label {
        font-size: var(--alx-density-font-size, 0.875rem);
        color: var(--alx-text-muted);
        margin-top: 0.25rem;
      }
      .actions {
        display: flex;
        gap: var(--alx-density-gap, 1rem);
        margin-top: var(--alx-density-gap, 1rem);
      }
      .schedule-list {
        list-style: none;
        margin: var(--alx-density-gap, 1rem) 0 0;
        padding: 0;
      }
      .schedule-item {
        display: flex;
        align-items: center;
        gap: var(--alx-density-gap, 1rem);
        padding: calc(var(--alx-density-padding, 0.75rem) / 2) 0;
        border-bottom: 1px solid var(--alx-border);
        font-size: var(--alx-density-font-size, 0.875rem);
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
      .progress-track {
        width: 100%;
        height: 8px;
      }
    `,
  ];

  @property({ type: String, reflect: true }) density: 'default' | 'compact' = 'default';
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
          <span class="progress-bar">
            <span class="progress-track">
              <span
                class="progress-fill"
                style="width:${this.progressPercent}%;background:var(--alx-primary)"
              ></span>
            </span>
            <span class="progress-label">${this.progressPercent.toFixed(0)}%</span>
          </span>
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
safeRegister('alx-account-warmup', AlxAccountWarmup);

declare global {
  interface HTMLElementTagNameMap {
    'alx-account-warmup': AlxAccountWarmup;
  }
}
