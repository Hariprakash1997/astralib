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
  alxChatLoadingStyles,
  alxChatCardStyles,
  alxChatToolbarStyles,
} from '../../styles/shared.js';

interface OfflineMessage {
  _id: string;
  visitorId: string;
  visitorName?: string;
  email?: string;
  message: string;
  formData?: Record<string, unknown>;
  submittedAt: Date;
}

export class AlxChatOfflineMessages extends LitElement {
  static styles = [
    alxChatResetStyles,
    alxChatThemeStyles,
    alxChatDensityStyles,
    alxChatTableStyles,
    alxChatButtonStyles,
    alxChatLoadingStyles,
    alxChatCardStyles,
    alxChatToolbarStyles,
    css`
      :host { display: block; }
      .msg-preview {
        max-width: 300px;
        overflow: hidden;
        text-overflow: ellipsis;
        white-space: nowrap;
      }
      tr[data-clickable] { cursor: pointer; }
      .expanded-msg {
        padding: 0.75rem;
        background: var(--alx-bg);
        border: 1px solid var(--alx-border);
        border-radius: var(--alx-radius);
        margin: 0.5rem 0;
        font-size: 0.8125rem;
        line-height: 1.6;
        white-space: pre-wrap;
      }
    `,
  ];

  @property({ type: String }) density: 'default' | 'compact' = 'default';
  @state() private messages: OfflineMessage[] = [];
  @state() private loading = false;
  @state() private error = '';
  @state() private page = 1;
  @state() private totalPages = 1;
  @state() private expandedId = '';

  private http!: HttpClient;

  connectedCallback() {
    super.connectedCallback();
    this.http = new HttpClient(AlxChatConfig.getApiUrl('chatEngine'));
    this.loadMessages();
  }

  async loadMessages() {
    this.loading = true;
    this.error = '';
    try {
      const result = await this.http.get<{
        data: OfflineMessage[];
        totalPages: number;
      }>('/offline-messages', { page: this.page, limit: 20 });
      this.messages = result.data ?? [];
      this.totalPages = result.totalPages ?? 1;
    } catch (e) {
      this.error = e instanceof Error ? e.message : 'Failed to load messages';
    } finally {
      this.loading = false;
    }
  }

  private formatTime(date: Date): string {
    return new Date(date).toLocaleString(undefined, {
      month: 'short',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    });
  }

  private toggleExpand(id: string) {
    this.expandedId = this.expandedId === id ? '' : id;
  }

  render() {
    return html`
      <div class="alx-card">
        <div class="alx-card-header">
          <h3>Offline Messages</h3>
          <button class="alx-btn-sm" @click=${() => this.loadMessages()}>Refresh</button>
        </div>

        ${this.error ? html`<div class="alx-error">${this.error}</div>` : ''}
        ${this.loading ? html`<div class="alx-loading"><span class="alx-spinner"></span> Loading...</div>` : ''}

        ${!this.loading && this.messages.length === 0 && !this.error
          ? html`<div class="alx-empty">No offline messages</div>` : ''}

        ${!this.loading && this.messages.length > 0 ? html`
          <div style="overflow-x:auto;">
            <table>
              <thead>
                <tr>
                  <th>Visitor</th>
                  <th>Message</th>
                  <th>Submitted At</th>
                </tr>
              </thead>
              <tbody>
                ${this.messages.map(m => html`
                  <tr data-clickable @click=${() => this.toggleExpand(m._id)}>
                    <td>${m.visitorName || m.email || m.visitorId?.slice(0, 12) || '-'}</td>
                    <td class="msg-preview">${m.message}</td>
                    <td>${this.formatTime(m.submittedAt)}</td>
                  </tr>
                  ${this.expandedId === m._id ? html`
                    <tr>
                      <td colspan="3">
                        <div class="expanded-msg">${m.message}</div>
                        ${m.formData && Object.keys(m.formData).length > 0 ? html`
                          <div style="font-size:0.75rem;color:var(--alx-text-muted);margin-top:0.25rem;">
                            ${Object.entries(m.formData).map(([k, v]) => html`
                              <div><strong>${k}:</strong> ${String(v)}</div>
                            `)}
                          </div>
                        ` : ''}
                      </td>
                    </tr>
                  ` : ''}
                `)}
              </tbody>
            </table>
          </div>

          ${this.totalPages > 1 ? html`
            <div class="pagination">
              <button class="alx-btn-sm" ?disabled=${this.page <= 1}
                @click=${() => { this.page--; this.loadMessages(); }}>Prev</button>
              <span class="text-muted text-small">Page ${this.page} of ${this.totalPages}</span>
              <button class="alx-btn-sm" ?disabled=${this.page >= this.totalPages}
                @click=${() => { this.page++; this.loadMessages(); }}>Next</button>
            </div>
          ` : ''}
        ` : ''}
      </div>
    `;
  }
}

safeRegister('alx-chat-offline-messages', AlxChatOfflineMessages);
