import { LitElement, html, css, nothing } from 'lit';
import { customElement, state } from 'lit/decorators.js';
import { alxBaseStyles } from '../../styles/theme.js';
import {
  alxResetStyles,
  alxTypographyStyles,
  alxButtonStyles,
  alxInputStyles,
  alxCardStyles,
  alxLoadingStyles,
} from '../../styles/shared.js';
import { RuleAPI } from '../../api/rule.api.js';

interface ThrottleData {
  maxPerUserPerDay: number;
  maxPerUserPerWeek: number;
  minGapDays: number;
}

const DEFAULT_THROTTLE: ThrottleData = {
  maxPerUserPerDay: 1,
  maxPerUserPerWeek: 3,
  minGapDays: 1,
};

@customElement('alx-throttle-settings')
export class AlxThrottleSettings extends LitElement {
  static override styles = [
    alxBaseStyles,
    alxResetStyles,
    alxTypographyStyles,
    alxButtonStyles,
    alxInputStyles,
    alxCardStyles,
    alxLoadingStyles,
    css`
      .form-grid {
        display: grid;
        grid-template-columns: 1fr 1fr 1fr;
        gap: 1rem;
      }

      .form-group {
        display: flex;
        flex-direction: column;
      }

      .actions {
        display: flex;
        gap: 0.75rem;
        margin-top: 1.5rem;
      }

      .hint {
        font-size: 0.75rem;
        color: var(--alx-text-muted);
        margin-top: 0.25rem;
      }

      @media (max-width: 600px) {
        .form-grid {
          grid-template-columns: 1fr;
        }
      }
    `,
  ];

  @state() private _form: ThrottleData = { ...DEFAULT_THROTTLE };
  @state() private _loading = false;
  @state() private _saving = false;
  @state() private _error = '';
  @state() private _saved = false;

  private __api?: RuleAPI;
  private get _api(): RuleAPI {
    if (!this.__api) this.__api = new RuleAPI();
    return this.__api;
  }

  override connectedCallback(): void {
    super.connectedCallback();
    this._loadSettings();
  }

  private async _loadSettings(): Promise<void> {
    this._loading = true;
    this._error = '';
    try {
      const res = (await this._api.getThrottleSettings()) as ThrottleData;
      this._form = {
        maxPerUserPerDay: res.maxPerUserPerDay ?? DEFAULT_THROTTLE.maxPerUserPerDay,
        maxPerUserPerWeek: res.maxPerUserPerWeek ?? DEFAULT_THROTTLE.maxPerUserPerWeek,
        minGapDays: res.minGapDays ?? DEFAULT_THROTTLE.minGapDays,
      };
    } catch (err) {
      this._error = err instanceof Error ? err.message : 'Failed to load throttle settings';
    } finally {
      this._loading = false;
    }
  }

  private async _onSave(): Promise<void> {
    this._saving = true;
    this._error = '';
    this._saved = false;
    try {
      await this._api.updateThrottleSettings(this._form as unknown as Record<string, unknown>);
      this._saved = true;
      this.dispatchEvent(
        new CustomEvent('alx-throttle-saved', {
          detail: { ...this._form },
          bubbles: true,
          composed: true,
        }),
      );
      setTimeout(() => {
        this._saved = false;
      }, 3000);
    } catch (err) {
      this._error = err instanceof Error ? err.message : 'Failed to save throttle settings';
    } finally {
      this._saving = false;
    }
  }

  override render() {
    if (this._loading) {
      return html`<div class="alx-loading"><div class="alx-spinner"></div></div>`;
    }

    return html`
      <div class="alx-card">
        <div class="alx-card-header">
          <h3>Throttle Settings</h3>
        </div>

        ${this._error ? html`<div class="alx-error">${this._error}</div>` : nothing}

        <div class="form-grid">
          <div class="form-group">
            <label>Max Per User Per Day</label>
            <input
              type="number"
              .value=${String(this._form.maxPerUserPerDay)}
              @input=${(e: Event) =>
                (this._form = {
                  ...this._form,
                  maxPerUserPerDay: Number((e.target as HTMLInputElement).value),
                })}
              min="1"
            />
            <span class="hint">Maximum emails sent to one user in a single day</span>
          </div>

          <div class="form-group">
            <label>Max Per User Per Week</label>
            <input
              type="number"
              .value=${String(this._form.maxPerUserPerWeek)}
              @input=${(e: Event) =>
                (this._form = {
                  ...this._form,
                  maxPerUserPerWeek: Number((e.target as HTMLInputElement).value),
                })}
              min="1"
            />
            <span class="hint">Maximum emails sent to one user in a 7-day window</span>
          </div>

          <div class="form-group">
            <label>Min Gap Days</label>
            <input
              type="number"
              .value=${String(this._form.minGapDays)}
              @input=${(e: Event) =>
                (this._form = {
                  ...this._form,
                  minGapDays: Number((e.target as HTMLInputElement).value),
                })}
              min="0"
            />
            <span class="hint">Minimum days between consecutive emails to the same user</span>
          </div>
        </div>

        <div class="actions">
          <button
            class="alx-btn-primary"
            ?disabled=${this._saving}
            @click=${this._onSave}
          >
            ${this._saving ? 'Saving...' : 'Save Settings'}
          </button>
          ${this._saved
            ? html`<span style="color: var(--alx-success); align-self: center; font-size: 0.875rem"
                >Settings saved</span
              >`
            : nothing}
        </div>
      </div>
    `;
  }
}

declare global {
  interface HTMLElementTagNameMap {
    'alx-throttle-settings': AlxThrottleSettings;
  }
}
