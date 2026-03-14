import { LitElement, html, css } from 'lit';
import { customElement, state, property } from 'lit/decorators.js';
import { alxBaseStyles } from '../../styles/theme.js';
import {
  alxButtonStyles,
  alxCardStyles,
  alxBadgeStyles,
  alxLoadingStyles,
  alxTableStyles,
} from '../../styles/shared.js';
import { AccountAPI } from '../../api/account.api.js';

interface BounceInfo {
  _id: string;
  email: string;
  imapEnabled: boolean;
  lastChecked?: string;
  bouncesFound: number;
  status: string;
}

@customElement('alx-bounce-status')
export class AlxBounceStatus extends LitElement {
  static override styles = [
    alxBaseStyles,
    alxButtonStyles,
    alxCardStyles,
    alxBadgeStyles,
    alxLoadingStyles,
    alxTableStyles,
    css`
      .single-view {
        display: flex;
        flex-direction: column;
        gap: 0.75rem;
      }
      .info-row {
        display: flex;
        justify-content: space-between;
        padding: 0.5rem 0;
        border-bottom: 1px solid var(--alx-border);
        font-size: 0.875rem;
      }
      .info-label {
        color: var(--alx-text-muted);
      }
      .actions {
        margin-top: 1rem;
      }
    `,
  ];

  @property({ attribute: 'account-id' }) accountId = '';

  @state() private accounts: BounceInfo[] = [];
  @state() private single: BounceInfo | null = null;
  @state() private loading = false;
  @state() private checking = false;
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
      if (this.accountId) {
        const health = (await this.api.getHealth(this.accountId)) as BounceInfo;
        this.single = health;
      } else {
        const res = (await this.api.getAllHealth()) as BounceInfo[] | { data: BounceInfo[] };
        this.accounts = Array.isArray(res) ? res : (res.data ?? []);
      }
    } catch (e) {
      this.error = e instanceof Error ? e.message : 'Failed to load bounce status';
    } finally {
      this.loading = false;
    }
  }

  private async onCheckNow(accountId: string): Promise<void> {
    this.checking = true;
    try {
      await this.api.testConnection(accountId);
      await this.load();
    } catch (e) {
      this.error = e instanceof Error ? e.message : 'Check failed';
    } finally {
      this.checking = false;
    }
  }

  private formatDate(dateStr?: string): string {
    if (!dateStr) return 'Never';
    return new Date(dateStr).toLocaleString();
  }

  private renderSingle() {
    const b = this.single;
    if (!b) return html`<div class="alx-empty">No bounce data</div>`;

    return html`
      <div class="single-view">
        <div class="info-row">
          <span class="info-label">IMAP Enabled</span>
          <span>${b.imapEnabled ? html`<span class="alx-badge alx-badge-success">Yes</span>` : html`<span class="alx-badge alx-badge-muted">No</span>`}</span>
        </div>
        <div class="info-row">
          <span class="info-label">Last Checked</span>
          <span>${this.formatDate(b.lastChecked)}</span>
        </div>
        <div class="info-row">
          <span class="info-label">Bounces Found</span>
          <span>${b.bouncesFound}</span>
        </div>
        <div class="info-row">
          <span class="info-label">Status</span>
          <span class="alx-badge ${b.status === 'active' ? 'alx-badge-success' : 'alx-badge-warning'}">${b.status}</span>
        </div>
        <div class="actions">
          <button class="alx-btn-primary" ?disabled=${this.checking} @click=${() => this.onCheckNow(this.accountId)}>
            ${this.checking ? 'Checking...' : 'Check Now'}
          </button>
        </div>
      </div>
    `;
  }

  private renderTable() {
    if (this.accounts.length === 0) {
      return html`<div class="alx-empty">No accounts</div>`;
    }

    return html`
      <table>
        <thead>
          <tr>
            <th>Email</th>
            <th>IMAP</th>
            <th>Last Checked</th>
            <th>Bounces</th>
            <th>Actions</th>
          </tr>
        </thead>
        <tbody>
          ${this.accounts.map(
            (a) => html`
              <tr>
                <td>${a.email}</td>
                <td>
                  ${a.imapEnabled
                    ? html`<span class="alx-badge alx-badge-success">On</span>`
                    : html`<span class="alx-badge alx-badge-muted">Off</span>`}
                </td>
                <td>${this.formatDate(a.lastChecked)}</td>
                <td>${a.bouncesFound}</td>
                <td>
                  <button class="alx-btn-sm" ?disabled=${this.checking} @click=${() => this.onCheckNow(a._id)}>
                    Check Now
                  </button>
                </td>
              </tr>
            `,
          )}
        </tbody>
      </table>
    `;
  }

  override render() {
    return html`
      <div class="alx-card">
        <div class="alx-card-header">
          <h3>Bounce Status</h3>
        </div>

        ${this.error ? html`<div class="alx-error">${this.error}</div>` : ''}
        ${this.loading
          ? html`<div class="alx-loading"><div class="alx-spinner"></div></div>`
          : this.accountId
            ? this.renderSingle()
            : this.renderTable()}
      </div>
    `;
  }
}

declare global {
  interface HTMLElementTagNameMap {
    'alx-bounce-status': AlxBounceStatus;
  }
}
