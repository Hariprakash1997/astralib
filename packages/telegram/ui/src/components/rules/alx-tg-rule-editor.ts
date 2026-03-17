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
  alxBadgeStyles,
} from '../../styles/shared.js';
import { TelegramRuleAPI } from '../../api/rule.api.js';

interface Condition {
  field: string;
  operator: string;
  value: string;
}

interface TemplateOption {
  _id: string;
  name: string;
}

export class AlxTgRuleEditor extends LitElement {
  static override styles = [
    alxBaseStyles,
    alxDensityStyles,
    alxButtonStyles,
    alxInputStyles,
    alxCardStyles,
    alxLoadingStyles,
    alxBadgeStyles,
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
      .segmented {
        display: inline-flex;
        border: 1px solid var(--alx-border);
        border-radius: var(--alx-radius);
        overflow: hidden;
      }
      .segmented button {
        border: none;
        border-radius: 0;
        padding: 0.3rem 0.75rem;
        font-size: 0.75rem;
        background: var(--alx-surface);
        color: var(--alx-text-muted);
      }
      .segmented button.active {
        background: var(--alx-primary);
        color: #fff;
      }
      .segmented button:not(:last-child) {
        border-right: 1px solid var(--alx-border);
      }
      .condition-row {
        display: flex;
        gap: 0.5rem;
        align-items: center;
        margin-bottom: 0.375rem;
      }
      .condition-row input, .condition-row select {
        flex: 1;
      }
      .identifier-row {
        display: flex;
        gap: 0.5rem;
        align-items: center;
        margin-bottom: 0.375rem;
      }
      .identifier-row input {
        flex: 1;
      }
    `,
  ];

  @property({ type: String, reflect: true }) density: 'default' | 'compact' = 'default';
  @property({ type: Boolean, attribute: 'hide-header' }) hideHeader = false;
  @property({ attribute: 'rule-id' }) ruleId = '';

  @state() private name = '';
  @state() private templateId = '';
  @state() private mode: 'query' | 'list' = 'query';
  @state() private conditions: Condition[] = [{ field: '', operator: 'eq', value: '' }];
  @state() private identifiers: string[] = [''];
  @state() private sendOnce = true;
  @state() private maxPerRun = 100;
  @state() private validFrom = '';
  @state() private validTill = '';
  @state() private templates: TemplateOption[] = [];
  @state() private loading = false;
  @state() private saving = false;
  @state() private error = '';

  private _api?: TelegramRuleAPI;
  private get api(): TelegramRuleAPI {
    if (!this._api) this._api = new TelegramRuleAPI();
    return this._api;
  }

  override willUpdate(changed: Map<PropertyKey, unknown>): void {
    if (changed.has('ruleId')) {
      if (this.ruleId) {
        this.loadRule();
      } else {
        this._resetForm();
      }
    }
  }

  override connectedCallback(): void {
    super.connectedCallback();
    this._loadTemplates();
  }

  private _resetForm(): void {
    this.name = '';
    this.templateId = '';
    this.mode = 'query';
    this.conditions = [{ field: '', operator: 'eq', value: '' }];
    this.identifiers = [''];
    this.sendOnce = true;
    this.maxPerRun = 100;
    this.validFrom = '';
    this.validTill = '';
    this.error = '';
  }

  private async _loadTemplates(): Promise<void> {
    try {
      const res = await this.api.listTemplates({ limit: 200 }) as { templates: TemplateOption[] };
      this.templates = res.templates ?? [];
    } catch {
      // Silent — dropdown will be empty
    }
  }

  private async loadRule(): Promise<void> {
    this.loading = true;
    this.error = '';
    try {
      const r = (await this.api.getRule(this.ruleId)) as Record<string, unknown>;
      this.name = (r['name'] as string) ?? '';
      this.templateId = (r['templateId'] as string) ?? '';
      this.mode = (r['mode'] as 'query' | 'list') ?? 'query';
      this.conditions = (r['conditions'] as Condition[]) ?? [{ field: '', operator: 'eq', value: '' }];
      this.identifiers = (r['identifiers'] as string[]) ?? [''];
      this.sendOnce = (r['sendOnce'] as boolean) ?? true;
      this.maxPerRun = (r['maxPerRun'] as number) ?? 100;
      this.validFrom = (r['validFrom'] as string) ?? '';
      this.validTill = (r['validTill'] as string) ?? '';
    } catch (e) {
      this.error = e instanceof Error ? e.message : 'Failed to load rule';
    } finally {
      this.loading = false;
    }
  }

  // --- Conditions ---

  private addCondition(): void {
    this.conditions = [...this.conditions, { field: '', operator: 'eq', value: '' }];
  }

  private removeCondition(index: number): void {
    this.conditions = this.conditions.filter((_, i) => i !== index);
  }

  private updateCondition(index: number, prop: keyof Condition, val: string): void {
    this.conditions = this.conditions.map((c, i) => (i === index ? { ...c, [prop]: val } : c));
  }

  // --- Identifiers ---

  private addIdentifier(): void {
    this.identifiers = [...this.identifiers, ''];
  }

  private removeIdentifier(index: number): void {
    this.identifiers = this.identifiers.filter((_, i) => i !== index);
  }

  private updateIdentifier(index: number, val: string): void {
    this.identifiers = this.identifiers.map((id, i) => (i === index ? val : id));
  }

  // --- Submit ---

  private async onSubmit(e: Event): Promise<void> {
    e.preventDefault();
    if (!this.name) {
      this.error = 'Name is required';
      return;
    }
    if (!this.templateId) {
      this.error = 'Template is required';
      return;
    }

    this.saving = true;
    this.error = '';

    const data: Record<string, unknown> = {
      name: this.name,
      templateId: this.templateId,
      mode: this.mode,
      sendOnce: this.sendOnce,
      maxPerRun: this.maxPerRun,
    };

    if (this.mode === 'query') {
      data['conditions'] = this.conditions.filter(c => c.field);
    } else {
      data['identifiers'] = this.identifiers.filter(id => id.trim());
    }

    if (this.validFrom) data['validFrom'] = this.validFrom;
    if (this.validTill) data['validTill'] = this.validTill;

    try {
      let result: unknown;
      if (this.ruleId) {
        result = await this.api.updateRule(this.ruleId, data);
      } else {
        result = await this.api.createRule(data);
      }
      this.dispatchEvent(
        new CustomEvent('alx-rule-saved', {
          detail: result,
          bubbles: true,
          composed: true,
        }),
      );
    } catch (e) {
      this.error = e instanceof Error ? e.message : 'Failed to save rule';
    } finally {
      this.saving = false;
    }
  }

  private onCancel(): void {
    this.dispatchEvent(
      new CustomEvent('alx-rule-cancelled', { bubbles: true, composed: true }),
    );
  }

  private async onDelete(): Promise<void> {
    if (!this.ruleId) return;
    if (!confirm('Delete this rule?')) return;
    this.saving = true;
    this.error = '';
    try {
      await this.api.deleteRule(this.ruleId);
      this.dispatchEvent(
        new CustomEvent('alx-rule-deleted', {
          detail: { _id: this.ruleId },
          bubbles: true,
          composed: true,
        }),
      );
    } catch (e) {
      this.error = e instanceof Error ? e.message : 'Failed to delete rule';
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
        ${this.hideHeader ? '' : html`<div class="alx-card-header"><h3>${this.ruleId ? 'Edit Rule' : 'Create Rule'}</h3></div>`}

        ${this.error ? html`<div class="alx-error">${this.error}</div>` : ''}

        <form @submit=${this.onSubmit}>
          <div class="form-row">
            <div class="form-group">
              <label>Name *</label>
              <input
                type="text"
                .value=${this.name}
                @input=${(e: Event) => (this.name = (e.target as HTMLInputElement).value)}
                placeholder="Rule name"
                required
              />
            </div>
            <div class="form-group">
              <label>Template *</label>
              <select .value=${this.templateId} @change=${(e: Event) => (this.templateId = (e.target as HTMLSelectElement).value)}>
                <option value="">Select template...</option>
                ${this.templates.map(t => html`<option value=${t._id} ?selected=${t._id === this.templateId}>${t.name}</option>`)}
              </select>
            </div>

            <div class="form-section-title">Target Mode</div>
            <div class="form-group full">
              <div class="segmented">
                <button type="button" class="${this.mode === 'query' ? 'active' : ''}" @click=${() => (this.mode = 'query')}>Query</button>
                <button type="button" class="${this.mode === 'list' ? 'active' : ''}" @click=${() => (this.mode = 'list')}>List</button>
              </div>
            </div>

            ${this.mode === 'query' ? html`
              <div class="form-section-title">Conditions</div>
              <div class="form-group full">
                ${this.conditions.map((c, i) => html`
                  <div class="condition-row">
                    <input type="text" .value=${c.field} @input=${(e: Event) => this.updateCondition(i, 'field', (e.target as HTMLInputElement).value)} placeholder="Field" />
                    <select .value=${c.operator} @change=${(e: Event) => this.updateCondition(i, 'operator', (e.target as HTMLSelectElement).value)}>
                      <option value="eq">equals</option>
                      <option value="neq">not equals</option>
                      <option value="contains">contains</option>
                      <option value="gt">greater than</option>
                      <option value="lt">less than</option>
                      <option value="in">in</option>
                      <option value="exists">exists</option>
                    </select>
                    <input type="text" .value=${c.value} @input=${(e: Event) => this.updateCondition(i, 'value', (e.target as HTMLInputElement).value)} placeholder="Value" />
                    <button type="button" class="alx-btn-icon danger" @click=${() => this.removeCondition(i)}>&times;</button>
                  </div>
                `)}
                <button type="button" class="alx-btn-sm" @click=${this.addCondition}>+ Add Condition</button>
              </div>
            ` : html`
              <div class="form-section-title">Identifiers</div>
              <div class="form-group full">
                ${this.identifiers.map((id, i) => html`
                  <div class="identifier-row">
                    <input type="text" .value=${id} @input=${(e: Event) => this.updateIdentifier(i, (e.target as HTMLInputElement).value)} placeholder="User ID or phone" />
                    <button type="button" class="alx-btn-icon danger" @click=${() => this.removeIdentifier(i)}>&times;</button>
                  </div>
                `)}
                <button type="button" class="alx-btn-sm" @click=${this.addIdentifier}>+ Add Identifier</button>
              </div>
            `}

            <div class="form-section-title">Options</div>
            <div class="form-group">
              <label>Max Per Run</label>
              <input type="number" .value=${String(this.maxPerRun)} @input=${(e: Event) => (this.maxPerRun = Number((e.target as HTMLInputElement).value))} min="1" />
            </div>
            <div class="form-group">
              <label style="display:flex;align-items:center;gap:0.5rem;text-transform:none;font-size:0.8125rem;color:var(--alx-text)">
                <input type="checkbox" style="width:auto" .checked=${this.sendOnce} @change=${(e: Event) => (this.sendOnce = (e.target as HTMLInputElement).checked)} />
                Send Once
              </label>
            </div>
            <div class="form-group">
              <label>Valid From</label>
              <input type="datetime-local" .value=${this.validFrom} @input=${(e: Event) => (this.validFrom = (e.target as HTMLInputElement).value)} />
            </div>
            <div class="form-group">
              <label>Valid Till</label>
              <input type="datetime-local" .value=${this.validTill} @input=${(e: Event) => (this.validTill = (e.target as HTMLInputElement).value)} />
            </div>
          </div>

          <div class="form-actions">
            <div>
              ${this.ruleId
                ? html`<button type="button" class="alx-btn-danger" ?disabled=${this.saving} @click=${this.onDelete}>Delete</button>`
                : ''}
            </div>
            <div class="form-actions-end">
              <button type="button" @click=${this.onCancel}>Cancel</button>
              <button type="submit" class="alx-btn-primary" ?disabled=${this.saving}>
                ${this.saving ? 'Saving...' : this.ruleId ? 'Update' : 'Create'}
              </button>
            </div>
          </div>
        </form>
      </div>
    `;
  }
}
safeRegister('alx-tg-rule-editor', AlxTgRuleEditor);

declare global {
  interface HTMLElementTagNameMap {
    'alx-tg-rule-editor': AlxTgRuleEditor;
  }
}
