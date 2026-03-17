import { LitElement, html, nothing } from 'lit';
import { state, property } from 'lit/decorators.js';
import { safeRegister } from '../../utils/safe-register.js';
import { alxBaseStyles } from '../../styles/theme.js';
import {
  alxDensityStyles,
  alxResetStyles,
  alxTypographyStyles,
  alxButtonStyles,
  alxInputStyles,
  alxCardStyles,
  alxLoadingStyles,
  alxToolbarStyles,
  alxToggleStyles,
  alxTooltipStyles,
} from '../../styles/shared.js';
import { RuleAPI } from '../../api/rule.api.js';
import type { TemplateData } from './alx-template-editor.types.js';
import { EMPTY_TEMPLATE } from './alx-template-editor.types.js';
import { templateEditorStyles } from './alx-template-editor.styles.js';

export class AlxTemplateEditor extends LitElement {
  static override styles = [
    alxBaseStyles,
    alxDensityStyles,
    alxResetStyles,
    alxTypographyStyles,
    alxButtonStyles,
    alxInputStyles,
    alxCardStyles,
    alxLoadingStyles,
    alxToolbarStyles,
    alxToggleStyles,
    alxTooltipStyles,
    templateEditorStyles,
  ];

  @property({ type: String, reflect: true }) density: 'default' | 'compact' = 'default';
  @property({ type: Boolean, attribute: 'hide-header' }) hideHeader = false;
  @property({ attribute: 'template-id' }) templateId = '';
  @property({ type: String }) categories = '';
  @property({ type: String }) audiences = '';
  @property({ type: String }) platforms = '';

  @state() private _form: TemplateData = { ...EMPTY_TEMPLATE, subjects: [''], bodies: [''], preheaders: [], fields: {} };
  @state() private _showHelp = false;
  @state() private _loading = false;
  @state() private _saving = false;
  @state() private _deleting = false;
  @state() private _error = '';
  @state() private _previewHtml = '';
  @state() private _previewing = false;
  @state() private _newVariable = '';
  @state() private _newFieldKey = '';

  private __api?: RuleAPI;
  private get _api(): RuleAPI {
    if (!this.__api) this.__api = new RuleAPI();
    return this.__api;
  }

  constructor() {
    super();
    this._showHelp = localStorage.getItem('alx-help-template') === 'true';
  }

  private _toggleHelp(): void {
    this._showHelp = !this._showHelp;
    localStorage.setItem('alx-help-template', String(this._showHelp));
  }

  override willUpdate(changed: Map<PropertyKey, unknown>): void {
    if (changed.has('templateId')) {
      if (this.templateId) {
        this._loadTemplate();
      } else {
        this._form = { ...EMPTY_TEMPLATE, subjects: [''], bodies: [''], preheaders: [], fields: {} };
        this._error = '';
        this._previewHtml = '';
      }
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
        templates: (TemplateData & { subject?: string; body?: string })[];
      };
      if (res.templates && res.templates.length > 0) {
        const t = res.templates[0];
        this._form = {
          ...t,
          subjects: t.subjects?.length ? [...t.subjects] : t.subject ? [t.subject] : [''],
          bodies: t.bodies?.length ? [...t.bodies] : t.body ? [t.body] : [''],
          preheaders: t.preheaders ? [...t.preheaders] : [],
          fields: t.fields ? { ...t.fields } : {},
        };
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

  // --- Multi-value helpers ---

  private _updateArrayItem(field: 'subjects' | 'bodies' | 'preheaders', index: number, value: string): void {
    const arr = [...this._form[field]];
    arr[index] = value;
    this._form = { ...this._form, [field]: arr };
  }

  private _addArrayItem(field: 'subjects' | 'bodies' | 'preheaders'): void {
    this._form = { ...this._form, [field]: [...this._form[field], ''] };
  }

  private _removeArrayItem(field: 'subjects' | 'bodies' | 'preheaders', index: number): void {
    const arr = this._form[field];
    if ((field === 'subjects' || field === 'bodies') && arr.length <= 1) return;
    this._form = { ...this._form, [field]: arr.filter((_, i) => i !== index) };
  }

  // --- Fields (key-value) helpers ---

  private _addFieldEntry(): void {
    const key = this._newFieldKey.trim();
    if (!key || key in this._form.fields) return;
    this._form = { ...this._form, fields: { ...this._form.fields, [key]: '' } };
    this._newFieldKey = '';
  }

  private _updateFieldValue(key: string, value: string): void {
    this._form = { ...this._form, fields: { ...this._form.fields, [key]: value } };
  }

  private _removeFieldEntry(key: string): void {
    const { [key]: _, ...rest } = this._form.fields;
    this._form = { ...this._form, fields: rest };
  }

  // --- Variables ---

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
        body: this._form.bodies[0] ?? '',
        subject: this._form.subjects[0] ?? '',
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
    if (!this._form.name.trim()) {
      this._error = 'Template name is required';
      return;
    }
    if (!this._form.slug.trim()) {
      this._error = 'Template slug is required';
      return;
    }
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

  private async _onDelete(): Promise<void> {
    if (!this._form._id) return;
    if (!confirm('Delete this template? This action cannot be undone.')) return;

    this._deleting = true;
    this._error = '';
    try {
      await this._api.deleteTemplate(this._form._id);
      this.dispatchEvent(
        new CustomEvent('alx-template-deleted', {
          detail: { _id: this._form._id },
          bubbles: true,
          composed: true,
        }),
      );
    } catch (err) {
      this._error = err instanceof Error ? err.message : 'Failed to delete template';
    } finally {
      this._deleting = false;
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

  private _renderMultiInput(label: string, field: 'subjects' | 'preheaders', placeholder: string, required: boolean) {
    const items = this._form[field];
    const helperMap: Record<string, string> = {
      subjects: 'Supports {{variables}}. Multiple variants enable A/B testing.',
    };
    const hint = helperMap[field];
    return html`
      <div class="form-group form-group-full">
        <label class="section-label">${label}</label>
        ${hint ? html`<span class="helper-text">${hint}</span>` : nothing}
        <div class="multi-list">
          ${items.map(
            (val, i) => html`
              <div class="multi-row">
                <input
                  type="text"
                  .value=${val}
                  @input=${(e: Event) => this._updateArrayItem(field, i, (e.target as HTMLInputElement).value)}
                  placeholder=${placeholder}
                />
                ${!required || items.length > 1
                  ? html`<button class="remove-btn" @click=${() => this._removeArrayItem(field, i)} title="Remove">&times;</button>`
                  : nothing}
              </div>
            `,
          )}
          <div>
            <button class="alx-btn-sm" @click=${() => this._addArrayItem(field)}>+ Add ${label.replace(/s$/, '')}</button>
          </div>
        </div>
      </div>
    `;
  }

  private _renderMultiTextarea(label: string, field: 'bodies', placeholder: string) {
    const items = this._form[field];
    return html`
      <div class="form-group form-group-full">
        <label class="section-label">${label}</label>
        <span class="helper-text">HTML email body. Use MJML syntax for responsive emails.</span>
        <div class="multi-list">
          ${items.map(
            (val, i) => html`
              <div class="multi-row">
                <textarea
                  .value=${val}
                  @input=${(e: Event) => this._updateArrayItem(field, i, (e.target as HTMLTextAreaElement).value)}
                  placeholder=${placeholder}
                ></textarea>
                ${items.length > 1
                  ? html`<button class="remove-btn" @click=${() => this._removeArrayItem(field, i)} title="Remove">&times;</button>`
                  : nothing}
              </div>
            `,
          )}
          <div>
            <button class="alx-btn-sm" @click=${() => this._addArrayItem(field)}>+ Add Body</button>
          </div>
        </div>
      </div>
    `;
  }

  private _renderFieldsEditor() {
    const entries = Object.entries(this._form.fields);
    return html`
      <div class="form-group form-group-full">
        <label class="section-label">Fields</label>
        <span class="helper-text">Default placeholder values. Overridden by candidate data.</span>
        <div class="multi-list" style="margin-top:0.5rem">
          ${entries.map(
            ([key, val]) => html`
              <div class="kv-row">
                <input type="text" .value=${key} disabled placeholder="Key" />
                <input
                  type="text"
                  .value=${val}
                  @input=${(e: Event) => this._updateFieldValue(key, (e.target as HTMLInputElement).value)}
                  placeholder="Default value"
                />
                <button class="remove-btn" @click=${() => this._removeFieldEntry(key)} title="Remove">&times;</button>
              </div>
            `,
          )}
          <div class="kv-row">
            <input
              type="text"
              .value=${this._newFieldKey}
              @input=${(e: Event) => (this._newFieldKey = (e.target as HTMLInputElement).value)}
              @keydown=${(e: KeyboardEvent) => {
                if (e.key === 'Enter') {
                  e.preventDefault();
                  this._addFieldEntry();
                }
              }}
              placeholder="New field key"
            />
            <button class="alx-btn-sm" @click=${this._addFieldEntry}>+ Add Field</button>
          </div>
        </div>
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
        ${this.hideHeader ? '' : html`<div class="alx-card-header"><h3>${isEdit ? 'Edit Template' : 'Create Template'}</h3></div>`}

        <div style="display:flex;justify-content:flex-end;margin-bottom:0.25rem">
          <button class="help-toggle ${this._showHelp ? 'open' : ''}" @click=${this._toggleHelp}>?</button>
        </div>
        ${this._showHelp ? html`
          <div class="help-panel">
            <strong>How templates work:</strong>
            <p>Templates define the email content. A rule picks a template and sends it to matched recipients.</p>
            <ul>
              <li><strong>Name / Slug</strong> — Internal name and URL-friendly identifier</li>
              <li><strong>Category / Audience / Platform</strong> — Organize and filter templates</li>
              <li><strong>Subjects</strong> — Email subject lines. Add multiple for A/B testing — one is picked randomly per send. Use {{variable}} for personalization.</li>
              <li><strong>Bodies</strong> — HTML email body using MJML syntax (responsive email markup). Add multiple for A/B testing.</li>
              <li><strong>Preheaders</strong> — Preview text shown in inbox after the subject line</li>
              <li><strong>Variables</strong> — Placeholder names (e.g. "name", "company"). Values come from recipient data at send time.</li>
              <li><strong>Fields</strong> — Default values for variables when recipient data is missing</li>
              <li><strong>Text Body</strong> — Plain text fallback for email clients that don't support HTML</li>
            </ul>
          </div>
        ` : ''}

        ${this._error ? html`<div class="alx-error">${this._error}</div>` : nothing}

        <div class="info-banner">Templates define the email content sent to recipients. Use <code>${'{{variable}}'}</code> syntax for personalization. Add multiple subject/body variants for A/B testing.</div>

        <div class="form-grid">
          <!-- Basic Info -->
          <div class="form-group">
            <label>Name</label>
            <input
              type="text"
              .value=${this._form.name}
              @input=${(e: Event) => this._updateField('name', (e.target as HTMLInputElement).value)}
              placeholder="e.g. Welcome Email"
            />
          </div>

          <div class="form-group">
            <label>Slug</label>
            <input
              type="text"
              .value=${this._form.slug}
              @input=${(e: Event) => this._updateField('slug', (e.target as HTMLInputElement).value)}
              placeholder="e.g. welcome-email"
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
                    placeholder="e.g. engagement, onboarding"
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
                    placeholder="e.g. provider, customer"
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
                    placeholder="e.g. app, web"
                  />
                </div>
              `}

          <!-- Subjects -->
          ${this._renderMultiInput('Subjects', 'subjects', 'Email subject (supports {{variables}})', true)}

          <!-- Bodies -->
          ${this._renderMultiTextarea('Bodies', 'bodies', '<mjml>...</mjml>')}

          <!-- Preheaders -->
          ${this._renderMultiInput('Preheaders', 'preheaders', 'Preview text', false)}
          ${this._form.preheaders.length === 0
            ? html`
                <div class="form-group form-group-full" style="margin-top:-0.5rem">
                  <span class="helper-text">Preview text shown in inbox listings</span>
                  <div><button class="alx-btn-sm" @click=${() => this._addArrayItem('preheaders')}>+ Add Preheader</button></div>
                </div>
              `
            : html`<div class="form-group form-group-full" style="margin-top:-0.75rem"><span class="helper-text">Preview text shown in inbox listings</span></div>`}

          <!-- Fields -->
          ${this._renderFieldsEditor()}

          <!-- Text Body -->
          <div class="form-group form-group-full">
            <label class="section-label">Text Body</label>
            <textarea
              .value=${this._form.textBody}
              @input=${(e: Event) =>
                this._updateField('textBody', (e.target as HTMLTextAreaElement).value)}
              placeholder="Plain text version of the email"
              style="min-height: 100px"
            ></textarea>
          </div>

          <!-- Variables -->
          <div class="form-group form-group-full">
            <label class="section-label">Variables</label>
            <span class="helper-text">Define placeholder names used in subjects and bodies. Values are filled from recipient data at send time.</span>
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
                    sandbox
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
            ?disabled=${this._previewing || !this._form.bodies[0]}
            @click=${this._onPreview}
          >
            ${this._previewing ? 'Loading...' : 'Preview'}
          </button>
          ${isEdit
            ? html`
                <span class="spacer"></span>
                <button
                  class="alx-btn-danger"
                  ?disabled=${this._deleting}
                  @click=${this._onDelete}
                >
                  ${this._deleting ? 'Deleting...' : 'Delete'}
                </button>
              `
            : nothing}
        </div>
      </div>
    `;
  }
}
safeRegister('alx-template-editor', AlxTemplateEditor);

declare global {
  interface HTMLElementTagNameMap {
    'alx-template-editor': AlxTemplateEditor;
  }
}
