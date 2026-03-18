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
  alxTooltipStyles,
} from '../../styles/shared.js';
import { AccountAPI } from '../../api/account.api.js';
import './alx-metadata-editor.js';

export class AlxAccountForm extends LitElement {
  static override styles = [
    alxBaseStyles,
    alxDensityStyles,
    alxButtonStyles,
    alxInputStyles,
    alxCardStyles,
    alxLoadingStyles,
    alxTooltipStyles,
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
      .imap-toggle {
        grid-column: 1 / -1;
        display: flex;
        align-items: center;
        gap: 0.5rem;
        margin-top: 0.25rem;
      }
      .imap-toggle input[type='checkbox'] {
        width: auto;
      }
      .imap-toggle label {
        margin-bottom: 0;
        text-transform: none;
        font-size: 0.8125rem;
        color: var(--alx-text);
        cursor: pointer;
      }
      .imap-derived {
        grid-column: 1 / -1;
        font-size: 0.75rem;
        color: var(--alx-text-muted);
        padding: 0.375rem 0.625rem;
        background: color-mix(in srgb, var(--alx-info) 6%, transparent);
        border-radius: var(--alx-radius);
        display: flex;
        align-items: center;
        justify-content: space-between;
      }
      .imap-derived code {
        font-size: 0.7rem;
      }
      .imap-customize {
        font-size: 0.7rem;
        color: var(--alx-primary);
        cursor: pointer;
        background: none;
        border: none;
        padding: 0;
        font-family: inherit;
      }
      .imap-customize:hover {
        text-decoration: underline;
      }
    `,
  ];

  @property({ type: String, reflect: true }) density: 'default' | 'compact' = 'default';
  @property({ type: Boolean, attribute: 'hide-header' }) hideHeader = false;
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
  @state() private metadata: Record<string, string | string[]> = {};
  @state() private imapEnabled = true;
  @state() private imapCustom = false;
  @state() private _showHelp = false;
  @state() private loading = false;
  @state() private saving = false;
  @state() private _deleting = false;
  @state() private error = '';

  private _api?: AccountAPI;
  private get api(): AccountAPI {
    if (!this._api) this._api = new AccountAPI();
    return this._api;
  }

  constructor() {
    super();
    this._showHelp = localStorage.getItem('alx-help-account') === 'true';
  }

  private _toggleHelp(): void {
    this._showHelp = !this._showHelp;
    localStorage.setItem('alx-help-account', String(this._showHelp));
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
    this.email = '';
    this.senderName = '';
    this.provider = 'gmail';
    this.smtpHost = '';
    this.smtpPort = 587;
    this.smtpUser = '';
    this.smtpPass = '';
    this.imapHost = '';
    this.imapPort = 993;
    this.imapUser = '';
    this.imapPass = '';
    this.imapEnabled = true;
    this.imapCustom = false;
    this.metadata = {};
    this.error = '';
  }

  private async loadAccount(): Promise<void> {
    this.loading = true;
    this.error = '';
    try {
      const account = (await this.api.getById(this.accountId)) as Record<string, unknown>;
      this.email = (account['email'] as string) ?? '';
      this.senderName = (account['senderName'] as string) ?? '';
      this.provider = (account['provider'] as 'gmail' | 'ses') ?? 'gmail';
      const smtp = (account['smtp'] as Record<string, unknown>) ?? {};
      this.smtpHost = (smtp['host'] as string) ?? '';
      this.smtpPort = (smtp['port'] as number) ?? 587;
      this.smtpUser = (smtp['user'] as string) ?? '';
      this.smtpPass = (smtp['pass'] as string) ?? '';
      const imap = (account['imap'] as Record<string, unknown>) ?? {};
      this.imapHost = (imap['host'] as string) ?? '';
      this.imapPort = (imap['port'] as number) ?? 993;
      this.imapUser = (imap['user'] as string) ?? '';
      this.imapPass = (imap['pass'] as string) ?? '';
      // For Gmail, default IMAP to enabled (auto-derived) even if not stored
      this.imapEnabled = this.provider === 'gmail' ? true : !!this.imapHost;
      if (this.provider === 'gmail' && this.imapHost) {
        this.imapCustom = this.imapHost !== 'imap.gmail.com'
          || this.imapPort !== 993
          || (this.imapUser !== '' && this.imapUser !== this.smtpUser);
      } else {
        this.imapCustom = !!this.imapHost;
      }
      this.metadata = (account['metadata'] as Record<string, string | string[]>) ?? {};
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
    if (this.smtpHost && (this.smtpPort < 1 || this.smtpPort > 65535)) {
      this.error = 'SMTP port must be between 1 and 65535';
      return;
    }

    this.saving = true;
    this.error = '';

    const data: Record<string, unknown> = {
      email: this.email,
      senderName: this.senderName,
      provider: this.provider,
      smtp: {
        host: this.smtpHost,
        port: this.smtpPort,
        user: this.smtpUser,
        pass: this.smtpPass,
      },
      metadata: this.metadata,
    };

    if (this.provider === 'gmail' && this.imapEnabled) {
      if (this.imapCustom) {
        data['imap'] = {
          host: this.imapHost,
          port: this.imapPort,
          user: this.imapUser,
          pass: this.imapPass,
        };
      } else {
        // Auto-derive from SMTP credentials
        data['imap'] = {
          host: 'imap.gmail.com',
          port: 993,
          user: this.smtpUser,
          pass: this.smtpPass,
        };
      }
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

  private async onDelete(): Promise<void> {
    if (!this.accountId) return;
    if (!confirm('Delete this account?')) return;
    this._deleting = true;
    this.error = '';
    try {
      await this.api.remove(this.accountId);
      this.dispatchEvent(
        new CustomEvent('alx-account-deleted', {
          detail: { _id: this.accountId },
          bubbles: true,
          composed: true,
        }),
      );
    } catch (e) {
      this.error = e instanceof Error ? e.message : 'Failed to delete account';
    } finally {
      this._deleting = false;
    }
  }

  private onSmtpFieldChange(field: 'host' | 'port' | 'user' | 'pass', value: string): void {
    if (field === 'host') this.smtpHost = value;
    else if (field === 'port') this.smtpPort = Number(value);
    else if (field === 'user') this.smtpUser = value;
    else this.smtpPass = value;
  }

  private onImapFieldChange(field: 'host' | 'port' | 'user' | 'pass', value: string): void {
    if (field === 'host') this.imapHost = value;
    else if (field === 'port') this.imapPort = Number(value);
    else if (field === 'user') this.imapUser = value;
    else this.imapPass = value;
  }

  private onMetadataChange(e: Event): void {
    this.metadata = (e as CustomEvent).detail;
  }

  override render() {
    if (this.loading) {
      return html`<div class="alx-loading"><div class="alx-spinner"></div></div>`;
    }

    return html`
      <div class="alx-card">
        ${this.hideHeader ? '' : html`<div class="alx-card-header"><h3>${this.accountId ? 'Edit Account' : 'Create Account'}</h3></div>`}

        <div style="display:flex;justify-content:flex-end;margin-bottom:0.25rem">
          <button class="help-toggle ${this._showHelp ? 'open' : ''}" @click=${this._toggleHelp}>?</button>
        </div>
        ${this._showHelp ? html`
          <div class="help-panel">
            <strong>How to set up an email account:</strong>
            <ul>
              <li><strong>Email</strong> — The sender email address your recipients will see</li>
              <li><strong>Sender Name</strong> — Display name shown in inbox (e.g. "Aryashree Nair")</li>
              <li><strong>Provider</strong> — Gmail or AWS SES. This determines SMTP settings.</li>
              <li><strong>SMTP</strong> — Server settings for sending emails. For Gmail: host = smtp.gmail.com, port = 465, user = your email, password = App Password (not your login password)</li>
              <li><strong>IMAP</strong> — For Gmail, this auto-detects bounced emails. Enabled by default, uses same credentials as SMTP.</li>
              <li><strong>Metadata</strong> — Custom key-value data attached to this account (e.g. sender names, contact numbers)</li>
            </ul>
          </div>
        ` : ''}

        ${this.error ? html`<div class="alx-error">${this.error}</div>` : ''}

        <form @submit=${this.onSubmit}>
          <div class="form-row">
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

            <div class="form-section-title">SMTP Configuration</div>
            <div class="form-group">
              <label>SMTP Host</label>
              <input
                type="text"
                .value=${this.smtpHost}
                @input=${(e: Event) => this.onSmtpFieldChange('host', (e.target as HTMLInputElement).value)}
                placeholder="smtp.gmail.com"
              />
            </div>
            <div class="form-group">
              <label>SMTP Port</label>
              <input
                type="number"
                .value=${String(this.smtpPort)}
                @input=${(e: Event) => this.onSmtpFieldChange('port', (e.target as HTMLInputElement).value)}
                placeholder="465 for SSL, 587 for TLS"
              />
            </div>
            <div class="form-group">
              <label>SMTP User</label>
              <input
                type="text"
                .value=${this.smtpUser}
                @input=${(e: Event) => this.onSmtpFieldChange('user', (e.target as HTMLInputElement).value)}
                placeholder="user@gmail.com"
              />
            </div>
            <div class="form-group">
              <label>SMTP Password</label>
              <input
                type="password"
                .value=${this.smtpPass}
                @input=${(e: Event) => this.onSmtpFieldChange('pass', (e.target as HTMLInputElement).value)}
                placeholder="App password"
              />
              <span class="info-line">For Gmail, use an App Password from myaccount.google.com</span>
            </div>

            ${this.provider === 'gmail'
              ? html`
                  <div class="form-section-title">IMAP Bounce Checking</div>
                  <div class="imap-toggle">
                    <input
                      type="checkbox"
                      id="imap-enabled"
                      .checked=${this.imapEnabled}
                      @change=${(e: Event) => { this.imapEnabled = (e.target as HTMLInputElement).checked; }}
                    />
                    <label for="imap-enabled">Enable IMAP bounce checking</label>
                  </div>
                  ${this.imapEnabled && !this.imapCustom
                    ? html`
                        <div class="imap-derived">
                          <span>Using <code>imap.gmail.com:993</code> with same SMTP credentials</span>
                          <button type="button" class="imap-customize" @click=${() => {
                            this.imapCustom = true;
                            this.imapHost = 'imap.gmail.com';
                            this.imapPort = 993;
                            this.imapUser = this.smtpUser;
                            this.imapPass = this.smtpPass;
                          }}>Customize</button>
                        </div>
                      `
                    : ''}
                  ${this.imapEnabled && this.imapCustom
                    ? html`
                        <div class="form-group">
                          <label>IMAP Host</label>
                          <input
                            type="text"
                            .value=${this.imapHost}
                            @input=${(e: Event) => this.onImapFieldChange('host', (e.target as HTMLInputElement).value)}
                            placeholder="imap.gmail.com"
                          />
                        </div>
                        <div class="form-group">
                          <label>IMAP Port</label>
                          <input
                            type="number"
                            .value=${String(this.imapPort)}
                            @input=${(e: Event) => this.onImapFieldChange('port', (e.target as HTMLInputElement).value)}
                          />
                        </div>
                        <div class="form-group">
                          <label>IMAP User</label>
                          <input
                            type="text"
                            .value=${this.imapUser}
                            @input=${(e: Event) => this.onImapFieldChange('user', (e.target as HTMLInputElement).value)}
                            placeholder="user@gmail.com"
                          />
                        </div>
                        <div class="form-group">
                          <label>IMAP Password</label>
                          <input
                            type="password"
                            .value=${this.imapPass}
                            @input=${(e: Event) => this.onImapFieldChange('pass', (e.target as HTMLInputElement).value)}
                            placeholder="App password"
                          />
                        </div>
                      `
                    : ''}
                `
              : ''}

            <div class="form-section-title">Metadata</div>
            <div class="form-group full">
              <alx-metadata-editor
                .value=${this.metadata}
                @metadata-change=${this.onMetadataChange}
              ></alx-metadata-editor>
            </div>
          </div>

          <div class="form-actions">
            <div>
              ${this.accountId
                ? html`<button
                    type="button"
                    class="alx-btn-danger"
                    ?disabled=${this._deleting}
                    @click=${this.onDelete}
                  >${this._deleting ? 'Deleting...' : 'Delete Account'}</button>`
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
safeRegister('alx-account-form', AlxAccountForm);

declare global {
  interface HTMLElementTagNameMap {
    'alx-account-form': AlxAccountForm;
  }
}
