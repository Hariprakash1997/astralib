import { LitElement, html, nothing } from 'lit';
import { state, property } from 'lit/decorators.js';
import { safeRegister } from '../utils/safe-register.js';
import { alxBaseStyles } from '../styles/theme.js';
import {
  alxDensityStyles,
  alxResetStyles,
  alxTypographyStyles,
  alxButtonStyles,
  alxInputStyles,
  alxCardStyles,
  alxLoadingStyles,
} from '../styles/shared.js';
import { RuleEngineAPI } from '../api/rule-engine.api.js';
import type { TemplateData, CollectionSummary, CollectionField, JoinOption } from './alx-rule-editor.types.js';
import { EMPTY_TEMPLATE } from './alx-rule-editor.types.js';
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
    templateEditorStyles,
  ];

  @property() baseUrl = '';
  @property({ attribute: false }) api?: RuleEngineAPI;
  @property({ attribute: 'template-id' }) templateId?: string;
  @property({ type: Array }) platforms: string[] = [];
  @property({ type: Array }) audiences: string[] = [];
  @property({ type: Array }) categories: string[] = [];

  @state() private _form: TemplateData = { ...EMPTY_TEMPLATE, subjects: [''], bodies: [''] };
  @state() private _loading = false;
  @state() private _saving = false;
  @state() private _error = '';
  @state() private _collections: CollectionSummary[] = [];
  @state() private _availableJoins: JoinOption[] = [];
  @state() private _collectionFields: CollectionField[] = [];
  @state() private _showVariablePicker = false;
  @state() private _pickerFields: CollectionField[] = [];
  @state() private _pickerActiveTab = '';

  private _apiInstance?: RuleEngineAPI;

  private get _api(): RuleEngineAPI {
    if (this.api) return this.api;
    if (!this._apiInstance && this.baseUrl) {
      this._apiInstance = RuleEngineAPI.create(this.baseUrl);
    }
    return this._apiInstance!;
  }

  override connectedCallback(): void {
    super.connectedCallback();
    this._loadCollections();

    this.addEventListener('content-changed', ((e: CustomEvent) => {
      const detail = e.detail;
      this._form = { ...this._form, ...detail };
    }) as EventListener);
  }

  override willUpdate(changed: Map<PropertyKey, unknown>): void {
    if (changed.has('templateId')) {
      if (this.templateId) {
        this._loadTemplate();
      } else {
        this._form = { ...EMPTY_TEMPLATE, subjects: [''], bodies: [''] };
        this._error = '';
        this._collectionFields = [];
        this._availableJoins = [];
      }
    }
  }

  override updated(changed: Map<PropertyKey, unknown>): void {
    if (changed.has('_form') || changed.has('_collectionFields')) {
      this._syncSlotContent();
    }
  }

  // --- API calls ---

  private async _loadTemplate(): Promise<void> {
    this._loading = true;
    this._error = '';
    try {
      const res = await this._api.listTemplates({ _id: this.templateId, limit: 1 }) as {
        templates: (TemplateData & { subject?: string; body?: string })[];
      };
      if (res.templates?.length) {
        const t = res.templates[0];
        this._form = {
          ...t,
          description: t.description ?? '',
          subjects: t.subjects?.length ? [...t.subjects] : t.subject ? [t.subject] : [''],
          bodies: t.bodies?.length ? [...t.bodies] : t.body ? [t.body] : [''],
          preheaders: t.preheaders ? [...t.preheaders] : [],
          fields: t.fields ? { ...t.fields } : {},
          variables: t.variables ? [...t.variables] : [],
          collectionName: t.collectionName ?? '',
          joins: t.joins ? [...t.joins] : [],
          attachments: t.attachments ? [...t.attachments] : [],
          metadata: t.metadata ?? {},
        };
        // Load collection context if set
        if (this._form.collectionName) {
          await this._onCollectionLoaded(this._form.collectionName, false);
        }
      }
    } catch (err) {
      this._error = err instanceof Error ? err.message : 'Failed to load template';
    } finally {
      this._loading = false;
    }
  }

  private async _loadCollections(): Promise<void> {
    try {
      const res = await this._api.listCollections() as {
        collections: CollectionSummary[];
      };
      this._collections = res.collections ?? [];
    } catch {
      // collections endpoint may not be configured
    }
  }

  private async _onCollectionLoaded(name: string, resetJoins: boolean): Promise<void> {
    const coll = this._collections.find(c => c.name === name);
    this._availableJoins = coll?.joins ?? [];
    if (resetJoins) {
      this._form = { ...this._form, joins: [] };
    }
    await this._refreshFields();
  }

  private async _refreshFields(): Promise<void> {
    if (!this._form.collectionName) {
      this._collectionFields = [];
      return;
    }
    try {
      const joins = this._form.joins.length ? this._form.joins : undefined;
      const res = await this._api.getCollectionFields(this._form.collectionName, joins) as {
        fields: CollectionField[];
      };
      this._collectionFields = (res.fields ?? []).filter(f => f.type !== 'object');
    } catch {
      this._collectionFields = [];
    }
  }

  // --- Slot data sync ---

  private _syncSlotContent(): void {
    const slotted = this.querySelector('[slot="content"]') as any;
    if (slotted) {
      slotted.bodies = this._form.bodies;
      slotted.subjects = this._form.subjects;
      slotted.preheaders = this._form.preheaders;
      slotted.textBody = this._form.textBody;
      slotted.metadata = this._form.metadata;
      slotted.variables = this._form.variables;
      slotted.collectionFields = this._collectionFields;
    }
  }

  // --- Form helpers ---

  private _updateField(field: keyof TemplateData, value: unknown): void {
    this._form = { ...this._form, [field]: value };
  }

  private _generateSlug(name: string): string {
    return name
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, '-')
      .replace(/(^-|-$)/g, '');
  }

  private _onNameInput(e: Event): void {
    const name = (e.target as HTMLInputElement).value;
    const autoSlug = !this._form._id && (!this._form.slug || this._form.slug === this._generateSlug(this._form.name));
    this._form = {
      ...this._form,
      name,
      ...(autoSlug ? { slug: this._generateSlug(name) } : {}),
    };
  }

  private _onCollectionChange(e: Event): void {
    const name = (e.target as HTMLSelectElement).value;
    this._form = { ...this._form, collectionName: name };
    this._onCollectionLoaded(name, true);
  }

  private _toggleJoin(alias: string): void {
    const joins = this._form.joins.includes(alias)
      ? this._form.joins.filter(j => j !== alias)
      : [...this._form.joins, alias];
    this._form = { ...this._form, joins };
    this._refreshFields();
  }

  // --- Variables ---

  private _removeVariable(variable: string): void {
    this._form = {
      ...this._form,
      variables: this._form.variables.filter(v => v !== variable),
    };
  }

  private _openVariablePicker(): void {
    this._showVariablePicker = true;
    // Build picker fields from collection fields, grouped by source
    this._pickerActiveTab = this._form.collectionName || '';
    this._pickerFields = [...this._collectionFields];
  }

  private _insertVariable(field: CollectionField): void {
    const variable = field.path;
    if (!this._form.variables.includes(variable)) {
      this._form = {
        ...this._form,
        variables: [...this._form.variables, variable],
      };
    }
    this._showVariablePicker = false;
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

  // --- Fallback body handler ---

  private _onFallbackBodyChange(e: Event): void {
    const value = (e.target as HTMLTextAreaElement).value;
    this._updateArrayItem('bodies', 0, value);
  }

  // --- Save / Cancel ---

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
      payload.attachments = (this._form.attachments || []).filter(a => a.filename && a.url);

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

  private _onCancel(): void {
    this.dispatchEvent(
      new CustomEvent('alx-template-cancelled', {
        bubbles: true,
        composed: true,
      }),
    );
  }

  // --- Render helpers ---

  private _renderSelect(label: string, field: keyof TemplateData, options: string[]) {
    const value = this._form[field] as string;
    return html`
      <div class="form-row">
        <label>${label}</label>
        <select
          .value=${value}
          @change=${(e: Event) => this._updateField(field, (e.target as HTMLSelectElement).value)}
        >
          <option value="">Select ${label.toLowerCase()}</option>
          ${options.map(o => html`<option value=${o} ?selected=${value === o}>${o}</option>`)}
        </select>
      </div>
    `;
  }

  private _renderInput(label: string, field: keyof TemplateData, placeholder = '') {
    const value = (this._form[field] as string) ?? '';
    return html`
      <div class="form-row">
        <label>${label}</label>
        <input
          type="text"
          .value=${value}
          @input=${(e: Event) => this._updateField(field, (e.target as HTMLInputElement).value)}
          placeholder=${placeholder}
        />
      </div>
    `;
  }

  private _renderSidebar() {
    return html`
      <div class="editor-sidebar">
        <!-- Name -->
        <div class="sidebar-section">
          <div class="form-row">
            <label>Name</label>
            <input
              type="text"
              .value=${this._form.name}
              @input=${this._onNameInput}
              placeholder="e.g. Welcome Notification"
            />
          </div>
          <div class="form-row">
            <label>Slug</label>
            <input
              type="text"
              .value=${this._form.slug}
              @input=${(e: Event) => this._updateField('slug', (e.target as HTMLInputElement).value)}
              placeholder="auto-generated"
            />
          </div>
          <div class="form-row">
            <label>Description</label>
            <textarea
              rows="2"
              .value=${this._form.description}
              @input=${(e: Event) => this._updateField('description', (e.target as HTMLTextAreaElement).value)}
              placeholder="Brief description"
              style="min-height:auto"
            ></textarea>
          </div>
        </div>

        <!-- Category / Audience / Platform -->
        <div class="sidebar-section">
          ${this.categories.length > 0
            ? this._renderSelect('Category', 'category', this.categories)
            : this._renderInput('Category', 'category', 'e.g. engagement')}
          ${this.audiences.length > 0
            ? this._renderSelect('Audience', 'audience', this.audiences)
            : this._renderInput('Audience', 'audience', 'e.g. provider')}
          ${this.platforms.length > 0
            ? this._renderSelect('Platform', 'platform', this.platforms)
            : this._renderInput('Platform', 'platform', 'e.g. email, telegram')}
        </div>

        <!-- Collection + Joins -->
        ${this._collections.length > 0 ? html`
          <div class="sidebar-section collection-section">
            <div class="form-row">
              <label>Collection</label>
              <select
                .value=${this._form.collectionName}
                @change=${this._onCollectionChange}
              >
                <option value="">No collection</option>
                ${this._collections.map(c => html`
                  <option value=${c.name} ?selected=${this._form.collectionName === c.name}>
                    ${c.label || c.name} (${c.fieldCount} fields)
                  </option>
                `)}
              </select>
            </div>

            ${this._availableJoins.length > 0 ? html`
              <div>
                <label>Joins</label>
                <div class="join-checkboxes">
                  ${this._availableJoins.map(j => html`
                    <label class="join-checkbox">
                      <input
                        type="checkbox"
                        .checked=${this._form.joins.includes(j.alias)}
                        @change=${() => this._toggleJoin(j.alias)}
                      />
                      ${j.label || j.alias}
                    </label>
                  `)}
                </div>
              </div>
            ` : nothing}
          </div>
        ` : nothing}

        <!-- Subjects -->
        <div class="sidebar-section">
          <label>Subjects</label>
          ${this._form.subjects.map((subj, i) => html`
            <div class="form-row" style="display:flex;gap:4px;align-items:center">
              <input
                type="text"
                .value=${subj}
                @input=${(e: Event) => this._updateArrayItem('subjects', i, (e.target as HTMLInputElement).value)}
                placeholder="Subject line"
                style="flex:1"
              />
              ${this._form.subjects.length > 1
                ? html`<button class="alx-btn" style="padding:2px 6px;font-size:12px" @click=${() => this._removeArrayItem('subjects', i)}>&times;</button>`
                : nothing}
            </div>
          `)}
          <button class="alx-btn" style="font-size:11px;padding:2px 8px" @click=${() => this._addArrayItem('subjects')}>+ Subject</button>
        </div>

        <!-- Variables -->
        <div class="sidebar-section variables-section">
          <label>Variables</label>
          <div class="variable-tags">
            ${this._form.variables.map(v => html`
              <span class="variable-tag">
                {{${v}}}
                <span class="remove" @click=${() => this._removeVariable(v)}>&times;</span>
              </span>
            `)}
            <button class="insert-variable-btn" @click=${this._openVariablePicker}>+ Insert Variable</button>
          </div>
        </div>
      </div>
    `;
  }

  private _renderVariablePicker() {
    if (!this._showVariablePicker) return nothing;

    // Group fields by collection source (base collection vs join alias prefix)
    const baseFields: CollectionField[] = [];
    const joinGroups = new Map<string, CollectionField[]>();

    for (const f of this._pickerFields) {
      const dotIdx = f.path.indexOf('.');
      const prefix = dotIdx > 0 ? f.path.substring(0, dotIdx) : '';
      const isJoin = this._form.joins.includes(prefix);
      if (isJoin) {
        if (!joinGroups.has(prefix)) joinGroups.set(prefix, []);
        joinGroups.get(prefix)!.push(f);
      } else {
        baseFields.push(f);
      }
    }

    return html`
      <div class="variable-picker-overlay" @click=${() => { this._showVariablePicker = false; }}>
        <div class="variable-picker" @click=${(e: Event) => e.stopPropagation()}>
          <h3>Insert Variable</h3>

          ${baseFields.length > 0 ? html`
            <div class="picker-group-label">${this._form.collectionName || 'Base'}</div>
            <div class="picker-fields">
              ${baseFields.map(f => html`
                <div class="picker-field" @click=${() => this._insertVariable(f)}>
                  <span>${f.path}</span>
                  <span class="type">${f.type}</span>
                </div>
              `)}
            </div>
          ` : nothing}

          ${[...joinGroups.entries()].map(([alias, fields]) => html`
            <div class="picker-group-label">${alias}</div>
            <div class="picker-fields">
              ${fields.map(f => html`
                <div class="picker-field" @click=${() => this._insertVariable(f)}>
                  <span>${f.path}</span>
                  <span class="type">${f.type}</span>
                </div>
              `)}
            </div>
          `)}

          ${this._pickerFields.length === 0 ? html`
            <div style="color:var(--alx-text-muted);font-size:12px;padding:8px 0">
              No fields available. Select a collection and joins first.
            </div>
          ` : nothing}
        </div>
      </div>
    `;
  }

  override render() {
    if (this._loading) {
      return html`<div class="alx-loading"><div class="alx-spinner"></div></div>`;
    }

    return html`
      ${this._error ? html`<div class="error-msg">${this._error}</div>` : nothing}

      <div class="editor-layout">
        ${this._renderSidebar()}

        <div class="editor-main">
          <slot name="content">
            <div class="fallback-editor">
              <label style="display:block;font-size:12px;font-weight:600;margin-bottom:4px;color:var(--alx-text-muted)">Content</label>
              <textarea
                .value=${this._form.bodies[0] || ''}
                @input=${this._onFallbackBodyChange}
                placeholder="Template body content"
              ></textarea>
            </div>
          </slot>
        </div>
      </div>

      <div class="actions">
        <button class="alx-btn" @click=${this._onCancel}>Cancel</button>
        <button class="alx-btn alx-btn-primary" @click=${this._onSave} ?disabled=${this._saving}>
          ${this._saving ? 'Saving...' : (this._form._id ? 'Update' : 'Create')}
        </button>
      </div>

      ${this._renderVariablePicker()}
    `;
  }
}

safeRegister('alx-template-editor', AlxTemplateEditor);

declare global {
  interface HTMLElementTagNameMap {
    'alx-template-editor': AlxTemplateEditor;
  }
}
