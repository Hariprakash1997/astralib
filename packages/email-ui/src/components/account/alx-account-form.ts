import { LitElement, html, css } from 'lit';
import { customElement, state, property } from 'lit/decorators.js';
import { alxBaseStyles } from '../../styles/theme.js';
import {
  alxButtonStyles,
  alxInputStyles,
  alxCardStyles,
  alxLoadingStyles,
} from '../../styles/shared.js';
import { AccountAPI } from '../../api/account.api.js';

@customElement('alx-account-form')
export class AlxAccountForm extends LitElement {
  static override styles = [
    alxBaseStyles,
    alxButtonStyles,
    alxInputStyles,
    alxCardStyles,
    alxLoadingStyles,
    css`
      .form-grid {
        display: grid;
        grid-template-columns: 1fr 1fr;
        gap: 1rem;
      }
      .form-group {
        display: flex;
        flex-direction: column;
      }
      .form-group.full {
        grid-column: 1 / -1;
      }
      .section-title {
        font-size: 0.9rem;
        font-weight: 600;
        color: var(--alx-text-muted);
        text-transform: uppercase;
        letter-spacing: 0.05em;
        margin: 1.25rem 0 0.5rem;
        grid-column: 1 / -1;
      }
      .actions {
        display: flex;
        gap: 0.75rem;
        justify-content: flex-end;
        margin-top: 1.25rem;
      }
      input[type='number'] {
        width: 100%;
      }
    `,
  ];

  @property({ attribute: 'account-id' }) accountId = '';

  @state() private email = '';
  @state() private senderName = '';
  @state() private provider: 'gmail' | 'ses' = 'gmail';
  @state() private smtpHost = '';
  @state() private smtpPort = 587;
  @state() private smtpUser = '';
  @state() private smtpPass = '';
  @state() private imapHost = '';
  @state() private imapPort = 993;
  @state() private imapUser = '';
  @state() private imapPass = '';
  @state() private loading = false;
  @state() private saving = false;
  @state() private error = '';

  private _api?: AccountAPI;
  private get api(): AccountAPI {
    if (!this._api) this._api = new AccountAPI();
    return this._api;
  }

  override connectedCallback(): void {
    super.connectedCallback();
    if (this.accountId) this.loadAccount();
  }

  private async loadAccount(): Promise<void> {
    this.loading = true;
    this.error = '';
    try {
      const account = (await this.api.getById(this.accountId)) as Record<string, unknown>;
      this.email = (account['email'] as string) ?? '';
      this.senderName = (account['senderName'] as string) ?? '';
      this.provider = (account['provider'] as 'gmail' | 'ses') ?? 'gmail';
      const smtp = (account['smtpConfig'] as Record<string, unknown>) ?? {};
      this.smtpHost = (smtp['host'] as string) ?? '';
      this.smtpPort = (smtp['port'] as number) ?? 587;
      this.smtpUser = (smtp['user'] as string) ?? '';
      this.smtpPass = (smtp['pass'] as string) ?? '';
      const imap = (account['imapConfig'] as Record<string, unknown>) ?? {};
      this.imapHost = (imap['host'] as string) ?? '';
      this.imapPort = (imap['port'] as number) ?? 993;
      this.imapUser = (imap['user'] as string) ?? '';
      this.imapPass = (imap['pass'] as string) ?? '';
    } catch (e) {
      this.error = e instanceof Error ? e.message : 'Failed to load account';
    } finally {
      this.loading = false;
    }
  }

  private async onSubmit(e: Event): Promise<void> {
    e.preventDefault();
    if (!this.email) {
      this.error = 'Email is required';
      return;
    }

    this.saving = true;
    this.error = '';

    const data: Record<string, unknown> = {
      email: this.email,
      senderName: this.senderName,
      provider: this.provider,
      smtpConfig: {
        host: this.smtpHost,
        port: this.smtpPort,
        user: this.smtpUser,
        pass: this.smtpPass,
      },
    };

    if (this.provider === 'gmail') {
      data['imapConfig'] = {
        host: this.imapHost,
        port: this.imapPort,
        user: this.imapUser,
        pass: this.imapPass,
      };
    }

    try {
      let result: unknown;
      if (this.accountId) {
        result = await this.api.update(this.accountId, data);
      } else {
        result = await this.api.create(data);
      }
      this.dispatchEvent(
        new CustomEvent('alx-account-saved', {
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
      new CustomEvent('alx-account-cancelled', {
        bubbles: true,
        composed: true,
      }),
    );
  }

  private showImap(): boolean {
    return this.provider === 'gmail';
  }

  override render() {
    if (this.loading) {
      return html`<div class="alx-loading"><div class="alx-spinner"></div></div>`;
    }

    return html`
      <div class="alx-card">
        <div class="alx-card-header">
          <h3>${this.accountId ? 'Edit Account' : 'Create Account'}</h3>
        </div>

        ${this.error ? html`<div class="alx-error">${this.error}</div>` : ''}

        <form @submit=${this.onSubmit}>
          <div class="form-grid">
            <div class="form-group">
              <label>Email *</label>
              <input
                type="email"
                .value=${this.email}
                @input=${(e: Event) => (this.email = (e.target as HTMLInputElement).value)}
                placeholder="sender@example.com"
                required
              />
            </div>
            <div class="form-group">
              <label>Sender Name</label>
              <input
                type="text"
                .value=${this.senderName}
                @input=${(e: Event) => (this.senderName = (e.target as HTMLInputElement).value)}
                placeholder="Display Name"
              />
            </div>
            <div class="form-group">
              <label>Provider</label>
              <select
                .value=${this.provider}
                @change=${(e: Event) => (this.provider = (e.target as HTMLSelectElement).value as 'gmail' | 'ses')}
              >
                <option value="gmail">Gmail</option>
                <option value="ses">AWS SES</option>
              </select>
            </div>

            <div class="section-title">SMTP Configuration</div>
            <div class="form-group">
              <label>SMTP Host</label>
              <input
                type="text"
                .value=${this.smtpHost}
                @input=${(e: Event) => (this.smtpHost = (e.target as HTMLInputElement).value)}
                placeholder="smtp.gmail.com"
              />
            </div>
            <div class="form-group">
              <label>SMTP Port</label>
              <input
                type="number"
                .value=${String(this.smtpPort)}
                @input=${(e: Event) => (this.smtpPort = Number((e.target as HTMLInputElement).value))}
              />
            </div>
            <div class="form-group">
              <label>SMTP User</label>
              <input
                type="text"
                .value=${this.smtpUser}
                @input=${(e: Event) => (this.smtpUser = (e.target as HTMLInputElement).value)}
                placeholder="user@gmail.com"
              />
            </div>
            <div class="form-group">
              <label>SMTP Password</label>
              <input
                type="password"
                .value=${this.smtpPass}
                @input=${(e: Event) => (this.smtpPass = (e.target as HTMLInputElement).value)}
                placeholder="App password"
              />
            </div>

            ${this.showImap()
              ? html`
                  <div class="section-title">IMAP Configuration</div>
                  <div class="form-group">
                    <label>IMAP Host</label>
                    <input
                      type="text"
                      .value=${this.imapHost}
                      @input=${(e: Event) => (this.imapHost = (e.target as HTMLInputElement).value)}
                      placeholder="imap.gmail.com"
                    />
                  </div>
                  <div class="form-group">
                    <label>IMAP Port</label>
                    <input
                      type="number"
                      .value=${String(this.imapPort)}
                      @input=${(e: Event) => (this.imapPort = Number((e.target as HTMLInputElement).value))}
                    />
                  </div>
                  <div class="form-group">
                    <label>IMAP User</label>
                    <input
                      type="text"
                      .value=${this.imapUser}
                      @input=${(e: Event) => (this.imapUser = (e.target as HTMLInputElement).value)}
                      placeholder="user@gmail.com"
                    />
                  </div>
                  <div class="form-group">
                    <label>IMAP Password</label>
                    <input
                      type="password"
                      .value=${this.imapPass}
                      @input=${(e: Event) => (this.imapPass = (e.target as HTMLInputElement).value)}
                      placeholder="App password"
                    />
                  </div>
                `
              : ''}
          </div>

          <div class="actions">
            <button type="button" @click=${this.onCancel}>Cancel</button>
            <button type="submit" class="alx-btn-primary" ?disabled=${this.saving}>
              ${this.saving ? 'Saving...' : this.accountId ? 'Update' : 'Create'}
            </button>
          </div>
        </form>
      </div>
    `;
  }
}

declare global {
  interface HTMLElementTagNameMap {
    'alx-account-form': AlxAccountForm;
  }
}
