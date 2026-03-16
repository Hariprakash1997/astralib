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
import { AccountAPI } from '../../api/account.api.js';

interface Account {
  _id: string;
  email: string;
  senderName?: string;
  provider: string;
  status: string;
  smtp?: { host?: string; port?: number; user?: string };
  imap?: { host?: string; port?: number; user?: string };
  limits?: { dailyMax?: number };
  health?: { score?: number; consecutiveErrors?: number; bounceCount?: number };
  warmup?: { enabled?: boolean; currentDay?: number };
  metadata?: Record<string, unknown>;
  totalEmailsSent?: number;
  createdAt?: string;
}

export class AlxAccountList extends LitElement {
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
      .email-cell {
        line-height: 1.3;
      }
      .email-cell-main {
        font-weight: 500;
      }
      .email-cell-sub {
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
      .meta-tags {
        display: flex;
        flex-wrap: wrap;
        gap: 0.2rem;
        max-width: 220px;
      }
      .meta-tag {
        display: inline-block;
        padding: 0.05rem 0.35rem;
        border-radius: 3px;
        font-size: 0.65rem;
        line-height: 1.5;
        background: color-mix(in srgb, var(--alx-primary) 10%, transparent);
        color: var(--alx-primary);
        white-space: nowrap;
        max-width: 140px;
        overflow: hidden;
        text-overflow: ellipsis;
      }
      .meta-more {
        font-size: 0.6rem;
        color: var(--alx-primary);
        padding: 0.05rem 0.25rem;
        cursor: pointer;
        border-radius: 3px;
      }
      .meta-more:hover {
        background: color-mix(in srgb, var(--alx-primary) 10%, transparent);
      }
    `,
  ];

  @property({ type: String, reflect: true }) density: 'default' | 'compact' = 'default';
  @property({ type: Number }) page = 1;
  @property({ type: Number }) limit = 20;

  @state() private accounts: Account[] = [];
  @state() private total = 0;
  @state() private loading = false;
  @state() private error = '';
  @state() private statusFilter = '';
  @state() private providerFilter = '';

  private _api?: AccountAPI;
  private get api(): AccountAPI {
    if (!this._api) this._api = new AccountAPI();
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
      if (this.providerFilter) params['provider'] = this.providerFilter;

      const res = await this.api.list(params) as {
        accounts: Account[];
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

  private onEdit(account: Account): void {
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

  private onProviderChange(e: Event): void {
    this.providerFilter = (e.target as HTMLSelectElement).value;
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

  private async onDelete(e: Event, account: Account): Promise<void> {
    e.stopPropagation();
    if (!confirm(`Delete account "${account.email}"?`)) return;
    try {
      await this.api.remove(account._id);
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
    if (score > 80) return 'var(--alx-success)';
    if (score > 50) return 'var(--alx-warning)';
    return 'var(--alx-danger)';
  }

  private capacityColor(sent: number, limit: number): string {
    const remaining = (limit - sent) / limit;
    if (remaining > 0.5) return 'var(--alx-success)';
    if (remaining > 0.2) return 'var(--alx-warning)';
    return 'var(--alx-danger)';
  }

  /**
   * Scan all loaded accounts to find the top 3 metadata keys.
   * Prioritizes string-array keys (most accounts have them), then string keys.
   */
  private get metaColumns(): string[] {
    const freq = new Map<string, { count: number; isArray: boolean }>();
    for (const a of this.accounts) {
      if (!a.metadata) continue;
      for (const [key, val] of Object.entries(a.metadata)) {
        const isArr = Array.isArray(val) && val.length > 0 && typeof val[0] === 'string';
        const isStr = typeof val === 'string' && val.length > 0;
        if (!isArr && !isStr) continue;
        const existing = freq.get(key);
        if (existing) {
          existing.count++;
        } else {
          freq.set(key, { count: 1, isArray: isArr });
        }
      }
    }
    // Sort: arrays first, then by frequency desc
    return [...freq.entries()]
      .sort((a, b) => {
        if (a[1].isArray !== b[1].isArray) return a[1].isArray ? -1 : 1;
        return b[1].count - a[1].count;
      })
      .slice(0, 3)
      .map(([key]) => key);
  }

  private formatMetaKey(key: string): string {
    return key.replace(/_/g, ' ');
  }

  private getMetaValues(meta: Record<string, unknown> | undefined, key: string): string[] {
    if (!meta || !(key in meta)) return [];
    const val = meta[key];
    if (Array.isArray(val)) return val.filter((v): v is string => typeof v === 'string');
    if (typeof val === 'string' && val) return [val];
    return [];
  }

  private statusBadgeClass(status: string): string {
    switch (status) {
      case 'active':
        return 'alx-badge alx-badge-success';
      case 'disabled':
      case 'error':
        return 'alx-badge alx-badge-danger';
      case 'warmup':
        return 'alx-badge alx-badge-warning';
      default:
        return 'alx-badge alx-badge-muted';
    }
  }

  override render() {
    return html`
      <div class="alx-card">
        <div class="alx-card-header">
          <h3>Email Accounts</h3>
        </div>

        <div class="toolbar">
          <select @change=${this.onStatusChange}>
            <option value="">All Statuses</option>
            <option value="active">Active</option>
            <option value="warmup">Warmup</option>
            <option value="disabled">Disabled</option>
            <option value="error">Error</option>
          </select>

          <select @change=${this.onProviderChange}>
            <option value="">All Providers</option>
            <option value="gmail">Gmail</option>
            <option value="ses">SES</option>
          </select>

          <span class="spacer"></span>

          <button @click=${() => this.load()}>Refresh</button>
          <button class="alx-btn-primary" @click=${this.onCreate}>
            + Create
          </button>
        </div>

        ${this.error ? html`<div class="alx-error">${this.error}</div>` : ''}
        ${this.loading
          ? html`<div class="alx-loading"><div class="alx-spinner"></div></div>`
          : this.accounts.length === 0
            ? html`<div class="alx-empty">
  <p>Add your email accounts to start sending.</p>
  <p>Each account needs SMTP credentials (host, port, user, app password).</p>
  <button class="alx-btn-primary alx-btn-sm" style="margin-top:0.5rem" @click=${this.onCreate}>+ Create Account</button>
</div>`
            : html`
                <table>
                  <thead>
                    <tr>
                      <th>ACCOUNT</th>
                      <th>STATUS</th>
                      <th>HEALTH</th>
                      <th>TOTAL SENT</th>
                      <th>WARMUP</th>
                      ${this.metaColumns.map(k => html`<th>${this.formatMetaKey(k)}</th>`)}
                      <th></th>
                    </tr>
                  </thead>
                  <tbody>
                    ${this.accounts.map(
                      (a) => html`
                        <tr>
                          <td>
                            <div class="email-cell">
                              <div class="email-cell-main">${a.email}</div>
                              ${a.senderName
                                ? html`<div class="email-cell-sub">${a.senderName}</div>`
                                : ''}
                            </div>
                          </td>
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
                              <span class="progress-label">${a.health?.score ?? 0}</span>
                            </span>
                          </td>
                          <td>
                            <span class="capacity-text">${a.totalEmailsSent ?? 0}</span>
                          </td>
                          <td>
                            ${a.warmup?.enabled
                              ? html`<span class="alx-badge alx-badge-warning">Day ${a.warmup.currentDay ?? 0}</span>`
                              : html`<span class="alx-badge alx-badge-muted">Off</span>`}
                          </td>
                          ${this.metaColumns.map(key => {
                            const vals = this.getMetaValues(a.metadata, key);
                            if (vals.length === 0) return html`<td><span class="text-small text-muted">\u2014</span></td>`;
                            const show = vals.slice(0, 3);
                            const rest = vals.length - show.length;
                            return html`<td>
                              <div class="meta-tags">
                                ${show.map(v => html`<span class="meta-tag">${v}</span>`)}
                                ${rest > 0
                                  ? html`<span class="meta-more" title="${vals.join(', ')}" @click=${() => this.onEdit(a)}>+${rest}</span>`
                                  : ''}
                              </div>
                            </td>`;
                          })}
                          <td>
                            <div class="action-group">
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
safeRegister('alx-account-list', AlxAccountList);

declare global {
  interface HTMLElementTagNameMap {
    'alx-account-list': AlxAccountList;
  }
}
