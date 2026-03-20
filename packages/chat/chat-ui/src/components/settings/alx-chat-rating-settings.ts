import { LitElement, html, css, nothing } from 'lit';
import { property, state } from 'lit/decorators.js';
import { safeRegister } from '../../utils/safe-register.js';
import { ChatApiClient } from '../../api/chat-api-client.js';
import type { RatingConfig } from '../../api/chat-api-client.js';
import {
  alxChatResetStyles,
  alxChatThemeStyles,
  alxChatDensityStyles,
  alxChatButtonStyles,
  alxChatInputStyles,
  alxChatLoadingStyles,
  alxChatCardStyles,
  alxChatToggleStyles,
} from '../../styles/shared.js';

const RATING_TYPES = ['thumbs', 'stars', 'emoji'] as const;

export class AlxChatRatingSettings extends LitElement {
  static styles = [
    alxChatResetStyles,
    alxChatThemeStyles,
    alxChatDensityStyles,
    alxChatButtonStyles,
    alxChatInputStyles,
    alxChatLoadingStyles,
    alxChatCardStyles,
    alxChatToggleStyles,
    css`
      :host { display: block; }

      .setting-row {
        display: flex;
        align-items: center;
        justify-content: space-between;
        padding: 0.75rem 0;
        border-bottom: 1px solid color-mix(in srgb, var(--alx-border) 60%, transparent);
      }

      .setting-row:last-child { border-bottom: none; }

      .setting-info { flex: 1; }

      .setting-label {
        font-size: 0.875rem;
        font-weight: 500;
        color: var(--alx-text);
      }

      .setting-desc {
        font-size: 0.75rem;
        color: var(--alx-text-muted);
        margin-top: 0.15rem;
      }

      .radio-group {
        display: flex;
        gap: 1rem;
      }

      .radio-option {
        display: flex;
        align-items: center;
        gap: 0.3rem;
        font-size: 0.8125rem;
        cursor: pointer;
      }

      .radio-option input[type="radio"] { width: auto; }

      .followup-section {
        padding: 0.75rem 0;
      }

      .followup-group {
        margin-bottom: 0.75rem;
        padding: 0.5rem;
        background: var(--alx-surface-alt);
        border: 1px solid var(--alx-border);
        border-radius: var(--alx-radius);
      }

      .followup-label {
        font-size: 0.75rem;
        font-weight: 600;
        color: var(--alx-text-muted);
        margin-bottom: 0.375rem;
      }

      .chip-list {
        display: flex;
        flex-wrap: wrap;
        gap: 0.25rem;
      }

      .chip {
        display: inline-flex;
        align-items: center;
        gap: 0.25rem;
        padding: 0.2rem 0.5rem;
        font-size: 0.75rem;
        background: color-mix(in srgb, var(--alx-primary) 15%, transparent);
        border: 1px solid color-mix(in srgb, var(--alx-primary) 30%, transparent);
        border-radius: 999px;
        color: var(--alx-text);
      }

      .chip-remove {
        background: none;
        border: none;
        color: var(--alx-text-muted);
        cursor: pointer;
        padding: 0;
        font-size: 12px;
        line-height: 1;
      }

      .chip-remove:hover { color: var(--alx-danger); }

      .add-row {
        display: flex;
        gap: 0.375rem;
        margin-top: 0.375rem;
      }

      .add-row input { flex: 1; }
    `,
  ];

  @property({ type: String }) density: 'default' | 'compact' = 'default';

  @state() private config: RatingConfig = {
    enabled: false,
    ratingType: 'thumbs',
    followUpOptions: {},
  };
  @state() private loading = false;
  @state() private saving = false;
  @state() private error = '';
  @state() private success = '';
  @state() private newFollowUp: Record<string, string> = {};

  private api!: ChatApiClient;

  connectedCallback() {
    super.connectedCallback();
    this.api = new ChatApiClient();
    this.loadConfig();
  }

  private async loadConfig() {
    this.loading = true;
    this.error = '';
    try {
      const result = await this.api.getRatingConfig();
      if (result) {
        this.config = {
          enabled: result.enabled ?? false,
          ratingType: result.ratingType ?? 'thumbs',
          followUpOptions: result.followUpOptions ?? {},
        };
      }
    } catch (e) {
      this.error = e instanceof Error ? e.message : 'Failed to load rating config';
    } finally {
      this.loading = false;
    }
  }

  private async onSave() {
    this.saving = true;
    this.error = '';
    this.success = '';
    try {
      await this.api.updateRatingConfig(this.config);
      this.success = 'Rating settings saved';
      setTimeout(() => this.success = '', 3000);
    } catch (e) {
      this.error = e instanceof Error ? e.message : 'Failed to save rating config';
    } finally {
      this.saving = false;
    }
  }

  private getFollowUpKeys(): string[] {
    if (this.config.ratingType === 'thumbs') return ['0', '1'];
    return ['1', '2', '3', '4', '5'];
  }

  private getFollowUpLabel(key: string): string {
    if (this.config.ratingType === 'thumbs') {
      return key === '0' ? 'Thumbs Down' : 'Thumbs Up';
    }
    if (this.config.ratingType === 'emoji') {
      const labels: Record<string, string> = { '1': 'Very Bad', '2': 'Bad', '3': 'Okay', '4': 'Good', '5': 'Great' };
      return labels[key] ?? key;
    }
    return `${key} Star${key !== '1' ? 's' : ''}`;
  }

  private addFollowUp(key: string) {
    const val = this.newFollowUp[key]?.trim();
    if (!val) return;
    const existing = this.config.followUpOptions[key] ?? [];
    this.config = {
      ...this.config,
      followUpOptions: {
        ...this.config.followUpOptions,
        [key]: [...existing, val],
      },
    };
    this.newFollowUp = { ...this.newFollowUp, [key]: '' };
  }

  private removeFollowUp(key: string, index: number) {
    const arr = [...(this.config.followUpOptions[key] ?? [])];
    arr.splice(index, 1);
    this.config = {
      ...this.config,
      followUpOptions: {
        ...this.config.followUpOptions,
        [key]: arr,
      },
    };
  }

  render() {
    return html`
      <div class="alx-card">
        <div class="alx-card-header">
          <h3>Rating Settings</h3>
          <button class="alx-btn-primary alx-btn-sm" ?disabled=${this.saving}
            @click=${this.onSave}>${this.saving ? 'Saving...' : 'Save'}</button>
        </div>

        ${this.error ? html`<div class="alx-error">${this.error}</div>` : ''}
        ${this.success ? html`<div class="alx-success-msg">${this.success}</div>` : ''}
        ${this.loading ? html`<div class="alx-loading"><span class="alx-spinner"></span> Loading...</div>` : ''}

        ${!this.loading ? html`
          <div class="setting-row">
            <div class="setting-info">
              <div class="setting-label">Enable Rating</div>
              <div class="setting-desc">Prompt visitors to rate their experience after chat ends</div>
            </div>
            <label class="toggle">
              <input type="checkbox" .checked=${this.config.enabled}
                @change=${(e: Event) => this.config = { ...this.config, enabled: (e.target as HTMLInputElement).checked }} />
              <span class="toggle-slider"></span>
            </label>
          </div>

          ${this.config.enabled ? html`
            <div class="setting-row">
              <div class="setting-info">
                <div class="setting-label">Rating Type</div>
                <div class="setting-desc">How visitors rate their experience</div>
              </div>
              <div class="radio-group">
                ${RATING_TYPES.map(type => html`
                  <label class="radio-option">
                    <input type="radio" name="ratingType" value=${type}
                      .checked=${this.config.ratingType === type}
                      @change=${() => this.config = { ...this.config, ratingType: type }} />
                    ${type.charAt(0).toUpperCase() + type.slice(1)}
                  </label>
                `)}
              </div>
            </div>

            <div class="followup-section">
              <div class="setting-label" style="margin-bottom:0.5rem;">Follow-up Options</div>
              <div class="setting-desc" style="margin-bottom:0.75rem;">
                Configure follow-up prompts shown for each rating value
              </div>
              ${this.getFollowUpKeys().map(key => html`
                <div class="followup-group">
                  <div class="followup-label">${this.getFollowUpLabel(key)}</div>
                  <div class="chip-list">
                    ${(this.config.followUpOptions[key] ?? []).map((opt, i) => html`
                      <span class="chip">
                        ${opt}
                        <button class="chip-remove" @click=${() => this.removeFollowUp(key, i)}>x</button>
                      </span>
                    `)}
                  </div>
                  <div class="add-row">
                    <input type="text" placeholder="Add follow-up option..."
                      .value=${this.newFollowUp[key] ?? ''}
                      @input=${(e: Event) => this.newFollowUp = { ...this.newFollowUp, [key]: (e.target as HTMLInputElement).value }}
                      @keydown=${(e: KeyboardEvent) => { if (e.key === 'Enter') { e.preventDefault(); this.addFollowUp(key); }}} />
                    <button class="alx-btn-sm" @click=${() => this.addFollowUp(key)}>Add</button>
                  </div>
                </div>
              `)}
            </div>
          ` : nothing}
        ` : ''}
      </div>
    `;
  }
}

safeRegister('alx-chat-rating-settings', AlxChatRatingSettings);
