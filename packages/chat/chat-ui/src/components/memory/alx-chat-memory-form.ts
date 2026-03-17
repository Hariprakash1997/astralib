import { LitElement, html, css } from 'lit';
import { property, state } from 'lit/decorators.js';
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
  alxChatDrawerStyles,
  alxChatToggleStyles,
} from '../../styles/shared.js';

export class AlxChatMemoryForm extends LitElement {
  static styles = [
    alxChatResetStyles,
    alxChatThemeStyles,
    alxChatDensityStyles,
    alxChatButtonStyles,
    alxChatInputStyles,
    alxChatLoadingStyles,
    alxChatDrawerStyles,
    alxChatToggleStyles,
    css`
      :host { display: block; }
      .radio-group {
        display: flex;
        gap: 0.75rem;
        margin-bottom: 0.625rem;
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
      .slider-row {
        display: flex;
        align-items: center;
        gap: 0.5rem;
      }
      .slider-row input[type="range"] {
        flex: 1;
        padding: 0;
      }
      .slider-value {
        font-size: 0.8125rem;
        font-weight: 600;
        min-width: 2rem;
        text-align: center;
      }
      .toggle-row {
        display: flex;
        align-items: center;
        gap: 0.5rem;
        margin-bottom: 0.625rem;
      }
      .toggle-label {
        font-size: 0.8125rem;
        color: var(--alx-text);
      }
    `,
  ];

  @property({ type: String }) density: 'default' | 'compact' = 'default';
  @property({ type: Boolean }) open = false;
  @property({ type: String }) memoryId = '';

  @state() private scope = 'global';
  @state() private scopeId = '';
  @state() private key = '';
  @state() private content = '';
  @state() private category = '';
  @state() private tags = '';
  @state() private priority = 5;
  @state() private isActive = true;
  @state() private saving = false;
  @state() private loading = false;
  @state() private error = '';

  private http!: HttpClient;

  connectedCallback() {
    super.connectedCallback();
    this.http = new HttpClient(AlxChatConfig.getApiUrl('chatAi'));
  }

  updated(changed: Map<string, unknown>) {
    if (changed.has('open') && this.open) {
      if (this.memoryId) {
        this.loadMemory();
      } else {
        this.resetForm();
      }
    }
  }

  private resetForm() {
    this.scope = 'global';
    this.scopeId = '';
    this.key = '';
    this.content = '';
    this.category = '';
    this.tags = '';
    this.priority = 5;
    this.isActive = true;
    this.error = '';
  }

  private async loadMemory() {
    this.loading = true;
    try {
      const mem = await this.http.get<Record<string, unknown>>(`/memories/${this.memoryId}`);
      this.scope = (mem.scope as string) || 'global';
      this.scopeId = (mem.scopeId as string) || '';
      this.key = (mem.key as string) || '';
      this.content = (mem.content as string) || '';
      this.category = (mem.category as string) || '';
      this.tags = Array.isArray(mem.tags) ? (mem.tags as string[]).join(', ') : '';
      this.priority = (mem.priority as number) ?? 5;
      this.isActive = (mem.isActive as boolean) !== false;
    } catch (e) {
      this.error = e instanceof Error ? e.message : 'Failed to load memory';
    } finally {
      this.loading = false;
    }
  }

  private async onSave() {
    if (!this.key.trim() || !this.content.trim()) {
      this.error = 'Key and content are required';
      return;
    }
    this.saving = true;
    this.error = '';
    try {
      const body = {
        scope: this.scope,
        scopeId: this.scope !== 'global' ? this.scopeId : undefined,
        key: this.key,
        content: this.content,
        category: this.category || undefined,
        tags: this.tags ? this.tags.split(',').map(t => t.trim()).filter(Boolean) : undefined,
        priority: this.priority,
        isActive: this.isActive,
      };
      if (this.memoryId) {
        await this.http.put(`/memories/${this.memoryId}`, body);
      } else {
        await this.http.post('/memories', body);
      }
      this.dispatchEvent(new CustomEvent('memory-saved', { bubbles: true, composed: true }));
      this.close();
    } catch (e) {
      this.error = e instanceof Error ? e.message : 'Failed to save';
    } finally {
      this.saving = false;
    }
  }

  private close() {
    this.open = false;
    this.memoryId = '';
    this.dispatchEvent(new CustomEvent('drawer-close', { bubbles: true, composed: true }));
  }

  render() {
    return html`
      <div class="drawer-overlay ${this.open ? 'open' : ''}" @click=${(e: Event) => {
        if (e.target === e.currentTarget) this.close();
      }}>
        <div class="drawer-panel">
          <div class="drawer-header">
            <h3>${this.memoryId ? 'Edit Memory' : 'Add Memory'}</h3>
            <button class="drawer-close" @click=${this.close}>&times;</button>
          </div>

          <div class="drawer-body">
            ${this.loading ? html`<div class="alx-loading"><span class="alx-spinner"></span></div>` : ''}
            ${this.error ? html`<div class="alx-error">${this.error}</div>` : ''}

            ${!this.loading ? html`
              <div class="form-group">
                <label>Scope</label>
                <div class="radio-group">
                  ${['global', 'agent', 'visitor', 'channel'].map(s => html`
                    <label class="radio-option">
                      <input type="radio" name="scope" value=${s} .checked=${this.scope === s}
                        @change=${() => this.scope = s} />
                      ${s}
                    </label>
                  `)}
                </div>
              </div>

              ${this.scope !== 'global' ? html`
                <div class="form-group">
                  <label>Scope ID</label>
                  <input type="text" .value=${this.scopeId}
                    @input=${(e: Event) => this.scopeId = (e.target as HTMLInputElement).value}
                    placeholder="${this.scope} ID" />
                </div>
              ` : ''}

              <div class="form-group">
                <label>Key</label>
                <input type="text" .value=${this.key}
                  @input=${(e: Event) => this.key = (e.target as HTMLInputElement).value}
                  placeholder="Memory key" />
              </div>

              <div class="form-group">
                <label>Content</label>
                <textarea rows="4" .value=${this.content}
                  @input=${(e: Event) => this.content = (e.target as HTMLTextAreaElement).value}
                  placeholder="Memory content"></textarea>
              </div>

              <div class="form-group">
                <label>Category</label>
                <input type="text" .value=${this.category}
                  @input=${(e: Event) => this.category = (e.target as HTMLInputElement).value}
                  placeholder="e.g. preferences, context" />
              </div>

              <div class="form-group">
                <label>Tags (comma-separated)</label>
                <input type="text" .value=${this.tags}
                  @input=${(e: Event) => this.tags = (e.target as HTMLInputElement).value}
                  placeholder="tag1, tag2" />
              </div>

              <div class="form-group">
                <label>Priority</label>
                <div class="slider-row">
                  <input type="range" min="0" max="10" .value=${String(this.priority)}
                    @input=${(e: Event) => this.priority = parseInt((e.target as HTMLInputElement).value)} />
                  <span class="slider-value">${this.priority}</span>
                </div>
              </div>

              <div class="toggle-row">
                <label class="toggle">
                  <input type="checkbox" .checked=${this.isActive}
                    @change=${(e: Event) => this.isActive = (e.target as HTMLInputElement).checked} />
                  <span class="toggle-slider"></span>
                </label>
                <span class="toggle-label">Active</span>
              </div>

              <div class="form-actions">
                <button @click=${this.close}>Cancel</button>
                <button class="alx-btn-primary" ?disabled=${this.saving}
                  @click=${this.onSave}>${this.saving ? 'Saving...' : 'Save'}</button>
              </div>
            ` : ''}
          </div>
        </div>
      </div>
    `;
  }
}

safeRegister('alx-chat-memory-form', AlxChatMemoryForm);
