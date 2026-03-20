import { LitElement, html, css, nothing } from 'lit';
import { property, state } from 'lit/decorators.js';
import { safeRegister } from '../../utils/safe-register.js';
import { ChatApiClient } from '../../api/chat-api-client.js';
import type { TeamTreeNode, HierarchyData } from '../../api/chat-api-client.js';
import { HttpClient } from '../../api/http-client.js';
import { AlxChatConfig } from '../../config.js';
import {
  alxChatResetStyles,
  alxChatThemeStyles,
  alxChatDensityStyles,
  alxChatButtonStyles,
  alxChatInputStyles,
  alxChatLoadingStyles,
  alxChatCardStyles,
  alxChatBadgeStyles,
} from '../../styles/shared.js';

interface AgentListItem {
  agentId: string;
  name: string;
  level?: number;
  status: string;
  parentId?: string;
  teamId?: string;
  role?: string;
}

export class AlxChatTeamHierarchy extends LitElement {
  static styles = [
    alxChatResetStyles,
    alxChatThemeStyles,
    alxChatDensityStyles,
    alxChatButtonStyles,
    alxChatInputStyles,
    alxChatLoadingStyles,
    alxChatCardStyles,
    alxChatBadgeStyles,
    css`
      :host { display: block; }

      .tree-container {
        padding: 0.5rem 0;
      }

      .tree-node {
        padding: 0.5rem 0.75rem;
        border-left: 2px solid color-mix(in srgb, var(--alx-border) 60%, transparent);
        margin-left: 1rem;
      }

      .tree-node.root {
        margin-left: 0;
        border-left: 2px solid var(--alx-primary);
      }

      .node-header {
        display: flex;
        align-items: center;
        gap: 0.5rem;
        cursor: pointer;
        padding: 0.375rem 0;
      }

      .node-header:hover {
        color: var(--alx-primary);
      }

      .node-name {
        font-size: 0.8125rem;
        font-weight: 500;
      }

      .node-level {
        font-size: 0.6875rem;
        color: var(--alx-text-muted);
      }

      .node-status {
        width: 8px;
        height: 8px;
        border-radius: 50%;
        flex-shrink: 0;
      }

      .node-status.available { background: var(--alx-success); }
      .node-status.away { background: var(--alx-warning); }
      .node-status.busy { background: var(--alx-danger); }
      .node-status.offline { background: var(--alx-text-muted); }

      .children {
        margin-left: 0.5rem;
      }

      .edit-form {
        margin-top: 0.75rem;
        padding: 0.75rem;
        background: var(--alx-surface-alt);
        border: 1px solid var(--alx-border);
        border-radius: var(--alx-radius);
      }

      .form-row {
        display: flex;
        gap: 0.5rem;
        align-items: center;
        margin-bottom: 0.5rem;
      }

      .form-row label {
        font-size: 0.75rem;
        color: var(--alx-text-muted);
        min-width: 80px;
      }

      .form-row input, .form-row select {
        flex: 1;
      }

      .form-actions {
        display: flex;
        gap: 0.375rem;
        margin-top: 0.5rem;
      }

      .empty-state {
        padding: 2rem;
        text-align: center;
        color: var(--alx-text-muted);
        font-size: 0.8125rem;
      }

      .agent-list-header {
        display: flex;
        align-items: center;
        justify-content: space-between;
        margin-bottom: 0.75rem;
      }
    `,
  ];

  @property({ type: String }) density: 'default' | 'compact' = 'default';
  @property({ type: String }) agentId = '';

  @state() private tree: TeamTreeNode[] = [];
  @state() private allAgents: AgentListItem[] = [];
  @state() private loading = false;
  @state() private saving = false;
  @state() private error = '';
  @state() private success = '';
  @state() private editingAgentId: string | null = null;
  @state() private editForm: HierarchyData = {};

  private api!: ChatApiClient;
  private http!: HttpClient;

  connectedCallback() {
    super.connectedCallback();
    this.api = new ChatApiClient();
    this.http = new HttpClient(AlxChatConfig.getApiUrl('chatEngine'));
    this.loadData();
  }

  private async loadData() {
    this.loading = true;
    this.error = '';
    try {
      const agents = await this.http.get<AgentListItem[]>('/agents');
      this.allAgents = Array.isArray(agents) ? agents : (agents as any).agents ?? [];

      if (this.agentId) {
        const subordinates = await this.api.getTeamTree(this.agentId);
        this.tree = Array.isArray(subordinates) ? subordinates : (subordinates as any).subordinates ?? [];
      } else {
        // Build a tree from all agents
        this.tree = this.buildTree(this.allAgents);
      }
    } catch (e) {
      this.error = e instanceof Error ? e.message : 'Failed to load hierarchy';
    } finally {
      this.loading = false;
    }
  }

  private buildTree(agents: AgentListItem[]): TeamTreeNode[] {
    const map = new Map<string, TeamTreeNode>();
    const roots: TeamTreeNode[] = [];

    for (const a of agents) {
      map.set(a.agentId, {
        agentId: a.agentId,
        name: a.name,
        level: a.level,
        status: a.status,
        parentId: a.parentId,
        teamId: a.teamId,
        children: [],
      });
    }

    for (const node of map.values()) {
      if (node.parentId && map.has(node.parentId)) {
        map.get(node.parentId)!.children!.push(node);
      } else {
        roots.push(node);
      }
    }

    return roots;
  }

  private startEdit(agentId: string) {
    const agent = this.allAgents.find(a => a.agentId === agentId);
    this.editingAgentId = agentId;
    this.editForm = {
      parentId: agent?.parentId ?? null,
      level: agent?.level ?? 1,
      teamId: agent?.teamId ?? null,
    };
  }

  private cancelEdit() {
    this.editingAgentId = null;
    this.editForm = {};
  }

  private async saveHierarchy() {
    if (!this.editingAgentId) return;
    this.saving = true;
    this.error = '';
    this.success = '';
    try {
      await this.api.setHierarchy(this.editingAgentId, this.editForm);
      this.success = 'Hierarchy updated';
      this.editingAgentId = null;
      this.editForm = {};
      await this.loadData();
      setTimeout(() => this.success = '', 3000);
    } catch (e) {
      this.error = e instanceof Error ? e.message : 'Failed to update hierarchy';
    } finally {
      this.saving = false;
    }
  }

  private getLevelLabel(level?: number): string {
    if (!level) return '';
    if (level === 3) return 'Manager';
    if (level === 2) return 'L2';
    return 'L1';
  }

  private renderNode(node: TeamTreeNode, isRoot = false): unknown {
    const levelLabel = this.getLevelLabel(node.level);
    return html`
      <div class="tree-node ${isRoot ? 'root' : ''}">
        <div class="node-header" @click=${() => this.startEdit(node.agentId)}>
          <span class="node-status ${node.status}"></span>
          <span class="node-name">${node.name}</span>
          ${levelLabel ? html`<span class="alx-badge alx-badge-info">${levelLabel}</span>` : nothing}
          <span class="node-level">${node.teamId ? `Team: ${node.teamId}` : ''}</span>
        </div>

        ${this.editingAgentId === node.agentId ? this.renderEditForm() : nothing}

        ${node.children && node.children.length > 0 ? html`
          <div class="children">
            ${node.children.map(child => this.renderNode(child))}
          </div>
        ` : nothing}
      </div>
    `;
  }

  private renderEditForm() {
    return html`
      <div class="edit-form">
        <div class="form-row">
          <label>Parent</label>
          <select .value=${this.editForm.parentId ?? ''}
            @change=${(e: Event) => this.editForm = { ...this.editForm, parentId: (e.target as HTMLSelectElement).value || null }}>
            <option value="">None (top-level)</option>
            ${this.allAgents
              .filter(a => a.agentId !== this.editingAgentId)
              .map(a => html`<option value=${a.agentId} ?selected=${a.agentId === this.editForm.parentId}>${a.name}</option>`)}
          </select>
        </div>
        <div class="form-row">
          <label>Level</label>
          <select .value=${String(this.editForm.level ?? 1)}
            @change=${(e: Event) => this.editForm = { ...this.editForm, level: Number((e.target as HTMLSelectElement).value) }}>
            <option value="1" ?selected=${this.editForm.level === 1}>L1 (Agent)</option>
            <option value="2" ?selected=${this.editForm.level === 2}>L2 (Senior)</option>
            <option value="3" ?selected=${this.editForm.level === 3}>L3 (Manager)</option>
          </select>
        </div>
        <div class="form-row">
          <label>Team ID</label>
          <input type="text" .value=${this.editForm.teamId ?? ''}
            @input=${(e: Event) => this.editForm = { ...this.editForm, teamId: (e.target as HTMLInputElement).value || null }}
            placeholder="Optional team identifier" />
        </div>
        <div class="form-actions">
          <button class="alx-btn-primary alx-btn-sm" ?disabled=${this.saving}
            @click=${this.saveHierarchy}>${this.saving ? 'Saving...' : 'Save'}</button>
          <button class="alx-btn-sm" @click=${this.cancelEdit}>Cancel</button>
        </div>
      </div>
    `;
  }

  render() {
    return html`
      <div class="alx-card">
        <div class="alx-card-header">
          <h3>Team Hierarchy</h3>
          <button class="alx-btn-sm" @click=${() => this.loadData()}>Refresh</button>
        </div>

        ${this.error ? html`<div class="alx-error">${this.error}</div>` : ''}
        ${this.success ? html`<div class="alx-success-msg">${this.success}</div>` : ''}
        ${this.loading ? html`<div class="alx-loading"><span class="alx-spinner"></span> Loading...</div>` : ''}

        ${!this.loading ? html`
          <div style="padding:0.5rem 0.75rem;font-size:0.75rem;color:var(--alx-text-muted);border-bottom:1px solid color-mix(in srgb, var(--alx-border) 40%, transparent);">
            Agents can only escalate one level up. L1 &rarr; L2, L2 &rarr; L3, and so on. The top-level agent (no parent) is the manager.
          </div>
          <div class="tree-container">
            ${this.tree.length === 0 ? html`
              <div class="empty-state">No agents found. Create agents first to build a team hierarchy.</div>
            ` : ''}
            ${this.tree.map(node => this.renderNode(node, true))}
          </div>
        ` : ''}
      </div>
    `;
  }
}

safeRegister('alx-chat-team-hierarchy', AlxChatTeamHierarchy);
