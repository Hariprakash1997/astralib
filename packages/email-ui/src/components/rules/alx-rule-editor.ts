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
} from '../../styles/shared.js';
import { RuleAPI } from '../../api/rule.api.js';
import type { Condition, TemplateOption, RuleData } from './alx-rule-editor.types.js';
import { EMPTY_RULE, OPERATORS } from './alx-rule-editor.types.js';
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
    ruleEditorStyles,
  ];

  @property({ type: String, reflect: true }) density: 'default' | 'compact' = 'default';
  @property({ type: Boolean, attribute: 'hide-header' }) hideHeader = false;
  @property({ attribute: 'rule-id' }) ruleId = '';

  @state() private _form: RuleData = JSON.parse(JSON.stringify(EMPTY_RULE));
  @state() private _templates: TemplateOption[] = [];
  @state() private _loading = false;
  @state() private _saving = false;
  @state() private _deleting = false;
  @state() private _error = '';

  private __api?: RuleAPI;
  private get _api(): RuleAPI {
    if (!this.__api) this.__api = new RuleAPI();
    return this.__api;
  }

  override connectedCallback(): void {
    super.connectedCallback();
    this._loadTemplates();
  }

  override willUpdate(changed: Map<PropertyKey, unknown>): void {
    if (changed.has('ruleId') && this.ruleId) {
      this._loadRule();
    }
  }

  private async _loadTemplates(): Promise<void> {
    try {
      const res = (await this._api.listTemplates({ limit: 200 })) as {
        templates: TemplateOption[];
      };
      this._templates = res.templates ?? [];
    } catch {
      // templates will be empty, user can still type an ID
    }
  }

  private async _loadRule(): Promise<void> {
    this._loading = true;
    this._error = '';
    try {
      const res = (await this._api.listRules({ _id: this.ruleId, limit: 1 })) as {
        rules: RuleData[];
      };
      if (res.rules && res.rules.length > 0) {
        const r = res.rules[0] as any;
        const target = r.target ?? {};
        this._form = {
          _id: r._id,
          name: r.name ?? '',
          templateId: r.templateId ?? '',
          platform: target.platform ?? '',
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
            emailType: r.emailType ?? 'automated',
            bypassThrottle: r.bypassThrottle ?? false,
          },
          validFrom: r.validFrom ? String(r.validFrom).slice(0, 10) : '',
          validTill: r.validTill ? String(r.validTill).slice(0, 10) : '',
          isActive: r.isActive ?? true,
        };
      }
    } catch (err) {
      this._error = err instanceof Error ? err.message : 'Failed to load rule';
    } finally {
      this._loading = false;
    }
  }

  private _updateField(field: keyof RuleData, value: unknown): void {
    if (field === 'targetMode') {
      const target = { ...this._form.target };
      if (value === 'list') {
        delete (target as any).conditions;
        delete (target as any).platform;
        delete (target as any).audience;
      } else {
        delete (target as any).identifiers;
      }
      this._form = { ...this._form, [field]: value as RuleData[typeof field], target };
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
    this._form = { ...this._form, target: { ...this._form.target, conditions } };
  }

  private _removeCondition(index: number): void {
    const conditions = this._form.target.conditions.filter((_, i) => i !== index);
    this._form = { ...this._form, target: { ...this._form.target, conditions } };
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
      // Build target object matching backend's RuleTarget schema
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
        templateId: this._form.templateId,
        target,
        sendOnce: this._form.behavior.sendOnce,
        resendAfterDays: this._form.behavior.resendAfterDays,
        maxPerRun: this._form.behavior.maxPerRun,
        autoApprove: this._form.behavior.autoApprove,
        emailType: this._form.behavior.emailType,
        bypassThrottle: this._form.behavior.bypassThrottle,
        isActive: this._form.isActive,
      };
      payload.validFrom = this._form.validFrom || null;
      payload.validTill = this._form.validTill || null;

      let result: unknown;
      if (this._form._id) {
        result = await this._api.updateRule(this._form._id, payload);
      } else {
        result = await this._api.createRule(payload);
      }

      this.dispatchEvent(
        new CustomEvent('alx-rule-saved', {
          detail: result,
          bubbles: true,
          composed: true,
        }),
      );
    } catch (err) {
      this._error = err instanceof Error ? err.message : 'Failed to save rule';
    } finally {
      this._saving = false;
    }
  }

  private async _onDelete(): Promise<void> {
    if (!this._form._id) return;
    if (!confirm('Delete this rule? This cannot be undone.')) return;
    this._deleting = true;
    this._error = '';
    try {
      await this._api.deleteRule(this._form._id);
      this.dispatchEvent(
        new CustomEvent('alx-rule-deleted', {
          detail: { _id: this._form._id },
          bubbles: true,
          composed: true,
        }),
      );
    } catch (err) {
      this._error = err instanceof Error ? err.message : 'Failed to delete rule';
    } finally {
      this._deleting = false;
    }
  }

  private _getIdentifiersText(): string {
    return (this._form.target.identifiers ?? []).join('\n');
  }

  private _setIdentifiersText(text: string): void {
    const identifiers = text
      .split(/[\n,]+/)
      .map((s) => s.trim())
      .filter(Boolean);
    this._form = {
      ...this._form,
      target: { ...this._form.target, identifiers },
    };
  }

  override render() {
    if (this._loading) {
      return html`<div class="alx-loading"><div class="alx-spinner"></div></div>`;
    }

    const isEdit = !!this._form._id;

    return html`
      <div class="alx-card">
        ${this.hideHeader ? '' : html`<div class="alx-card-header"><h3>${isEdit ? 'Edit Rule' : 'Create Rule'}</h3></div>`}

        ${this._error ? html`<div class="alx-error">${this._error}</div>` : nothing}

        <div class="form-grid">
          <div class="form-group">
            <label>Name</label>
            <input
              type="text"
              .value=${this._form.name}
              @input=${(e: Event) => this._updateField('name', (e.target as HTMLInputElement).value)}
              placeholder="Rule name"
            />
          </div>

          <div class="form-group">
            <label>Template</label>
            <select
              .value=${this._form.templateId}
              @change=${(e: Event) =>
                this._updateField('templateId', (e.target as HTMLSelectElement).value)}
            >
              <option value="">Select template</option>
              ${this._templates.map(
                (t) =>
                  html`<option value=${t._id} ?selected=${this._form.templateId === t._id}>
                    ${t.name}
                  </option>`,
              )}
            </select>
          </div>

          <!-- Target Mode -->
          <div class="section-title">Targeting</div>

          <div class="mode-toggle">
            <label>
              <input
                type="radio"
                name="targetMode"
                value="query"
                ?checked=${this._form.targetMode !== 'list'}
                @change=${() => this._updateField('targetMode', 'query')}
              />
              Query
            </label>
            <label>
              <input
                type="radio"
                name="targetMode"
                value="list"
                ?checked=${this._form.targetMode === 'list'}
                @change=${() => this._updateField('targetMode', 'list')}
              />
              List
            </label>
          </div>

          ${this._form.targetMode === 'list'
            ? html`
                <div class="form-group form-group-full">
                  <label>Identifiers</label>
                  <textarea
                    .value=${this._getIdentifiersText()}
                    @input=${(e: Event) =>
                      this._setIdentifiersText((e.target as HTMLTextAreaElement).value)}
                    placeholder="user@example.com"
                  ></textarea>
                  <span class="helper-text">Enter email addresses, one per line</span>
                </div>
              `
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

                <!-- Conditions -->
                <div class="section-title">Target Conditions</div>

                <div class="form-group form-group-full">
                  ${this._form.target.conditions.map(
                    (c, i) => html`
                      <div class="condition-row">
                        <input
                          type="text"
                          .value=${c.field}
                          @input=${(e: Event) =>
                            this._updateCondition(i, 'field', (e.target as HTMLInputElement).value)}
                          placeholder="Field path"
                        />
                        <select
                          .value=${c.operator}
                          @change=${(e: Event) =>
                            this._updateCondition(
                              i,
                              'operator',
                              (e.target as HTMLSelectElement).value,
                            )}
                        >
                          ${OPERATORS.map(
                            (op) =>
                              html`<option value=${op} ?selected=${c.operator === op}>
                                ${op}
                              </option>`,
                          )}
                        </select>
                        <input
                          type="text"
                          .value=${c.value}
                          @input=${(e: Event) =>
                            this._updateCondition(i, 'value', (e.target as HTMLInputElement).value)}
                          placeholder="Value"
                        />
                        <button
                          class="alx-btn-sm alx-btn-danger"
                          @click=${() => this._removeCondition(i)}
                        >
                          &times;
                        </button>
                      </div>
                    `,
                  )}
                  <button class="alx-btn-sm" @click=${this._addCondition}>+ Add Condition</button>
                </div>
              `}

          <!-- Validity Dates -->
          <div class="section-title">Validity</div>

          <div class="form-group">
            <label>Valid From</label>
            <input
              type="date"
              .value=${this._form.validFrom ?? ''}
              @input=${(e: Event) =>
                this._updateField('validFrom', (e.target as HTMLInputElement).value)}
            />
          </div>

          <div class="form-group">
            <label>Valid Till</label>
            <input
              type="date"
              .value=${this._form.validTill ?? ''}
              @input=${(e: Event) =>
                this._updateField('validTill', (e.target as HTMLInputElement).value)}
            />
          </div>

          <div class="form-group form-group-full">
            <span class="helper-text"
              >Rule only runs within this date range. Leave empty for always active.</span
            >
          </div>

          <!-- Behavior -->
          <div class="section-title">Behavior</div>

          <div class="form-group">
            <label>Email Type</label>
            <select
              .value=${this._form.behavior.emailType}
              @change=${(e: Event) =>
                this._updateBehavior('emailType', (e.target as HTMLSelectElement).value)}
            >
              <option value="automated" ?selected=${this._form.behavior.emailType === 'automated'}>
                Automated
              </option>
              <option
                value="transactional"
                ?selected=${this._form.behavior.emailType === 'transactional'}
              >
                Transactional
              </option>
            </select>
          </div>

          <div class="form-group">
            <label>Max Per Run</label>
            <input
              type="number"
              .value=${String(this._form.behavior.maxPerRun)}
              @input=${(e: Event) =>
                this._updateBehavior('maxPerRun', Number((e.target as HTMLInputElement).value))}
              min="1"
            />
          </div>

          <div class="form-group">
            <label>Resend After Days</label>
            <input
              type="number"
              .value=${this._form.behavior.resendAfterDays !== null
                ? String(this._form.behavior.resendAfterDays)
                : ''}
              @input=${(e: Event) => {
                const val = (e.target as HTMLInputElement).value;
                this._updateBehavior('resendAfterDays', val ? Number(val) : null);
              }}
              placeholder="Leave empty for never"
              min="1"
            />
          </div>

          <div class="form-group">
            <div class="checkbox-group">
              <input
                type="checkbox"
                id="sendOnce"
                .checked=${this._form.behavior.sendOnce}
                @change=${(e: Event) =>
                  this._updateBehavior('sendOnce', (e.target as HTMLInputElement).checked)}
              />
              <label for="sendOnce" style="margin-bottom:0">Send Once</label>
            </div>
          </div>

          <div class="form-group">
            <div class="checkbox-group">
              <input
                type="checkbox"
                id="autoApprove"
                .checked=${this._form.behavior.autoApprove}
                @change=${(e: Event) =>
                  this._updateBehavior('autoApprove', (e.target as HTMLInputElement).checked)}
              />
              <label for="autoApprove" style="margin-bottom:0">Auto Approve</label>
            </div>
          </div>

          <div class="form-group">
            <div class="checkbox-group">
              <input
                type="checkbox"
                id="bypassThrottle"
                .checked=${this._form.behavior.bypassThrottle}
                @change=${(e: Event) =>
                  this._updateBehavior('bypassThrottle', (e.target as HTMLInputElement).checked)}
              />
              <label for="bypassThrottle" style="margin-bottom:0">Bypass Throttle</label>
            </div>
          </div>
        </div>

        <div class="actions">
          <button
            class="alx-btn-primary"
            ?disabled=${this._saving}
            @click=${this._onSave}
          >
            ${this._saving ? 'Saving...' : isEdit ? 'Update Rule' : 'Create Rule'}
          </button>
          ${isEdit
            ? html`
                <button
                  class="alx-btn-danger actions-right"
                  ?disabled=${this._deleting}
                  @click=${this._onDelete}
                >
                  ${this._deleting ? 'Deleting...' : 'Delete Rule'}
                </button>
              `
            : nothing}
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
