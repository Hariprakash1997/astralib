import { LitElement, html, css, nothing } from 'lit';
import { property, state } from 'lit/decorators.js';
import type { ICallLog, IPipelineStage } from '@astralibx/call-log-types';
import { safeRegister } from '../../utils/safe-register.js';
import { CallLogApiClient } from '../../api/call-log-api-client.js';

export class AlxCallLogDetail extends LitElement {
  static styles = css`
    :host { display: block; font-family: inherit; }
    .card { background: var(--alx-surface, #fff); border: 1px solid var(--alx-border, #e2e8f0); border-radius: 8px; padding: 1rem; }
    .card-header { display: flex; align-items: center; justify-content: space-between; margin-bottom: 1rem; }
    h3 { margin: 0; font-size: 1rem; font-weight: 600; }
    .grid { display: grid; grid-template-columns: 1fr 1fr; gap: 0.75rem; margin-bottom: 1rem; }
    .field { display: flex; flex-direction: column; gap: 0.2rem; }
    .field-label { font-size: 0.7rem; font-weight: 600; text-transform: uppercase; letter-spacing: 0.04em; color: var(--alx-text-muted, #64748b); }
    .field-value { font-size: 0.875rem; }
    .badge { display: inline-block; padding: 0.1rem 0.5rem; border-radius: 4px; font-size: 0.75rem; font-weight: 500; }
    .badge-high { background: #fee2e2; color: #dc2626; }
    .badge-urgent { background: #fce7f3; color: #9d174d; }
    .badge-medium { background: #fef9c3; color: #92400e; }
    .badge-low { background: #f1f5f9; color: #64748b; }
    .badge-in { background: #dbeafe; color: #1e40af; }
    .badge-out { background: #dcfce7; color: #166534; }
    .badge-closed { background: #f1f5f9; color: #64748b; }
    .badge-open { background: #dcfce7; color: #166534; }
    .tag { display: inline-block; background: #f1f5f9; color: #334155; padding: 0.1rem 0.4rem; border-radius: 4px; font-size: 0.75rem; margin: 0.1rem; }
    .actions { display: flex; gap: 0.5rem; flex-wrap: wrap; }
    button { padding: 0.375rem 0.75rem; font-size: 0.8rem; border-radius: 6px; border: 1px solid var(--alx-border, #e2e8f0); cursor: pointer; background: var(--alx-surface, #fff); font-family: inherit; }
    button.primary { background: #3b82f6; color: #fff; border-color: #3b82f6; }
    button.danger { background: #fee2e2; color: #dc2626; border-color: #fca5a5; }
    .section-title { font-size: 0.8rem; font-weight: 700; text-transform: uppercase; letter-spacing: 0.05em; color: var(--alx-text-muted, #64748b); margin: 1rem 0 0.5rem; }
    .error { color: #dc2626; padding: 0.5rem; font-size: 0.875rem; }
    .loading, .empty { color: var(--alx-text-muted, #64748b); padding: 1rem; text-align: center; }
    select { padding: 0.3rem 0.5rem; border: 1px solid var(--alx-border, #e2e8f0); border-radius: 6px; font-size: 0.8rem; font-family: inherit; background: var(--alx-surface, #fff); }
    input { padding: 0.3rem 0.5rem; border: 1px solid var(--alx-border, #e2e8f0); border-radius: 6px; font-size: 0.8rem; font-family: inherit; }
    .inline-form { display: flex; gap: 0.4rem; align-items: center; flex-wrap: wrap; margin-top: 0.25rem; }
    .followup-green { color: #166534; font-weight: 500; }
    .followup-yellow { color: #92400e; font-weight: 500; }
    .followup-red { color: #dc2626; font-weight: 500; }
    .warn-icon { font-size: 0.75rem; }
    button.warning { background: #fef9c3; color: #92400e; border-color: #fde68a; }
    button.success { background: #dcfce7; color: #166534; border-color: #86efac; }
  `;

  @property({ type: String }) callLogId = '';
  @property({ type: String }) agentId = '';

  @state() private callLog: ICallLog | null = null;
  @state() private loading = false;
  @state() private error = '';

  // stage change
  @state() private pipelineStages: IPipelineStage[] = [];
  @state() private stagesLoaded = false;
  @state() private selectedNewStage = '';

  // reassignment
  @state() private showReassignInput = false;
  @state() private reassignAgentId = '';
  @state() private reassigning = false;

  // follow-up
  @state() private showFollowUpPicker = false;
  @state() private followUpPickerValue = '';

  private api = new CallLogApiClient();

  connectedCallback() {
    super.connectedCallback();
    if (this.callLogId) this.load();
  }

  updated(changed: Map<PropertyKey, unknown>) {
    if (changed.has('callLogId') && this.callLogId) this.load();
  }

  async load() {
    this.loading = true;
    this.error = '';
    try {
      this.callLog = await this.api.getCallLog(this.callLogId);
    } catch (e) {
      this.error = e instanceof Error ? e.message : 'Failed to load call log';
    } finally {
      this.loading = false;
    }
  }

  private onEdit() {
    this.dispatchEvent(new CustomEvent('call-log-edit', {
      detail: { callLogId: this.callLogId, callLog: this.callLog },
      bubbles: true, composed: true,
    }));
  }

  private async onClose() {
    if (!this.callLog || this.callLog.isClosed) return;
    if (!confirm('Close this call log?')) return;
    try {
      this.callLog = await this.api.closeCallLog(this.callLogId, this.callLog.agentId);
    } catch (e) {
      this.error = e instanceof Error ? e.message : 'Close failed';
    }
  }

  private async onReopen() {
    if (!this.callLog || !this.callLog.isClosed) return;
    if (!confirm('Reopen this call log?')) return;
    try {
      this.callLog = await this.api.reopenCallLog(this.callLogId, this.callLog.agentId);
    } catch (e) {
      this.error = e instanceof Error ? e.message : 'Reopen failed';
    }
  }

  private async loadPipelineStages() {
    if (!this.callLog || this.stagesLoaded) return;
    try {
      const pipeline = await this.api.getPipeline(this.callLog.pipelineId);
      this.pipelineStages = [...pipeline.stages].sort((a, b) => a.order - b.order);
      this.stagesLoaded = true;
    } catch { /* non-fatal */ }
  }

  private async onStageChange(newStageId: string) {
    if (!this.callLog || !newStageId || newStageId === this.callLog.currentStageId) return;
    try {
      this.callLog = await this.api.changeStage(this.callLogId, newStageId, this.callLog.agentId);
      this.selectedNewStage = '';
    } catch (e) {
      this.error = e instanceof Error ? e.message : 'Stage change failed';
    }
  }

  private async onReassign() {
    if (!this.callLog || !this.reassignAgentId.trim()) return;
    this.reassigning = true;
    try {
      this.callLog = await this.api.assignCallLog(this.callLogId, this.reassignAgentId.trim(), this.callLog.agentId);
      this.showReassignInput = false;
      this.reassignAgentId = '';
    } catch (e) {
      this.error = e instanceof Error ? e.message : 'Reassignment failed';
    } finally {
      this.reassigning = false;
    }
  }

  private async onSetFollowUp() {
    if (!this.callLog || !this.followUpPickerValue) return;
    try {
      this.callLog = await this.api.updateCallLog(this.callLogId, { nextFollowUpDate: this.followUpPickerValue });
      this.showFollowUpPicker = false;
      this.followUpPickerValue = '';
    } catch (e) {
      this.error = e instanceof Error ? e.message : 'Failed to set follow-up';
    }
  }

  private async onClearFollowUp() {
    if (!this.callLog) return;
    if (!confirm('Clear follow-up date?')) return;
    try {
      this.callLog = await this.api.updateCallLog(this.callLogId, { nextFollowUpDate: '' });
    } catch (e) {
      this.error = e instanceof Error ? e.message : 'Failed to clear follow-up';
    }
  }

  private followUpClass(date?: Date | string): string {
    if (!date) return '';
    const d = new Date(date);
    const now = new Date();
    const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
    const dDay = new Date(d.getFullYear(), d.getMonth(), d.getDate());
    if (dDay < today) return 'followup-red';
    if (dDay.getTime() === today.getTime()) return 'followup-yellow';
    return 'followup-green';
  }

  private formatDate(d?: Date | string): string {
    if (!d) return '-';
    return new Date(d).toLocaleString(undefined, { month: 'short', day: 'numeric', year: 'numeric', hour: '2-digit', minute: '2-digit' });
  }

  render() {
    if (!this.callLogId) return html`<div class="card"><div class="empty">Select a call log to view details.</div></div>`;
    if (this.loading) return html`<div class="card"><div class="loading">Loading...</div></div>`;
    if (this.error) return html`<div class="card"><div class="error">${this.error} <button @click=${() => this.error = ''}>Dismiss</button></div></div>`;
    if (!this.callLog) return nothing;

    const c = this.callLog;
    const currentStage = this.pipelineStages.find(s => s.stageId === c.currentStageId);

    return html`
      <div class="card">
        <div class="card-header">
          <h3>${c.contactRef.displayName}</h3>
          <div class="actions">
            <button @click=${this.onEdit}>Edit</button>
            ${c.isClosed
              ? html`<button class="success" @click=${this.onReopen}>Reopen</button>`
              : html`<button class="danger" @click=${this.onClose}>Close</button>`}
          </div>
        </div>

        <div class="section-title">Contact</div>
        <div class="grid">
          <div class="field">
            <span class="field-label">Name</span>
            <span class="field-value">${c.contactRef.displayName}</span>
          </div>
          <div class="field">
            <span class="field-label">External ID</span>
            <span class="field-value">${c.contactRef.externalId}</span>
          </div>
          <div class="field">
            <span class="field-label">Phone</span>
            <span class="field-value">${c.contactRef.phone ?? '-'}</span>
          </div>
          <div class="field">
            <span class="field-label">Email</span>
            <span class="field-value">${c.contactRef.email ?? '-'}</span>
          </div>
        </div>

        <div class="section-title">Call Info</div>
        <div class="grid">
          <div class="field">
            <span class="field-label">Direction</span>
            <span class="badge ${c.direction === 'inbound' ? 'badge-in' : 'badge-out'}">${c.direction}</span>
          </div>
          <div class="field">
            <span class="field-label">Priority</span>
            <span class="badge badge-${c.priority}">${c.priority}</span>
          </div>
          <div class="field">
            <span class="field-label">Status</span>
            <span class="badge ${c.isClosed ? 'badge-closed' : 'badge-open'}">${c.isClosed ? 'Closed' : 'Open'}</span>
          </div>
          <div class="field">
            <span class="field-label">Category</span>
            <span class="field-value">${c.category ?? '-'}</span>
          </div>
          <div class="field">
            <span class="field-label">Call Date</span>
            <span class="field-value">${this.formatDate(c.callDate)}</span>
          </div>
          <div class="field" style="grid-column:1/-1;">
            <span class="field-label">Agent</span>
            <div class="inline-form">
              <span class="field-value">${c.agentId}</span>
              ${!this.showReassignInput
                ? html`<button @click=${() => { this.showReassignInput = true; this.reassignAgentId = ''; }}>Reassign</button>`
                : html`
                  <input type="text" placeholder="New agent ID" .value=${this.reassignAgentId}
                    @input=${(e: Event) => this.reassignAgentId = (e.target as HTMLInputElement).value}
                    @keydown=${(e: KeyboardEvent) => { if (e.key === 'Enter') this.onReassign(); if (e.key === 'Escape') this.showReassignInput = false; }} />
                  <button class="primary" ?disabled=${this.reassigning} @click=${this.onReassign}>${this.reassigning ? '...' : 'Confirm'}</button>
                  <button @click=${() => this.showReassignInput = false}>Cancel</button>
                `}
            </div>
          </div>
        </div>

        <div class="section-title">Stage</div>
        <div class="inline-form" style="margin-bottom:0.75rem;">
          <span class="field-value" style="font-weight:500;">${currentStage?.name ?? c.currentStageId ?? 'Unknown'}</span>
          <select
            .value=${this.selectedNewStage}
            @focus=${() => this.loadPipelineStages()}
            @change=${(e: Event) => {
              const val = (e.target as HTMLSelectElement).value;
              if (val) this.onStageChange(val);
            }}>
            <option value="">Move to Stage...</option>
            ${this.pipelineStages.filter(s => s.stageId !== c.currentStageId).map(s => html`
              <option value=${s.stageId}>
                ${s.name}${s.isTerminal ? ' ⚠ (closes call)' : ''}
              </option>
            `)}
          </select>
        </div>

        <div class="section-title">Follow-up</div>
        <div class="inline-form" style="margin-bottom:0.75rem;">
          ${c.nextFollowUpDate
            ? html`
              <span class="${this.followUpClass(c.nextFollowUpDate)}">${this.formatDate(c.nextFollowUpDate)}</span>
              <button @click=${this.onClearFollowUp}>Clear</button>
            `
            : html`<span style="font-size:0.8rem;color:#94a3b8;">No follow-up set</span>`}
          ${!this.showFollowUpPicker
            ? html`<button @click=${() => { this.showFollowUpPicker = true; this.followUpPickerValue = ''; }}>Set Follow-up</button>`
            : html`
              <input type="date" .value=${this.followUpPickerValue}
                @change=${(e: Event) => this.followUpPickerValue = (e.target as HTMLInputElement).value} />
              <button class="primary" @click=${this.onSetFollowUp}>Save</button>
              <button @click=${() => this.showFollowUpPicker = false}>Cancel</button>
            `}
        </div>

        <div class="section-title">Tags</div>
        <div>
          ${c.tags.length > 0
            ? c.tags.map(t => html`<span class="tag">${t}</span>`)
            : html`<span style="font-size:0.8rem;color:#64748b;">No tags</span>`}
        </div>

        <div class="section-title">Timeline</div>
        <alx-call-timeline .callLogId=${this.callLogId}></alx-call-timeline>
      </div>
    `;
  }
}

safeRegister('alx-call-log-detail', AlxCallLogDetail);
