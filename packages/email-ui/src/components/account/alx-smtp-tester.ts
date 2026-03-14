import { LitElement, html, css } from 'lit';
import { customElement, state, property } from 'lit/decorators.js';
import { alxBaseStyles } from '../../styles/theme.js';
import {
  alxButtonStyles,
  alxCardStyles,
  alxLoadingStyles,
} from '../../styles/shared.js';
import { AccountAPI } from '../../api/account.api.js';

@customElement('alx-smtp-tester')
export class AlxSmtpTester extends LitElement {
  static override styles = [
    alxBaseStyles,
    alxButtonStyles,
    alxCardStyles,
    alxLoadingStyles,
    css`
      .result {
        display: flex;
        align-items: center;
        gap: 0.75rem;
        margin-top: 1rem;
        padding: 1rem;
        border-radius: var(--alx-radius);
        font-size: 0.9rem;
      }
      .result-success {
        background: color-mix(in srgb, var(--alx-success) 10%, transparent);
        border: 1px solid var(--alx-success);
        color: var(--alx-success);
      }
      .result-failure {
        background: color-mix(in srgb, var(--alx-danger) 10%, transparent);
        border: 1px solid var(--alx-danger);
        color: var(--alx-danger);
      }
      .icon {
        font-size: 1.5rem;
        flex-shrink: 0;
      }
      .test-area {
        display: flex;
        align-items: center;
        gap: 1rem;
      }
    `,
  ];

  @property({ attribute: 'account-id' }) accountId = '';

  @state() private testing = false;
  @state() private result: { success: boolean; message: string } | null = null;

  private _api?: AccountAPI;
  private get api(): AccountAPI {
    if (!this._api) this._api = new AccountAPI();
    return this._api;
  }

  private async onTest(): Promise<void> {
    if (!this.accountId) return;
    this.testing = true;
    this.result = null;
    try {
      const res = (await this.api.testConnection(this.accountId)) as {
        success?: boolean;
        message?: string;
        error?: string;
      };
      this.result = {
        success: res.success !== false,
        message: res.message ?? 'Connection successful',
      };
    } catch (e) {
      this.result = {
        success: false,
        message: e instanceof Error ? e.message : 'Connection test failed',
      };
    } finally {
      this.testing = false;
    }
  }

  override render() {
    return html`
      <div class="alx-card">
        <div class="alx-card-header">
          <h3>SMTP Connection Test</h3>
        </div>

        <div class="test-area">
          <button
            class="alx-btn-primary"
            ?disabled=${this.testing || !this.accountId}
            @click=${this.onTest}
          >
            ${this.testing ? 'Testing...' : 'Test Connection'}
          </button>
          ${this.testing
            ? html`<div class="alx-spinner"></div>`
            : ''}
        </div>

        ${this.result
          ? html`
              <div class="result ${this.result.success ? 'result-success' : 'result-failure'}">
                <span class="icon">${this.result.success ? '\u2713' : '\u2717'}</span>
                <span>${this.result.message}</span>
              </div>
            `
          : ''}
      </div>
    `;
  }
}

declare global {
  interface HTMLElementTagNameMap {
    'alx-smtp-tester': AlxSmtpTester;
  }
}
