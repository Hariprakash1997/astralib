import { LitElement, html, css } from 'lit';
import { property, state } from 'lit/decorators.js';
import type { IPipelineStage } from '@astralibx/call-log-types';
import { safeRegister } from '../../utils/safe-register.js';
import { CallLogApiClient } from '../../api/call-log-api-client.js';

export class AlxPipelineStageEditor extends LitElement {
  static styles = css`
    :host { display: block; }
    .card { background: var(--alx-surface, #fff); border: 1px solid var(--alx-border, #e2e8f0); border-radius: 8px; padding: 1rem; }
    .card-header { display: flex; align-items: center; justify-content: space-between; margin-bottom: 1rem; }
    h3 { margin: 0; font-size: 1rem; font-weight: 600; }
    .stage-row { display: flex; align-items: center; gap: 0.75rem; padding: 0.5rem 0; border-bottom: 1px solid var(--alx-border, #e2e8f0); }
    .color-dot { width: 12px; height: 12px; border-radius: 50%; flex-shrink: 0; }
    .stage-name { flex: 1; font-size: 0.875rem; }
    .badge { display: inline-block; padding: 0.125rem 0.4rem; border-radius: 9999px; font-size: 0.7rem; font-weight: 500; }
    .badge-warning { background: #fef9c3; color: #92400e; }
    .badge-muted { background: #f1f5f9; color: #64748b; }
    .form { display: grid; gap: 0.75rem; margin-top: 1rem; padding: 1rem; background: var(--alx-surface-alt, #f8fafc); border-radius: 6px; border: 1px solid var(--alx-border, #e2e8f0); }
    .form-row { display: grid; grid-template-columns: 1fr 1fr; gap: 0.5rem; }
    label { display: flex; flex-direction: column; gap: 0.25rem; font-size: 0.8rem; font-weight: 500; }
    input[type=text], input[type=color], input[type=number] { padding: 0.375rem 0.5rem; border: 1px solid var(--alx-border, #e2e8f0); border-radius: 4px; font-size: 0.875rem; font-family: inherit; }
    .checkbox-row { display: flex; align-items: center; gap: 0.5rem; font-size: 0.875rem; }
    .actions { display: flex; gap: 0.5rem; }
    button { padding: 0.375rem 0.75rem; font-size: 0.8rem; border-radius: 6px; border: 1px solid var(--alx-border, #e2e8f0); cursor: pointer; background: var(--alx-surface, #fff); font-family: inherit; }
    button.primary { background: #3b82f6; color: #fff; border-color: #3b82f6; }
    button.danger { background: #fee2e2; color: #dc2626; border-color: #fca5a5; }
    .error { color: #dc2626; font-size: 0.8rem; }
    .empty { color: var(--alx-text-muted, #64748b); padding: 0.5rem 0; font-size: 0.875rem; }
  `;

  @property({ type: String }) pipelineId = '';
  @state() private stages: IPipelineStage[] = [];
  @state() private loading = false;
  @state() private error = '';
  @state() private showForm = false;
  @state() private editingStage: IPipelineStage | null = null;

  // form fields
  @state() private formName = '';
  @state() private formColor = '#6366f1';
  @state() private formOrder = 0;
  @state() private formIsTerminal = false;
  @state() private formIsDefault = false;

  private api = new CallLogApiClient();

  connectedCallback() {
    super.connectedCallback();
    if (this.pipelineId) this.loadPipeline();
  }

  updated(changed: Map<PropertyKey, unknown>) {
    if (changed.has('pipelineId') && this.pipelineId) {
      this.loadPipeline();
    }
  }

  async loadPipeline() {
    this.loading = true;
    this.error = '';
    try {
      const pipeline = await this.api.getPipeline(this.pipelineId);
      this.stages = [...pipeline.stages].sort((a, b) => a.order - b.order);
    } catch (e) {
      this.error = e instanceof Error ? e.message : 'Failed to load pipeline';
    } finally {
      this.loading = false;
    }
  }

  private openAddForm() {
    this.editingStage = null;
    this.formName = '';
    this.formColor = '#6366f1';
    this.formOrder = this.stages.length;
    this.formIsTerminal = false;
    this.formIsDefault = false;
    this.showForm = true;
  }

  private openEditForm(stage: IPipelineStage) {
    this.editingStage = stage;
    this.formName = stage.name;
    this.formColor = stage.color;
    this.formOrder = stage.order;
    this.formIsTerminal = stage.isTerminal;
    this.formIsDefault = stage.isDefault;
    this.showForm = true;
  }

  private async onSave() {
    if (!this.formName.trim()) return;
    this.error = '';
    try {
      if (this.editingStage) {
        await this.api.updateStage(this.pipelineId, this.editingStage.stageId, {
          name: this.formName,
          color: this.formColor,
          order: this.formOrder,
          isTerminal: this.formIsTerminal,
          isDefault: this.formIsDefault,
        });
      } else {
        await this.api.addStage(this.pipelineId, {
          name: this.formName,
          color: this.formColor,
          order: this.formOrder,
          isTerminal: this.formIsTerminal,
          isDefault: this.formIsDefault,
        });
      }
      this.showForm = false;
      this.loadPipeline();
      this.dispatchEvent(new CustomEvent('stage-saved', { bubbles: true, composed: true }));
    } catch (e) {
      this.error = e instanceof Error ? e.message : 'Save failed';
    }
  }

  private async onDelete(stage: IPipelineStage) {
    if (!confirm(`Remove stage "${stage.name}"?`)) return;
    try {
      await this.api.removeStage(this.pipelineId, stage.stageId);
      this.loadPipeline();
    } catch (e) {
      this.error = e instanceof Error ? e.message : 'Delete failed';
    }
  }

  render() {
    if (!this.pipelineId) return html`<div class="card"><div class="empty">Select a pipeline to edit stages.</div></div>`;

    return html`
      <div class="card">
        <div class="card-header">
          <h3>Pipeline Stages</h3>
          <div class="actions">
            <button @click=${this.openAddForm}>+ Add Stage</button>
          </div>
        </div>

        ${this.error ? html`<div class="error">${this.error}</div>` : ''}
        ${this.loading ? html`<div class="empty">Loading...</div>` : ''}

        ${this.stages.length === 0 && !this.loading ? html`<div class="empty">No stages. Add the first stage.</div>` : ''}

        ${this.stages.map(stage => html`
          <div class="stage-row">
            <div class="color-dot" style="background:${stage.color}"></div>
            <span class="stage-name">${stage.name}</span>
            ${stage.isDefault ? html`<span class="badge badge-warning">Default</span>` : ''}
            ${stage.isTerminal ? html`<span class="badge badge-muted">Terminal</span>` : ''}
            <span style="font-size:0.75rem;color:var(--alx-text-muted,#64748b);">#${stage.order}</span>
            <div class="actions">
              <button @click=${() => this.openEditForm(stage)}>Edit</button>
              <button class="danger" @click=${() => this.onDelete(stage)}>Remove</button>
            </div>
          </div>
        `)}

        ${this.showForm ? html`
          <div class="form">
            <label>
              Stage Name
              <input type="text" .value=${this.formName}
                @input=${(e: Event) => this.formName = (e.target as HTMLInputElement).value} />
            </label>
            <div class="form-row">
              <label>
                Color
                <input type="color" .value=${this.formColor}
                  @input=${(e: Event) => this.formColor = (e.target as HTMLInputElement).value} />
              </label>
              <label>
                Order
                <input type="number" .value=${String(this.formOrder)} min="0"
                  @input=${(e: Event) => this.formOrder = parseInt((e.target as HTMLInputElement).value || '0', 10)} />
              </label>
            </div>
            <div class="checkbox-row">
              <input type="checkbox" id="terminal" .checked=${this.formIsTerminal}
                @change=${(e: Event) => this.formIsTerminal = (e.target as HTMLInputElement).checked} />
              <label for="terminal">Terminal stage (closes call log)</label>
            </div>
            <div class="checkbox-row">
              <input type="checkbox" id="default" .checked=${this.formIsDefault}
                @change=${(e: Event) => this.formIsDefault = (e.target as HTMLInputElement).checked} />
              <label for="default">Default entry stage</label>
            </div>
            <div class="actions">
              <button class="primary" @click=${this.onSave}>Save Stage</button>
              <button @click=${() => this.showForm = false}>Cancel</button>
            </div>
          </div>
        ` : ''}
      </div>
    `;
  }
}

safeRegister('alx-pipeline-stage-editor', AlxPipelineStageEditor);
