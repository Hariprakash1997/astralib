import { LitElement, html, css } from 'lit';
import { state } from 'lit/decorators.js';
import { safeRegister } from '../../utils/safe-register.js';
import { HttpClient } from '../../api/http-client.js';
import { AlxChatConfig } from '../../config.js';
import {
  alxChatResetStyles,
  alxChatThemeStyles,
  alxChatDensityStyles,
  alxChatButtonStyles,
  alxChatBadgeStyles,
  alxChatLoadingStyles,
  alxChatCardStyles,
  alxChatToggleStyles,
} from '../../styles/shared.js';

interface PromptTemplate {
  _id: string;
  name: string;
  description?: string;
  isDefault: boolean;
  isActive: boolean;
  sections?: { key: string }[];
}

export class AlxChatPromptList extends LitElement {
  static styles = [
    alxChatResetStyles,
    alxChatThemeStyles,
    alxChatDensityStyles,
    alxChatButtonStyles,
    alxChatBadgeStyles,
    alxChatLoadingStyles,
    alxChatCardStyles,
    alxChatToggleStyles,
    css`
      :host { display: block; }

      .prompt-item {
        display: flex;
        align-items: center;
        justify-content: space-between;
        padding: 0.625rem 0.75rem;
        border-bottom: 1px solid color-mix(in srgb, var(--alx-border) 60%, transparent);
        transition: background 0.1s;
      }

      .prompt-item:hover {
        background: color-mix(in srgb, var(--alx-primary) 4%, transparent);
      }

      .prompt-info {
        flex: 1;
      }

      .prompt-name {
        font-weight: 500;
        font-size: 0.875rem;
        display: flex;
        align-items: center;
        gap: 0.375rem;
      }

      .prompt-desc {
        font-size: 0.75rem;
        color: var(--alx-text-muted);
        margin-top: 0.15rem;
      }

      .prompt-meta {
        font-size: 0.6875rem;
        color: var(--alx-text-muted);
        margin-top: 0.15rem;
      }

      .actions {
        display: flex;
        gap: 0.25rem;
        align-items: center;
      }
    `,
  ];

  @state() private prompts: PromptTemplate[] = [];
  @state() private loading = false;
  @state() private error = '';

  private http!: HttpClient;

  connectedCallback() {
    super.connectedCallback();
    this.http = new HttpClient(AlxChatConfig.getApiUrl('chatAi'));
    this.loadPrompts();
  }

  async loadPrompts() {
    this.loading = true;
    this.error = '';
    try {
      const result = await this.http.get<PromptTemplate[] | { data: PromptTemplate[] }>('/prompts');
      this.prompts = Array.isArray(result) ? result : (result as { data: PromptTemplate[] }).data ?? [];
    } catch (e) {
      this.error = e instanceof Error ? e.message : 'Failed to load prompts';
    } finally {
      this.loading = false;
    }
  }

  private onEdit(prompt: PromptTemplate) {
    this.dispatchEvent(new CustomEvent('prompt-edit', {
      detail: { promptId: prompt._id, prompt },
      bubbles: true,
      composed: true,
    }));
  }

  private async onDelete(prompt: PromptTemplate) {
    if (!confirm(`Delete prompt "${prompt.name}"?`)) return;
    try {
      await this.http.delete(`/prompts/${prompt._id}`);
      this.loadPrompts();
    } catch (e) {
      this.error = e instanceof Error ? e.message : 'Failed to delete';
    }
  }

  private async onSetDefault(prompt: PromptTemplate) {
    try {
      await this.http.post(`/prompts/${prompt._id}/set-default`);
      this.loadPrompts();
    } catch (e) {
      this.error = e instanceof Error ? e.message : 'Failed to set default';
    }
  }

  private onAdd() {
    this.dispatchEvent(new CustomEvent('prompt-add', { bubbles: true, composed: true }));
  }

  render() {
    return html`
      <div class="alx-card">
        <div class="alx-card-header">
          <h3>Prompt Templates</h3>
          <button class="alx-btn-primary alx-btn-sm" @click=${this.onAdd}>+ Add Template</button>
        </div>

        ${this.error ? html`<div class="alx-error">${this.error}</div>` : ''}
        ${this.loading ? html`<div class="alx-loading"><span class="alx-spinner"></span> Loading...</div>` : ''}

        ${!this.loading && this.prompts.length === 0 && !this.error
          ? html`<div class="alx-empty">No prompt templates</div>`
          : ''}

        ${!this.loading ? this.prompts.map(p => html`
          <div class="prompt-item">
            <div class="prompt-info">
              <div class="prompt-name">
                ${p.name}
                ${p.isDefault ? html`<span class="alx-badge alx-badge-info">Default</span>` : ''}
                ${!p.isActive ? html`<span class="alx-badge alx-badge-muted">Inactive</span>` : ''}
              </div>
              ${p.description ? html`<div class="prompt-desc">${p.description}</div>` : ''}
              <div class="prompt-meta">${p.sections?.length ?? 0} sections</div>
            </div>
            <div class="actions">
              ${!p.isDefault ? html`
                <button class="alx-btn-sm" @click=${() => this.onSetDefault(p)}>Set Default</button>
              ` : ''}
              <button class="alx-btn-icon" title="Edit" @click=${() => this.onEdit(p)}>&#9998;</button>
              <button class="alx-btn-icon danger" title="Delete" @click=${() => this.onDelete(p)}>&#10005;</button>
            </div>
          </div>
        `) : ''}
      </div>
    `;
  }
}

safeRegister('alx-chat-prompt-list', AlxChatPromptList);
