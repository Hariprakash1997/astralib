import { LitElement, html, css } from 'lit';
import { state } from 'lit/decorators.js';
import type { ChatAgentInfo } from '@astralibx/chat-types';
import { AgentStatus } from '@astralibx/chat-types';
import { safeRegister } from '../../utils/safe-register.js';
import { HttpClient } from '../../api/http-client.js';
import { AlxChatConfig } from '../../config.js';
import {
  alxChatResetStyles,
  alxChatThemeStyles,
  alxChatDensityStyles,
  alxChatTableStyles,
  alxChatButtonStyles,
  alxChatBadgeStyles,
  alxChatLoadingStyles,
  alxChatToolbarStyles,
  alxChatCardStyles,
  alxChatToggleStyles,
} from '../../styles/shared.js';

interface AgentData extends ChatAgentInfo {
  isActive?: boolean;
  maxConcurrentChats?: number;
  activeChats?: number;
  totalChatsHandled?: number;
}

export class AlxChatAgentList extends LitElement {
  static styles = [
    alxChatResetStyles,
    alxChatThemeStyles,
    alxChatDensityStyles,
    alxChatTableStyles,
    alxChatButtonStyles,
    alxChatBadgeStyles,
    alxChatLoadingStyles,
    alxChatToolbarStyles,
    alxChatCardStyles,
    alxChatToggleStyles,
    css`
      :host { display: block; }
      .actions { display: flex; gap: 0.25rem; }
      .ai-indicator {
        display: inline-flex;
        align-items: center;
        gap: 0.2rem;
        font-size: 0.6875rem;
        font-weight: 600;
        color: var(--alx-info);
      }
    `,
  ];

  @state() private agents: AgentData[] = [];
  @state() private loading = false;
  @state() private error = '';

  private http!: HttpClient;

  connectedCallback() {
    super.connectedCallback();
    this.http = new HttpClient(AlxChatConfig.getApiUrl('chatEngine'));
    this.loadAgents();
  }

  async loadAgents() {
    this.loading = true;
    this.error = '';
    try {
      const result = await this.http.get<AgentData[] | { data: AgentData[] }>('/agents');
      this.agents = Array.isArray(result) ? result : (result as { data: AgentData[] }).data ?? [];
    } catch (e) {
      this.error = e instanceof Error ? e.message : 'Failed to load agents';
    } finally {
      this.loading = false;
    }
  }

  private getStatusBadge(status: AgentStatus) {
    const map: Record<string, { cls: string; label: string }> = {
      [AgentStatus.Available]: { cls: 'alx-badge-success', label: 'Available' },
      [AgentStatus.Busy]: { cls: 'alx-badge-warning', label: 'Busy' },
      [AgentStatus.Away]: { cls: 'alx-badge-muted', label: 'Away' },
      [AgentStatus.Offline]: { cls: 'alx-badge-danger', label: 'Offline' },
    };
    return map[status] ?? { cls: 'alx-badge-muted', label: status };
  }

  private onEdit(agent: AgentData) {
    this.dispatchEvent(new CustomEvent('agent-edit', {
      detail: { agentId: agent.agentId, agent },
      bubbles: true,
      composed: true,
    }));
  }

  private async onToggleActive(agent: AgentData) {
    try {
      await this.http.post(`/agents/${agent.agentId}/toggle-active`);
      this.loadAgents();
    } catch (e) {
      this.error = e instanceof Error ? e.message : 'Failed to toggle agent';
    }
  }

  private async onDelete(agent: AgentData) {
    if (!confirm(`Delete agent "${agent.name}"?`)) return;
    try {
      await this.http.delete(`/agents/${agent.agentId}`);
      this.loadAgents();
    } catch (e) {
      this.error = e instanceof Error ? e.message : 'Failed to delete agent';
    }
  }

  private onAdd() {
    this.dispatchEvent(new CustomEvent('agent-add', {
      bubbles: true,
      composed: true,
    }));
  }

  render() {
    return html`
      <div class="alx-card">
        <div class="alx-card-header">
          <h3>Agents</h3>
          <button class="alx-btn-primary alx-btn-sm" @click=${this.onAdd}>+ Add Agent</button>
        </div>

        ${this.error ? html`<div class="alx-error">${this.error}</div>` : ''}
        ${this.loading ? html`<div class="alx-loading"><span class="alx-spinner"></span> Loading...</div>` : ''}

        ${!this.loading && this.agents.length === 0 && !this.error
          ? html`<div class="alx-empty">No agents configured</div>`
          : ''}

        ${!this.loading && this.agents.length > 0 ? html`
          <div style="overflow-x:auto;">
            <table>
              <thead>
                <tr>
                  <th>Name</th>
                  <th>Role</th>
                  <th>Status</th>
                  <th>AI</th>
                  <th>Active Chats</th>
                  <th>Total Handled</th>
                  <th>Actions</th>
                </tr>
              </thead>
              <tbody>
                ${this.agents.map(a => {
                  const badge = this.getStatusBadge(a.status);
                  return html`
                    <tr>
                      <td>${a.name}</td>
                      <td>${a.role || '-'}</td>
                      <td><span class="alx-badge ${badge.cls}">${badge.label}</span></td>
                      <td>
                        ${a.isAI ? html`<span class="ai-indicator">AI</span>` : '-'}
                      </td>
                      <td>${a.activeChats ?? 0}</td>
                      <td>${a.totalChatsHandled ?? 0}</td>
                      <td>
                        <div class="actions">
                          <button class="alx-btn-icon" title="Edit" @click=${() => this.onEdit(a)}>&#9998;</button>
                          <label class="toggle" title="Toggle active">
                            <input type="checkbox" .checked=${a.isActive !== false}
                              @change=${() => this.onToggleActive(a)} />
                            <span class="toggle-slider"></span>
                          </label>
                          <button class="alx-btn-icon danger" title="Delete" @click=${() => this.onDelete(a)}>&#10005;</button>
                        </div>
                      </td>
                    </tr>
                  `;
                })}
              </tbody>
            </table>
          </div>
        ` : ''}
      </div>
    `;
  }
}

safeRegister('alx-chat-agent-list', AlxChatAgentList);
