import { LitElement, html, css } from 'lit';
import { property, state } from 'lit/decorators.js';
import { safeRegister } from '../../utils/safe-register.js';
import { HttpClient } from '../../api/http-client.js';
import { AlxChatConfig } from '../../config.js';
import {
  alxChatResetStyles,
  alxChatThemeStyles,
  alxChatDensityStyles,
  alxChatTableStyles,
  alxChatButtonStyles,
  alxChatInputStyles,
  alxChatBadgeStyles,
  alxChatLoadingStyles,
  alxChatToolbarStyles,
  alxChatCardStyles,
  alxChatToggleStyles,
} from '../../styles/shared.js';

interface MemoryEntry {
  _id: string;
  key: string;
  content: string;
  scope: string;
  scopeId?: string;
  category?: string;
  tags?: string[];
  priority?: number;
  isActive: boolean;
  source?: string;
  createdAt?: Date;
}

export class AlxChatMemoryList extends LitElement {
  static styles = [
    alxChatResetStyles,
    alxChatThemeStyles,
    alxChatDensityStyles,
    alxChatTableStyles,
    alxChatButtonStyles,
    alxChatInputStyles,
    alxChatBadgeStyles,
    alxChatLoadingStyles,
    alxChatToolbarStyles,
    alxChatCardStyles,
    alxChatToggleStyles,
    css`
      :host { display: block; }
      .content-cell {
        max-width: 250px;
        overflow: hidden;
        text-overflow: ellipsis;
        white-space: nowrap;
      }
      .actions { display: flex; gap: 0.25rem; }
      .bulk-bar {
        display: flex;
        align-items: center;
        gap: 0.5rem;
        padding: 0.5rem;
        background: color-mix(in srgb, var(--alx-primary) 8%, transparent);
        border-radius: var(--alx-radius);
        margin-bottom: 0.5rem;
        font-size: 0.8125rem;
      }
    `,
  ];

  @property({ type: String }) density: 'default' | 'compact' = 'default';
  @state() private memories: MemoryEntry[] = [];
  @state() private loading = false;
  @state() private error = '';
  @state() private search = '';
  @state() private scopeFilter = '';
  @state() private categoryFilter = '';
  @state() private sourceFilter = '';
  @state() private activeFilter = '';
  @state() private page = 1;
  @state() private totalPages = 1;
  @state() private selected = new Set<string>();

  private http!: HttpClient;

  connectedCallback() {
    super.connectedCallback();
    this.http = new HttpClient(AlxChatConfig.getApiUrl('chatAi'));
    this.loadMemories();
  }

  async loadMemories() {
    this.loading = true;
    this.error = '';
    try {
      const params: Record<string, unknown> = { page: this.page, limit: 20 };
      if (this.search) params.search = this.search;
      if (this.scopeFilter) params.scope = this.scopeFilter;
      if (this.categoryFilter) params.category = this.categoryFilter;
      if (this.sourceFilter) params.source = this.sourceFilter;
      if (this.activeFilter) params.isActive = this.activeFilter === 'true';

      const result = await this.http.get<{
        data: MemoryEntry[];
        total: number;
        totalPages: number;
      }>('/memories', params);
      this.memories = result.data ?? [];
      this.totalPages = result.totalPages ?? 1;
    } catch (e) {
      this.error = e instanceof Error ? e.message : 'Failed to load memories';
    } finally {
      this.loading = false;
    }
  }

  private onEdit(mem: MemoryEntry) {
    this.dispatchEvent(new CustomEvent('memory-edit', {
      detail: { memoryId: mem._id, memory: mem },
      bubbles: true,
      composed: true,
    }));
  }

  private async onDelete(mem: MemoryEntry) {
    if (!confirm(`Delete memory "${mem.key}"?`)) return;
    try {
      await this.http.delete(`/memories/${mem._id}`);
      this.loadMemories();
    } catch (e) {
      this.error = e instanceof Error ? e.message : 'Failed to delete';
    }
  }

  private async onToggle(mem: MemoryEntry) {
    try {
      await this.http.patch(`/memories/${mem._id}`, { isActive: !mem.isActive });
      this.loadMemories();
    } catch (e) {
      this.error = e instanceof Error ? e.message : 'Failed to toggle';
    }
  }

  private async bulkDelete() {
    if (!confirm(`Delete ${this.selected.size} selected memories?`)) return;
    try {
      await this.http.post('/memories/bulk-delete', { ids: Array.from(this.selected) });
      this.selected = new Set();
      this.loadMemories();
    } catch (e) {
      this.error = e instanceof Error ? e.message : 'Bulk delete failed';
    }
  }

  private toggleSelect(id: string) {
    const next = new Set(this.selected);
    if (next.has(id)) next.delete(id); else next.add(id);
    this.selected = next;
  }

  private onAdd() {
    this.dispatchEvent(new CustomEvent('memory-add', { bubbles: true, composed: true }));
  }

  private onImport() {
    this.dispatchEvent(new CustomEvent('memory-import', { bubbles: true, composed: true }));
  }

  private async onExport() {
    try {
      const data = await this.http.get<MemoryEntry[]>('/memories/export');
      const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = 'chat-memories.json';
      a.click();
      URL.revokeObjectURL(url);
    } catch (e) {
      this.error = e instanceof Error ? e.message : 'Export failed';
    }
  }

  private getSourceBadge(source?: string) {
    if (!source) return '';
    const map: Record<string, string> = {
      manual: 'alx-badge-info',
      ai: 'alx-badge-warning',
      agent: 'alx-badge-success',
      system: 'alx-badge-muted',
    };
    return map[source] ?? 'alx-badge-muted';
  }

  render() {
    return html`
      <div class="alx-card">
        <div class="alx-card-header">
          <h3>Memory</h3>
          <div style="display:flex;gap:0.375rem;">
            <button class="alx-btn-sm" @click=${this.onImport}>Import</button>
            <button class="alx-btn-sm" @click=${this.onExport}>Export</button>
            <button class="alx-btn-primary alx-btn-sm" @click=${this.onAdd}>+ Add</button>
          </div>
        </div>

        <div class="toolbar">
          <input type="search" placeholder="Search..."
            .value=${this.search} @input=${(e: Event) => {
              this.search = (e.target as HTMLInputElement).value;
              this.page = 1;
              this.loadMemories();
            }} />
          <select @change=${(e: Event) => {
            this.scopeFilter = (e.target as HTMLSelectElement).value;
            this.page = 1;
            this.loadMemories();
          }}>
            <option value="">All Scopes</option>
            <option value="global">Global</option>
            <option value="agent">Agent</option>
            <option value="visitor">Visitor</option>
            <option value="channel">Channel</option>
          </select>
          <select @change=${(e: Event) => {
            this.sourceFilter = (e.target as HTMLSelectElement).value;
            this.page = 1;
            this.loadMemories();
          }}>
            <option value="">All Sources</option>
            <option value="manual">Manual</option>
            <option value="ai">AI</option>
            <option value="agent">Agent</option>
            <option value="system">System</option>
          </select>
          <select @change=${(e: Event) => {
            this.activeFilter = (e.target as HTMLSelectElement).value;
            this.page = 1;
            this.loadMemories();
          }}>
            <option value="">All</option>
            <option value="true">Active</option>
            <option value="false">Inactive</option>
          </select>
        </div>

        ${this.selected.size > 0 ? html`
          <div class="bulk-bar">
            <span>${this.selected.size} selected</span>
            <button class="alx-btn-sm alx-btn-danger" @click=${this.bulkDelete}>Delete Selected</button>
          </div>
        ` : ''}

        ${this.error ? html`<div class="alx-error">${this.error}</div>` : ''}
        ${this.loading ? html`<div class="alx-loading"><span class="alx-spinner"></span> Loading...</div>` : ''}

        ${!this.loading && this.memories.length === 0 && !this.error
          ? html`<div class="alx-empty">No memory entries found</div>`
          : ''}

        ${!this.loading && this.memories.length > 0 ? html`
          <div style="overflow-x:auto;">
            <table>
              <thead>
                <tr>
                  <th style="width:30px;"></th>
                  <th>Key</th>
                  <th>Content</th>
                  <th>Scope</th>
                  <th>Category</th>
                  <th>Source</th>
                  <th>Priority</th>
                  <th>Active</th>
                  <th>Actions</th>
                </tr>
              </thead>
              <tbody>
                ${this.memories.map(m => html`
                  <tr>
                    <td>
                      <input type="checkbox" .checked=${this.selected.has(m._id)}
                        @change=${() => this.toggleSelect(m._id)} />
                    </td>
                    <td>${m.key}</td>
                    <td class="content-cell" title="${m.content}">${m.content}</td>
                    <td>${m.scope}</td>
                    <td>${m.category || '-'}</td>
                    <td>
                      ${m.source ? html`<span class="alx-badge ${this.getSourceBadge(m.source)}">${m.source}</span>` : '-'}
                    </td>
                    <td>${m.priority ?? '-'}</td>
                    <td>
                      <label class="toggle">
                        <input type="checkbox" .checked=${m.isActive} @change=${() => this.onToggle(m)} />
                        <span class="toggle-slider"></span>
                      </label>
                    </td>
                    <td>
                      <div class="actions">
                        <button class="alx-btn-icon" title="Edit" @click=${() => this.onEdit(m)}>&#9998;</button>
                        <button class="alx-btn-icon danger" title="Delete" @click=${() => this.onDelete(m)}>&#10005;</button>
                      </div>
                    </td>
                  </tr>
                `)}
              </tbody>
            </table>
          </div>

          ${this.totalPages > 1 ? html`
            <div class="pagination">
              <button class="alx-btn-sm" ?disabled=${this.page <= 1}
                @click=${() => { this.page--; this.loadMemories(); }}>Prev</button>
              <span class="text-muted text-small">Page ${this.page} of ${this.totalPages}</span>
              <button class="alx-btn-sm" ?disabled=${this.page >= this.totalPages}
                @click=${() => { this.page++; this.loadMemories(); }}>Next</button>
            </div>
          ` : ''}
        ` : ''}
      </div>
    `;
  }
}

safeRegister('alx-chat-memory-list', AlxChatMemoryList);
