import { LitElement, html, css, nothing } from 'lit';
import { customElement, state, property } from 'lit/decorators.js';
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

interface TemplateData {
  _id?: string;
  name: string;
  slug: string;
  category: string;
  audience: string;
  platform: string;
  subject: string;
  body: string;
  textBody: string;
  variables: string[];
  isActive: boolean;
}

const EMPTY_TEMPLATE: TemplateData = {
  name: '',
  slug: '',
  category: '',
  audience: '',
  platform: '',
  subject: '',
  body: '',
  textBody: '',
  variables: [],
  isActive: true,
};

@customElement('alx-template-editor')
export class AlxTemplateEditor extends LitElement {
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
        grid-template-columns: 1fr 1fr;
        gap: 1rem;
      }

      .form-group {
        display: flex;
        flex-direction: column;
      }

      .form-group-full {
        grid-column: 1 / -1;
      }

      textarea {
        min-height: 200px;
        font-family: 'Fira Code', 'Cascadia Code', monospace;
        font-size: 0.8rem;
        resize: vertical;
      }

      .variables-input {
        display: flex;
        flex-wrap: wrap;
        gap: 0.5rem;
        align-items: center;
      }

      .variable-tag {
        display: inline-flex;
        align-items: center;
        gap: 0.25rem;
        padding: 0.2rem 0.5rem;
        background: color-mix(in srgb, var(--alx-primary) 15%, transparent);
        color: var(--alx-primary);
        border-radius: var(--alx-radius);
        font-size: 0.8rem;
      }

      .variable-tag button {
        background: none;
        border: none;
        color: var(--alx-text-muted);
        cursor: pointer;
        padding: 0;
        font-size: 1rem;
        line-height: 1;
      }

      .add-variable {
        display: flex;
        gap: 0.5rem;
        margin-top: 0.5rem;
      }

      .add-variable input {
        width: 180px;
      }

      .actions {
        display: flex;
        gap: 0.75rem;
        margin-top: 1.5rem;
      }

      .preview-frame {
        width: 100%;
        height: 400px;
        border: 1px solid var(--alx-border);
        border-radius: var(--alx-radius);
        background: #fff;
        margin-top: 0.5rem;
      }
    `,
  ];

  @property({ attribute: 'template-id' }) templateId = '';
  @property({ type: String }) categories = '';
  @property({ type: String }) audiences = '';
  @property({ type: String }) platforms = '';

  @state() private _form: TemplateData = { ...EMPTY_TEMPLATE };
  @state() private _loading = false;
  @state() private _saving = false;
  @state() private _error = '';
  @state() private _previewHtml = '';
  @state() private _previewing = false;
  @state() private _newVariable = '';

  private __api?: RuleAPI;
  private get _api(): RuleAPI {
    if (!this.__api) this.__api = new RuleAPI();
    return this.__api;
  }

  override connectedCallback(): void {
    super.connectedCallback();
    if (this.templateId) {
      this._loadTemplate();
    }
  }

  override updated(changed: Map<string, unknown>): void {
    if (changed.has('templateId') && this.templateId) {
      this._loadTemplate();
    }
  }

  private _parseJsonAttr(val: string): string[] {
    if (!val) return [];
    try {
      return JSON.parse(val);
    } catch {
      return [];
    }
  }

  private async _loadTemplate(): Promise<void> {
    this._loading = true;
    this._error = '';
    try {
      const res = await this._api.listTemplates({ _id: this.templateId, limit: 1 }) as {
        data: TemplateData[];
      };
      if (res.data.length > 0) {
        this._form = { ...res.data[0] };
      }
    } catch (err) {
      this._error = err instanceof Error ? err.message : 'Failed to load template';
    } finally {
      this._loading = false;
    }
  }

  private _updateField(field: keyof TemplateData, value: unknown): void {
    this._form = { ...this._form, [field]: value };
  }

  private _addVariable(): void {
    const v = this._newVariable.trim();
    if (v && !this._form.variables.includes(v)) {
      this._form = { ...this._form, variables: [...this._form.variables, v] };
      this._newVariable = '';
    }
  }

  private _removeVariable(variable: string): void {
    this._form = {
      ...this._form,
      variables: this._form.variables.filter((v) => v !== variable),
    };
  }

  private async _onPreview(): Promise<void> {
    this._previewing = true;
    this._error = '';
    try {
      const res = (await this._api.previewTemplate({
        body: this._form.body,
        subject: this._form.subject,
        variables: this._form.variables,
      })) as { html: string };
      this._previewHtml = res.html;
    } catch (err) {
      this._error = err instanceof Error ? err.message : 'Preview failed';
    } finally {
      this._previewing = false;
    }
  }

  private async _onSave(): Promise<void> {
    this._saving = true;
    this._error = '';
    try {
      const payload: Record<string, unknown> = { ...this._form };
      delete payload['_id'];

      let result: unknown;
      if (this._form._id) {
        result = await this._api.updateTemplate(this._form._id, payload);
      } else {
        result = await this._api.createTemplate(payload);
      }

      this.dispatchEvent(
        new CustomEvent('alx-template-saved', {
          detail: result,
          bubbles: true,
          composed: true,
        }),
      );
    } catch (err) {
      this._error = err instanceof Error ? err.message : 'Failed to save template';
    } finally {
      this._saving = false;
    }
  }

  private _renderSelect(
    label: string,
    field: keyof TemplateData,
    options: string[],
  ) {
    const value = this._form[field] as string;
    return html`
      <div class="form-group">
        <label>${label}</label>
        <select
          .value=${value}
          @change=${(e: Event) => this._updateField(field, (e.target as HTMLSelectElement).value)}
        >
          <option value="">Select ${label.toLowerCase()}</option>
          ${options.map((o) => html`<option value=${o} ?selected=${value === o}>${o}</option>`)}
        </select>
      </div>
    `;
  }

  override render() {
    if (this._loading) {
      return html`<div class="alx-loading"><div class="alx-spinner"></div></div>`;
    }

    const categories = this._parseJsonAttr(this.categories);
    const audiences = this._parseJsonAttr(this.audiences);
    const platforms = this._parseJsonAttr(this.platforms);
    const isEdit = !!this._form._id;

    return html`
      <div class="alx-card">
        <div class="alx-card-header">
          <h3>${isEdit ? 'Edit Template' : 'Create Template'}</h3>
        </div>

        ${this._error ? html`<div class="alx-error">${this._error}</div>` : nothing}

        <div class="form-grid">
          <div class="form-group">
            <label>Name</label>
            <input
              type="text"
              .value=${this._form.name}
              @input=${(e: Event) => this._updateField('name', (e.target as HTMLInputElement).value)}
              placeholder="Template name"
            />
          </div>

          <div class="form-group">
            <label>Slug</label>
            <input
              type="text"
              .value=${this._form.slug}
              @input=${(e: Event) => this._updateField('slug', (e.target as HTMLInputElement).value)}
              placeholder="template-slug"
            />
          </div>

          ${categories.length > 0
            ? this._renderSelect('Category', 'category', categories)
            : html`
                <div class="form-group">
                  <label>Category</label>
                  <input
                    type="text"
                    .value=${this._form.category}
                    @input=${(e: Event) =>
                      this._updateField('category', (e.target as HTMLInputElement).value)}
                    placeholder="Category"
                  />
                </div>
              `}

          ${audiences.length > 0
            ? this._renderSelect('Audience', 'audience', audiences)
            : html`
                <div class="form-group">
                  <label>Audience</label>
                  <input
                    type="text"
                    .value=${this._form.audience}
                    @input=${(e: Event) =>
                      this._updateField('audience', (e.target as HTMLInputElement).value)}
                    placeholder="Audience"
                  />
                </div>
              `}

          ${platforms.length > 0
            ? this._renderSelect('Platform', 'platform', platforms)
            : html`
                <div class="form-group">
                  <label>Platform</label>
                  <input
                    type="text"
                    .value=${this._form.platform}
                    @input=${(e: Event) =>
                      this._updateField('platform', (e.target as HTMLInputElement).value)}
                    placeholder="Platform"
                  />
                </div>
              `}

          <div class="form-group">
            <label>Subject</label>
            <input
              type="text"
              .value=${this._form.subject}
              @input=${(e: Event) =>
                this._updateField('subject', (e.target as HTMLInputElement).value)}
              placeholder="Email subject (supports {{variables}})"
            />
          </div>

          <div class="form-group form-group-full">
            <label>Body (MJML / Handlebars)</label>
            <textarea
              .value=${this._form.body}
              @input=${(e: Event) =>
                this._updateField('body', (e.target as HTMLTextAreaElement).value)}
              placeholder="<mjml>...</mjml>"
            ></textarea>
          </div>

          <div class="form-group form-group-full">
            <label>Text Body (plain text fallback)</label>
            <textarea
              .value=${this._form.textBody}
              @input=${(e: Event) =>
                this._updateField('textBody', (e.target as HTMLTextAreaElement).value)}
              placeholder="Plain text version of the email"
              style="min-height: 100px"
            ></textarea>
          </div>

          <div class="form-group form-group-full">
            <label>Variables</label>
            <div class="variables-input">
              ${this._form.variables.map(
                (v) => html`
                  <span class="variable-tag">
                    {{${v}}}
                    <button @click=${() => this._removeVariable(v)}>&times;</button>
                  </span>
                `,
              )}
            </div>
            <div class="add-variable">
              <input
                type="text"
                .value=${this._newVariable}
                @input=${(e: Event) =>
                  (this._newVariable = (e.target as HTMLInputElement).value)}
                @keydown=${(e: KeyboardEvent) => {
                  if (e.key === 'Enter') {
                    e.preventDefault();
                    this._addVariable();
                  }
                }}
                placeholder="Variable name"
              />
              <button class="alx-btn-sm" @click=${this._addVariable}>Add</button>
            </div>
          </div>

          ${this._previewHtml
            ? html`
                <div class="form-group form-group-full">
                  <label>Preview</label>
                  <iframe
                    class="preview-frame"
                    .srcdoc=${this._previewHtml}
                    sandbox=""
                  ></iframe>
                </div>
              `
            : nothing}
        </div>

        <div class="actions">
          <button
            class="alx-btn-primary"
            ?disabled=${this._saving}
            @click=${this._onSave}
          >
            ${this._saving ? 'Saving...' : isEdit ? 'Update Template' : 'Create Template'}
          </button>
          <button
            ?disabled=${this._previewing || !this._form.body}
            @click=${this._onPreview}
          >
            ${this._previewing ? 'Loading...' : 'Preview'}
          </button>
        </div>
      </div>
    `;
  }
}

declare global {
  interface HTMLElementTagNameMap {
    'alx-template-editor': AlxTemplateEditor;
  }
}
