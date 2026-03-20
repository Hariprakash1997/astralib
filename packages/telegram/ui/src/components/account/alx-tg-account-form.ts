import { LitElement, html, css } from 'lit';
import { state, property } from 'lit/decorators.js';
import { safeRegister } from '../../utils/safe-register.js';
import { alxBaseStyles } from '../../styles/theme.js';
import {
  alxDensityStyles,
  alxButtonStyles,
  alxInputStyles,
  alxCardStyles,
  alxLoadingStyles,
} from '../../styles/shared.js';
import { TelegramAccountAPI } from '../../api/account.api.js';

export class AlxTgAccountForm extends LitElement {
  static override styles = [
    alxBaseStyles,
    alxDensityStyles,
    alxButtonStyles,
    alxInputStyles,
    alxCardStyles,
    alxLoadingStyles,
    css`
      :host {
        display: block;
      }
      .form-row {
        gap: 0.625rem;
      }
      .form-group.full {
        grid-column: 1 / -1;
      }
      .form-section-title {
        grid-column: 1 / -1;
        margin-top: 0.5rem;
      }
      .form-actions {
        justify-content: space-between;
      }
      .form-actions-end {
        display: flex;
        gap: 0.5rem;
      }
      .field-help {
        display: block;
        font-size: 0.65rem;
        color: var(--alx-text-muted);
        margin-top: 0.15rem;
      }
    `,
  ];

  @property({ type: String, reflect: true }) density: 'default' | 'compact' = 'default';
  @property({ type: Boolean, attribute: 'hide-header' }) hideHeader = false;
  @property({ attribute: 'account-id' }) accountId = '';

  @state() private phone = '';
  @state() private name = '';
  @state() private session = '';
  @state() private dailyLimit = 50;
  @state() private delayMin = 30;
  @state() private delayMax = 90;
  @state() private loading = false;
  @state() private saving = false;
  @state() private tags = '';
  @state() private error = '';

  private _api?: TelegramAccountAPI;
  private get api(): TelegramAccountAPI {
    if (!this._api) this._api = new TelegramAccountAPI();
    return this._api;
  }

  override willUpdate(changed: Map<PropertyKey, unknown>): void {
    if (changed.has('accountId')) {
      if (this.accountId) {
        this.loadAccount();
      } else {
        this._resetForm();
      }
    }
  }

  private _resetForm(): void {
    this.phone = '';
    this.name = '';
    this.session = '';
    this.dailyLimit = 50;
    this.delayMin = 30;
    this.delayMax = 90;
    this.tags = '';
    this.error = '';
  }

  private async loadAccount(): Promise<void> {
    this.loading = true;
    this.error = '';
    try {
      const account = (await this.api.getAccount(this.accountId)) as Record<string, unknown>;
      this.phone = (account['phone'] as string) ?? '';
      this.name = (account['name'] as string) ?? '';
      this.session = (account['session'] as string) ?? '';
      this.dailyLimit = (account['dailyLimit'] as number) ?? 50;
      this.delayMin = (account['delayMin'] as number) ?? 30;
      this.delayMax = (account['delayMax'] as number) ?? 90;
      this.tags = Array.isArray(account['tags']) ? (account['tags'] as string[]).join(', ') : '';
    } catch (e) {
      this.error = e instanceof Error ? e.message : 'Failed to load account';
    } finally {
      this.loading = false;
    }
  }

  private async onSubmit(e: Event): Promise<void> {
    e.preventDefault();
    if (!this.phone) {
      this.error = 'Phone number is required';
      return;
    }
    if (this.delayMin > this.delayMax) {
      this.error = 'Delay Min cannot be greater than Delay Max';
      return;
    }

    this.saving = true;
    this.error = '';

    const data: Record<string, unknown> = {
      phone: this.phone,
      name: this.name,
      session: this.session,
      dailyLimit: this.dailyLimit,
      delayMin: this.delayMin,
      delayMax: this.delayMax,
      tags: this.tags.split(',').map(t => t.trim()).filter(Boolean),
    };

    try {
      let result: unknown;
      if (this.accountId) {
        result = await this.api.updateAccount(this.accountId, data);
      } else {
        result = await this.api.createAccount(data);
      }
      this.dispatchEvent(
        new CustomEvent('alx-saved', {
          detail: result,
          bubbles: true,
          composed: true,
        }),
      );
    } catch (e) {
      this.error = e instanceof Error ? e.message : 'Failed to save account';
    } finally {
      this.saving = false;
    }
  }

  private onCancel(): void {
    this.dispatchEvent(
      new CustomEvent('alx-cancelled', {
        bubbles: true,
        composed: true,
      }),
    );
  }

  private async onDelete(): Promise<void> {
    if (!this.accountId) return;
    if (!confirm('Delete this account?')) return;
    this.saving = true;
    this.error = '';
    try {
      await this.api.deleteAccount(this.accountId);
      this.dispatchEvent(
        new CustomEvent('alx-deleted', {
          detail: { _id: this.accountId },
          bubbles: true,
          composed: true,
        }),
      );
    } catch (e) {
      this.error = e instanceof Error ? e.message : 'Failed to delete account';
    } finally {
      this.saving = false;
    }
  }

  override render() {
    if (this.loading) {
      return html`<div class="alx-loading"><div class="alx-spinner"></div></div>`;
    }

    return html`
      <div class="alx-card">
        ${this.hideHeader ? '' : html`<div class="alx-card-header"><h3>${this.accountId ? 'Edit Account' : 'Add Account'}</h3></div>`}

        ${this.error ? html`<div class="alx-error">${this.error}</div>` : ''}

        <form @submit=${this.onSubmit}>
          <div class="form-row">
            <div class="form-group">
              <label>Phone *</label>
              <input
                type="text"
                .value=${this.phone}
                @input=${(e: Event) => (this.phone = (e.target as HTMLInputElement).value)}
                placeholder="+1234567890"
                required
              />
            </div>
            <div class="form-group">
              <label>Name</label>
              <input
                type="text"
                .value=${this.name}
                @input=${(e: Event) => (this.name = (e.target as HTMLInputElement).value)}
                placeholder="Account name"
              />
            </div>
            <div class="form-group">
              <label>Tags</label>
              <input
                type="text"
                .value=${this.tags}
                @input=${(e: Event) => (this.tags = (e.target as HTMLInputElement).value)}
                placeholder="sales, outreach"
              />
            </div>

            <div class="form-group full">
              <label>Session Key</label>
              <small class="field-help">Authentication token for this Telegram account. Generated via the session setup flow (phone verification + OTP code).</small>
              <textarea
                rows="3"
                .value=${this.session}
                @input=${(e: Event) => (this.session = (e.target as HTMLTextAreaElement).value)}
                placeholder="Paste StringSession here..."
              ></textarea>
            </div>

            <div class="form-section-title">Send Limits</div>
            <div class="form-group">
              <label>Daily Limit</label>
              <input
                type="number"
                .value=${String(this.dailyLimit)}
                @input=${(e: Event) => (this.dailyLimit = Number((e.target as HTMLInputElement).value))}
                min="1"
              />
              <small class="field-help">Recommended: 10-50 for new accounts, up to 100 for established ones</small>
            </div>
            <div class="form-group">
              <label>Delay Min (seconds)</label>
              <input
                type="number"
                .value=${String(this.delayMin)}
                @input=${(e: Event) => (this.delayMin = Number((e.target as HTMLInputElement).value))}
                min="1"
              />
              <small class="field-help">Seconds between messages. Recommended: 30-90s minimum</small>
            </div>
            <div class="form-group">
              <label>Delay Max (seconds)</label>
              <input
                type="number"
                .value=${String(this.delayMax)}
                @input=${(e: Event) => (this.delayMax = Number((e.target as HTMLInputElement).value))}
                min="1"
              />
            </div>
          </div>

          <div class="form-actions">
            <div>
              ${this.accountId
                ? html`<button
                    type="button"
                    class="alx-btn-danger"
                    ?disabled=${this.saving}
                    @click=${this.onDelete}
                  >Delete Account</button>`
                : ''}
            </div>
            <div class="form-actions-end">
              <button type="button" @click=${this.onCancel}>Cancel</button>
              <button type="submit" class="alx-btn-primary" ?disabled=${this.saving}>
                ${this.saving ? 'Saving...' : this.accountId ? 'Update' : 'Create'}
              </button>
            </div>
          </div>
        </form>
      </div>
    `;
  }
}
safeRegister('alx-tg-account-form', AlxTgAccountForm);

declare global {
  interface HTMLElementTagNameMap {
    'alx-tg-account-form': AlxTgAccountForm;
  }
}
