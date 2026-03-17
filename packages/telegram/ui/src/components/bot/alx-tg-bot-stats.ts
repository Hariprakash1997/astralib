import { LitElement, html, css } from 'lit';
import { state, property } from 'lit/decorators.js';
import { safeRegister } from '../../utils/safe-register.js';
import { alxBaseStyles } from '../../styles/theme.js';
import {
  alxDensityStyles,
  alxButtonStyles,
  alxInputStyles,
  alxTableStyles,
  alxBadgeStyles,
  alxLoadingStyles,
  alxCardStyles,
  alxToolbarStyles,
} from '../../styles/shared.js';
import { TelegramBotAPI } from '../../api/bot.api.js';

interface BotUser {
  _id: string;
  telegramId: string;
  username?: string;
  firstName?: string;
  lastName?: string;
  blocked?: boolean;
  lastActive?: string;
}

export class AlxTgBotStats extends LitElement {
  static override styles = [
    alxBaseStyles,
    alxDensityStyles,
    alxButtonStyles,
    alxInputStyles,
    alxTableStyles,
    alxBadgeStyles,
    alxLoadingStyles,
    alxCardStyles,
    alxToolbarStyles,
    css`
      .stats-grid {
        display: grid;
        grid-template-columns: repeat(auto-fit, minmax(140px, 1fr));
        gap: 0.625rem;
        margin-bottom: 1rem;
      }
      .stat-card {
        padding: 0.75rem;
        background: var(--alx-surface);
        border: 1px solid var(--alx-border);
        border-radius: var(--alx-radius);
        text-align: center;
      }
      .stat-value {
        font-size: 1.5rem;
        font-weight: 700;
        color: var(--alx-text);
        font-variant-numeric: tabular-nums;
      }
      .stat-label {
        font-size: 0.7rem;
        color: var(--alx-text-muted);
        text-transform: uppercase;
        letter-spacing: 0.03em;
        margin-top: 0.15rem;
      }
      .stat-running .stat-value { color: var(--alx-success); }
      .stat-stopped .stat-value { color: var(--alx-danger); }
    `,
  ];

  @property({ type: String, reflect: true }) density: 'default' | 'compact' = 'default';
  @property({ type: Number }) page = 1;
  @property({ type: Number }) limit = 20;

  @state() private botStatus = 'unknown';
  @state() private totalUsers = 0;
  @state() private activeUsers = 0;
  @state() private blockedUsers = 0;
  @state() private users: BotUser[] = [];
  @state() private usersTotal = 0;
  @state() private loading = false;
  @state() private error = '';

  private _api?: TelegramBotAPI;
  private get api(): TelegramBotAPI {
    if (!this._api) this._api = new TelegramBotAPI();
    return this._api;
  }
  private _loadGeneration = 0;

  override connectedCallback(): void {
    super.connectedCallback();
    this.load();
  }

  async load(): Promise<void> {
    const gen = ++this._loadGeneration;
    this.loading = true;
    this.error = '';
    try {
      const [statusRes, statsRes, usersRes] = await Promise.all([
        this.api.getStatus() as Promise<Record<string, unknown>>,
        this.api.getStats() as Promise<Record<string, unknown>>,
        this.api.getUsers({ page: this.page, limit: this.limit }) as Promise<{
          users: BotUser[];
          total?: number;
        }>,
      ]);
      if (gen !== this._loadGeneration) return;
      this.botStatus = (statusRes['status'] as string) ?? 'unknown';
      this.totalUsers = (statsRes['totalUsers'] as number) ?? 0;
      this.activeUsers = (statsRes['activeUsers'] as number) ?? 0;
      this.blockedUsers = (statsRes['blockedUsers'] as number) ?? 0;
      this.users = usersRes.users ?? [];
      this.usersTotal = usersRes.total ?? usersRes.users?.length ?? 0;
    } catch (e) {
      if (gen !== this._loadGeneration) return;
      this.error = e instanceof Error ? e.message : 'Failed to load bot stats';
    } finally {
      if (gen === this._loadGeneration) this.loading = false;
    }
  }

  private get totalPages(): number {
    return Math.max(1, Math.ceil(this.usersTotal / this.limit));
  }

  private onPrev(): void {
    if (this.page > 1) { this.page--; this.load(); }
  }

  private onNext(): void {
    if (this.page < this.totalPages) { this.page++; this.load(); }
  }

  private formatDate(d?: string): string {
    if (!d) return '--';
    try {
      return new Date(d).toLocaleDateString(undefined, {
        month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit',
      });
    } catch {
      return d;
    }
  }

  override render() {
    if (this.loading) {
      return html`<div class="alx-loading"><div class="alx-spinner"></div></div>`;
    }

    return html`
      ${this.error ? html`<div class="alx-error">${this.error}</div>` : ''}

      <div class="stats-grid">
        <div class="stat-card ${this.botStatus === 'running' ? 'stat-running' : 'stat-stopped'}">
          <div class="stat-value">${this.botStatus}</div>
          <div class="stat-label">Bot Status</div>
        </div>
        <div class="stat-card">
          <div class="stat-value">${this.totalUsers}</div>
          <div class="stat-label">Total Users</div>
        </div>
        <div class="stat-card">
          <div class="stat-value">${this.activeUsers}</div>
          <div class="stat-label">Active Users</div>
        </div>
        <div class="stat-card">
          <div class="stat-value">${this.blockedUsers}</div>
          <div class="stat-label">Blocked Users</div>
        </div>
      </div>

      <div class="alx-card">
        <div class="alx-card-header">
          <h3>Bot Users</h3>
        </div>

        <div class="toolbar">
          <span class="spacer"></span>
          <button @click=${() => this.load()}>Refresh</button>
        </div>

        ${this.users.length === 0
          ? html`<div class="alx-empty"><p>No bot users yet.</p></div>`
          : html`
              <table>
                <thead>
                  <tr>
                    <th>ID</th>
                    <th>USERNAME</th>
                    <th>NAME</th>
                    <th>STATUS</th>
                    <th>LAST ACTIVE</th>
                  </tr>
                </thead>
                <tbody>
                  ${this.users.map(u => html`
                    <tr>
                      <td style="font-family:monospace;font-size:0.75rem">${u.telegramId}</td>
                      <td>${u.username ? `@${u.username}` : '--'}</td>
                      <td>${[u.firstName, u.lastName].filter(Boolean).join(' ') || '--'}</td>
                      <td>
                        <span class="alx-badge ${u.blocked ? 'alx-badge-danger' : 'alx-badge-success'}">
                          ${u.blocked ? 'blocked' : 'active'}
                        </span>
                      </td>
                      <td>${this.formatDate(u.lastActive)}</td>
                    </tr>
                  `)}
                </tbody>
              </table>

              <div class="pagination">
                <button class="alx-btn-sm" ?disabled=${this.page <= 1} @click=${this.onPrev}>Prev</button>
                <span class="text-small text-muted">Page ${this.page} of ${this.totalPages}</span>
                <button class="alx-btn-sm" ?disabled=${this.page >= this.totalPages} @click=${this.onNext}>Next</button>
              </div>
            `}
      </div>
    `;
  }
}
safeRegister('alx-tg-bot-stats', AlxTgBotStats);

declare global {
  interface HTMLElementTagNameMap {
    'alx-tg-bot-stats': AlxTgBotStats;
  }
}
