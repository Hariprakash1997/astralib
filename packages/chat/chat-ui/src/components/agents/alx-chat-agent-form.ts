import { LitElement, html, css } from 'lit';
import { property, state } from 'lit/decorators.js';
import { safeRegister } from '../../utils/safe-register.js';
import { HttpClient } from '../../api/http-client.js';
import { AlxChatConfig } from '../../config.js';
import {
  alxChatResetStyles,
  alxChatThemeStyles,
  alxChatDensityStyles,
  alxChatButtonStyles,
  alxChatInputStyles,
  alxChatLoadingStyles,
  alxChatDrawerStyles,
  alxChatToggleStyles,
} from '../../styles/shared.js';

interface PromptTemplate {
  _id: string;
  name: string;
}

export class AlxChatAgentForm extends LitElement {
  static styles = [
    alxChatResetStyles,
    alxChatThemeStyles,
    alxChatDensityStyles,
    alxChatButtonStyles,
    alxChatInputStyles,
    alxChatLoadingStyles,
    alxChatDrawerStyles,
    alxChatToggleStyles,
    css`
      :host { display: block; }
      .toggle-row {
        display: flex;
        align-items: center;
        gap: 0.5rem;
        margin-bottom: 0.625rem;
      }
      .toggle-label {
        font-size: 0.8125rem;
        color: var(--alx-text);
      }
      .avatar-upload {
        display: flex;
        align-items: center;
        gap: 16px;
        margin-bottom: 16px;
      }
      .avatar-preview {
        width: 64px;
        height: 64px;
        border-radius: 50%;
        overflow: hidden;
        background: var(--alx-surface-alt, #1e2028);
        display: flex;
        align-items: center;
        justify-content: center;
        border: 2px dashed var(--alx-border, #2a2d37);
        flex-shrink: 0;
      }
      .avatar-preview img {
        width: 100%;
        height: 100%;
        object-fit: cover;
      }
      .avatar-placeholder {
        color: var(--alx-text-muted, #8b8fa3);
      }
      .upload-btn {
        padding: 8px 16px;
        border: 1px solid var(--alx-border, #2a2d37);
        border-radius: var(--alx-radius, 8px);
        background: var(--alx-surface, transparent);
        color: var(--alx-text, inherit);
        cursor: pointer;
        font-size: 13px;
        font-family: inherit;
        transition: border-color 0.15s;
      }
      .upload-btn:hover {
        border-color: var(--alx-primary, #6366f1);
      }
      .upload-btn:disabled {
        opacity: 0.5;
        cursor: not-allowed;
      }
    `,
  ];

  @property({ type: String }) density: 'default' | 'compact' = 'default';
  @property({ type: Boolean }) open = false;
  @property({ type: String }) agentId = '';

  @state() private name = '';
  @state() private avatar = '';
  @state() private agentRole = '';
  @state() private isAI = false;
  @state() private maxConcurrentChats = 5;
  @state() private promptTemplateId = '';
  @state() private promptTemplates: PromptTemplate[] = [];
  @state() private saving = false;
  @state() private uploading = false;
  @state() private error = '';
  @state() private loading = false;

  private http!: HttpClient;

  connectedCallback() {
    super.connectedCallback();
    this.http = new HttpClient(AlxChatConfig.getApiUrl('chatEngine'));
  }

  updated(changed: Map<string, unknown>) {
    if (changed.has('open') && this.open) {
      this.loadPromptTemplates();
      if (this.agentId) {
        this.loadAgent();
      } else {
        this.resetForm();
      }
    }
  }

  private resetForm() {
    this.name = '';
    this.avatar = '';
    this.agentRole = '';
    this.isAI = false;
    this.maxConcurrentChats = 5;
    this.promptTemplateId = '';
    this.error = '';
  }

  private async loadAgent() {
    this.loading = true;
    try {
      const agent = await this.http.get<Record<string, unknown>>(`/agents/${this.agentId}`);
      this.name = (agent.name as string) || '';
      this.avatar = (agent.avatar as string) || '';
      this.agentRole = (agent.role as string) || '';
      this.isAI = (agent.isAI as boolean) || false;
      this.maxConcurrentChats = (agent.maxConcurrentChats as number) || 5;
      this.promptTemplateId = (agent.promptTemplateId as string) || '';
    } catch (e) {
      this.error = e instanceof Error ? e.message : 'Failed to load agent';
    } finally {
      this.loading = false;
    }
  }

  private async loadPromptTemplates() {
    const aiApi = AlxChatConfig.getApiUrl('chatAi');
    if (!aiApi) return;
    try {
      const aiHttp = new HttpClient(aiApi);
      const result = await aiHttp.get<PromptTemplate[] | { data: PromptTemplate[] }>('/prompts');
      this.promptTemplates = Array.isArray(result) ? result : (result as { data: PromptTemplate[] }).data ?? [];
    } catch {
      // Non-critical: prompt templates may not be available
    }
  }

  private async onSave() {
    if (!this.name.trim()) {
      this.error = 'Name is required';
      return;
    }
    this.saving = true;
    this.error = '';
    try {
      const body = {
        name: this.name,
        avatar: this.avatar || undefined,
        role: this.agentRole || undefined,
        isAI: this.isAI,
        maxConcurrentChats: this.maxConcurrentChats,
        promptTemplateId: this.promptTemplateId || undefined,
      };
      if (this.agentId) {
        await this.http.put(`/agents/${this.agentId}`, body);
      } else {
        await this.http.post('/agents', body);
      }
      this.dispatchEvent(new CustomEvent('agent-saved', { bubbles: true, composed: true }));
      this.close();
    } catch (e) {
      this.error = e instanceof Error ? e.message : 'Failed to save agent';
    } finally {
      this.saving = false;
    }
  }

  private async _handleFileSelect(e: Event) {
    const input = e.target as HTMLInputElement;
    const file = input.files?.[0];
    if (!file) return;

    if (!file.type.startsWith('image/')) {
      this.error = 'Only image files allowed';
      return;
    }
    if (file.size > 5 * 1024 * 1024) {
      this.error = 'File too large (max 5MB)';
      return;
    }

    this.uploading = true;
    this.error = '';

    const reader = new FileReader();
    reader.onload = async () => {
      const base64 = (reader.result as string).split(',')[1];
      try {
        const res = await this.http.post<{ url: string }>(`/agents/${this.agentId}/avatar`, {
          data: base64,
          mimetype: file.type,
          filename: file.name,
        });
        this.avatar = res.url;
      } catch (err) {
        this.error = err instanceof Error ? err.message : 'Upload failed';
      } finally {
        this.uploading = false;
      }
    };
    reader.onerror = () => {
      this.error = 'Failed to read file';
      this.uploading = false;
    };
    reader.readAsDataURL(file);
  }

  private close() {
    this.open = false;
    this.agentId = '';
    this.dispatchEvent(new CustomEvent('drawer-close', { bubbles: true, composed: true }));
  }

  render() {
    return html`
      <div class="drawer-overlay ${this.open ? 'open' : ''}" @click=${(e: Event) => {
        if (e.target === e.currentTarget) this.close();
      }}>
        <div class="drawer-panel">
          <div class="drawer-header">
            <h3>${this.agentId ? 'Edit Agent' : 'Add Agent'}</h3>
            <button class="drawer-close" @click=${this.close}>&times;</button>
          </div>

          <div class="drawer-body">
            ${this.loading ? html`<div class="alx-loading"><span class="alx-spinner"></span> Loading...</div>` : ''}
            ${this.error ? html`<div class="alx-error">${this.error}</div>` : ''}

            ${!this.loading ? html`
              <div class="form-group">
                <label>Name</label>
                <input type="text" .value=${this.name}
                  @input=${(e: Event) => this.name = (e.target as HTMLInputElement).value}
                  placeholder="Agent name" />
              </div>

              ${AlxChatConfig.capabilities.fileUpload && this.agentId ? html`
                <div class="avatar-upload">
                  <div class="avatar-preview">
                    ${this.avatar
                      ? html`<img src=${this.avatar} alt="Avatar">`
                      : html`<div class="avatar-placeholder">
                          <svg width="24" height="24" viewBox="0 0 24 24" fill="none">
                            <circle cx="12" cy="8" r="4" stroke="currentColor" stroke-width="1.5"/>
                            <path d="M4 20c0-4 3.5-7 8-7s8 3 8 7" stroke="currentColor" stroke-width="1.5" stroke-linecap="round"/>
                          </svg>
                        </div>`
                    }
                  </div>
                  <button type="button" class="upload-btn" ?disabled=${this.uploading}
                    @click=${() => this.renderRoot.querySelector<HTMLInputElement>('.avatar-file-input')?.click()}>
                    ${this.uploading ? 'Uploading...' : 'Choose Photo'}
                  </button>
                  <input type="file" accept="image/*" class="avatar-file-input"
                    @change=${this._handleFileSelect} style="display:none">
                </div>
              ` : html`
                <div class="form-group">
                  <label>Avatar URL</label>
                  <input type="text" .value=${this.avatar}
                    @input=${(e: Event) => this.avatar = (e.target as HTMLInputElement).value}
                    placeholder="https://..." />
                </div>
              `}

              <div class="form-group">
                <label>Role</label>
                <input type="text" .value=${this.agentRole}
                  @input=${(e: Event) => this.agentRole = (e.target as HTMLInputElement).value}
                  placeholder="e.g. Support, Sales" />
              </div>

              <div class="toggle-row">
                <label class="toggle">
                  <input type="checkbox" .checked=${this.isAI}
                    @change=${(e: Event) => this.isAI = (e.target as HTMLInputElement).checked} />
                  <span class="toggle-slider"></span>
                </label>
                <span class="toggle-label">AI Agent</span>
              </div>

              <div class="form-group">
                <label>Max Concurrent Chats</label>
                <input type="number" min="1" max="50" .value=${String(this.maxConcurrentChats)}
                  @input=${(e: Event) => this.maxConcurrentChats = parseInt((e.target as HTMLInputElement).value) || 5} />
              </div>

              ${this.promptTemplates.length > 0 ? html`
                <div class="form-group">
                  <label>Prompt Template</label>
                  <select .value=${this.promptTemplateId}
                    @change=${(e: Event) => this.promptTemplateId = (e.target as HTMLSelectElement).value}>
                    <option value="">None</option>
                    ${this.promptTemplates.map(t =>
                      html`<option value=${t._id}>${t.name}</option>`
                    )}
                  </select>
                </div>
              ` : ''}

              <div class="form-actions">
                <button @click=${this.close}>Cancel</button>
                <button class="alx-btn-primary" ?disabled=${this.saving}
                  @click=${this.onSave}>
                  ${this.saving ? 'Saving...' : 'Save'}
                </button>
              </div>
            ` : ''}
          </div>
        </div>
      </div>
    `;
  }
}

safeRegister('alx-chat-agent-form', AlxChatAgentForm);
