import { LitElement, html, css } from 'lit';
import { state } from 'lit/decorators.js';
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

interface KnowledgeEntry {
  _id: string;
  title: string;
  content: string;
  category?: string;
  tags?: string[];
  priority?: number;
  isActive: boolean;
}

export class AlxChatKnowledgeList extends LitElement {
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
        max-width: 300px;
        overflow: hidden;
        text-overflow: ellipsis;
        white-space: nowrap;
      }
      .actions { display: flex; gap: 0.25rem; }
      .tags { display: flex; gap: 0.2rem; flex-wrap: wrap; }
      .tag {
        font-size: 0.625rem;
        padding: 0.05rem 0.3rem;
        border-radius: 3px;
        background: color-mix(in srgb, var(--alx-primary) 10%, transparent);
        color: var(--alx-primary);
      }
    `,
  ];

  @state() private entries: KnowledgeEntry[] = [];
  @state() private loading = false;
  @state() private error = '';
  @state() private search = '';
  @state() private categoryFilter = '';
  @state() private activeFilter = '';
  @state() private page = 1;
  @state() private totalPages = 1;

  private http!: HttpClient;

  connectedCallback() {
    super.connectedCallback();
    this.http = new HttpClient(AlxChatConfig.getApiUrl('chatAi'));
    this.loadEntries();
  }

  async loadEntries() {
    this.loading = true;
    this.error = '';
    try {
      const params: Record<string, unknown> = { page: this.page, limit: 20 };
      if (this.search) params.search = this.search;
      if (this.categoryFilter) params.category = this.categoryFilter;
      if (this.activeFilter) params.isActive = this.activeFilter === 'true';

      const result = await this.http.get<{
        data: KnowledgeEntry[];
        totalPages: number;
      }>('/knowledge', params);
      this.entries = result.data ?? [];
      this.totalPages = result.totalPages ?? 1;
    } catch (e) {
      this.error = e instanceof Error ? e.message : 'Failed to load knowledge';
    } finally {
      this.loading = false;
    }
  }

  private onEdit(entry: KnowledgeEntry) {
    this.dispatchEvent(new CustomEvent('knowledge-edit', {
      detail: { knowledgeId: entry._id, entry },
      bubbles: true,
      composed: true,
    }));
  }

  private async onDelete(entry: KnowledgeEntry) {
    if (!confirm(`Delete "${entry.title}"?`)) return;
    try {
      await this.http.delete(`/knowledge/${entry._id}`);
      this.loadEntries();
    } catch (e) {
      this.error = e instanceof Error ? e.message : 'Failed to delete';
    }
  }

  private onAdd() {
    this.dispatchEvent(new CustomEvent('knowledge-add', { bubbles: true, composed: true }));
  }

  private async onExport() {
    try {
      const data = await this.http.get<KnowledgeEntry[]>('/knowledge/export');
      const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = 'chat-knowledge.json';
      a.click();
      URL.revokeObjectURL(url);
    } catch (e) {
      this.error = e instanceof Error ? e.message : 'Export failed';
    }
  }

  private onImport() {
    this.dispatchEvent(new CustomEvent('knowledge-import', { bubbles: true, composed: true }));
  }

  render() {
    return html`
      <div class="alx-card">
        <div class="alx-card-header">
          <h3>Knowledge Base</h3>
          <div style="display:flex;gap:0.375rem;">
            <button class="alx-btn-sm" @click=${this.onImport}>Import</button>
            <button class="alx-btn-sm" @click=${this.onExport}>Export</button>
            <button class="alx-btn-primary alx-btn-sm" @click=${this.onAdd}>+ Add</button>
          </div>
        </div>

        <div class="toolbar">
          <input type="search" placeholder="Search..." .value=${this.search}
            @input=${(e: Event) => { this.search = (e.target as HTMLInputElement).value; this.page = 1; this.loadEntries(); }} />
          <select @change=${(e: Event) => { this.activeFilter = (e.target as HTMLSelectElement).value; this.page = 1; this.loadEntries(); }}>
            <option value="">All</option>
            <option value="true">Active</option>
            <option value="false">Inactive</option>
          </select>
        </div>

        ${this.error ? html`<div class="alx-error">${this.error}</div>` : ''}
        ${this.loading ? html`<div class="alx-loading"><span class="alx-spinner"></span> Loading...</div>` : ''}

        ${!this.loading && this.entries.length === 0 && !this.error
          ? html`<div class="alx-empty">No knowledge entries found</div>` : ''}

        ${!this.loading && this.entries.length > 0 ? html`
          <div style="overflow-x:auto;">
            <table>
              <thead>
                <tr>
                  <th>Title</th>
                  <th>Content</th>
                  <th>Category</th>
                  <th>Tags</th>
                  <th>Priority</th>
                  <th>Active</th>
                  <th>Actions</th>
                </tr>
              </thead>
              <tbody>
                ${this.entries.map(e => html`
                  <tr>
                    <td>${e.title}</td>
                    <td class="content-cell" title="${e.content}">${e.content}</td>
                    <td>${e.category || '-'}</td>
                    <td>
                      <div class="tags">
                        ${(e.tags || []).map(t => html`<span class="tag">${t}</span>`)}
                      </div>
                    </td>
                    <td>${e.priority ?? '-'}</td>
                    <td>
                      <span class="alx-badge ${e.isActive ? 'alx-badge-success' : 'alx-badge-muted'}">
                        ${e.isActive ? 'Active' : 'Inactive'}
                      </span>
                    </td>
                    <td>
                      <div class="actions">
                        <button class="alx-btn-icon" title="Edit" @click=${() => this.onEdit(e)}>&#9998;</button>
                        <button class="alx-btn-icon danger" title="Delete" @click=${() => this.onDelete(e)}>&#10005;</button>
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
                @click=${() => { this.page--; this.loadEntries(); }}>Prev</button>
              <span class="text-muted text-small">Page ${this.page} of ${this.totalPages}</span>
              <button class="alx-btn-sm" ?disabled=${this.page >= this.totalPages}
                @click=${() => { this.page++; this.loadEntries(); }}>Next</button>
            </div>
          ` : ''}
        ` : ''}
      </div>
    `;
  }
}

safeRegister('alx-chat-knowledge-list', AlxChatKnowledgeList);
