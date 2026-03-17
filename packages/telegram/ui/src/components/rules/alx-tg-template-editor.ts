import { LitElement, html, css } from 'lit';
import { state, property } from 'lit/decorators.js';
import { safeRegister } from '../../utils/safe-register.js';
import { alxBaseStyles } from '../../styles/theme.js';
import {
  alxDensityStyles,
  alxButtonStyles,
  alxInputStyles,
  alxCardStyles,
  alxLoadingStyles,
} from '../../styles/shared.js';
import { TelegramRuleAPI } from '../../api/rule.api.js';

interface MessageVariant {
  text: string;
}

interface FieldEntry {
  key: string;
  value: string;
}

export class AlxTgTemplateEditor extends LitElement {
  static override styles = [
    alxBaseStyles,
    alxDensityStyles,
    alxButtonStyles,
    alxInputStyles,
    alxCardStyles,
    alxLoadingStyles,
    css`
      :host {
        display: block;
      }
      .form-row {
        gap: 0.625rem;
      }
      .form-group.full {
        grid-column: 1 / -1;
      }
      .form-section-title {
        grid-column: 1 / -1;
        margin-top: 0.5rem;
      }
      .form-actions {
        justify-content: space-between;
      }
      .form-actions-end {
        display: flex;
        gap: 0.5rem;
      }
      .message-item {
        display: flex;
        gap: 0.5rem;
        align-items: flex-start;
        margin-bottom: 0.5rem;
      }
      .message-item textarea {
        flex: 1;
      }
      .field-row {
        display: flex;
        gap: 0.5rem;
        align-items: center;
        margin-bottom: 0.375rem;
      }
      .field-row input {
        flex: 1;
      }
      .preview-box {
        padding: 0.75rem;
        background: color-mix(in srgb, var(--alx-info) 6%, transparent);
        border: 1px solid color-mix(in srgb, var(--alx-info) 20%, transparent);
        border-radius: var(--alx-radius);
        font-size: 0.8125rem;
        white-space: pre-wrap;
        margin-bottom: 0.75rem;
      }
    `,
  ];

  @property({ type: String, reflect: true }) density: 'default' | 'compact' = 'default';
  @property({ type: Boolean, attribute: 'hide-header' }) hideHeader = false;
  @property({ attribute: 'template-id' }) templateId = '';

  @state() private name = '';
  @state() private messages: MessageVariant[] = [{ text: '' }];
  @state() private category = '';
  @state() private platform = '';
  @state() private audience = '';
  @state() private mediaUrl = '';
  @state() private fields: FieldEntry[] = [];
  @state() private preview = '';
  @state() private loading = false;
  @state() private saving = false;
  @state() private error = '';

  private _api?: TelegramRuleAPI;
  private get api(): TelegramRuleAPI {
    if (!this._api) this._api = new TelegramRuleAPI();
    return this._api;
  }

  override willUpdate(changed: Map<PropertyKey, unknown>): void {
    if (changed.has('templateId')) {
      if (this.templateId) {
        this.loadTemplate();
      } else {
        this._resetForm();
      }
    }
  }

  private _resetForm(): void {
    this.name = '';
    this.messages = [{ text: '' }];
    this.category = '';
    this.platform = '';
    this.audience = '';
    this.mediaUrl = '';
    this.fields = [];
    this.preview = '';
    this.error = '';
  }

  private async loadTemplate(): Promise<void> {
    this.loading = true;
    this.error = '';
    try {
      const t = (await this.api.getTemplate(this.templateId)) as Record<string, unknown>;
      this.name = (t['name'] as string) ?? '';
      this.messages = (t['messages'] as MessageVariant[]) ?? [{ text: '' }];
      this.category = (t['category'] as string) ?? '';
      this.platform = (t['platform'] as string) ?? '';
      this.audience = (t['audience'] as string) ?? '';
      this.mediaUrl = (t['mediaUrl'] as string) ?? '';
      const rawFields = (t['fields'] as Record<string, string>) ?? {};
      this.fields = Object.entries(rawFields).map(([key, value]) => ({ key, value }));
    } catch (e) {
      this.error = e instanceof Error ? e.message : 'Failed to load template';
    } finally {
      this.loading = false;
    }
  }

  private addMessage(): void {
    this.messages = [...this.messages, { text: '' }];
  }

  private removeMessage(index: number): void {
    if (this.messages.length <= 1) return;
    this.messages = this.messages.filter((_, i) => i !== index);
  }

  private updateMessage(index: number, text: string): void {
    this.messages = this.messages.map((m, i) => (i === index ? { text } : m));
  }

  private addField(): void {
    this.fields = [...this.fields, { key: '', value: '' }];
  }

  private removeField(index: number): void {
    this.fields = this.fields.filter((_, i) => i !== index);
  }

  private updateField(index: number, prop: 'key' | 'value', val: string): void {
    this.fields = this.fields.map((f, i) => (i === index ? { ...f, [prop]: val } : f));
  }

  private async onPreview(): Promise<void> {
    try {
      const res = await this.api.previewTemplate({
        messages: this.messages,
        fields: Object.fromEntries(this.fields.map(f => [f.key, f.value])),
      }) as { preview?: string };
      this.preview = res.preview ?? 'Preview not available';
    } catch (e) {
      this.preview = e instanceof Error ? e.message : 'Preview failed';
    }
  }

  private async onSubmit(e: Event): Promise<void> {
    e.preventDefault();
    if (!this.name) {
      this.error = 'Name is required';
      return;
    }

    this.saving = true;
    this.error = '';

    const data: Record<string, unknown> = {
      name: this.name,
      messages: this.messages,
      category: this.category,
      platform: this.platform,
      audience: this.audience,
      mediaUrl: this.mediaUrl,
      fields: Object.fromEntries(this.fields.filter(f => f.key).map(f => [f.key, f.value])),
    };

    try {
      let result: unknown;
      if (this.templateId) {
        result = await this.api.updateTemplate(this.templateId, data);
      } else {
        result = await this.api.createTemplate(data);
      }
      this.dispatchEvent(
        new CustomEvent('alx-template-saved', {
          detail: result,
          bubbles: true,
          composed: true,
        }),
      );
    } catch (e) {
      this.error = e instanceof Error ? e.message : 'Failed to save template';
    } finally {
      this.saving = false;
    }
  }

  private onCancel(): void {
    this.dispatchEvent(
      new CustomEvent('alx-template-cancelled', { bubbles: true, composed: true }),
    );
  }

  private async onDelete(): Promise<void> {
    if (!this.templateId) return;
    if (!confirm('Delete this template?')) return;
    this.saving = true;
    this.error = '';
    try {
      await this.api.deleteTemplate(this.templateId);
      this.dispatchEvent(
        new CustomEvent('alx-template-deleted', {
          detail: { _id: this.templateId },
          bubbles: true,
          composed: true,
        }),
      );
    } catch (e) {
      this.error = e instanceof Error ? e.message : 'Failed to delete template';
    } finally {
      this.saving = false;
    }
  }

  override render() {
    if (this.loading) {
      return html`<div class="alx-loading"><div class="alx-spinner"></div></div>`;
    }

    return html`
      <div class="alx-card">
        ${this.hideHeader ? '' : html`<div class="alx-card-header"><h3>${this.templateId ? 'Edit Template' : 'Create Template'}</h3></div>`}

        ${this.error ? html`<div class="alx-error">${this.error}</div>` : ''}

        <form @submit=${this.onSubmit}>
          <div class="form-row">
            <div class="form-group">
              <label>Name *</label>
              <input
                type="text"
                .value=${this.name}
                @input=${(e: Event) => (this.name = (e.target as HTMLInputElement).value)}
                placeholder="Template name"
                required
              />
            </div>
            <div class="form-group">
              <label>Category</label>
              <input
                type="text"
                .value=${this.category}
                @input=${(e: Event) => (this.category = (e.target as HTMLInputElement).value)}
                placeholder="e.g. outreach, follow-up"
              />
            </div>
            <div class="form-group">
              <label>Platform</label>
              <input
                type="text"
                .value=${this.platform}
                @input=${(e: Event) => (this.platform = (e.target as HTMLInputElement).value)}
                placeholder="e.g. telegram"
              />
            </div>
            <div class="form-group">
              <label>Audience</label>
              <input
                type="text"
                .value=${this.audience}
                @input=${(e: Event) => (this.audience = (e.target as HTMLInputElement).value)}
                placeholder="e.g. new-users"
              />
            </div>

            <div class="form-group full">
              <label>Media Attachment URL</label>
              <input
                type="text"
                .value=${this.mediaUrl}
                @input=${(e: Event) => (this.mediaUrl = (e.target as HTMLInputElement).value)}
                placeholder="https://example.com/image.jpg"
              />
            </div>

            <div class="form-section-title">Message Variants</div>
            <div class="form-group full">
              ${this.messages.map((m, i) => html`
                <div class="message-item">
                  <textarea
                    rows="3"
                    .value=${m.text}
                    @input=${(e: Event) => this.updateMessage(i, (e.target as HTMLTextAreaElement).value)}
                    placeholder="Message variant ${i + 1}... Use {{variable}} for placeholders"
                  ></textarea>
                  <button type="button" class="alx-btn-icon danger" @click=${() => this.removeMessage(i)} title="Remove">&times;</button>
                </div>
              `)}
              <button type="button" class="alx-btn-sm" @click=${this.addMessage}>+ Add Variant</button>
            </div>

            <div class="form-section-title">Custom Fields</div>
            <div class="form-group full">
              ${this.fields.map((f, i) => html`
                <div class="field-row">
                  <input
                    type="text"
                    .value=${f.key}
                    @input=${(e: Event) => this.updateField(i, 'key', (e.target as HTMLInputElement).value)}
                    placeholder="Key"
                  />
                  <input
                    type="text"
                    .value=${f.value}
                    @input=${(e: Event) => this.updateField(i, 'value', (e.target as HTMLInputElement).value)}
                    placeholder="Value"
                  />
                  <button type="button" class="alx-btn-icon danger" @click=${() => this.removeField(i)}>&times;</button>
                </div>
              `)}
              <button type="button" class="alx-btn-sm" @click=${this.addField}>+ Add Field</button>
            </div>
          </div>

          ${this.preview ? html`
            <div class="form-section-title">Preview</div>
            <div class="preview-box">${this.preview}</div>
          ` : ''}

          <div class="form-actions">
            <div>
              ${this.templateId
                ? html`<button type="button" class="alx-btn-danger" ?disabled=${this.saving} @click=${this.onDelete}>Delete</button>`
                : ''}
              <button type="button" class="alx-btn-sm" @click=${this.onPreview}>Preview</button>
            </div>
            <div class="form-actions-end">
              <button type="button" @click=${this.onCancel}>Cancel</button>
              <button type="submit" class="alx-btn-primary" ?disabled=${this.saving}>
                ${this.saving ? 'Saving...' : this.templateId ? 'Update' : 'Create'}
              </button>
            </div>
          </div>
        </form>
      </div>
    `;
  }
}
safeRegister('alx-tg-template-editor', AlxTgTemplateEditor);

declare global {
  interface HTMLElementTagNameMap {
    'alx-tg-template-editor': AlxTgTemplateEditor;
  }
}
