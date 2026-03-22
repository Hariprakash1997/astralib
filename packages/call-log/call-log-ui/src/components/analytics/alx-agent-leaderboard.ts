import { LitElement, html, css } from 'lit';
import { state } from 'lit/decorators.js';
import type { AgentCallStats } from '@astralibx/call-log-types';
import { safeRegister } from '../../utils/safe-register.js';
import { CallLogApiClient } from '../../api/call-log-api-client.js';

export class AlxAgentLeaderboard extends LitElement {
  static styles = css`
    :host { display: block; font-family: inherit; }
    .card { background: var(--alx-surface, #fff); border: 1px solid var(--alx-border, #e2e8f0); border-radius: 8px; padding: 1rem; }
    .card-header { display: flex; align-items: center; justify-content: space-between; margin-bottom: 1rem; }
    h3 { margin: 0; font-size: 1rem; font-weight: 600; }
    .toolbar { display: flex; gap: 0.5rem; margin-bottom: 0.75rem; flex-wrap: wrap; }
    input { padding: 0.375rem 0.5rem; border: 1px solid var(--alx-border, #e2e8f0); border-radius: 6px; font-size: 0.8rem; font-family: inherit; }
    button { padding: 0.35rem 0.75rem; font-size: 0.8rem; border-radius: 6px; border: 1px solid #3b82f6; cursor: pointer; background: #3b82f6; color: #fff; font-family: inherit; }
    table { width: 100%; border-collapse: collapse; }
    th, td { text-align: left; padding: 0.5rem 0.75rem; border-bottom: 1px solid var(--alx-border, #e2e8f0); font-size: 0.8rem; }
    th { font-size: 0.7rem; font-weight: 600; text-transform: uppercase; letter-spacing: 0.04em; color: var(--alx-text-muted, #64748b); }
    .rank { font-weight: 700; color: var(--alx-text-muted, #64748b); }
    .rank-1 { color: #f59e0b; }
    .rank-2 { color: #94a3b8; }
    .rank-3 { color: #92400e; }
    .progress { height: 6px; border-radius: 3px; background: #e2e8f0; overflow: hidden; margin-top: 2px; }
    .progress-fill { height: 100%; background: #3b82f6; border-radius: 3px; }
    .badge { display: inline-block; padding: 0.1rem 0.4rem; border-radius: 4px; font-size: 0.7rem; font-weight: 500; background: #f1f5f9; color: #334155; }
    .error { color: #dc2626; font-size: 0.875rem; padding: 0.5rem; }
    .loading, .empty { color: var(--alx-text-muted, #64748b); padding: 1rem; text-align: center; }
  `;

  @state() private agents: AgentCallStats[] = [];
  @state() private loading = false;
  @state() private error = '';
  @state() private dateFrom = '';
  @state() private dateTo = '';

  private api = new CallLogApiClient();

  connectedCallback() {
    super.connectedCallback();
    this.load();
  }

  async load() {
    this.loading = true;
    this.error = '';
    try {
      const result = await this.api.getAgentLeaderboard({
        from: this.dateFrom || undefined,
        to: this.dateTo || undefined,
      });
      this.agents = result.agents ?? [];
    } catch (e) {
      this.error = e instanceof Error ? e.message : 'Failed to load leaderboard';
    } finally {
      this.loading = false;
    }
  }

  private rankClass(i: number): string {
    return i === 0 ? 'rank rank-1' : i === 1 ? 'rank rank-2' : i === 2 ? 'rank rank-3' : 'rank';
  }

  private rankLabel(i: number): string {
    return i === 0 ? '🥇' : i === 1 ? '🥈' : i === 2 ? '🥉' : String(i + 1);
  }

  render() {
    const maxCalls = Math.max(...this.agents.map(a => a.totalCalls), 1);

    return html`
      <div class="card">
        <div class="card-header">
          <h3>Agent Leaderboard</h3>
        </div>

        <div class="toolbar">
          <input type="date" .value=${this.dateFrom} @change=${(e: Event) => this.dateFrom = (e.target as HTMLInputElement).value} />
          <input type="date" .value=${this.dateTo} @change=${(e: Event) => this.dateTo = (e.target as HTMLInputElement).value} />
          <button @click=${() => this.load()}>Load</button>
        </div>

        ${this.error ? html`<div class="error">${this.error}</div>` : ''}
        ${this.loading ? html`<div class="loading">Loading leaderboard...</div>` : ''}

        ${!this.loading && this.agents.length === 0 && !this.error
          ? html`<div class="empty">No agent data found.</div>`
          : ''}

        ${!this.loading && this.agents.length > 0 ? html`
          <table>
            <thead>
              <tr>
                <th>#</th>
                <th>Agent</th>
                <th>Total Calls</th>
                <th>Closed</th>
                <th>Close Rate</th>
                <th>Follow-Ups Done</th>
                <th>Overdue</th>
              </tr>
            </thead>
            <tbody>
              ${this.agents.map((agent, i) => html`
                <tr>
                  <td class="${this.rankClass(i)}">${this.rankLabel(i)}</td>
                  <td>
                    <div style="font-weight:500;">${agent.agentName || agent.agentId}</div>
                    <div style="font-size:0.7rem;color:#94a3b8;">${agent.agentId}</div>
                  </td>
                  <td>
                    <div>${agent.totalCalls}</div>
                    <div class="progress">
                      <div class="progress-fill" style="width:${(agent.totalCalls / maxCalls) * 100}%"></div>
                    </div>
                  </td>
                  <td>${agent.callsClosed}</td>
                  <td>${agent.closeRate.toFixed(1)}%</td>
                  <td>${agent.followUpsCompleted}</td>
                  <td>
                    ${agent.overdueFollowUps > 0
                      ? html`<span class="badge" style="background:#fee2e2;color:#dc2626;">${agent.overdueFollowUps}</span>`
                      : html`<span style="color:#22c55e;">0</span>`}
                  </td>
                </tr>
              `)}
            </tbody>
          </table>
        ` : ''}
      </div>
    `;
  }
}

safeRegister('alx-agent-leaderboard', AlxAgentLeaderboard);
