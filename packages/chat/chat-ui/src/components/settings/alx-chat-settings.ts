import { LitElement, html, css } from 'lit';
import { state } from 'lit/decorators.js';
import { SessionMode } from '@astralibx/chat-types';
import { safeRegister } from '../../utils/safe-register.js';
import { HttpClient } from '../../api/http-client.js';
import { AlxChatConfig } from '../../config.js';
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

interface ChatSettings {
  defaultSessionMode: string;
  autoAssignEnabled: boolean;
  aiEnabled: boolean;
  metadata?: Record<string, unknown>;
}

export class AlxChatSettings extends LitElement {
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

      .setting-row:last-child {
        border-bottom: none;
      }

      .setting-info {
        flex: 1;
      }

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

      .radio-option input[type="radio"] {
        width: auto;
      }
    `,
  ];

  @state() private settings: ChatSettings = {
    defaultSessionMode: SessionMode.AI,
    autoAssignEnabled: true,
    aiEnabled: true,
  };
  @state() private loading = false;
  @state() private saving = false;
  @state() private error = '';
  @state() private success = '';

  private http!: HttpClient;

  connectedCallback() {
    super.connectedCallback();
    this.http = new HttpClient(AlxChatConfig.getApiUrl('chatEngine'));
    this.loadSettings();
  }

  async loadSettings() {
    this.loading = true;
    try {
      const result = await this.http.get<ChatSettings>('/settings');
      this.settings = result;
    } catch (e) {
      this.error = e instanceof Error ? e.message : 'Failed to load settings';
    } finally {
      this.loading = false;
    }
  }

  private async onSave() {
    this.saving = true;
    this.error = '';
    this.success = '';
    try {
      await this.http.put('/settings', this.settings);
      this.success = 'Settings saved successfully';
      setTimeout(() => this.success = '', 3000);
    } catch (e) {
      this.error = e instanceof Error ? e.message : 'Failed to save settings';
    } finally {
      this.saving = false;
    }
  }

  render() {
    return html`
      <div class="alx-card">
        <div class="alx-card-header">
          <h3>Chat Settings</h3>
          <button class="alx-btn-primary alx-btn-sm" ?disabled=${this.saving}
            @click=${this.onSave}>${this.saving ? 'Saving...' : 'Save'}</button>
        </div>

        ${this.error ? html`<div class="alx-error">${this.error}</div>` : ''}
        ${this.success ? html`<div class="alx-success-msg">${this.success}</div>` : ''}
        ${this.loading ? html`<div class="alx-loading"><span class="alx-spinner"></span> Loading...</div>` : ''}

        ${!this.loading ? html`
          <div class="setting-row">
            <div class="setting-info">
              <div class="setting-label">Default Session Mode</div>
              <div class="setting-desc">How new chat sessions are initially handled</div>
            </div>
            <div class="radio-group">
              <label class="radio-option">
                <input type="radio" name="mode" value=${SessionMode.AI}
                  .checked=${this.settings.defaultSessionMode === SessionMode.AI}
                  @change=${() => this.settings = { ...this.settings, defaultSessionMode: SessionMode.AI }} />
                AI
              </label>
              <label class="radio-option">
                <input type="radio" name="mode" value=${SessionMode.Manual}
                  .checked=${this.settings.defaultSessionMode === SessionMode.Manual}
                  @change=${() => this.settings = { ...this.settings, defaultSessionMode: SessionMode.Manual }} />
                Manual
              </label>
            </div>
          </div>

          <div class="setting-row">
            <div class="setting-info">
              <div class="setting-label">Auto-Assign Agents</div>
              <div class="setting-desc">Automatically assign available agents to waiting sessions</div>
            </div>
            <label class="toggle">
              <input type="checkbox" .checked=${this.settings.autoAssignEnabled}
                @change=${(e: Event) => this.settings = { ...this.settings, autoAssignEnabled: (e.target as HTMLInputElement).checked }} />
              <span class="toggle-slider"></span>
            </label>
          </div>

          <div class="setting-row">
            <div class="setting-info">
              <div class="setting-label">AI Enabled</div>
              <div class="setting-desc">Enable AI agent responses for chat sessions</div>
            </div>
            <label class="toggle">
              <input type="checkbox" .checked=${this.settings.aiEnabled}
                @change=${(e: Event) => this.settings = { ...this.settings, aiEnabled: (e.target as HTMLInputElement).checked }} />
              <span class="toggle-slider"></span>
            </label>
          </div>
        ` : ''}
      </div>
    `;
  }
}

safeRegister('alx-chat-settings', AlxChatSettings);
