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
  alxChatBadgeStyles,
  alxChatLoadingStyles,
  alxChatDrawerStyles,
  alxChatToggleStyles,
} from '../../styles/shared.js';

interface PromptSection {
  key: string;
  label: string;
  content: string;
  enabled: boolean;
  isSystem: boolean;
  order: number;
}

export class AlxChatPromptEditor extends LitElement {
  static styles = [
    alxChatResetStyles,
    alxChatThemeStyles,
    alxChatDensityStyles,
    alxChatButtonStyles,
    alxChatInputStyles,
    alxChatBadgeStyles,
    alxChatLoadingStyles,
    alxChatDrawerStyles,
    alxChatToggleStyles,
    css`
      :host { display: block; }

      .editor-container {
        background: var(--alx-surface);
        border: 1px solid var(--alx-border);
        border-radius: var(--alx-radius);
        overflow: hidden;
      }

      .editor-header {
        padding: 1rem;
        border-bottom: 1px solid var(--alx-border);
      }

      .editor-body {
        padding: 1rem;
      }

      .section-list {
        display: flex;
        flex-direction: column;
        gap: 0.5rem;
        margin-top: 1rem;
      }

      .section-item {
        border: 1px solid var(--alx-border);
        border-radius: var(--alx-radius);
        overflow: hidden;
        transition: border-color 0.15s;
      }

      .section-item:hover {
        border-color: color-mix(in srgb, var(--alx-primary) 40%, var(--alx-border));
      }

      .section-header {
        display: flex;
        align-items: center;
        gap: 0.5rem;
        padding: 0.5rem 0.75rem;
        background: var(--alx-surface-alt);
        cursor: pointer;
      }

      .section-drag {
        cursor: grab;
        color: var(--alx-text-muted);
        font-size: 1rem;
        user-select: none;
      }

      .section-key {
        font-weight: 600;
        font-size: 0.8125rem;
        flex: 1;
      }

      .section-label {
        font-size: 0.75rem;
        color: var(--alx-text-muted);
      }

      .section-content {
        padding: 0.75rem;
        display: none;
      }

      .section-content.expanded {
        display: block;
      }

      .section-content textarea {
        min-height: 120px;
        font-family: 'JetBrains Mono', 'Fira Code', 'Consolas', monospace;
        font-size: 0.75rem;
      }

      .preview-area {
        margin-top: 1rem;
        padding: 0.75rem;
        background: var(--alx-bg);
        border: 1px solid var(--alx-border);
        border-radius: var(--alx-radius);
        font-family: 'JetBrains Mono', 'Fira Code', 'Consolas', monospace;
        font-size: 0.75rem;
        line-height: 1.6;
        white-space: pre-wrap;
        max-height: 300px;
        overflow-y: auto;
      }
    `,
  ];

  @property({ type: Boolean }) open = false;
  @property({ type: String }) promptId = '';

  @state() private name = '';
  @state() private description = '';
  @state() private sections: PromptSection[] = [];
  @state() private expandedIndex = -1;
  @state() private saving = false;
  @state() private loading = false;
  @state() private error = '';
  @state() private previewText = '';
  @state() private showPreview = false;

  private http!: HttpClient;

  connectedCallback() {
    super.connectedCallback();
    this.http = new HttpClient(AlxChatConfig.getApiUrl('chatAi'));
  }

  updated(changed: Map<string, unknown>) {
    if (changed.has('open') && this.open) {
      this.previewText = '';
      this.showPreview = false;
      if (this.promptId) {
        this.loadPrompt();
      } else {
        this.resetForm();
      }
    }
  }

  private resetForm() {
    this.name = '';
    this.description = '';
    this.sections = [];
    this.expandedIndex = -1;
    this.error = '';
  }

  private async loadPrompt() {
    this.loading = true;
    try {
      const p = await this.http.get<Record<string, unknown>>(`/prompts/${this.promptId}`);
      this.name = (p.name as string) || '';
      this.description = (p.description as string) || '';
      this.sections = (p.sections as PromptSection[]) || [];
    } catch (e) {
      this.error = e instanceof Error ? e.message : 'Failed to load prompt';
    } finally {
      this.loading = false;
    }
  }

  private toggleSection(index: number) {
    this.expandedIndex = this.expandedIndex === index ? -1 : index;
  }

  private updateSection(index: number, field: keyof PromptSection, value: unknown) {
    const updated = [...this.sections];
    updated[index] = { ...updated[index], [field]: value };
    this.sections = updated;
  }

  private addSection() {
    const order = this.sections.length;
    this.sections = [...this.sections, {
      key: `section_${order}`,
      label: 'New Section',
      content: '',
      enabled: true,
      isSystem: false,
      order,
    }];
    this.expandedIndex = this.sections.length - 1;
  }

  private removeSection(index: number) {
    this.sections = this.sections.filter((_, i) => i !== index);
    if (this.expandedIndex === index) this.expandedIndex = -1;
  }

  private moveSection(index: number, direction: -1 | 1) {
    const target = index + direction;
    if (target < 0 || target >= this.sections.length) return;
    const updated = [...this.sections];
    [updated[index], updated[target]] = [updated[target], updated[index]];
    updated.forEach((s, i) => s.order = i);
    this.sections = updated;
    this.expandedIndex = target;
  }

  private async onPreview() {
    try {
      const result = await this.http.post<{ preview: string }>(`/prompts/preview`, {
        name: this.name,
        sections: this.sections,
      });
      this.previewText = result.preview || this.sections
        .filter(s => s.enabled)
        .map(s => `--- ${s.label} ---\n${s.content}`)
        .join('\n\n');
      this.showPreview = true;
    } catch {
      // Fallback: local preview
      this.previewText = this.sections
        .filter(s => s.enabled)
        .map(s => `--- ${s.label} ---\n${s.content}`)
        .join('\n\n');
      this.showPreview = true;
    }
  }

  private async onSave() {
    if (!this.name.trim()) {
      this.error = 'Name is required';
      return;
    }
    this.saving = true;
    this.error = '';
    try {
      const body = {
        name: this.name,
        description: this.description || undefined,
        sections: this.sections,
      };
      if (this.promptId) {
        await this.http.put(`/prompts/${this.promptId}`, body);
      } else {
        await this.http.post('/prompts', body);
      }
      this.dispatchEvent(new CustomEvent('prompt-saved', { bubbles: true, composed: true }));
      this.close();
    } catch (e) {
      this.error = e instanceof Error ? e.message : 'Failed to save';
    } finally {
      this.saving = false;
    }
  }

  private close() {
    this.open = false;
    this.promptId = '';
    this.dispatchEvent(new CustomEvent('drawer-close', { bubbles: true, composed: true }));
  }

  render() {
    return html`
      <div class="drawer-overlay ${this.open ? 'open' : ''}" @click=${(e: Event) => {
        if (e.target === e.currentTarget) this.close();
      }}>
        <div class="drawer-panel" style="width:600px;">
          <div class="drawer-header">
            <h3>${this.promptId ? 'Edit Prompt Template' : 'New Prompt Template'}</h3>
            <button class="drawer-close" @click=${this.close}>&times;</button>
          </div>

          <div class="drawer-body">
            ${this.loading ? html`<div class="alx-loading"><span class="alx-spinner"></span></div>` : ''}
            ${this.error ? html`<div class="alx-error">${this.error}</div>` : ''}

            ${!this.loading ? html`
              <div class="form-group">
                <label>Template Name</label>
                <input type="text" .value=${this.name}
                  @input=${(e: Event) => this.name = (e.target as HTMLInputElement).value}
                  placeholder="e.g. Customer Support Agent" />
              </div>

              <div class="form-group">
                <label>Description</label>
                <input type="text" .value=${this.description}
                  @input=${(e: Event) => this.description = (e.target as HTMLInputElement).value}
                  placeholder="Brief description" />
              </div>

              <div style="display:flex;align-items:center;justify-content:space-between;margin-top:1rem;">
                <label style="margin:0;">Sections</label>
                <div style="display:flex;gap:0.375rem;">
                  <button class="alx-btn-sm" @click=${this.onPreview}>Preview</button>
                  <button class="alx-btn-sm" @click=${this.addSection}>+ Add Section</button>
                </div>
              </div>

              <div class="section-list">
                ${this.sections.map((section, i) => html`
                  <div class="section-item">
                    <div class="section-header" @click=${() => this.toggleSection(i)}>
                      <span class="section-drag" @click=${(e: Event) => e.stopPropagation()}>
                        <span @click=${() => this.moveSection(i, -1)} style="cursor:pointer;">&uarr;</span>
                        <span @click=${() => this.moveSection(i, 1)} style="cursor:pointer;">&darr;</span>
                      </span>
                      <span class="section-key">${section.key}</span>
                      <span class="section-label">${section.label}</span>
                      ${section.isSystem ? html`<span class="alx-badge alx-badge-muted">System</span>` : ''}
                      <label class="toggle" @click=${(e: Event) => e.stopPropagation()}>
                        <input type="checkbox" .checked=${section.enabled}
                          @change=${(e: Event) => this.updateSection(i, 'enabled', (e.target as HTMLInputElement).checked)} />
                        <span class="toggle-slider"></span>
                      </label>
                      ${!section.isSystem ? html`
                        <button class="alx-btn-icon danger" title="Remove"
                          @click=${(e: Event) => { e.stopPropagation(); this.removeSection(i); }}>&#10005;</button>
                      ` : ''}
                    </div>
                    <div class="section-content ${this.expandedIndex === i ? 'expanded' : ''}">
                      <div class="form-row">
                        <div class="form-group">
                          <label>Key</label>
                          <input type="text" .value=${section.key}
                            @input=${(e: Event) => this.updateSection(i, 'key', (e.target as HTMLInputElement).value)} />
                        </div>
                        <div class="form-group">
                          <label>Label</label>
                          <input type="text" .value=${section.label}
                            @input=${(e: Event) => this.updateSection(i, 'label', (e.target as HTMLInputElement).value)} />
                        </div>
                      </div>
                      <div class="form-group">
                        <label>Content</label>
                        <textarea .value=${section.content}
                          @input=${(e: Event) => this.updateSection(i, 'content', (e.target as HTMLTextAreaElement).value)}
                          placeholder="Prompt section content..."></textarea>
                      </div>
                    </div>
                  </div>
                `)}
              </div>

              ${this.showPreview ? html`
                <div class="preview-area">${this.previewText}</div>
              ` : ''}

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

safeRegister('alx-chat-prompt-editor', AlxChatPromptEditor);
