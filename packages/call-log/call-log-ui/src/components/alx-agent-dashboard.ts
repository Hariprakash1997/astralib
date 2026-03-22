import { LitElement, html, css, nothing } from 'lit';
import { property, state } from 'lit/decorators.js';
import type { ICallLog, AgentCallStats } from '@astralibx/call-log-types';
import { safeRegister } from '../utils/safe-register.js';
import { CallLogApiClient } from '../api/call-log-api-client.js';

export class AlxAgentDashboard extends LitElement {
  static styles = css`
    :host { display: block; font-family: inherit; }
    .panels { display: grid; grid-template-columns: 1fr 1fr 1fr; gap: 1rem; }
    @media (max-width: 900px) { .panels { grid-template-columns: 1fr; } }
    .panel { background: var(--alx-surface, #fff); border: 1px solid var(--alx-border, #e2e8f0); border-radius: 8px; padding: 1rem; }
    .panel-title { font-size: 0.8rem; font-weight: 700; text-transform: uppercase; letter-spacing: 0.05em; color: var(--alx-text-muted, #64748b); margin-bottom: 0.75rem; }
    .call-card { border: 1px solid var(--alx-border, #e2e8f0); border-radius: 6px; padding: 0.625rem 0.75rem; margin-bottom: 0.5rem; cursor: pointer; font-size: 0.8rem; transition: box-shadow 0.15s; }
    .call-card:hover { box-shadow: 0 2px 6px rgba(0,0,0,0.08); }
    .call-name { font-weight: 600; margin-bottom: 0.2rem; }
    .call-meta { font-size: 0.72rem; color: var(--alx-text-muted, #64748b); }
    .badge { display: inline-block; padding: 0.1rem 0.375rem; border-radius: 4px; font-size: 0.7rem; font-weight: 500; margin-left: 0.25rem; }
    .badge-high { background: #fee2e2; color: #dc2626; }
    .badge-urgent { background: #fce7f3; color: #9d174d; }
    .badge-medium { background: #fef9c3; color: #92400e; }
    .badge-low { background: #f1f5f9; color: #64748b; }
    .followup-row { display: flex; align-items: center; justify-content: space-between; padding: 0.5rem 0; border-bottom: 1px solid var(--alx-border, #e2e8f0); font-size: 0.8rem; }
    .followup-row:last-child { border-bottom: none; }
    .followup-date { font-size: 0.72rem; font-weight: 500; }
    .date-green { color: #166534; }
    .date-yellow { color: #92400e; }
    .date-red { color: #dc2626; }
    .stat-row { display: flex; align-items: center; justify-content: space-between; padding: 0.4rem 0; border-bottom: 1px solid var(--alx-border, #e2e8f0); font-size: 0.8rem; }
    .stat-row:last-child { border-bottom: none; }
    .stat-label { color: var(--alx-text-muted, #64748b); }
    .stat-val { font-weight: 600; font-size: 0.95rem; }
    .btn-sm { padding: 0.2rem 0.5rem; font-size: 0.7rem; border-radius: 4px; border: 1px solid var(--alx-border, #e2e8f0); cursor: pointer; background: var(--alx-surface, #fff); font-family: inherit; }
    .btn-sm:hover { background: #f1f5f9; }
    .empty { color: var(--alx-text-muted, #64748b); font-size: 0.8rem; text-align: center; padding: 1rem 0; }
    .loading { color: var(--alx-text-muted, #64748b); font-size: 0.8rem; padding: 0.5rem 0; text-align: center; }
    .error { color: #dc2626; font-size: 0.8rem; padding: 0.25rem 0; }
  `;

  @property({ type: String }) agentId = '';

  @state() private openCalls: ICallLog[] = [];
  @state() private followUps: ICallLog[] = [];
  @state() private stats: AgentCallStats | null = null;
  @state() private loadingOpen = false;
  @state() private loadingFollowUps = false;
  @state() private loadingStats = false;
  @state() private errorOpen = '';
  @state() private errorFollowUps = '';
  @state() private errorStats = '';

  private api = new CallLogApiClient();

  connectedCallback() {
    super.connectedCallback();
    if (this.agentId) this.loadAll();
  }

  updated(changed: Map<PropertyKey, unknown>) {
    if (changed.has('agentId') && this.agentId) this.loadAll();
  }

  private loadAll() {
    this.loadOpenCalls();
    this.loadFollowUps();
    this.loadStats();
  }

  private async loadOpenCalls() {
    this.loadingOpen = true;
    this.errorOpen = '';
    try {
      const result = await this.api.listCallLogs({ agentId: this.agentId, isClosed: false, limit: 25 });
      this.openCalls = result.data ?? [];
    } catch (e) {
      this.errorOpen = e instanceof Error ? e.message : 'Failed to load';
    } finally {
      this.loadingOpen = false;
    }
  }

  private async loadFollowUps() {
    this.loadingFollowUps = true;
    this.errorFollowUps = '';
    try {
      this.followUps = await this.api.getFollowUpsDue(this.agentId);
    } catch (e) {
      this.errorFollowUps = e instanceof Error ? e.message : 'Failed to load';
    } finally {
      this.loadingFollowUps = false;
    }
  }

  private async loadStats() {
    this.loadingStats = true;
    this.errorStats = '';
    try {
      this.stats = await this.api.getAgentStats(this.agentId);
    } catch (e) {
      this.errorStats = e instanceof Error ? e.message : 'Failed to load';
    } finally {
      this.loadingStats = false;
    }
  }

  private onCallCardClick(call: ICallLog) {
    this.dispatchEvent(new CustomEvent('call-log-select', {
      detail: { callLogId: call.callLogId, callLog: call },
      bubbles: true, composed: true,
    }));
  }

  private followUpClass(date?: Date | string): string {
    if (!date) return '';
    const d = new Date(date);
    const now = new Date();
    const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
    const dDay = new Date(d.getFullYear(), d.getMonth(), d.getDate());
    if (dDay < today) return 'date-red';
    if (dDay.getTime() === today.getTime()) return 'date-yellow';
    return 'date-green';
  }

  private formatDate(d?: Date | string): string {
    if (!d) return '-';
    return new Date(d).toLocaleDateString(undefined, { month: 'short', day: 'numeric', year: 'numeric' });
  }

  private pct(n: number): string {
    return (n * 100).toFixed(1) + '%';
  }

  private renderOpenCalls() {
    return html`
      <div class="panel">
        <div class="panel-title">My Open Calls</div>
        ${this.loadingOpen ? html`<div class="loading">Loading...</div>` : ''}
        ${this.errorOpen ? html`<div class="error">${this.errorOpen}</div>` : ''}
        ${!this.loadingOpen && this.openCalls.length === 0 && !this.errorOpen
          ? html`<div class="empty">No open calls</div>`
          : ''}
        ${this.openCalls.map(c => html`
          <div class="call-card" @click=${() => this.onCallCardClick(c)}>
            <div class="call-name">
              ${c.contactRef.displayName}
              <span class="badge badge-${c.priority}">${c.priority}</span>
            </div>
            <div class="call-meta">${this.formatDate(c.callDate)}</div>
            ${c.currentStageId ? html`<div class="call-meta">Stage: ${c.currentStageId}</div>` : nothing}
          </div>
        `)}
      </div>
    `;
  }

  private renderFollowUps() {
    return html`
      <div class="panel">
        <div class="panel-title">Overdue Follow-ups</div>
        ${this.loadingFollowUps ? html`<div class="loading">Loading...</div>` : ''}
        ${this.errorFollowUps ? html`<div class="error">${this.errorFollowUps}</div>` : ''}
        ${!this.loadingFollowUps && this.followUps.length === 0 && !this.errorFollowUps
          ? html`<div class="empty">No pending follow-ups</div>`
          : ''}
        ${this.followUps.map(c => html`
          <div class="followup-row">
            <div>
              <div style="font-weight:500;">${c.contactRef.displayName}</div>
              <div class="followup-date ${this.followUpClass(c.nextFollowUpDate)}">
                ${this.formatDate(c.nextFollowUpDate)}
              </div>
            </div>
            <button class="btn-sm" @click=${() => this.onCallCardClick(c)}>View</button>
          </div>
        `)}
      </div>
    `;
  }

  private renderStats() {
    const s = this.stats;
    return html`
      <div class="panel">
        <div class="panel-title">My Stats</div>
        ${this.loadingStats ? html`<div class="loading">Loading...</div>` : ''}
        ${this.errorStats ? html`<div class="error">${this.errorStats}</div>` : ''}
        ${s ? html`
          <div class="stat-row">
            <span class="stat-label">Total Calls</span>
            <span class="stat-val">${s.totalCalls}</span>
          </div>
          <div class="stat-row">
            <span class="stat-label">Closed Calls</span>
            <span class="stat-val">${s.callsClosed}</span>
          </div>
          <div class="stat-row">
            <span class="stat-label">Close Rate</span>
            <span class="stat-val">${s.closeRate.toFixed(1)}%</span>
          </div>
          <div class="stat-row">
            <span class="stat-label">Avg Calls/Day</span>
            <span class="stat-val">${s.avgCallsPerDay.toFixed(1)}</span>
          </div>
          <div class="stat-row">
            <span class="stat-label">Overdue Follow-ups</span>
            <span class="stat-val" style="color:${s.overdueFollowUps > 0 ? '#dc2626' : 'inherit'}">${s.overdueFollowUps}</span>
          </div>
        ` : nothing}
      </div>
    `;
  }

  render() {
    if (!this.agentId) {
      return html`<div style="color:#94a3b8;padding:1rem;font-size:0.875rem;">No agent ID provided.</div>`;
    }
    return html`
      <div class="panels">
        ${this.renderOpenCalls()}
        ${this.renderFollowUps()}
        ${this.renderStats()}
      </div>
    `;
  }
}

safeRegister('alx-agent-dashboard', AlxAgentDashboard);
