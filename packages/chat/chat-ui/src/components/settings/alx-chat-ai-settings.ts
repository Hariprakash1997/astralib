import { LitElement, html, css, nothing } from 'lit';
import { property, state } from 'lit/decorators.js';
import { safeRegister } from '../../utils/safe-register.js';
import { ChatApiClient } from '../../api/chat-api-client.js';
import type { AiSettings, AiCharacterProfile } from '../../api/chat-api-client.js';
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

const EMPTY_CHARACTER: AiCharacterProfile = {
  name: '',
  tone: '',
  personality: '',
  rules: [],
  responseStyle: '',
};

export class AlxChatAiSettings extends LitElement {
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
        flex-direction: column;
        gap: 0.5rem;
        margin-top: 0.5rem;
      }

      .radio-option {
        display: flex;
        align-items: flex-start;
        gap: 0.3rem;
        font-size: 0.8125rem;
        cursor: pointer;
      }

      .radio-option input[type="radio"] { width: auto; margin-top: 0.15rem; }

      .radio-option-text {
        display: flex;
        flex-direction: column;
      }

      .radio-option-desc {
        font-size: 0.6875rem;
        color: var(--alx-text-muted);
        margin-top: 0.1rem;
        font-weight: 400;
      }

      .character-form {
        padding: 0.75rem 0;
      }

      .form-group {
        margin-bottom: 0.75rem;
      }

      .form-group label {
        display: block;
        font-size: 0.75rem;
        font-weight: 500;
        color: var(--alx-text-muted);
        margin-bottom: 0.25rem;
      }

      .form-group input, .form-group textarea {
        width: 100%;
      }

      .form-group textarea {
        min-height: 60px;
        resize: vertical;
        font-family: inherit;
        font-size: 0.8125rem;
        padding: 0.5rem;
        background: var(--alx-surface-alt);
        border: 1px solid var(--alx-border);
        border-radius: var(--alx-radius);
        color: var(--alx-text);
      }

      .rules-list {
        display: flex;
        flex-direction: column;
        gap: 0.25rem;
      }

      .rule-row {
        display: flex;
        gap: 0.375rem;
        align-items: center;
      }

      .rule-row input { flex: 1; }

      .remove-btn {
        background: transparent;
        border: 1px solid var(--alx-border);
        color: var(--alx-danger);
        border-radius: var(--alx-radius);
        width: 24px;
        height: 24px;
        cursor: pointer;
        display: flex;
        align-items: center;
        justify-content: center;
        font-size: 14px;
      }

      .section-title {
        font-size: 0.8125rem;
        font-weight: 600;
        color: var(--alx-text);
        margin: 0.75rem 0 0.5rem;
      }
    `,
  ];

  @property({ type: String }) density: 'default' | 'compact' = 'default';

  @state() private aiMode = 'agent-wise';
  @state() private showAiTag = true;
  @state() private character: AiCharacterProfile = { ...EMPTY_CHARACTER };
  @state() private hasCharacter = false;
  @state() private loading = false;
  @state() private saving = false;
  @state() private error = '';
  @state() private success = '';
  @state() private newRule = '';

  private api!: ChatApiClient;

  connectedCallback() {
    super.connectedCallback();
    this.api = new ChatApiClient();
    this.loadSettings();
  }

  private async loadSettings() {
    this.loading = true;
    this.error = '';
    try {
      const settings = await this.api.getAiSettings();
      this.aiMode = settings.aiMode ?? 'agent-wise';
      this.showAiTag = settings.showAiTag ?? true;
      if (settings.aiCharacter?.globalCharacter) {
        this.character = { ...settings.aiCharacter.globalCharacter };
        this.hasCharacter = true;
      } else {
        this.character = { ...EMPTY_CHARACTER };
        this.hasCharacter = false;
      }
    } catch (e) {
      this.error = e instanceof Error ? e.message : 'Failed to load AI settings';
    } finally {
      this.loading = false;
    }
  }

  private async onSave() {
    this.saving = true;
    this.error = '';
    this.success = '';
    try {
      const data: Partial<AiSettings> = {
        aiMode: this.aiMode,
        showAiTag: this.showAiTag,
        aiCharacter: {
          globalCharacter: this.hasCharacter ? { ...this.character } : null,
        },
      };
      await this.api.updateAiSettings(data);
      this.success = 'AI settings saved';
      setTimeout(() => this.success = '', 3000);
    } catch (e) {
      this.error = e instanceof Error ? e.message : 'Failed to save AI settings';
    } finally {
      this.saving = false;
    }
  }

  private addRule() {
    if (!this.newRule.trim()) return;
    this.character = { ...this.character, rules: [...this.character.rules, this.newRule.trim()] };
    this.newRule = '';
  }

  private removeRule(index: number) {
    const rules = [...this.character.rules];
    rules.splice(index, 1);
    this.character = { ...this.character, rules };
  }

  render() {
    return html`
      <div class="alx-card">
        <div class="alx-card-header">
          <h3>AI Settings</h3>
          <button class="alx-btn-primary alx-btn-sm" ?disabled=${this.saving}
            @click=${this.onSave}>${this.saving ? 'Saving...' : 'Save'}</button>
        </div>

        ${this.error ? html`<div class="alx-error">${this.error}</div>` : ''}
        ${this.success ? html`<div class="alx-success-msg">${this.success}</div>` : ''}
        ${this.loading ? html`<div class="alx-loading"><span class="alx-spinner"></span> Loading...</div>` : ''}

        ${!this.loading ? html`
          <div class="setting-row" style="flex-direction:column;align-items:flex-start;">
            <div class="setting-info">
              <div class="setting-label">Global AI Mode</div>
              <div class="setting-desc">Controls how AI is applied across all agents</div>
            </div>
            <div class="radio-group">
              <label class="radio-option">
                <input type="radio" name="aiMode" value="manual"
                  .checked=${this.aiMode === 'manual'}
                  @change=${() => this.aiMode = 'manual'} />
                <span class="radio-option-text">
                  Manual
                  <span class="radio-option-desc">All chats handled by humans only. AI is completely disabled.</span>
                </span>
              </label>
              <label class="radio-option">
                <input type="radio" name="aiMode" value="ai"
                  .checked=${this.aiMode === 'ai'}
                  @change=${() => this.aiMode = 'ai'} />
                <span class="radio-option-text">
                  AI
                  <span class="radio-option-desc">All chats handled by AI automatically. No human agents needed.</span>
                </span>
              </label>
              <label class="radio-option">
                <input type="radio" name="aiMode" value="agent-wise"
                  .checked=${this.aiMode === 'agent-wise'}
                  @change=${() => this.aiMode = 'agent-wise'} />
                <span class="radio-option-text">
                  Let Each Agent Choose
                  <span class="radio-option-desc">Each agent can switch between AI and manual mode for their own chats.</span>
                </span>
              </label>
            </div>
          </div>

          <div class="setting-row">
            <div class="setting-info">
              <div class="setting-label">Show AI Tag</div>
              <div class="setting-desc">Display an AI indicator on AI-generated messages visible to visitors</div>
            </div>
            <label class="toggle">
              <input type="checkbox" .checked=${this.showAiTag}
                @change=${(e: Event) => this.showAiTag = (e.target as HTMLInputElement).checked} />
              <span class="toggle-slider"></span>
            </label>
          </div>

          <div class="setting-row" style="flex-direction:column;align-items:flex-start;">
            <div style="display:flex;align-items:center;justify-content:space-between;width:100%;">
              <div class="setting-info">
                <div class="setting-label">Global AI Character</div>
                <div class="setting-desc">Configure the AI personality used for all responses</div>
              </div>
              <label class="toggle">
                <input type="checkbox" .checked=${this.hasCharacter}
                  @change=${(e: Event) => this.hasCharacter = (e.target as HTMLInputElement).checked} />
                <span class="toggle-slider"></span>
              </label>
            </div>

            ${this.hasCharacter ? html`
              <div class="character-form">
                <div class="form-group">
                  <label>Character Name</label>
                  <input type="text" .value=${this.character.name}
                    @input=${(e: Event) => this.character = { ...this.character, name: (e.target as HTMLInputElement).value }}
                    placeholder="e.g. Astra" />
                </div>
                <div class="form-group">
                  <label>Tone</label>
                  <input type="text" .value=${this.character.tone}
                    @input=${(e: Event) => this.character = { ...this.character, tone: (e.target as HTMLInputElement).value }}
                    placeholder="e.g. friendly, professional" />
                </div>
                <div class="form-group">
                  <label>Personality</label>
                  <textarea .value=${this.character.personality}
                    @input=${(e: Event) => this.character = { ...this.character, personality: (e.target as HTMLTextAreaElement).value }}
                    placeholder="Describe the AI's personality..."></textarea>
                </div>
                <div class="form-group">
                  <label>Response Style</label>
                  <input type="text" .value=${this.character.responseStyle}
                    @input=${(e: Event) => this.character = { ...this.character, responseStyle: (e.target as HTMLInputElement).value }}
                    placeholder="e.g. concise, detailed" />
                </div>
                <div class="form-group">
                  <label>Rules</label>
                  <div class="rules-list">
                    ${this.character.rules.map((rule, i) => html`
                      <div class="rule-row">
                        <input type="text" .value=${rule} readonly />
                        <button class="remove-btn" @click=${() => this.removeRule(i)}>x</button>
                      </div>
                    `)}
                    <div class="rule-row">
                      <input type="text" .value=${this.newRule}
                        @input=${(e: Event) => this.newRule = (e.target as HTMLInputElement).value}
                        @keydown=${(e: KeyboardEvent) => { if (e.key === 'Enter') { e.preventDefault(); this.addRule(); }}}
                        placeholder="Add a rule..." />
                      <button class="alx-btn-sm" @click=${this.addRule}>Add</button>
                    </div>
                  </div>
                </div>
              </div>
            ` : nothing}
          </div>
        ` : ''}
      </div>
    `;
  }
}

safeRegister('alx-chat-ai-settings', AlxChatAiSettings);
