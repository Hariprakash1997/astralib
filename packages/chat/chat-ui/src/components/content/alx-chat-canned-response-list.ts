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
  alxChatLoadingStyles,
  alxChatCardStyles,
  alxChatToolbarStyles,
  alxChatDrawerStyles,
} from '../../styles/shared.js';

interface CannedResponse {
  _id?: string;
  responseId?: string;
  title: string;
  content: string;
  category?: string;
  shortcut?: string;
  isActive?: boolean;
}

export class AlxChatCannedResponseList extends LitElement {
  static styles = [
    alxChatResetStyles,
    alxChatThemeStyles,
    alxChatDensityStyles,
    alxChatTableStyles,
    alxChatButtonStyles,
    alxChatInputStyles,
    alxChatLoadingStyles,
    alxChatCardStyles,
    alxChatToolbarStyles,
    alxChatDrawerStyles,
    css`
      :host { display: block; }
      .content-cell {
        max-width: 300px;
        overflow: hidden;
        text-overflow: ellipsis;
        white-space: nowrap;
      }
      .shortcut {
        font-family: 'JetBrains Mono', 'Fira Code', monospace;
        font-size: 0.75rem;
        padding: 0.1rem 0.3rem;
        background: color-mix(in srgb, var(--alx-text) 8%, transparent);
        border-radius: 3px;
      }
      .actions { display: flex; gap: 0.25rem; }
    `,
  ];

  @property({ type: String }) density: 'default' | 'compact' = 'default';
  @state() private responses: CannedResponse[] = [];
  @state() private loading = false;
  @state() private error = '';
  @state() private search = '';
  @state() private showForm = false;
  @state() private editItem: CannedResponse | null = null;
  @state() private formTitle = '';
  @state() private formContent = '';
  @state() private formCategory = '';
  @state() private formShortcut = '';
  @state() private saving = false;

  private http!: HttpClient;

  connectedCallback() {
    super.connectedCallback();
    this.http = new HttpClient(AlxChatConfig.getApiUrl('chatEngine'));
    this.loadResponses();
  }

  async loadResponses() {
    this.loading = true;
    this.error = '';
    try {
      const params: Record<string, unknown> = {};
      if (this.search) params.search = this.search;
      const result = await this.http.get<CannedResponse[] | { data: CannedResponse[] }>('/canned-responses', params);
      this.responses = Array.isArray(result) ? result : (result as { data: CannedResponse[] }).data ?? [];
    } catch (e) {
      this.error = e instanceof Error ? e.message : 'Failed to load';
    } finally {
      this.loading = false;
    }
  }

  private openAdd() {
    this.editItem = null;
    this.formTitle = '';
    this.formContent = '';
    this.formCategory = '';
    this.formShortcut = '';
    this.showForm = true;
  }

  private openEdit(r: CannedResponse) {
    this.editItem = r;
    this.formTitle = r.title;
    this.formContent = r.content;
    this.formCategory = r.category || '';
    this.formShortcut = r.shortcut || '';
    this.showForm = true;
  }

  private closeForm() {
    this.showForm = false;
    this.editItem = null;
    this.error = '';
  }

  private async onSave() {
    if (!this.formTitle.trim() || !this.formContent.trim()) {
      this.error = 'Title and content are required';
      return;
    }
    this.saving = true;
    this.error = '';
    try {
      const body = {
        title: this.formTitle,
        content: this.formContent,
        category: this.formCategory || undefined,
        shortcut: this.formShortcut || undefined,
      };
      const id = this.editItem?._id || this.editItem?.responseId;
      if (id) {
        await this.http.put(`/canned-responses/${id}`, body);
      } else {
        await this.http.post('/canned-responses', body);
      }
      this.closeForm();
      this.loadResponses();
    } catch (e) {
      this.error = e instanceof Error ? e.message : 'Failed to save';
    } finally {
      this.saving = false;
    }
  }

  private async onDelete(r: CannedResponse) {
    const id = r._id || r.responseId;
    if (!id || !confirm(`Delete "${r.title}"?`)) return;
    try {
      await this.http.delete(`/canned-responses/${id}`);
      this.loadResponses();
    } catch (e) {
      this.error = e instanceof Error ? e.message : 'Failed to delete';
    }
  }

  render() {
    return html`
      <div class="alx-card">
        <div class="alx-card-header">
          <h3>Canned Responses</h3>
          <button class="alx-btn-primary alx-btn-sm" @click=${this.openAdd}>+ Add Response</button>
        </div>

        <div class="toolbar">
          <input type="search" placeholder="Search..." .value=${this.search}
            @input=${(e: Event) => { this.search = (e.target as HTMLInputElement).value; this.loadResponses(); }} />
        </div>

        ${this.error && !this.showForm ? html`<div class="alx-error">${this.error}</div>` : ''}
        ${this.loading ? html`<div class="alx-loading"><span class="alx-spinner"></span> Loading...</div>` : ''}

        ${!this.loading && this.responses.length === 0 && !this.error
          ? html`<div class="alx-empty">No canned responses</div>` : ''}

        ${!this.loading && this.responses.length > 0 ? html`
          <div style="overflow-x:auto;">
            <table>
              <thead>
                <tr>
                  <th>Title</th>
                  <th>Content</th>
                  <th>Category</th>
                  <th>Shortcut</th>
                  <th>Actions</th>
                </tr>
              </thead>
              <tbody>
                ${this.responses.map(r => html`
                  <tr>
                    <td>${r.title}</td>
                    <td class="content-cell" title="${r.content}">${r.content}</td>
                    <td>${r.category || '-'}</td>
                    <td>${r.shortcut ? html`<span class="shortcut">/${r.shortcut}</span>` : '-'}</td>
                    <td>
                      <div class="actions">
                        <button class="alx-btn-icon" title="Edit" @click=${() => this.openEdit(r)}>&#9998;</button>
                        <button class="alx-btn-icon danger" title="Delete" @click=${() => this.onDelete(r)}>&#10005;</button>
                      </div>
                    </td>
                  </tr>
                `)}
              </tbody>
            </table>
          </div>
        ` : ''}
      </div>

      <!-- Drawer form -->
      <div class="drawer-overlay ${this.showForm ? 'open' : ''}" @click=${(e: Event) => {
        if (e.target === e.currentTarget) this.closeForm();
      }}>
        <div class="drawer-panel">
          <div class="drawer-header">
            <h3>${this.editItem ? 'Edit Response' : 'Add Response'}</h3>
            <button class="drawer-close" @click=${this.closeForm}>&times;</button>
          </div>
          <div class="drawer-body">
            ${this.error && this.showForm ? html`<div class="alx-error">${this.error}</div>` : ''}
            <div class="form-group">
              <label>Title</label>
              <input type="text" .value=${this.formTitle}
                @input=${(e: Event) => this.formTitle = (e.target as HTMLInputElement).value}
                placeholder="e.g. Greeting" />
            </div>
            <div class="form-group">
              <label>Content</label>
              <textarea rows="4" .value=${this.formContent}
                @input=${(e: Event) => this.formContent = (e.target as HTMLTextAreaElement).value}
                placeholder="Response text..."></textarea>
            </div>
            <div class="form-row">
              <div class="form-group">
                <label>Category</label>
                <input type="text" .value=${this.formCategory}
                  @input=${(e: Event) => this.formCategory = (e.target as HTMLInputElement).value} />
              </div>
              <div class="form-group">
                <label>Shortcut</label>
                <input type="text" .value=${this.formShortcut}
                  @input=${(e: Event) => this.formShortcut = (e.target as HTMLInputElement).value}
                  placeholder="e.g. greet" />
              </div>
            </div>
            <div class="form-actions">
              <button @click=${this.closeForm}>Cancel</button>
              <button class="alx-btn-primary" ?disabled=${this.saving}
                @click=${this.onSave}>${this.saving ? 'Saving...' : 'Save'}</button>
            </div>
          </div>
        </div>
      </div>
    `;
  }
}

safeRegister('alx-chat-canned-response-list', AlxChatCannedResponseList);
