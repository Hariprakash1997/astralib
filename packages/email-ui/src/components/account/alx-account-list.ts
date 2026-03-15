import { LitElement, html, css } from 'lit';
import { customElement, state, property } from 'lit/decorators.js';
import { alxBaseStyles } from '../../styles/theme.js';
import {
  alxButtonStyles,
  alxInputStyles,
  alxTableStyles,
  alxBadgeStyles,
  alxLoadingStyles,
  alxCardStyles,
} from '../../styles/shared.js';
import { AccountAPI } from '../../api/account.api.js';

interface Account {
  _id: string;
  email: string;
  senderName?: string;
  provider: string;
  status: string;
  healthScore?: number;
  dailyLimit?: number;
  sentToday?: number;
  warmupActive?: boolean;
}

@customElement('alx-account-list')
export class AlxAccountList extends LitElement {
  static override styles = [
    alxBaseStyles,
    alxButtonStyles,
    alxInputStyles,
    alxTableStyles,
    alxBadgeStyles,
    alxLoadingStyles,
    alxCardStyles,
    css`
      .toolbar {
        display: flex;
        align-items: center;
        gap: 0.75rem;
        margin-bottom: 1rem;
        flex-wrap: wrap;
      }
      .toolbar select {
        width: auto;
        min-width: 140px;
      }
      .spacer {
        flex: 1;
      }
      tr[data-clickable] {
        cursor: pointer;
      }
      .health-bar {
        display: inline-block;
        width: 60px;
        height: 8px;
        background: var(--alx-border);
        border-radius: 4px;
        overflow: hidden;
        vertical-align: middle;
        margin-right: 0.5rem;
      }
      .health-bar-fill {
        height: 100%;
        border-radius: 4px;
        transition: width 0.3s;
      }
      .capacity-bar {
        display: inline-block;
        width: 80px;
        height: 8px;
        background: var(--alx-border);
        border-radius: 4px;
        overflow: hidden;
        vertical-align: middle;
        margin-right: 0.5rem;
      }
      .capacity-bar-fill {
        height: 100%;
        border-radius: 4px;
      }
      .pagination {
        display: flex;
        align-items: center;
        justify-content: center;
        gap: 0.75rem;
        margin-top: 1rem;
      }
    `,
  ];

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

  private onRowClick(account: Account): void {
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
            ? html`<div class="alx-empty">No accounts found</div>`
            : html`
                <table>
                  <thead>
                    <tr>
                      <th>Email</th>
                      <th>Provider</th>
                      <th>Status</th>
                      <th>Health</th>
                      <th>Capacity</th>
                      <th>Warmup</th>
                    </tr>
                  </thead>
                  <tbody>
                    ${this.accounts.map(
                      (a) => html`
                        <tr
                          data-clickable
                          @click=${() => this.onRowClick(a)}
                        >
                          <td>${a.email}</td>
                          <td>${a.provider}</td>
                          <td>
                            <span class=${this.statusBadgeClass(a.status)}>
                              ${a.status}
                            </span>
                          </td>
                          <td>
                            <span class="health-bar">
                              <span
                                class="health-bar-fill"
                                style="width:${a.healthScore ?? 0}%;background:${this.healthColor(a.healthScore ?? 0)}"
                              ></span>
                            </span>
                            ${a.healthScore ?? 0}
                          </td>
                          <td>
                            <span class="capacity-bar">
                              <span
                                class="capacity-bar-fill"
                                style="width:${a.dailyLimit ? ((a.sentToday ?? 0) / a.dailyLimit) * 100 : 0}%;background:${this.capacityColor(a.sentToday ?? 0, a.dailyLimit ?? 1)}"
                              ></span>
                            </span>
                            ${a.sentToday ?? 0}/${a.dailyLimit ?? 0}
                          </td>
                          <td>
                            ${a.warmupActive
                              ? html`<span class="alx-badge alx-badge-warning">Active</span>`
                              : html`<span class="alx-badge alx-badge-muted">Off</span>`}
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

declare global {
  interface HTMLElementTagNameMap {
    'alx-account-list': AlxAccountList;
  }
}
