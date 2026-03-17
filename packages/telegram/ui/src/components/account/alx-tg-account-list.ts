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
  alxProgressBarStyles,
} from '../../styles/shared.js';
import { TelegramAccountAPI } from '../../api/account.api.js';

interface TgAccount {
  _id: string;
  phone: string;
  name?: string;
  status: string;
  health?: { score?: number };
  dailyLimit?: number;
  sentToday?: number;
  session?: string;
  createdAt?: string;
}

export class AlxTgAccountList extends LitElement {
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
    alxProgressBarStyles,
    css`
      .phone-cell {
        line-height: 1.3;
      }
      .phone-cell-main {
        font-weight: 500;
      }
      .phone-cell-sub {
        font-size: 0.7rem;
        color: var(--alx-text-muted);
        margin-top: 0.1rem;
      }
      .action-group {
        display: flex;
        gap: 0.25rem;
        align-items: center;
      }
      .capacity-text {
        font-variant-numeric: tabular-nums;
        font-size: 0.8rem;
        color: var(--alx-text-muted);
      }
      .health-good { color: var(--alx-success); }
      .health-fair { color: var(--alx-warning); }
      .health-poor { color: var(--alx-danger); }
    `,
  ];

  @property({ type: String, reflect: true }) density: 'default' | 'compact' = 'default';
  @property({ type: Number }) page = 1;
  @property({ type: Number }) limit = 20;

  @state() private accounts: TgAccount[] = [];
  @state() private total = 0;
  @state() private loading = false;
  @state() private error = '';
  @state() private statusFilter = '';

  private _api?: TelegramAccountAPI;
  private get api(): TelegramAccountAPI {
    if (!this._api) this._api = new TelegramAccountAPI();
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
      const params: Record<string, unknown> = {
        page: this.page,
        limit: this.limit,
      };
      if (this.statusFilter) params['status'] = this.statusFilter;

      const res = await this.api.listAccounts(params) as {
        accounts: TgAccount[];
        total?: number;
      };
      if (gen !== this._loadGeneration) return;
      this.accounts = res.accounts ?? [];
      this.total = res.total ?? res.accounts?.length ?? 0;
      if (this.page > this.totalPages) {
        this.page = this.totalPages;
      }
    } catch (e) {
      if (gen !== this._loadGeneration) return;
      this.error = e instanceof Error ? e.message : 'Failed to load accounts';
    } finally {
      if (gen === this._loadGeneration) this.loading = false;
    }
  }

  private get totalPages(): number {
    return Math.max(1, Math.ceil(this.total / this.limit));
  }

  private onEdit(account: TgAccount): void {
    this.dispatchEvent(
      new CustomEvent('alx-account-selected', {
        detail: account,
        bubbles: true,
        composed: true,
      }),
    );
  }

  private onStatusChange(e: Event): void {
    this.statusFilter = (e.target as HTMLSelectElement).value;
    this.page = 1;
    this.load();
  }

  private onPrev(): void {
    if (this.page > 1) {
      this.page--;
      this.load();
    }
  }

  private onNext(): void {
    if (this.page < this.totalPages) {
      this.page++;
      this.load();
    }
  }

  private async onConnect(e: Event, account: TgAccount): Promise<void> {
    e.stopPropagation();
    try {
      await this.api.connectAccount(account._id);
      this.load();
    } catch (err) {
      this.error = err instanceof Error ? err.message : 'Failed to connect';
    }
  }

  private async onDisconnect(e: Event, account: TgAccount): Promise<void> {
    e.stopPropagation();
    try {
      await this.api.disconnectAccount(account._id);
      this.load();
    } catch (err) {
      this.error = err instanceof Error ? err.message : 'Failed to disconnect';
    }
  }

  private async onDelete(e: Event, account: TgAccount): Promise<void> {
    e.stopPropagation();
    if (!confirm(`Delete account "${account.phone}"?`)) return;
    try {
      await this.api.deleteAccount(account._id);
      this.dispatchEvent(
        new CustomEvent('alx-account-deleted', {
          detail: account,
          bubbles: true,
          composed: true,
        }),
      );
      this.load();
    } catch (err) {
      this.error = err instanceof Error ? err.message : 'Failed to delete account';
    }
  }

  private onCreate(): void {
    this.dispatchEvent(
      new CustomEvent('alx-account-create', {
        bubbles: true,
        composed: true,
      }),
    );
  }

  private healthColor(score: number): string {
    if (score > 70) return 'var(--alx-success)';
    if (score > 40) return 'var(--alx-warning)';
    return 'var(--alx-danger)';
  }

  private statusBadgeClass(status: string): string {
    switch (status) {
      case 'connected':
        return 'alx-badge alx-badge-success';
      case 'disconnected':
        return 'alx-badge alx-badge-muted';
      case 'quarantined':
        return 'alx-badge alx-badge-warning';
      case 'banned':
        return 'alx-badge alx-badge-danger';
      case 'warmup':
        return 'alx-badge alx-badge-info';
      default:
        return 'alx-badge alx-badge-muted';
    }
  }

  override render() {
    return html`
      <div class="alx-card">
        <div class="alx-card-header">
          <h3>Telegram Accounts</h3>
        </div>

        <div class="toolbar">
          <select @change=${this.onStatusChange}>
            <option value="">All Statuses</option>
            <option value="connected">Connected</option>
            <option value="disconnected">Disconnected</option>
            <option value="quarantined">Quarantined</option>
            <option value="banned">Banned</option>
            <option value="warmup">Warmup</option>
          </select>

          <span class="spacer"></span>

          <button @click=${() => this.load()}>Refresh</button>
          <button class="alx-btn-primary" @click=${this.onCreate}>
            + Add Account
          </button>
        </div>

        ${this.error ? html`<div class="alx-error">${this.error}</div>` : ''}
        ${this.loading
          ? html`<div class="alx-loading"><div class="alx-spinner"></div></div>`
          : this.accounts.length === 0
            ? html`<div class="alx-empty">
  <p>Add your Telegram accounts to start sending.</p>
  <p>Each account needs a phone number and session string.</p>
  <button class="alx-btn-primary alx-btn-sm" style="margin-top:0.5rem" @click=${this.onCreate}>+ Add Account</button>
</div>`
            : html`
                <table>
                  <thead>
                    <tr>
                      <th>NAME</th>
                      <th>PHONE</th>
                      <th>STATUS</th>
                      <th>HEALTH</th>
                      <th>SENT TODAY / LIMIT</th>
                      <th></th>
                    </tr>
                  </thead>
                  <tbody>
                    ${this.accounts.map(
                      (a) => html`
                        <tr>
                          <td>
                            <div class="phone-cell">
                              <div class="phone-cell-main">${a.name || '--'}</div>
                            </div>
                          </td>
                          <td>${a.phone}</td>
                          <td>
                            <span class=${this.statusBadgeClass(a.status)}>
                              ${a.status}
                            </span>
                          </td>
                          <td>
                            <span class="progress-bar">
                              <span class="progress-track">
                                <span
                                  class="progress-fill"
                                  style="width:${a.health?.score ?? 0}%;background:${this.healthColor(a.health?.score ?? 0)}"
                                ></span>
                              </span>
                              <span class="progress-label">
                                ${a.health?.score ?? 0}
                                <span class="${(a.health?.score ?? 0) > 70 ? 'health-good' : (a.health?.score ?? 0) > 40 ? 'health-fair' : 'health-poor'}">${(a.health?.score ?? 0) > 70 ? 'Good' : (a.health?.score ?? 0) > 40 ? 'Fair' : 'Poor'}</span>
                              </span>
                            </span>
                          </td>
                          <td>
                            <span class="capacity-text">${a.sentToday ?? 0} / ${a.dailyLimit ?? 0}</span>
                          </td>
                          <td>
                            <div class="action-group">
                              ${a.status === 'disconnected'
                                ? html`<button class="alx-btn-sm alx-btn-success" @click=${(e: Event) => this.onConnect(e, a)}>Connect</button>`
                                : a.status === 'connected'
                                  ? html`<button class="alx-btn-sm" @click=${(e: Event) => this.onDisconnect(e, a)}>Disconnect</button>`
                                  : ''}
                              <button
                                class="alx-btn-icon"
                                title="Edit"
                                @click=${() => this.onEdit(a)}
                              >&#9998;</button>
                              <button
                                class="alx-btn-icon danger"
                                title="Delete"
                                @click=${(e: Event) => this.onDelete(e, a)}
                              >&times;</button>
                            </div>
                          </td>
                        </tr>
                      `,
                    )}
                  </tbody>
                </table>

                <div class="pagination">
                  <button
                    class="alx-btn-sm"
                    ?disabled=${this.page <= 1}
                    @click=${this.onPrev}
                  >
                    Prev
                  </button>
                  <span class="text-small text-muted">
                    Page ${this.page} of ${this.totalPages}
                  </span>
                  <button
                    class="alx-btn-sm"
                    ?disabled=${this.page >= this.totalPages}
                    @click=${this.onNext}
                  >
                    Next
                  </button>
                </div>
              `}
      </div>
    `;
  }
}
safeRegister('alx-tg-account-list', AlxTgAccountList);

declare global {
  interface HTMLElementTagNameMap {
    'alx-tg-account-list': AlxTgAccountList;
  }
}
