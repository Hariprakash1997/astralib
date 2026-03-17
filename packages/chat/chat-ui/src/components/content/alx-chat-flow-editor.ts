import { LitElement, html, css } from 'lit';
import { state } from 'lit/decorators.js';
import type { FlowStep, PreChatFlowConfig } from '@astralibx/chat-types';
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
  alxChatCardStyles,
  alxChatToggleStyles,
} from '../../styles/shared.js';

const STEP_TYPES = ['welcome', 'faq', 'guided', 'form', 'agent-selector', 'custom'] as const;

export class AlxChatFlowEditor extends LitElement {
  static styles = [
    alxChatResetStyles,
    alxChatThemeStyles,
    alxChatDensityStyles,
    alxChatButtonStyles,
    alxChatInputStyles,
    alxChatBadgeStyles,
    alxChatLoadingStyles,
    alxChatCardStyles,
    alxChatToggleStyles,
    css`
      :host { display: block; }

      .flow-header {
        display: flex;
        align-items: center;
        gap: 0.75rem;
        margin-bottom: 1rem;
      }

      .step-list {
        display: flex;
        flex-direction: column;
        gap: 0.5rem;
      }

      .step-item {
        border: 1px solid var(--alx-border);
        border-radius: var(--alx-radius);
        overflow: hidden;
      }

      .step-header {
        display: flex;
        align-items: center;
        gap: 0.5rem;
        padding: 0.5rem 0.75rem;
        background: var(--alx-surface-alt);
        cursor: pointer;
      }

      .step-number {
        width: 24px;
        height: 24px;
        border-radius: 50%;
        background: var(--alx-primary);
        color: #fff;
        display: flex;
        align-items: center;
        justify-content: center;
        font-size: 0.6875rem;
        font-weight: 700;
        flex-shrink: 0;
      }

      .step-type {
        font-weight: 500;
        font-size: 0.8125rem;
        flex: 1;
        text-transform: capitalize;
      }

      .step-drag {
        cursor: grab;
        color: var(--alx-text-muted);
        user-select: none;
      }

      .step-body {
        padding: 0.75rem;
        display: none;
        border-top: 1px solid var(--alx-border);
      }

      .step-body.expanded {
        display: block;
      }

      .step-actions {
        display: flex;
        gap: 0.25rem;
      }

      .add-step-menu {
        display: flex;
        flex-wrap: wrap;
        gap: 0.375rem;
        margin-top: 0.75rem;
      }

      .preview-container {
        margin-top: 1rem;
        padding: 1rem;
        background: var(--alx-bg);
        border: 1px solid var(--alx-border);
        border-radius: var(--alx-radius);
      }

      .preview-step {
        padding: 0.5rem;
        margin-bottom: 0.375rem;
        background: var(--alx-surface);
        border-radius: var(--alx-radius);
        font-size: 0.8125rem;
      }

      .toggle-row {
        display: flex;
        align-items: center;
        gap: 0.5rem;
        margin-bottom: 0.5rem;
      }
      .toggle-label { font-size: 0.8125rem; }
    `,
  ];

  @state() private flowConfig: PreChatFlowConfig = {
    enabled: false,
    steps: [],
    completionAction: 'chat',
  };
  @state() private loading = false;
  @state() private saving = false;
  @state() private error = '';
  @state() private expandedIndex = -1;
  @state() private showPreview = false;

  private http!: HttpClient;

  connectedCallback() {
    super.connectedCallback();
    this.http = new HttpClient(AlxChatConfig.getApiUrl('chatEngine'));
    this.loadConfig();
  }

  async loadConfig() {
    this.loading = true;
    try {
      const config = await this.http.get<{ preChatFlow?: PreChatFlowConfig }>('/widget-config');
      if (config.preChatFlow) {
        this.flowConfig = config.preChatFlow;
      }
    } catch (e) {
      this.error = e instanceof Error ? e.message : 'Failed to load config';
    } finally {
      this.loading = false;
    }
  }

  private addStep(type: string) {
    const step: FlowStep = this.createDefaultStep(type);
    this.flowConfig = {
      ...this.flowConfig,
      steps: [...this.flowConfig.steps, step],
    };
    this.expandedIndex = this.flowConfig.steps.length - 1;
  }

  private createDefaultStep(type: string): FlowStep {
    switch (type) {
      case 'welcome':
        return { type: 'welcome', title: 'Welcome', subtitle: '', ctaText: 'Start Chat' };
      case 'faq':
        return { type: 'faq', title: 'FAQ', items: [], searchEnabled: true, feedbackEnabled: true };
      case 'guided':
        return { type: 'guided', questions: [], mode: 'sequential' };
      case 'form':
        return { type: 'form', title: 'Your Details', fields: [], submitText: 'Continue' };
      case 'agent-selector':
        return { type: 'agent-selector', title: 'Select Agent', showAvailability: true };
      case 'custom':
        return { type: 'custom', html: '<p>Custom content</p>', ctaText: 'Continue' };
      default:
        return { type: 'custom', html: '', ctaText: 'Continue' };
    }
  }

  private removeStep(index: number) {
    const steps = [...this.flowConfig.steps];
    steps.splice(index, 1);
    this.flowConfig = { ...this.flowConfig, steps };
    if (this.expandedIndex === index) this.expandedIndex = -1;
  }

  private moveStep(index: number, direction: -1 | 1) {
    const target = index + direction;
    if (target < 0 || target >= this.flowConfig.steps.length) return;
    const steps = [...this.flowConfig.steps];
    [steps[index], steps[target]] = [steps[target], steps[index]];
    this.flowConfig = { ...this.flowConfig, steps };
    this.expandedIndex = target;
  }

  private updateStepField(index: number, field: string, value: unknown) {
    const steps = [...this.flowConfig.steps];
    steps[index] = { ...steps[index], [field]: value } as FlowStep;
    this.flowConfig = { ...this.flowConfig, steps };
  }

  private async onSave() {
    this.saving = true;
    this.error = '';
    try {
      await this.http.put('/widget-config', { preChatFlow: this.flowConfig });
      this.dispatchEvent(new CustomEvent('flow-saved', { bubbles: true, composed: true }));
    } catch (e) {
      this.error = e instanceof Error ? e.message : 'Failed to save';
    } finally {
      this.saving = false;
    }
  }

  private renderStepConfig(step: FlowStep, index: number) {
    switch (step.type) {
      case 'welcome':
        return html`
          <div class="form-group">
            <label>Title</label>
            <input type="text" .value=${step.title}
              @input=${(e: Event) => this.updateStepField(index, 'title', (e.target as HTMLInputElement).value)} />
          </div>
          <div class="form-group">
            <label>Subtitle</label>
            <input type="text" .value=${step.subtitle || ''}
              @input=${(e: Event) => this.updateStepField(index, 'subtitle', (e.target as HTMLInputElement).value)} />
          </div>
          <div class="form-group">
            <label>CTA Text</label>
            <input type="text" .value=${step.ctaText || ''}
              @input=${(e: Event) => this.updateStepField(index, 'ctaText', (e.target as HTMLInputElement).value)} />
          </div>
        `;
      case 'faq':
        return html`
          <div class="form-group">
            <label>Title</label>
            <input type="text" .value=${step.title || ''}
              @input=${(e: Event) => this.updateStepField(index, 'title', (e.target as HTMLInputElement).value)} />
          </div>
          <div class="toggle-row">
            <label class="toggle">
              <input type="checkbox" .checked=${step.searchEnabled !== false}
                @change=${(e: Event) => this.updateStepField(index, 'searchEnabled', (e.target as HTMLInputElement).checked)} />
              <span class="toggle-slider"></span>
            </label>
            <span class="toggle-label">Search Enabled</span>
          </div>
          <div class="toggle-row">
            <label class="toggle">
              <input type="checkbox" .checked=${step.feedbackEnabled !== false}
                @change=${(e: Event) => this.updateStepField(index, 'feedbackEnabled', (e.target as HTMLInputElement).checked)} />
              <span class="toggle-slider"></span>
            </label>
            <span class="toggle-label">Feedback Enabled</span>
          </div>
          <p class="text-muted text-small">FAQ items are managed in the FAQ section</p>
        `;
      case 'form':
        return html`
          <div class="form-group">
            <label>Title</label>
            <input type="text" .value=${step.title || ''}
              @input=${(e: Event) => this.updateStepField(index, 'title', (e.target as HTMLInputElement).value)} />
          </div>
          <div class="form-group">
            <label>Submit Text</label>
            <input type="text" .value=${step.submitText || ''}
              @input=${(e: Event) => this.updateStepField(index, 'submitText', (e.target as HTMLInputElement).value)} />
          </div>
          <p class="text-muted text-small">Form fields: ${step.fields?.length || 0} configured</p>
        `;
      case 'agent-selector':
        return html`
          <div class="form-group">
            <label>Title</label>
            <input type="text" .value=${step.title || ''}
              @input=${(e: Event) => this.updateStepField(index, 'title', (e.target as HTMLInputElement).value)} />
          </div>
          <div class="toggle-row">
            <label class="toggle">
              <input type="checkbox" .checked=${step.showAvailability !== false}
                @change=${(e: Event) => this.updateStepField(index, 'showAvailability', (e.target as HTMLInputElement).checked)} />
              <span class="toggle-slider"></span>
            </label>
            <span class="toggle-label">Show Availability</span>
          </div>
        `;
      case 'custom':
        return html`
          <div class="form-group">
            <label>HTML Content</label>
            <textarea rows="4" .value=${step.html}
              @input=${(e: Event) => this.updateStepField(index, 'html', (e.target as HTMLTextAreaElement).value)}></textarea>
          </div>
          <div class="form-group">
            <label>CTA Text</label>
            <input type="text" .value=${step.ctaText || ''}
              @input=${(e: Event) => this.updateStepField(index, 'ctaText', (e.target as HTMLInputElement).value)} />
          </div>
        `;
      default:
        return html`<p class="text-muted">Configure this step type externally</p>`;
    }
  }

  render() {
    return html`
      <div class="alx-card">
        <div class="alx-card-header">
          <h3>Pre-Chat Flow</h3>
          <div style="display:flex;gap:0.375rem;">
            <button class="alx-btn-sm" @click=${() => this.showPreview = !this.showPreview}>
              ${this.showPreview ? 'Hide Preview' : 'Preview'}
            </button>
            <button class="alx-btn-primary alx-btn-sm" ?disabled=${this.saving}
              @click=${this.onSave}>${this.saving ? 'Saving...' : 'Save'}</button>
          </div>
        </div>

        ${this.error ? html`<div class="alx-error">${this.error}</div>` : ''}
        ${this.loading ? html`<div class="alx-loading"><span class="alx-spinner"></span> Loading...</div>` : ''}

        ${!this.loading ? html`
          <div class="flow-header">
            <label class="toggle">
              <input type="checkbox" .checked=${this.flowConfig.enabled}
                @change=${(e: Event) => this.flowConfig = { ...this.flowConfig, enabled: (e.target as HTMLInputElement).checked }} />
              <span class="toggle-slider"></span>
            </label>
            <span style="font-size:0.8125rem;">Flow Enabled</span>
            <div class="spacer"></div>
            <select style="width:auto;" .value=${this.flowConfig.completionAction}
              @change=${(e: Event) => this.flowConfig = { ...this.flowConfig, completionAction: (e.target as HTMLSelectElement).value as 'chat' | 'close' | 'url' }}>
              <option value="chat">Open Chat</option>
              <option value="close">Close Widget</option>
              <option value="url">Redirect to URL</option>
            </select>
          </div>

          <div class="step-list">
            ${this.flowConfig.steps.map((step, i) => html`
              <div class="step-item">
                <div class="step-header" @click=${() => this.expandedIndex = this.expandedIndex === i ? -1 : i}>
                  <span class="step-number">${i + 1}</span>
                  <span class="step-drag" @click=${(e: Event) => e.stopPropagation()}>
                    <span @click=${() => this.moveStep(i, -1)} style="cursor:pointer;">&uarr;</span>
                    <span @click=${() => this.moveStep(i, 1)} style="cursor:pointer;">&darr;</span>
                  </span>
                  <span class="step-type">${step.type}</span>
                  <div class="step-actions" @click=${(e: Event) => e.stopPropagation()}>
                    <button class="alx-btn-icon danger" @click=${() => this.removeStep(i)}>&#10005;</button>
                  </div>
                </div>
                <div class="step-body ${this.expandedIndex === i ? 'expanded' : ''}">
                  ${this.renderStepConfig(step, i)}
                </div>
              </div>
            `)}
          </div>

          <div class="add-step-menu">
            ${STEP_TYPES.map(t => html`
              <button class="alx-btn-sm" @click=${() => this.addStep(t)}>${t}</button>
            `)}
          </div>

          ${this.showPreview ? html`
            <div class="preview-container">
              <h4 style="margin-bottom:0.5rem;">Flow Preview</h4>
              ${this.flowConfig.steps.length === 0
                ? html`<p class="text-muted">No steps configured</p>`
                : this.flowConfig.steps.map((step, i) => html`
                    <div class="preview-step">
                      <strong>Step ${i + 1}:</strong> ${step.type}
                      ${step.type === 'welcome' ? ` - ${step.title}` : ''}
                      ${step.type === 'form' ? ` - ${step.title || 'Form'}` : ''}
                    </div>
                  `)
              }
              <p class="text-muted text-small" style="margin-top:0.5rem;">
                Completion: ${this.flowConfig.completionAction}
              </p>
            </div>
          ` : ''}
        ` : ''}
      </div>
    `;
  }
}

safeRegister('alx-chat-flow-editor', AlxChatFlowEditor);
