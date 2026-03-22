import { LitElement, html, css } from 'lit';
import { property, state } from 'lit/decorators.js';
import type { IPipeline, IPipelineStage, ICallLog } from '@astralibx/call-log-types';
import { safeRegister } from '../../utils/safe-register.js';
import { CallLogApiClient } from '../../api/call-log-api-client.js';

export class AlxPipelineBoard extends LitElement {
  static styles = css`
    :host { display: block; }
    .board { display: flex; gap: 1rem; overflow-x: auto; padding: 1rem 0; }
    .column {
      flex: 0 0 260px;
      background: var(--alx-surface-alt, #f8fafc);
      border-radius: 8px;
      border: 1px solid var(--alx-border, #e2e8f0);
      display: flex;
      flex-direction: column;
    }
    .col-header {
      display: flex;
      align-items: center;
      gap: 0.5rem;
      padding: 0.75rem 1rem;
      border-bottom: 1px solid var(--alx-border, #e2e8f0);
      font-size: 0.875rem;
      font-weight: 600;
    }
    .col-dot { width: 10px; height: 10px; border-radius: 50%; flex-shrink: 0; }
    .col-count { margin-left: auto; font-size: 0.75rem; font-weight: 500; color: var(--alx-text-muted, #64748b); background: var(--alx-border, #e2e8f0); padding: 0.125rem 0.4rem; border-radius: 9999px; }
    .col-cards { padding: 0.5rem; display: flex; flex-direction: column; gap: 0.5rem; min-height: 100px; }
    .call-card {
      background: var(--alx-surface, #fff);
      border: 1px solid var(--alx-border, #e2e8f0);
      border-radius: 6px;
      padding: 0.625rem 0.75rem;
      cursor: pointer;
      font-size: 0.8rem;
      transition: box-shadow 0.15s;
    }
    .call-card:hover { box-shadow: 0 2px 8px rgba(0,0,0,0.08); }
    .call-card.drag-over { border-color: #3b82f6; background: #eff6ff; }
    .contact-name { font-weight: 600; margin-bottom: 0.25rem; }
    .meta { color: var(--alx-text-muted, #64748b); font-size: 0.75rem; }
    .badge { display: inline-block; padding: 0.1rem 0.375rem; border-radius: 4px; font-size: 0.7rem; font-weight: 500; margin-top: 0.25rem; }
    .badge-high { background: #fee2e2; color: #dc2626; }
    .badge-urgent { background: #fce7f3; color: #9d174d; }
    .badge-medium { background: #fef9c3; color: #92400e; }
    .badge-low { background: #f1f5f9; color: #64748b; }
    .toolbar { display: flex; gap: 0.5rem; align-items: center; padding: 0.5rem 0 1rem; flex-wrap: wrap; }
    select, input { padding: 0.375rem 0.5rem; border: 1px solid var(--alx-border, #e2e8f0); border-radius: 6px; font-size: 0.8rem; font-family: inherit; background: var(--alx-surface, #fff); }
    .error { color: #dc2626; padding: 0.5rem; font-size: 0.875rem; }
    .loading { color: var(--alx-text-muted, #64748b); padding: 0.5rem; font-size: 0.875rem; }
    .empty-col { color: var(--alx-text-muted, #64748b); font-size: 0.75rem; text-align: center; padding: 1rem 0.5rem; }
  `;

  @property({ type: String }) pipelineId = '';
  @state() private pipeline: IPipeline | null = null;
  @state() private callLogs: ICallLog[] = [];
  @state() private loading = false;
  @state() private error = '';
  @state() private filterAgentId = '';
  @state() private filterPriority = '';
  @state() private draggingId = '';

  private api = new CallLogApiClient();

  connectedCallback() {
    super.connectedCallback();
    if (this.pipelineId) this.load();
  }

  updated(changed: Map<PropertyKey, unknown>) {
    if (changed.has('pipelineId') && this.pipelineId) this.load();
  }

  async load() {
    this.loading = true;
    this.error = '';
    try {
      const [pipeline, result] = await Promise.all([
        this.api.getPipeline(this.pipelineId),
        this.api.listCallLogs({ pipelineId: this.pipelineId, limit: 200 }),
      ]);
      this.pipeline = pipeline;
      this.callLogs = result.data ?? [];
    } catch (e) {
      this.error = e instanceof Error ? e.message : 'Failed to load board';
    } finally {
      this.loading = false;
    }
  }

  private getCallsForStage(stage: IPipelineStage): ICallLog[] {
    return this.callLogs.filter(c => {
      if (c.currentStageId !== stage.stageId) return false;
      if (this.filterAgentId && c.agentId !== this.filterAgentId) return false;
      if (this.filterPriority && c.priority !== this.filterPriority) return false;
      return true;
    });
  }

  private priorityBadgeClass(priority: string) {
    const map: Record<string, string> = { high: 'badge-high', urgent: 'badge-urgent', medium: 'badge-medium', low: 'badge-low' };
    return map[priority] ?? 'badge-low';
  }

  private onDragStart(callLogId: string) {
    this.draggingId = callLogId;
  }

  private onDragOver(e: DragEvent) {
    e.preventDefault();
  }

  private async onDrop(e: DragEvent, stage: IPipelineStage) {
    e.preventDefault();
    if (!this.draggingId) return;
    const call = this.callLogs.find(c => c.callLogId === this.draggingId);
    if (!call || call.currentStageId === stage.stageId) return;
    try {
      const updated = await this.api.changeStage(this.draggingId, stage.stageId, call.agentId);
      this.callLogs = this.callLogs.map(c => c.callLogId === updated.callLogId ? updated : c);
    } catch (e) {
      this.error = e instanceof Error ? e.message : 'Stage change failed';
    } finally {
      this.draggingId = '';
    }
  }

  private onCardClick(call: ICallLog) {
    this.dispatchEvent(new CustomEvent('call-log-select', {
      detail: { callLogId: call.callLogId, callLog: call },
      bubbles: true, composed: true,
    }));
  }

  render() {
    if (!this.pipelineId) return html`<div class="loading">Select a pipeline to view the board.</div>`;

    const sortedStages = this.pipeline
      ? [...this.pipeline.stages].sort((a, b) => a.order - b.order)
      : [];

    return html`
      <div class="toolbar">
        <input type="text" placeholder="Filter by agent ID..."
          .value=${this.filterAgentId}
          @input=${(e: Event) => { this.filterAgentId = (e.target as HTMLInputElement).value; this.requestUpdate(); }} />
        <select .value=${this.filterPriority}
          @change=${(e: Event) => { this.filterPriority = (e.target as HTMLSelectElement).value; this.requestUpdate(); }}>
          <option value="">All Priorities</option>
          <option value="urgent">Urgent</option>
          <option value="high">High</option>
          <option value="medium">Medium</option>
          <option value="low">Low</option>
        </select>
        <button @click=${() => this.load()} style="padding:0.375rem 0.75rem;font-size:0.8rem;border:1px solid #e2e8f0;border-radius:6px;cursor:pointer;">Refresh</button>
      </div>

      ${this.error ? html`<div class="error">${this.error}</div>` : ''}
      ${this.loading ? html`<div class="loading">Loading board...</div>` : ''}

      ${!this.loading ? html`
        <div class="board">
          ${sortedStages.map(stage => {
            const cards = this.getCallsForStage(stage);
            return html`
              <div class="column"
                @dragover=${this.onDragOver}
                @drop=${(e: DragEvent) => this.onDrop(e, stage)}>
                <div class="col-header">
                  <div class="col-dot" style="background:${stage.color}"></div>
                  <span>${stage.name}</span>
                  <span class="col-count">${cards.length}</span>
                </div>
                <div class="col-cards">
                  ${cards.length === 0
                    ? html`<div class="empty-col">Drop cards here</div>`
                    : cards.map(call => html`
                      <div class="call-card"
                        draggable="true"
                        @dragstart=${() => this.onDragStart(call.callLogId)}
                        @click=${() => this.onCardClick(call)}>
                        <div class="contact-name">${call.contactRef.displayName}</div>
                        <div class="meta">${call.direction} · ${call.contactRef.phone ?? call.contactRef.email ?? ''}</div>
                        <span class="badge ${this.priorityBadgeClass(call.priority)}">${call.priority}</span>
                      </div>
                    `)}
                </div>
              </div>
            `;
          })}
        </div>
      ` : ''}
    `;
  }
}

safeRegister('alx-pipeline-board', AlxPipelineBoard);
