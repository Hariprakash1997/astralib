import { LitElement, html, css, nothing } from 'lit';
import { property, state } from 'lit/decorators.js';
import type { ICallLog, ICallLogSettings } from '@astralibx/call-log-types';
import { safeRegister } from '../../utils/safe-register.js';
import { CallLogApiClient } from '../../api/call-log-api-client.js';

export class AlxCallLogList extends LitElement {
  static styles = css`
    :host { display: block; font-family: inherit; }
    .card { background: var(--alx-surface, #fff); border: 1px solid var(--alx-border, #e2e8f0); border-radius: 8px; padding: 1rem; }
    .card-header { display: flex; align-items: center; justify-content: space-between; margin-bottom: 1rem; }
    h3 { margin: 0; font-size: 1rem; font-weight: 600; }
    .toolbar { display: flex; gap: 0.5rem; flex-wrap: wrap; margin-bottom: 0.75rem; }
    select, input { padding: 0.375rem 0.5rem; border: 1px solid var(--alx-border, #e2e8f0); border-radius: 6px; font-size: 0.8rem; font-family: inherit; background: var(--alx-surface, #fff); }
    table { width: 100%; border-collapse: collapse; }
    th, td { text-align: left; padding: 0.5rem 0.75rem; border-bottom: 1px solid var(--alx-border, #e2e8f0); font-size: 0.8rem; }
    th { font-weight: 600; color: var(--alx-text-muted, #64748b); font-size: 0.75rem; }
    tr:hover td { background: var(--alx-surface-alt, #f8fafc); cursor: pointer; }
    .badge { display: inline-block; padding: 0.1rem 0.4rem; border-radius: 4px; font-size: 0.7rem; font-weight: 500; }
    .badge-high { background: #fee2e2; color: #dc2626; }
    .badge-urgent { background: #fce7f3; color: #9d174d; }
    .badge-medium { background: #fef9c3; color: #92400e; }
    .badge-low { background: #f1f5f9; color: #64748b; }
    .badge-in { background: #dbeafe; color: #1e40af; }
    .badge-out { background: #dcfce7; color: #166534; }
    .badge-closed { background: #f1f5f9; color: #64748b; }
    .badge-open { background: #dcfce7; color: #166534; }
    .badge-channel { background: #f0fdf4; color: #166534; border: 1px solid #bbf7d0; }
    .badge-outcome-answered { background: #dcfce7; color: #166534; }
    .badge-outcome-missed { background: #fee2e2; color: #dc2626; }
    .badge-outcome-voicemail { background: #fef9c3; color: #92400e; }
    .badge-outcome-busy { background: #fce7f3; color: #9d174d; }
    .badge-outcome-default { background: #f1f5f9; color: #334155; }
    .badge-followup { background: #eff6ff; color: #1e40af; border: 1px solid #bfdbfe; font-size: 0.65rem; padding: 0.05rem 0.3rem; }
    input[type=checkbox].followup-toggle { width: auto; cursor: pointer; }
    .pagination { display: flex; align-items: center; gap: 0.5rem; padding-top: 0.75rem; }
    button { padding: 0.375rem 0.75rem; font-size: 0.8rem; border-radius: 6px; border: 1px solid var(--alx-border, #e2e8f0); cursor: pointer; background: var(--alx-surface, #fff); font-family: inherit; }
    button.primary { background: #3b82f6; color: #fff; border-color: #3b82f6; }
    button:disabled { opacity: 0.4; cursor: not-allowed; }
    .error { color: #dc2626; padding: 0.5rem; font-size: 0.875rem; }
    .loading, .empty { color: var(--alx-text-muted, #64748b); padding: 1rem; text-align: center; font-size: 0.875rem; }
    .tag { display: inline-block; background: #f1f5f9; color: #334155; padding: 0.1rem 0.35rem; border-radius: 4px; font-size: 0.7rem; margin: 0 0.1rem; }
    .bulk-toolbar { display: flex; gap: 0.5rem; align-items: center; background: #eff6ff; border: 1px solid #bfdbfe; border-radius: 6px; padding: 0.4rem 0.75rem; margin-bottom: 0.5rem; }
    .bulk-toolbar span { font-size: 0.8rem; font-weight: 500; color: #1e40af; }
    input[type=checkbox] { cursor: pointer; }
  `;

  @property({ type: String }) pipelineId = '';

  @state() private callLogs: ICallLog[] = [];
  @state() private settings: ICallLogSettings | null = null;
  @state() private loading = false;
  @state() private error = '';
  @state() private page = 1;
  @state() private totalPages = 1;
  @state() private filterPipelineId = '';
  @state() private filterStageId = '';
  @state() private filterAgentId = '';
  @state() private filterPriority = '';
  @state() private filterDirection = '';
  @state() private filterChannel = '';
  @state() private filterOutcome = '';
  @state() private filterIsFollowUp = '';
  @state() private filterIsClosed = '';
  @state() private filterFrom = '';
  @state() private filterTo = '';

  // bulk selection
  @state() private selectedIds: Set<string> = new Set();
  @state() private bulkStageId = '';
  @state() private bulkAgentId = '';

  private api = new CallLogApiClient();

  connectedCallback() {
    super.connectedCallback();
    if (this.pipelineId) this.filterPipelineId = this.pipelineId;
    this.loadCallLogs();
    this.loadSettings();
  }

  async loadSettings() {
    try {
      this.settings = await this.api.getSettings();
    } catch {
      // non-fatal
    }
  }

  async loadCallLogs() {
    this.loading = true;
    this.error = '';
    try {
      const filter: Record<string, unknown> = { page: this.page, limit: 25 };
      if (this.filterPipelineId) filter['pipelineId'] = this.filterPipelineId;
      if (this.filterStageId) filter['currentStageId'] = this.filterStageId;
      if (this.filterAgentId) filter['agentId'] = this.filterAgentId;
      if (this.filterPriority) filter['priority'] = this.filterPriority;
      if (this.filterDirection) filter['direction'] = this.filterDirection;
      if (this.filterChannel) filter['channel'] = this.filterChannel;
      if (this.filterOutcome) filter['outcome'] = this.filterOutcome;
      if (this.filterIsFollowUp !== '') filter['isFollowUp'] = this.filterIsFollowUp === 'true';
      if (this.filterIsClosed !== '') filter['isClosed'] = this.filterIsClosed === 'true';
      if (this.filterFrom) filter['from'] = this.filterFrom;
      if (this.filterTo) filter['to'] = this.filterTo;

      const result = await this.api.listCallLogs(filter as Parameters<typeof this.api.listCallLogs>[0]);
      this.callLogs = result.data ?? [];
      this.totalPages = result.totalPages ?? 1;
    } catch (e) {
      this.error = e instanceof Error ? e.message : 'Failed to load call logs';
    } finally {
      this.loading = false;
    }
  }

  private onRowClick(call: ICallLog) {
    this.dispatchEvent(new CustomEvent('call-log-select', {
      detail: { callLogId: call.callLogId, callLog: call },
      bubbles: true, composed: true,
    }));
  }

  private onAdd() {
    this.dispatchEvent(new CustomEvent('call-log-add', { bubbles: true, composed: true }));
  }

  private goPage(p: number) {
    this.page = p;
    this.loadCallLogs();
  }

  private applyFilter() {
    this.page = 1;
    this.selectedIds = new Set();
    this.loadCallLogs();
  }

  private toggleSelect(id: string) {
    const next = new Set(this.selectedIds);
    if (next.has(id)) next.delete(id); else next.add(id);
    this.selectedIds = next;
  }

  private toggleSelectAll() {
    if (this.selectedIds.size === this.callLogs.length) {
      this.selectedIds = new Set();
    } else {
      this.selectedIds = new Set(this.callLogs.map(c => c.callLogId));
    }
  }

  private async onBulkMoveStage() {
    if (!this.bulkStageId || this.selectedIds.size === 0) return;
    const ids = [...this.selectedIds];
    try {
      await this.api.bulkChangeStage(ids, this.bulkStageId, this.bulkAgentId || 'system');
      this.selectedIds = new Set();
      this.bulkStageId = '';
      this.loadCallLogs();
    } catch (e) {
      this.error = e instanceof Error ? e.message : 'Bulk stage change failed';
    }
  }

  private async onBulkClose() {
    if (this.selectedIds.size === 0) return;
    if (!confirm(`Close ${this.selectedIds.size} selected call logs?`)) return;
    const ids = [...this.selectedIds];
    const agentId = this.bulkAgentId || 'system';
    let failCount = 0;
    for (const id of ids) {
      try { await this.api.closeCallLog(id, agentId); } catch { failCount++; }
    }
    this.selectedIds = new Set();
    this.loadCallLogs();
    if (failCount > 0) this.error = `${failCount} calls could not be closed.`;
  }

  private async onExport(format: 'csv' | 'json') {
    try {
      const filter: Record<string, unknown> = {};
      if (this.filterPipelineId) filter['pipelineId'] = this.filterPipelineId;
      if (this.filterAgentId) filter['agentId'] = this.filterAgentId;
      if (this.filterPriority) filter['priority'] = this.filterPriority;
      if (this.filterIsClosed !== '') filter['isClosed'] = this.filterIsClosed === 'true';
      if (this.filterFrom) filter['dateFrom'] = this.filterFrom;
      if (this.filterTo) filter['dateTo'] = this.filterTo;
      const data = await this.api.exportCallLogs(filter as Parameters<typeof this.api.exportCallLogs>[0], format);
      const blob = new Blob([typeof data === 'string' ? data : JSON.stringify(data, null, 2)], {
        type: format === 'csv' ? 'text/csv' : 'application/json',
      });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url; a.download = `call-logs.${format}`; a.click();
      URL.revokeObjectURL(url);
    } catch (e) {
      this.error = e instanceof Error ? e.message : 'Export failed';
    }
  }

  private outcomeBadgeClass(outcome?: string): string {
    if (!outcome) return 'badge-outcome-default';
    const o = outcome.toLowerCase();
    if (o.includes('answer') || o === 'connected') return 'badge-outcome-answered';
    if (o.includes('miss') || o === 'no-answer') return 'badge-outcome-missed';
    if (o.includes('voicemail') || o === 'vm') return 'badge-outcome-voicemail';
    if (o.includes('busy')) return 'badge-outcome-busy';
    return 'badge-outcome-default';
  }

  private formatDate(d?: Date | string): string {
    if (!d) return '-';
    return new Date(d).toLocaleDateString(undefined, { month: 'short', day: 'numeric', year: 'numeric' });
  }

  render() {
    return html`
      <div class="card">
        <div class="card-header">
          <h3>Call Logs</h3>
          <div style="display:flex;gap:0.5rem;">
            <button @click=${() => this.onExport('csv')}>Export CSV</button>
            <button @click=${() => this.onExport('json')}>Export JSON</button>
            <button @click=${() => this.loadCallLogs()}>Refresh</button>
            <button class="primary" @click=${this.onAdd}>+ New Call</button>
          </div>
        </div>

        <div class="toolbar">
          <input type="text" placeholder="Pipeline ID" .value=${this.filterPipelineId}
            @input=${(e: Event) => this.filterPipelineId = (e.target as HTMLInputElement).value} />
          <input type="text" placeholder="Agent ID" .value=${this.filterAgentId}
            @input=${(e: Event) => this.filterAgentId = (e.target as HTMLInputElement).value} />
          <select .value=${this.filterPriority}
            @change=${(e: Event) => this.filterPriority = (e.target as HTMLSelectElement).value}>
            <option value="">All Priorities</option>
            <option value="urgent">Urgent</option>
            <option value="high">High</option>
            <option value="medium">Medium</option>
            <option value="low">Low</option>
          </select>
          <select .value=${this.filterDirection}
            @change=${(e: Event) => this.filterDirection = (e.target as HTMLSelectElement).value}>
            <option value="">All Directions</option>
            <option value="inbound">Inbound</option>
            <option value="outbound">Outbound</option>
          </select>
          <select .value=${this.filterChannel}
            @change=${(e: Event) => this.filterChannel = (e.target as HTMLSelectElement).value}>
            <option value="">All Channels</option>
            ${(this.settings?.availableChannels ?? []).map(ch => html`
              <option value=${ch}>${ch}</option>
            `)}
          </select>
          <select .value=${this.filterOutcome}
            @change=${(e: Event) => this.filterOutcome = (e.target as HTMLSelectElement).value}>
            <option value="">All Outcomes</option>
            ${(this.settings?.availableOutcomes ?? []).map(oc => html`
              <option value=${oc}>${oc}</option>
            `)}
          </select>
          <select .value=${this.filterIsFollowUp}
            @change=${(e: Event) => this.filterIsFollowUp = (e.target as HTMLSelectElement).value}>
            <option value="">All Calls</option>
            <option value="true">Follow-ups Only</option>
            <option value="false">Non Follow-ups</option>
          </select>
          <select .value=${this.filterIsClosed}
            @change=${(e: Event) => this.filterIsClosed = (e.target as HTMLSelectElement).value}>
            <option value="">Open & Closed</option>
            <option value="false">Open</option>
            <option value="true">Closed</option>
          </select>
          <input type="date" .value=${this.filterFrom}
            @change=${(e: Event) => this.filterFrom = (e.target as HTMLInputElement).value} />
          <input type="date" .value=${this.filterTo}
            @change=${(e: Event) => this.filterTo = (e.target as HTMLInputElement).value} />
          <button class="primary" @click=${this.applyFilter}>Apply</button>
        </div>

        ${this.error ? html`<div class="error">${this.error}</div>` : ''}
        ${this.loading ? html`<div class="loading">Loading...</div>` : ''}

        ${this.selectedIds.size > 0 ? html`
          <div class="bulk-toolbar">
            <span>${this.selectedIds.size} selected</span>
            <input type="text" placeholder="Stage ID" style="width:120px;"
              .value=${this.bulkStageId}
              @input=${(e: Event) => this.bulkStageId = (e.target as HTMLInputElement).value} />
            <input type="text" placeholder="Agent ID" style="width:100px;"
              .value=${this.bulkAgentId}
              @input=${(e: Event) => this.bulkAgentId = (e.target as HTMLInputElement).value} />
            <button @click=${this.onBulkMoveStage}>Move to Stage</button>
            <button class="danger" @click=${this.onBulkClose}>Close Selected</button>
            <button @click=${() => this.selectedIds = new Set()}>Clear</button>
          </div>
        ` : nothing}

        ${!this.loading && this.callLogs.length === 0 && !this.error
          ? html`<div class="empty">No call logs found</div>`
          : ''}

        ${!this.loading && this.callLogs.length > 0 ? html`
          <div style="overflow-x:auto;">
            <table>
              <thead>
                <tr>
                  <th><input type="checkbox"
                    .checked=${this.selectedIds.size === this.callLogs.length && this.callLogs.length > 0}
                    @change=${this.toggleSelectAll} /></th>
                  <th>Contact</th>
                  <th>Direction</th>
                  <th>Channel</th>
                  <th>Outcome</th>
                  <th>Priority</th>
                  <th>Tags</th>
                  <th>Call Date</th>
                  <th>Follow-Up</th>
                  <th>Status</th>
                </tr>
              </thead>
              <tbody>
                ${this.callLogs.map(c => html`
                  <tr @click=${() => this.onRowClick(c)}>
                    <td @click=${(e: Event) => { e.stopPropagation(); this.toggleSelect(c.callLogId); }}>
                      <input type="checkbox" .checked=${this.selectedIds.has(c.callLogId)} @change=${(e: Event) => { e.stopPropagation(); this.toggleSelect(c.callLogId); }} />
                    </td>
                    <td>
                      <div style="font-weight:500;">${c.contactRef.displayName}</div>
                      <div style="font-size:0.7rem;color:#64748b;">${c.contactRef.phone ?? c.contactRef.email ?? ''}</div>
                    </td>
                    <td>
                      <span class="badge ${c.direction === 'inbound' ? 'badge-in' : 'badge-out'}">${c.direction}</span>
                      ${c.isFollowUp ? html`<span class="badge badge-followup" title="Follow-up call">FU</span>` : nothing}
                    </td>
                    <td><span class="badge badge-channel">${c.channel ?? '-'}</span></td>
                    <td><span class="badge ${this.outcomeBadgeClass(c.outcome)}">${c.outcome ?? '-'}</span></td>
                    <td><span class="badge badge-${c.priority}">${c.priority}</span></td>
                    <td>${(c.tags ?? []).slice(0, 3).map(t => html`<span class="tag">${t}</span>`)}</td>
                    <td>${this.formatDate(c.callDate)}</td>
                    <td>${this.formatDate(c.nextFollowUpDate)}</td>
                    <td><span class="badge ${c.isClosed ? 'badge-closed' : 'badge-open'}">${c.isClosed ? 'Closed' : 'Open'}</span></td>
                  </tr>
                `)}
              </tbody>
            </table>
          </div>

          ${this.totalPages > 1 ? html`
            <div class="pagination">
              <button ?disabled=${this.page <= 1} @click=${() => this.goPage(this.page - 1)}>Prev</button>
              <span style="font-size:0.8rem;color:#64748b;">Page ${this.page} of ${this.totalPages}</span>
              <button ?disabled=${this.page >= this.totalPages} @click=${() => this.goPage(this.page + 1)}>Next</button>
            </div>
          ` : ''}
        ` : ''}
      </div>
    `;
  }
}

safeRegister('alx-call-log-list', AlxCallLogList);
