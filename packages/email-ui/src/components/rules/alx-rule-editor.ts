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

interface Condition {
  field: string;
  operator: string;
  value: string;
}

interface TemplateOption {
  _id: string;
  name: string;
}

interface RuleData {
  _id?: string;
  name: string;
  templateId: string;
  platform: string;
  audience: string;
  target: {
    conditions: Condition[];
  };
  behavior: {
    sendOnce: boolean;
    resendAfterDays: number | null;
    maxPerRun: number;
    autoApprove: boolean;
    emailType: string;
    bypassThrottle: boolean;
  };
  isActive: boolean;
}

const EMPTY_RULE: RuleData = {
  name: '',
  templateId: '',
  platform: '',
  audience: '',
  target: { conditions: [] },
  behavior: {
    sendOnce: true,
    resendAfterDays: null,
    maxPerRun: 50,
    autoApprove: true,
    emailType: 'marketing',
    bypassThrottle: false,
  },
  isActive: true,
};

const OPERATORS = ['equals', 'not_equals', 'contains', 'gt', 'gte', 'lt', 'lte', 'in', 'exists'];

@customElement('alx-rule-editor')
export class AlxRuleEditor extends LitElement {
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

      .section-title {
        font-size: 0.95rem;
        font-weight: 600;
        color: var(--alx-text);
        margin-top: 1rem;
        margin-bottom: 0.5rem;
        padding-bottom: 0.25rem;
        border-bottom: 1px solid var(--alx-border);
        grid-column: 1 / -1;
      }

      .condition-row {
        display: flex;
        gap: 0.5rem;
        align-items: center;
        margin-bottom: 0.5rem;
      }

      .condition-row input,
      .condition-row select {
        flex: 1;
      }

      .condition-row button {
        flex-shrink: 0;
      }

      .checkbox-group {
        display: flex;
        align-items: center;
        gap: 0.5rem;
        margin-top: 0.25rem;
      }

      .checkbox-group input[type='checkbox'] {
        width: auto;
      }

      .actions {
        display: flex;
        gap: 0.75rem;
        margin-top: 1.5rem;
      }
    `,
  ];

  @property({ attribute: 'rule-id' }) ruleId = '';

  @state() private _form: RuleData = JSON.parse(JSON.stringify(EMPTY_RULE));
  @state() private _templates: TemplateOption[] = [];
  @state() private _loading = false;
  @state() private _saving = false;
  @state() private _error = '';

  private __api?: RuleAPI;
  private get _api(): RuleAPI {
    if (!this.__api) this.__api = new RuleAPI();
    return this.__api;
  }

  override connectedCallback(): void {
    super.connectedCallback();
    this._loadTemplates();
    if (this.ruleId) {
      this._loadRule();
    }
  }

  override updated(changed: Map<string, unknown>): void {
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
        this._form = { ...JSON.parse(JSON.stringify(EMPTY_RULE)), ...res.rules[0] };
      }
    } catch (err) {
      this._error = err instanceof Error ? err.message : 'Failed to load rule';
    } finally {
      this._loading = false;
    }
  }

  private _updateField(field: keyof RuleData, value: unknown): void {
    this._form = { ...this._form, [field]: value };
  }

  private _updateBehavior(field: keyof RuleData['behavior'], value: unknown): void {
    this._form = {
      ...this._form,
      behavior: { ...this._form.behavior, [field]: value },
    };
  }

  private _addCondition(): void {
    const conditions = [...this._form.target.conditions, { field: '', operator: 'equals', value: '' }];
    this._form = { ...this._form, target: { conditions } };
  }

  private _updateCondition(index: number, field: keyof Condition, value: string): void {
    const conditions = [...this._form.target.conditions];
    conditions[index] = { ...conditions[index], [field]: value };
    this._form = { ...this._form, target: { conditions } };
  }

  private _removeCondition(index: number): void {
    const conditions = this._form.target.conditions.filter((_, i) => i !== index);
    this._form = { ...this._form, target: { conditions } };
  }

  private async _onSave(): Promise<void> {
    this._saving = true;
    this._error = '';
    try {
      const payload: Record<string, unknown> = { ...this._form };
      delete payload['_id'];

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
                      this._updateCondition(i, 'operator', (e.target as HTMLSelectElement).value)}
                  >
                    ${OPERATORS.map(
                      (op) =>
                        html`<option value=${op} ?selected=${c.operator === op}>${op}</option>`,
                    )}
                  </select>
                  <input
                    type="text"
                    .value=${c.value}
                    @input=${(e: Event) =>
                      this._updateCondition(i, 'value', (e.target as HTMLInputElement).value)}
                    placeholder="Value"
                  />
                  <button class="alx-btn-sm alx-btn-danger" @click=${() => this._removeCondition(i)}>
                    &times;
                  </button>
                </div>
              `,
            )}
            <button class="alx-btn-sm" @click=${this._addCondition}>+ Add Condition</button>
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
              <option value="marketing" ?selected=${this._form.behavior.emailType === 'marketing'}>
                Marketing
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
        </div>
      </div>
    `;
  }
}

declare global {
  interface HTMLElementTagNameMap {
    'alx-rule-editor': AlxRuleEditor;
  }
}
