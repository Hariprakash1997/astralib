import { LitElement, html, css } from 'lit';
import { property, state } from 'lit/decorators.js';
import type { PipelineFunnel } from '@astralibx/call-log-types';
import { safeRegister } from '../../utils/safe-register.js';
import { CallLogApiClient } from '../../api/call-log-api-client.js';

export class AlxPipelineFunnel extends LitElement {
  static styles = css`
    :host { display: block; font-family: inherit; }
    .card { background: var(--alx-surface, #fff); border: 1px solid var(--alx-border, #e2e8f0); border-radius: 8px; padding: 1rem; }
    .card-header { display: flex; align-items: center; justify-content: space-between; margin-bottom: 1rem; }
    h3 { margin: 0; font-size: 1rem; font-weight: 600; }
    .toolbar { display: flex; gap: 0.5rem; align-items: center; margin-bottom: 1rem; flex-wrap: wrap; }
    select, input { padding: 0.375rem 0.5rem; border: 1px solid var(--alx-border, #e2e8f0); border-radius: 6px; font-size: 0.8rem; font-family: inherit; }
    button { padding: 0.35rem 0.75rem; font-size: 0.8rem; border-radius: 6px; border: 1px solid #3b82f6; cursor: pointer; background: #3b82f6; color: #fff; font-family: inherit; }
    .funnel { display: flex; flex-direction: column; gap: 0.5rem; }
    .funnel-stage { display: flex; align-items: center; gap: 1rem; }
    .funnel-bar-wrap { flex: 1; height: 32px; background: var(--alx-surface-alt, #f1f5f9); border-radius: 4px; overflow: hidden; }
    .funnel-bar { height: 100%; background: #3b82f6; display: flex; align-items: center; padding: 0 0.5rem; color: #fff; font-size: 0.75rem; font-weight: 600; transition: width 0.3s; }
    .stage-name { min-width: 120px; font-size: 0.8rem; font-weight: 500; }
    .stage-stats { font-size: 0.75rem; color: var(--alx-text-muted, #64748b); min-width: 80px; text-align: right; }
    .drop-off { font-size: 0.7rem; color: #ef4444; }
    .error { color: #dc2626; font-size: 0.875rem; padding: 0.5rem; }
    .loading, .empty { color: var(--alx-text-muted, #64748b); padding: 0.5rem; }
  `;

  @property({ type: String }) pipelineId = '';

  @state() private funnel: PipelineFunnel | null = null;
  @state() private pipelines: Array<{ pipelineId: string; name: string }> = [];
  @state() private loading = false;
  @state() private error = '';
  @state() private selectedPipelineId = '';
  @state() private dateFrom = '';
  @state() private dateTo = '';

  private api = new CallLogApiClient();

  connectedCallback() {
    super.connectedCallback();
    this.loadPipelines();
    if (this.pipelineId) {
      this.selectedPipelineId = this.pipelineId;
      this.loadFunnel();
    }
  }

  updated(changed: Map<PropertyKey, unknown>) {
    if (changed.has('pipelineId') && this.pipelineId) {
      this.selectedPipelineId = this.pipelineId;
      this.loadFunnel();
    }
  }

  async loadPipelines() {
    try {
      const result = await this.api.listPipelines({ isActive: true });
      this.pipelines = result.map(p => ({ pipelineId: p.pipelineId, name: p.name }));
      if (!this.selectedPipelineId && this.pipelines.length > 0) {
        this.selectedPipelineId = this.pipelines[0]!.pipelineId;
        this.loadFunnel();
      }
    } catch {
      // non-fatal
    }
  }

  async loadFunnel() {
    if (!this.selectedPipelineId) return;
    this.loading = true;
    this.error = '';
    try {
      this.funnel = await this.api.getPipelineFunnel(this.selectedPipelineId, {
        from: this.dateFrom || undefined,
        to: this.dateTo || undefined,
      });
    } catch (e) {
      this.error = e instanceof Error ? e.message : 'Failed to load funnel';
    } finally {
      this.loading = false;
    }
  }

  render() {
    const maxEntered = this.funnel
      ? Math.max(...this.funnel.stages.map(s => s.entered), 1)
      : 1;

    return html`
      <div class="card">
        <div class="card-header">
          <h3>Pipeline Funnel</h3>
        </div>

        <div class="toolbar">
          <select .value=${this.selectedPipelineId}
            @change=${(e: Event) => { this.selectedPipelineId = (e.target as HTMLSelectElement).value; this.loadFunnel(); }}>
            ${this.pipelines.map(p => html`<option value=${p.pipelineId}>${p.name}</option>`)}
          </select>
          <input type="date" .value=${this.dateFrom} @change=${(e: Event) => this.dateFrom = (e.target as HTMLInputElement).value} />
          <input type="date" .value=${this.dateTo} @change=${(e: Event) => this.dateTo = (e.target as HTMLInputElement).value} />
          <button @click=${() => this.loadFunnel()}>Load</button>
        </div>

        ${this.error ? html`<div class="error">${this.error}</div>` : ''}
        ${this.loading ? html`<div class="loading">Loading funnel...</div>` : ''}

        ${!this.loading && this.funnel ? html`
          <div class="funnel">
            ${this.funnel.stages.map(stage => {
              const width = Math.max((stage.entered / maxEntered) * 100, 2);
              return html`
                <div class="funnel-stage">
                  <span class="stage-name">${stage.stageName}</span>
                  <div class="funnel-bar-wrap">
                    <div class="funnel-bar" style="width:${width}%;">
                      ${stage.entered}
                    </div>
                  </div>
                  <div class="stage-stats">
                    <div>${stage.exited} exited</div>
                    ${stage.dropOff > 0 ? html`<div class="drop-off">-${stage.dropOff} drop</div>` : ''}
                  </div>
                </div>
              `;
            })}
          </div>
        ` : ''}

        ${!this.loading && !this.funnel && !this.error
          ? html`<div class="empty">Select a pipeline to view funnel.</div>`
          : ''}
      </div>
    `;
  }
}

safeRegister('alx-pipeline-funnel', AlxPipelineFunnel);
