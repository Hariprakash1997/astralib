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

export class AlxChatKnowledgeForm extends LitElement {
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
      .slider-row {
        display: flex;
        align-items: center;
        gap: 0.5rem;
      }
      .slider-row input[type="range"] { flex: 1; padding: 0; }
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
      .toggle-label { font-size: 0.8125rem; color: var(--alx-text); }
    `,
  ];

  @property({ type: Boolean }) open = false;
  @property({ type: String }) knowledgeId = '';

  @state() private entryTitle = '';
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
      if (this.knowledgeId) {
        this.loadEntry();
      } else {
        this.resetForm();
      }
    }
  }

  private resetForm() {
    this.entryTitle = '';
    this.content = '';
    this.category = '';
    this.tags = '';
    this.priority = 5;
    this.isActive = true;
    this.error = '';
  }

  private async loadEntry() {
    this.loading = true;
    try {
      const k = await this.http.get<Record<string, unknown>>(`/knowledge/${this.knowledgeId}`);
      this.entryTitle = (k.title as string) || '';
      this.content = (k.content as string) || '';
      this.category = (k.category as string) || '';
      this.tags = Array.isArray(k.tags) ? (k.tags as string[]).join(', ') : '';
      this.priority = (k.priority as number) ?? 5;
      this.isActive = (k.isActive as boolean) !== false;
    } catch (e) {
      this.error = e instanceof Error ? e.message : 'Failed to load';
    } finally {
      this.loading = false;
    }
  }

  private async onSave() {
    if (!this.entryTitle.trim() || !this.content.trim()) {
      this.error = 'Title and content are required';
      return;
    }
    this.saving = true;
    this.error = '';
    try {
      const body = {
        title: this.entryTitle,
        content: this.content,
        category: this.category || undefined,
        tags: this.tags ? this.tags.split(',').map(t => t.trim()).filter(Boolean) : undefined,
        priority: this.priority,
        isActive: this.isActive,
      };
      if (this.knowledgeId) {
        await this.http.put(`/knowledge/${this.knowledgeId}`, body);
      } else {
        await this.http.post('/knowledge', body);
      }
      this.dispatchEvent(new CustomEvent('knowledge-saved', { bubbles: true, composed: true }));
      this.close();
    } catch (e) {
      this.error = e instanceof Error ? e.message : 'Failed to save';
    } finally {
      this.saving = false;
    }
  }

  private close() {
    this.open = false;
    this.knowledgeId = '';
    this.dispatchEvent(new CustomEvent('drawer-close', { bubbles: true, composed: true }));
  }

  render() {
    return html`
      <div class="drawer-overlay ${this.open ? 'open' : ''}" @click=${(e: Event) => {
        if (e.target === e.currentTarget) this.close();
      }}>
        <div class="drawer-panel">
          <div class="drawer-header">
            <h3>${this.knowledgeId ? 'Edit Knowledge' : 'Add Knowledge'}</h3>
            <button class="drawer-close" @click=${this.close}>&times;</button>
          </div>
          <div class="drawer-body">
            ${this.loading ? html`<div class="alx-loading"><span class="alx-spinner"></span></div>` : ''}
            ${this.error ? html`<div class="alx-error">${this.error}</div>` : ''}

            ${!this.loading ? html`
              <div class="form-group">
                <label>Title</label>
                <input type="text" .value=${this.entryTitle}
                  @input=${(e: Event) => this.entryTitle = (e.target as HTMLInputElement).value}
                  placeholder="Knowledge entry title" />
              </div>
              <div class="form-group">
                <label>Content</label>
                <textarea rows="6" .value=${this.content}
                  @input=${(e: Event) => this.content = (e.target as HTMLTextAreaElement).value}
                  placeholder="Knowledge content"></textarea>
              </div>
              <div class="form-group">
                <label>Category</label>
                <input type="text" .value=${this.category}
                  @input=${(e: Event) => this.category = (e.target as HTMLInputElement).value}
                  placeholder="e.g. product, policy" />
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

safeRegister('alx-chat-knowledge-form', AlxChatKnowledgeForm);
