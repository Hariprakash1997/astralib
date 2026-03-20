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
  alxToolbarStyles,
  alxTooltipStyles,
} from '../styles/shared.js';
import { RuleEngineAPI } from '../api/rule-engine.api.js';
import {
  RuleData, EMPTY_RULE, Condition, CollectionField, CollectionSummary,
  JoinOption, TemplateOption, TYPE_OPERATORS, OPERATORS,
} from './alx-rule-editor.types.js';
import { ruleEditorStyles } from './alx-rule-editor.styles.js';

export class AlxRuleEditor extends LitElement {
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
    alxTooltipStyles,
    ruleEditorStyles,
  ];

  @property() baseUrl = '';
  @property({ attribute: false }) api?: RuleEngineAPI;
  @property() ruleId?: string;
  @property({ type: Array }) platforms: string[] = [];
  @property({ type: Array }) audiences: string[] = [];

  @state() private _form: RuleData = JSON.parse(JSON.stringify(EMPTY_RULE));
  @state() private _loading = false;
  @state() private _saving = false;
  @state() private _error = '';
  @state() private _templates: TemplateOption[] = [];
  @state() private _collections: CollectionSummary[] = [];
  @state() private _collectionFields: CollectionField[] = [];
  @state() private _availableJoins: JoinOption[] = [];
  @state() private _previewResult: { matchedCount: number; sample: any[] } | null = null;
  @state() private _previewing = false;
  @state() private _showCustomCron = false;
  @state() private _success = '';

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
    this._loadTemplates();
    this._loadCollections();
  }

  override willUpdate(changed: Map<PropertyKey, unknown>): void {
    if (changed.has('ruleId')) {
      if (this.ruleId) {
        this._loadRule();
      } else {
        this._form = JSON.parse(JSON.stringify(EMPTY_RULE));
        this._collectionFields = [];
        this._availableJoins = [];
        this._previewResult = null;
        this._error = '';
      }
    }
  }

  private async _loadTemplates(): Promise<void> {
    try {
      const res = await this._api.listTemplates({ limit: 200 }) as { templates: TemplateOption[] };
      this._templates = res.templates ?? [];
    } catch {
      // templates will be empty
    }
  }

  private async _loadCollections(): Promise<void> {
    try {
      const res = await this._api.listCollections() as { collections: CollectionSummary[] };
      this._collections = res.collections ?? [];
    } catch {
      // graceful fallback
    }
  }

  private async _onTemplateChange(templateId: string): Promise<void> {
    this._form = { ...this._form, templateId };
    this._collectionFields = [];
    this._availableJoins = [];
    this._previewResult = null;

    const template = this._templates.find(t => t._id === templateId);
    if (!template?.collectionName) return;

    const col = this._collections.find(c => c.name === template.collectionName);
    this._availableJoins = col?.joins ?? [];

    const joins = template.joins?.length ? template.joins : undefined;
    try {
      const res = await this._api.getCollectionFields(template.collectionName, joins) as { fields: CollectionField[] };
      this._collectionFields = res.fields ?? [];
    } catch {
      this._collectionFields = [];
    }
  }

  private async _loadRule(): Promise<void> {
    this._loading = true;
    this._error = '';
    try {
      const res = await this._api.listRules({ _id: this.ruleId, limit: 1 }) as { rules: any[] };
      if (res.rules && res.rules.length > 0) {
        const r = res.rules[0];
        const target = r.target ?? {};
        this._form = {
          _id: r._id,
          name: r.name ?? '',
          templateId: r.templateId ?? '',
          platform: r.platform ?? '',
          audience: target.role ?? '',
          targetMode: target.mode ?? 'query',
          target: {
            conditions: target.conditions ?? [],
            identifiers: target.identifiers ?? [],
          },
          behavior: {
            sendOnce: r.sendOnce ?? true,
            resendAfterDays: r.resendAfterDays ?? null,
            maxPerRun: r.maxPerRun ?? 50,
            autoApprove: r.autoApprove ?? true,
            ruleType: r.ruleType ?? 'automated',
            bypassThrottle: r.bypassThrottle ?? false,
          },
          schedule: r.schedule ? {
            enabled: r.schedule.enabled ?? false,
            cron: r.schedule.cron ?? '',
            timezone: r.schedule.timezone ?? 'UTC',
          } : undefined,
          validFrom: r.validFrom ? String(r.validFrom).slice(0, 10) : '',
          validTill: r.validTill ? String(r.validTill).slice(0, 10) : '',
          isActive: r.isActive ?? true,
        };
        // Load collection context from template
        if (r.templateId) {
          // Ensure templates are loaded before deriving collection context
          if (this._templates.length === 0) {
            await this._loadTemplates();
          }
          const template = this._templates.find(t => t._id === r.templateId);
          if (template?.collectionName) {
            await this._onTemplateChange(template._id);
            // Restore the form's templateId after _onTemplateChange updates it
            this._form = { ...this._form, templateId: r.templateId };
          }
        }
      }
    } catch (err) {
      this._error = err instanceof Error ? err.message : 'Failed to load rule';
    } finally {
      this._loading = false;
    }
  }

  private _getFieldType(fieldPath: string): string | undefined {
    return this._collectionFields.find(f => f.path === fieldPath)?.type;
  }

  private _getOperatorsForField(fieldPath: string): Array<{ value: string; label: string }> {
    const fieldType = this._getFieldType(fieldPath);
    if (fieldType && TYPE_OPERATORS[fieldType]) {
      const allowed = TYPE_OPERATORS[fieldType];
      return OPERATORS.filter(op => allowed.includes(op.value));
    }
    return OPERATORS;
  }

  private _updateField(field: keyof RuleData, value: unknown): void {
    if (field === 'targetMode') {
      this._form = {
        ...this._form,
        targetMode: value as 'query' | 'list',
        target: {
          conditions: this._form.target.conditions ?? [],
          identifiers: this._form.target.identifiers ?? [],
        },
      };
      return;
    }
    this._form = { ...this._form, [field]: value };
  }

  private _updateBehavior(field: keyof RuleData['behavior'], value: unknown): void {
    this._form = {
      ...this._form,
      behavior: { ...this._form.behavior, [field]: value },
    };
  }

  private _addCondition(): void {
    const conditions = [...this._form.target.conditions, { field: '', operator: 'eq', value: '' }];
    this._form = { ...this._form, target: { ...this._form.target, conditions } };
  }

  private _updateCondition(index: number, field: keyof Condition, value: string): void {
    const conditions = [...this._form.target.conditions];
    conditions[index] = { ...conditions[index], [field]: value };

    if (field === 'field' && this._collectionFields.length > 0) {
      const fieldDef = this._collectionFields.find(f => f.path === value);
      if (fieldDef) {
        const validOps = TYPE_OPERATORS[fieldDef.type] || OPERATORS.map(op => op.value);
        if (!validOps.includes(conditions[index].operator)) {
          conditions[index] = { ...conditions[index], operator: validOps[0] };
        }
      }
    }

    this._form = { ...this._form, target: { ...this._form.target, conditions } };
  }

  private _removeCondition(index: number): void {
    const conditions = this._form.target.conditions.filter((_, i) => i !== index);
    this._form = { ...this._form, target: { ...this._form.target, conditions } };
  }

  private _getIdentifiersText(): string {
    return (this._form.target.identifiers ?? []).join('\n');
  }

  private _setIdentifiersText(text: string): void {
    const identifiers = text.split(/[\n,]+/).map(s => s.trim()).filter(Boolean);
    this._form = { ...this._form, target: { ...this._form.target, identifiers } };
  }

  private _setCron(cron: string): void {
    this._form = {
      ...this._form,
      schedule: { ...(this._form.schedule ?? { enabled: true, cron: '', timezone: 'UTC' }), cron },
    };
    this._showCustomCron = false;
  }

  private _isCronCustom(): boolean {
    const cron = this._form.schedule?.cron ?? '';
    return cron !== '' && !['0 9 * * *', '0 9 * * 1-5', '0 9 * * 1', '0 18 * * *', '0 9 1 * *', '0 9 15 * *'].includes(cron);
  }

  private _cronDescription(): string {
    const cron = this._form.schedule?.cron ?? '';
    const tz = this._form.schedule?.timezone || 'UTC';
    const map: Record<string, string> = {
      '0 9 * * *': `Every day at 9:00 AM (${tz})`,
      '0 9 * * 1-5': `Weekdays at 9:00 AM (${tz})`,
      '0 9 * * 1': `Every Monday at 9:00 AM (${tz})`,
      '0 18 * * *': `Every day at 6:00 PM (${tz})`,
      '0 9 1 * *': `1st of every month at 9:00 AM (${tz})`,
      '0 9 15 * *': `15th of every month at 9:00 AM (${tz})`,
    };
    return map[cron] || (cron ? `Custom: ${cron} (${tz})` : 'No schedule set');
  }

  private async _onPreviewConditions(): Promise<void> {
    const template = this._templates.find(t => t._id === this._form.templateId);
    if (!template?.collectionName) return;

    this._previewing = true;
    this._previewResult = null;
    try {
      const result = await this._api.previewConditions({
        collectionName: template.collectionName,
        joins: template.joins,
        conditions: this._form.target.conditions,
      }) as { matchedCount: number; sample: any[] };
      this._previewResult = result;
    } catch (err) {
      this._error = (err as Error).message;
    } finally {
      this._previewing = false;
    }
  }

  private async _onSave(): Promise<void> {
    if (!this._form.name.trim()) {
      this._error = 'Rule name is required';
      return;
    }
    if (!this._form.templateId) {
      this._error = 'Please select a template';
      return;
    }

    this._saving = true;
    this._error = '';

    try {
      const target: Record<string, unknown> = this._form.targetMode === 'list'
        ? { mode: 'list', identifiers: this._form.target.identifiers ?? [] }
        : {
            mode: 'query',
            role: this._form.audience || undefined,
            platform: this._form.platform || undefined,
            conditions: this._form.target.conditions ?? [],
          };

      const payload: Record<string, unknown> = {
        name: this._form.name,
        platform: this._form.platform,
        templateId: this._form.templateId,
        target,
        sendOnce: this._form.behavior.sendOnce,
        resendAfterDays: this._form.behavior.resendAfterDays,
        maxPerRun: this._form.behavior.maxPerRun,
        autoApprove: this._form.behavior.autoApprove,
        ruleType: this._form.behavior.ruleType,
        bypassThrottle: this._form.behavior.bypassThrottle,
        validFrom: this._form.validFrom || null,
        validTill: this._form.validTill || null,
        schedule: this._form.schedule?.enabled
          ? { enabled: true, cron: this._form.schedule.cron, timezone: this._form.schedule.timezone || 'UTC' }
          : { enabled: false, cron: '', timezone: 'UTC' },
      };

      let result: unknown;
      if (this._form._id) {
        result = await this._api.updateRule(this._form._id, payload);
      } else {
        result = await this._api.createRule(payload);
      }

      this._success = 'Rule saved successfully';
      setTimeout(() => { this._success = ''; }, 3000);
      this.dispatchEvent(new CustomEvent('alx-rule-saved', { detail: result, bubbles: true, composed: true }));
    } catch (err) {
      this._error = err instanceof Error ? err.message : 'Failed to save rule';
    } finally {
      this._saving = false;
    }
  }

  private _renderConditionRow(c: Condition, i: number) {
    const hasFields = this._collectionFields.length > 0;
    const operators: Array<{ value: string; label: string }> = hasFields ? this._getOperatorsForField(c.field) : OPERATORS;
    const fieldDef = this._collectionFields.find(f => f.path === c.field);
    const hasEnum = fieldDef?.enumValues && fieldDef.enumValues.length > 0;
    const isBool = fieldDef?.type === 'boolean';
    const isDate = fieldDef?.type === 'date';
    const isNumber = fieldDef?.type === 'number';
    const noValue = ['exists', 'not_exists'].includes(c.operator);

    return html`
      <div class="condition-row">
        ${hasFields ? html`
          <select
            .value=${c.field}
            @change=${(e: Event) => this._updateCondition(i, 'field', (e.target as HTMLSelectElement).value)}
          >
            <option value="">Select field</option>
            ${this._renderFieldOptions()}
          </select>
        ` : html`
          <input
            type="text"
            .value=${c.field}
            @input=${(e: Event) => this._updateCondition(i, 'field', (e.target as HTMLInputElement).value)}
            placeholder="Field path"
          />
        `}
        <select
          .value=${c.operator}
          @change=${(e: Event) => this._updateCondition(i, 'operator', (e.target as HTMLSelectElement).value)}
        >
          ${operators.map(op => html`<option value=${op.value} ?selected=${c.operator === op.value}>${op.label}</option>`)}
        </select>
        ${noValue ? html`<span class="condition-no-value"></span>` :
          hasEnum ? html`
            <select
              .value=${c.value}
              @change=${(e: Event) => this._updateCondition(i, 'value', (e.target as HTMLSelectElement).value)}
            >
              <option value="">Select value</option>
              ${fieldDef!.enumValues!.map(v => html`<option value=${v} ?selected=${c.value === v}>${v}</option>`)}
            </select>
          ` :
          isBool ? html`
            <select
              .value=${c.value}
              @change=${(e: Event) => this._updateCondition(i, 'value', (e.target as HTMLSelectElement).value)}
            >
              <option value="true" ?selected=${c.value === 'true'}>true</option>
              <option value="false" ?selected=${c.value === 'false'}>false</option>
            </select>
          ` :
          isDate ? html`
            <input
              type="date"
              .value=${c.value}
              @input=${(e: Event) => this._updateCondition(i, 'value', (e.target as HTMLInputElement).value)}
            />
          ` :
          isNumber ? html`
            <input
              type="number"
              .value=${c.value}
              @input=${(e: Event) => this._updateCondition(i, 'value', (e.target as HTMLInputElement).value)}
              placeholder="Value"
            />
          ` : html`
            <input
              type="text"
              .value=${c.value}
              @input=${(e: Event) => this._updateCondition(i, 'value', (e.target as HTMLInputElement).value)}
              placeholder="Value"
            />
          `}
        <button class="alx-btn-sm alx-btn-danger" @click=${() => this._removeCondition(i)}>&times;</button>
      </div>
    `;
  }

  private _renderFieldOptions() {
    // Group fields: primary fields + optgroups per join alias
    const primaryFields = this._collectionFields.filter(f => f.type !== 'object' && !f.path.includes('.'));
    const joinGroups = new Map<string, CollectionField[]>();

    for (const alias of this._availableJoins.map(j => j.alias)) {
      const joined = this._collectionFields.filter(f => f.type !== 'object' && f.path.startsWith(`${alias}.`));
      if (joined.length > 0) joinGroups.set(alias, joined);
    }

    // Fields that belong to a known join
    const joinPrefixes = new Set(this._availableJoins.map(j => j.alias));
    const otherFields = this._collectionFields.filter(f =>
      f.type !== 'object' &&
      f.path.includes('.') &&
      !joinPrefixes.has(f.path.split('.')[0])
    );

    return html`
      ${primaryFields.map(f => html`<option value=${f.path}>${f.path} (${f.type})</option>`)}
      ${otherFields.map(f => html`<option value=${f.path}>${f.path} (${f.type})</option>`)}
      ${[...joinGroups.entries()].map(([alias, fields]) => {
        const joinDef = this._availableJoins.find(j => j.alias === alias);
        return html`
          <optgroup label="${joinDef?.label || alias}">
            ${fields.map(f => html`<option value=${f.path}>${f.path} (${f.type})</option>`)}
          </optgroup>
        `;
      })}
    `;
  }

  override render() {
    if (this._loading) {
      return html`<div class="alx-loading"><div class="alx-spinner"></div></div>`;
    }

    const isEdit = !!this._form._id;

    return html`
      <div class="alx-card">
        <div class="alx-card-header">
          <h3>${isEdit ? 'Edit Rule' : 'Create Rule'}</h3>
        </div>

        ${this._error ? html`<div class="alx-error">${this._error}</div>` : nothing}
        ${this._success ? html`<div class="success-msg" style="color:var(--alx-success,#16a34a);font-size:13px;margin-bottom:8px">${this._success}</div>` : nothing}

        <div class="form-grid">
          <!-- 1. Name -->
          <div class="form-group">
            <label>Name</label>
            <input
              type="text"
              .value=${this._form.name}
              @input=${(e: Event) => this._updateField('name', (e.target as HTMLInputElement).value)}
              placeholder="e.g. Welcome Rule for New Users"
            />
          </div>

          <!-- 2. Platform -->
          <div class="form-group">
            <label>Platform</label>
            ${this.platforms.length > 0 ? html`
              <select
                .value=${this._form.platform}
                @change=${(e: Event) => this._updateField('platform', (e.target as HTMLSelectElement).value)}
              >
                <option value="">Select platform</option>
                ${this.platforms.map(p => html`
                  <option value=${p} ?selected=${this._form.platform === p}>${p}</option>
                `)}
              </select>
            ` : html`
              <input
                type="text"
                .value=${this._form.platform}
                @input=${(e: Event) => this._updateField('platform', (e.target as HTMLInputElement).value)}
                placeholder="e.g. app, web"
              />
            `}
          </div>

          <!-- 3. Template -->
          <div class="form-group form-group-full">
            <label>Template</label>
            <select
              .value=${this._form.templateId}
              @change=${(e: Event) => this._onTemplateChange((e.target as HTMLSelectElement).value)}
            >
              <option value="">Select template</option>
              ${this._templates.map(t => html`
                <option value=${t._id} ?selected=${this._form.templateId === t._id}>${t.name}</option>
              `)}
            </select>
            ${this._form.templateId && this._collectionFields.length > 0 ? html`
              <span class="helper-text">Collection context loaded from template (${this._collectionFields.length} fields)</span>
            ` : nothing}
          </div>

          <!-- 4. Target Mode Toggle -->
          <div class="section-title">Targeting</div>

          <div class="mode-toggle">
            <label
              class="mode-option ${this._form.targetMode !== 'list' ? 'active' : ''}"
              @click=${() => this._updateField('targetMode', 'query')}
            >Filter by conditions</label>
            <label
              class="mode-option ${this._form.targetMode === 'list' ? 'active' : ''}"
              @click=${() => this._updateField('targetMode', 'list')}
            >Specific contacts</label>
          </div>

          <!-- 5/6. Query or List mode content -->
          ${this._form.targetMode === 'list' ? html`
            <div class="form-group form-group-full">
              <label>Identifiers</label>
              <textarea
                .value=${this._getIdentifiersText()}
                @input=${(e: Event) => this._setIdentifiersText((e.target as HTMLTextAreaElement).value)}
                placeholder="user@example.com"
              ></textarea>
              <span class="helper-text">Enter contact identifiers, one per line</span>
            </div>
          ` : html`
            <div class="form-group">
              <label>Audience</label>
              ${this.audiences.length > 0 ? html`
                <select
                  .value=${this._form.audience}
                  @change=${(e: Event) => this._updateField('audience', (e.target as HTMLSelectElement).value)}
                >
                  <option value="">Any audience</option>
                  ${this.audiences.map(a => html`
                    <option value=${a} ?selected=${this._form.audience === a}>${a}</option>
                  `)}
                </select>
              ` : html`
                <input
                  type="text"
                  .value=${this._form.audience}
                  @input=${(e: Event) => this._updateField('audience', (e.target as HTMLInputElement).value)}
                  placeholder="e.g. customer, provider"
                />
              `}
            </div>

            <!-- Conditions -->
            <div class="section-title">Target Conditions</div>

            <div class="form-group form-group-full">
              ${this._form.target.conditions.map((c, i) => this._renderConditionRow(c, i))}
              <div style="display:flex;gap:0.5rem;align-items:center;margin-top:0.25rem">
                <button class="alx-btn-sm" @click=${this._addCondition}>+ Add Condition</button>
                ${this._form.templateId && this._form.target.conditions.length > 0 ? html`
                  <button
                    class="alx-btn-sm"
                    ?disabled=${this._previewing}
                    @click=${this._onPreviewConditions}
                  >${this._previewing ? 'Previewing...' : 'Preview'}</button>
                ` : nothing}
              </div>

              ${this._previewResult ? html`
                <div class="preview-result" style="margin-top:0.5rem;padding:0.5rem;background:var(--alx-surface-2,#f9fafb);border-radius:var(--alx-radius);border:1px solid var(--alx-border)">
                  <strong>${this._previewResult.matchedCount}</strong> users match
                  ${this._previewResult.sample.length > 0 ? html`
                    <div class="preview-sample" style="margin-top:0.25rem;display:flex;flex-wrap:wrap;gap:0.25rem">
                      ${this._previewResult.sample.map(s => html`
                        <span class="sample-item" style="font-size:0.75rem;padding:0.1rem 0.4rem;background:var(--alx-primary-bg,#eef2ff);border-radius:3px;color:var(--alx-primary)">${s.contactValue || s.name}</span>
                      `)}
                    </div>
                  ` : nothing}
                </div>
              ` : nothing}
            </div>
          `}

          <!-- 7. Behavior -->
          <div class="section-title">Behavior</div>

          <div class="form-group">
            <label>Rule Type</label>
            <select
              .value=${this._form.behavior.ruleType}
              @change=${(e: Event) => this._updateBehavior('ruleType', (e.target as HTMLSelectElement).value)}
            >
              <option value="automated" ?selected=${this._form.behavior.ruleType === 'automated'}>Automated</option>
              <option value="transactional" ?selected=${this._form.behavior.ruleType === 'transactional'}>Transactional</option>
            </select>
            <small class="field-help">Automated: subject to throttle limits. Transactional: bypasses throttle (use for confirmations, receipts).</small>
          </div>

          <div class="form-group">
            <label>Max Per Run</label>
            <input
              type="number"
              .value=${String(this._form.behavior.maxPerRun)}
              @input=${(e: Event) => this._updateBehavior('maxPerRun', Number((e.target as HTMLInputElement).value))}
              min="1"
            />
          </div>

          <div class="form-group">
            <label>Resend After Days</label>
            <input
              type="number"
              .value=${this._form.behavior.resendAfterDays !== null ? String(this._form.behavior.resendAfterDays) : ''}
              @input=${(e: Event) => {
                const val = (e.target as HTMLInputElement).value;
                this._updateBehavior('resendAfterDays', val ? Number(val) : null);
              }}
              placeholder="Leave empty for never"
              min="1"
            />
            <span class="helper-text">Leave empty to never resend</span>
          </div>

          <div class="form-group">
            <div class="checkbox-group">
              <input
                type="checkbox"
                id="sendOnce"
                .checked=${this._form.behavior.sendOnce}
                @change=${(e: Event) => this._updateBehavior('sendOnce', (e.target as HTMLInputElement).checked)}
              />
              <label for="sendOnce" style="margin-bottom:0">Send Once</label>
            </div>
            ${!this._form.behavior.sendOnce ? html`<span class="helper-text">Recipients may receive this multiple times</span>` : nothing}
          </div>

          <div class="form-group">
            <div class="checkbox-group">
              <input
                type="checkbox"
                id="autoApprove"
                .checked=${this._form.behavior.autoApprove}
                @change=${(e: Event) => this._updateBehavior('autoApprove', (e.target as HTMLInputElement).checked)}
              />
              <label for="autoApprove" style="margin-bottom:0">Auto Approve</label>
            </div>
            <small class="field-help">When enabled, messages are sent immediately. When disabled, messages require manual approval before sending.</small>
          </div>

          <div class="form-group">
            <div class="checkbox-group">
              <input
                type="checkbox"
                id="bypassThrottle"
                .checked=${this._form.behavior.bypassThrottle}
                @change=${(e: Event) => this._updateBehavior('bypassThrottle', (e.target as HTMLInputElement).checked)}
              />
              <label for="bypassThrottle" style="margin-bottom:0">Bypass Throttle</label>
            </div>
            ${this._form.behavior.bypassThrottle ? html`<span class="helper-text" style="color:var(--alx-warn,#b45309)">Ignores send limits — use carefully</span>` : nothing}
          </div>

          <!-- 8. Schedule -->
          <div class="section-title">Schedule</div>

          <div class="schedule-toggle">
            <input
              type="checkbox"
              id="scheduleEnabled"
              .checked=${this._form.schedule?.enabled ?? false}
              @change=${(e: Event) => {
                const enabled = (e.target as HTMLInputElement).checked;
                this._form = {
                  ...this._form,
                  schedule: {
                    enabled,
                    cron: this._form.schedule?.cron ?? '',
                    timezone: this._form.schedule?.timezone ?? 'UTC',
                  },
                };
              }}
            />
            <label for="scheduleEnabled">Enable scheduled execution</label>
          </div>

          ${this._form.schedule?.enabled ? html`
            <div class="form-group form-group-full">
              <label>Schedule</label>
              <select @change=${(e: Event) => {
                const val = (e.target as HTMLSelectElement).value;
                if (val === 'custom') {
                  this._showCustomCron = true;
                } else {
                  this._showCustomCron = false;
                  this._setCron(val);
                }
              }}>
                <option value="" ?selected=${!this._form.schedule?.cron}>Select schedule...</option>
                <option value="0 9 * * *" ?selected=${this._form.schedule?.cron === '0 9 * * *'}>Every day at 9:00 AM</option>
                <option value="0 9 * * 1-5" ?selected=${this._form.schedule?.cron === '0 9 * * 1-5'}>Weekdays at 9:00 AM</option>
                <option value="0 9 * * 1" ?selected=${this._form.schedule?.cron === '0 9 * * 1'}>Every Monday at 9:00 AM</option>
                <option value="0 18 * * *" ?selected=${this._form.schedule?.cron === '0 18 * * *'}>Every day at 6:00 PM</option>
                <option value="0 9 1 * *" ?selected=${this._form.schedule?.cron === '0 9 1 * *'}>1st of every month at 9:00 AM</option>
                <option value="0 9 15 * *" ?selected=${this._form.schedule?.cron === '0 9 15 * *'}>15th of every month at 9:00 AM</option>
                <option value="custom" ?selected=${this._showCustomCron || this._isCronCustom()}>Custom...</option>
              </select>
              ${this._showCustomCron || this._isCronCustom() ? html`
                <input
                  type="text"
                  .value=${this._form.schedule?.cron ?? ''}
                  @input=${(e: Event) => this._setCron((e.target as HTMLInputElement).value)}
                  placeholder="0 9 * * 1"
                  style="margin-top:4px"
                />
              ` : nothing}
              <span class="helper-text">${this._cronDescription()}</span>
            </div>

            <div class="form-group">
              <label>Timezone</label>
              <input
                type="text"
                .value=${this._form.schedule?.timezone ?? 'UTC'}
                @input=${(e: Event) => {
                  this._form = {
                    ...this._form,
                    schedule: { ...this._form.schedule!, timezone: (e.target as HTMLInputElement).value },
                  };
                }}
                placeholder="Asia/Kolkata"
              />
            </div>
          ` : nothing}
          ${!this._form.schedule?.enabled && !!this._form._id ? html`
            <span class="helper-text" style="grid-column:1/-1">No schedule — run manually via Run History</span>
          ` : nothing}

          <!-- 9. Validity -->
          <div class="section-title">Validity</div>

          <div class="form-group">
            <label>Valid From</label>
            <input
              type="date"
              .value=${this._form.validFrom ?? ''}
              @input=${(e: Event) => this._updateField('validFrom', (e.target as HTMLInputElement).value)}
            />
          </div>

          <div class="form-group">
            <label>Valid Till</label>
            <input
              type="date"
              .value=${this._form.validTill ?? ''}
              @input=${(e: Event) => this._updateField('validTill', (e.target as HTMLInputElement).value)}
            />
          </div>

          <div class="form-group form-group-full">
            <span class="helper-text">Rule only runs within this date range. Leave empty for always active.</span>
          </div>
        </div>

        <!-- 10. Actions -->
        <div class="actions">
          <button class="alx-btn-primary" ?disabled=${this._saving} @click=${this._onSave}>
            ${this._saving ? 'Saving...' : isEdit ? 'Update Rule' : 'Create Rule'}
          </button>
          <button class="alx-btn-sm" @click=${() => this.dispatchEvent(new CustomEvent('alx-rule-cancel', { bubbles: true, composed: true }))}>
            Cancel
          </button>
        </div>
      </div>
    `;
  }
}

safeRegister('alx-rule-editor', AlxRuleEditor);

declare global {
  interface HTMLElementTagNameMap {
    'alx-rule-editor': AlxRuleEditor;
  }
}
