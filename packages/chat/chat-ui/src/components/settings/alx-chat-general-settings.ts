import { LitElement, html, css } from 'lit';
import { property, state } from 'lit/decorators.js';
import { safeRegister } from '../../utils/safe-register.js';
import { ChatApiClient } from '../../api/chat-api-client.js';
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

export class AlxChatGeneralSettings extends LitElement {
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

      .chip-section {
        padding: 0.75rem 0;
        border-bottom: 1px solid color-mix(in srgb, var(--alx-border) 60%, transparent);
      }

      .chip-list {
        display: flex;
        flex-wrap: wrap;
        gap: 0.25rem;
        margin-top: 0.375rem;
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

      .chip.category {
        background: color-mix(in srgb, var(--alx-info) 15%, transparent);
        border: 1px solid color-mix(in srgb, var(--alx-info) 30%, transparent);
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
        margin-top: 0.5rem;
      }

      .add-row input { flex: 1; }

      .number-input {
        width: 80px;
        text-align: center;
      }
    `,
  ];

  @property({ type: String }) density: 'default' | 'compact' = 'default';

  @state() private chatMode = 'switchable';
  @state() private tags: string[] = [];
  @state() private categories: string[] = [];
  @state() private autoCloseAfterMinutes = 30;
  @state() private autoAwayTimeoutMinutes = 15;
  @state() private loading = false;
  @state() private saving = false;
  @state() private error = '';
  @state() private success = '';
  @state() private newTag = '';
  @state() private newCategory = '';

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
      const [chatMode, tags, categories, settings] = await Promise.all([
        this.api.getChatMode(),
        this.api.getAvailableTags(),
        this.api.getUserCategories(),
        this.api.getSettings(),
      ]);
      this.chatMode = chatMode ?? 'switchable';
      this.tags = Array.isArray(tags) ? tags : [];
      this.categories = Array.isArray(categories) ? categories : [];
      this.autoCloseAfterMinutes = (settings as any).autoCloseAfterMinutes ?? 30;
      this.autoAwayTimeoutMinutes = (settings as any).autoAwayTimeoutMinutes ?? 15;
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
      await Promise.all([
        this.api.updateChatMode(this.chatMode),
        this.api.updateAvailableTags(this.tags),
        this.api.updateUserCategories(this.categories),
        this.api.updateSettings({
          autoCloseAfterMinutes: this.autoCloseAfterMinutes,
          autoAwayTimeoutMinutes: this.autoAwayTimeoutMinutes,
        }),
      ]);
      this.success = 'General settings saved';
      setTimeout(() => this.success = '', 3000);
    } catch (e) {
      this.error = e instanceof Error ? e.message : 'Failed to save settings';
    } finally {
      this.saving = false;
    }
  }

  private addTag() {
    const val = this.newTag.trim();
    if (!val || this.tags.includes(val)) return;
    this.tags = [...this.tags, val];
    this.newTag = '';
  }

  private removeTag(index: number) {
    const t = [...this.tags];
    t.splice(index, 1);
    this.tags = t;
  }

  private addCategory() {
    const val = this.newCategory.trim();
    if (!val || this.categories.includes(val)) return;
    this.categories = [...this.categories, val];
    this.newCategory = '';
  }

  private removeCategory(index: number) {
    const c = [...this.categories];
    c.splice(index, 1);
    this.categories = c;
  }

  render() {
    return html`
      <div class="alx-card">
        <div class="alx-card-header">
          <h3>General Settings</h3>
          <button class="alx-btn-primary alx-btn-sm" ?disabled=${this.saving}
            @click=${this.onSave}>${this.saving ? 'Saving...' : 'Save'}</button>
        </div>

        ${this.error ? html`<div class="alx-error">${this.error}</div>` : ''}
        ${this.success ? html`<div class="alx-success-msg">${this.success}</div>` : ''}
        ${this.loading ? html`<div class="alx-loading"><span class="alx-spinner"></span> Loading...</div>` : ''}

        ${!this.loading ? html`
          <div class="setting-row">
            <div class="setting-info">
              <div class="setting-label">Chat Mode</div>
              <div class="setting-desc">Fixed prevents visitors from switching agents mid-chat</div>
            </div>
            <div class="radio-group">
              <label class="radio-option">
                <input type="radio" name="chatMode" value="switchable"
                  .checked=${this.chatMode === 'switchable'}
                  @change=${() => this.chatMode = 'switchable'} />
                Switchable
              </label>
              <label class="radio-option">
                <input type="radio" name="chatMode" value="fixed"
                  .checked=${this.chatMode === 'fixed'}
                  @change=${() => this.chatMode = 'fixed'} />
                Fixed
              </label>
            </div>
          </div>

          <div class="setting-row">
            <div class="setting-info">
              <div class="setting-label">Auto-Close Timeout</div>
              <div class="setting-desc">Minutes of inactivity before a session is auto-closed (1-1440)</div>
            </div>
            <input type="number" class="number-input" min="1" max="1440"
              .value=${String(this.autoCloseAfterMinutes)}
              @input=${(e: Event) => this.autoCloseAfterMinutes = Number((e.target as HTMLInputElement).value) || 30} />
          </div>

          <div class="setting-row">
            <div class="setting-info">
              <div class="setting-label">Auto-Away Timeout</div>
              <div class="setting-desc">Minutes of agent inactivity before setting agent status to Away (1-480)</div>
            </div>
            <input type="number" class="number-input" min="1" max="480"
              .value=${String(this.autoAwayTimeoutMinutes)}
              @input=${(e: Event) => this.autoAwayTimeoutMinutes = Number((e.target as HTMLInputElement).value) || 15} />
          </div>

          <div class="chip-section">
            <div class="setting-label">Available Tags</div>
            <div class="setting-desc">Tags that agents can apply to chat sessions</div>
            <div class="chip-list">
              ${this.tags.map((tag, i) => html`
                <span class="chip">
                  ${tag}
                  <button class="chip-remove" @click=${() => this.removeTag(i)}>x</button>
                </span>
              `)}
            </div>
            <div class="add-row">
              <input type="text" placeholder="Add a tag..." .value=${this.newTag}
                @input=${(e: Event) => this.newTag = (e.target as HTMLInputElement).value}
                @keydown=${(e: KeyboardEvent) => { if (e.key === 'Enter') { e.preventDefault(); this.addTag(); }}} />
              <button class="alx-btn-sm" @click=${this.addTag}>Add</button>
            </div>
          </div>

          <div class="chip-section" style="border-bottom:none;">
            <div class="setting-label">User Categories</div>
            <div class="setting-desc">Categories agents can assign to visitors for classification</div>
            <div class="chip-list">
              ${this.categories.map((cat, i) => html`
                <span class="chip category">
                  ${cat}
                  <button class="chip-remove" @click=${() => this.removeCategory(i)}>x</button>
                </span>
              `)}
            </div>
            <div class="add-row">
              <input type="text" placeholder="Add a category..." .value=${this.newCategory}
                @input=${(e: Event) => this.newCategory = (e.target as HTMLInputElement).value}
                @keydown=${(e: KeyboardEvent) => { if (e.key === 'Enter') { e.preventDefault(); this.addCategory(); }}} />
              <button class="alx-btn-sm" @click=${this.addCategory}>Add</button>
            </div>
          </div>
        ` : ''}
      </div>
    `;
  }
}

safeRegister('alx-chat-general-settings', AlxChatGeneralSettings);
