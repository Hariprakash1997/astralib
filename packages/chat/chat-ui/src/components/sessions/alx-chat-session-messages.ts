import { LitElement, html, css } from 'lit';
import { property, state } from 'lit/decorators.js';
import type { ChatMessage } from '@astralibx/chat-types';
import { ChatSenderType, ChatContentType } from '@astralibx/chat-types';
import { safeRegister } from '../../utils/safe-register.js';
import { HttpClient } from '../../api/http-client.js';
import { AlxChatConfig } from '../../config.js';
import {
  alxChatResetStyles,
  alxChatThemeStyles,
  alxChatDensityStyles,
  alxChatButtonStyles,
  alxChatLoadingStyles,
  alxChatCardStyles,
} from '../../styles/shared.js';

export class AlxChatSessionMessages extends LitElement {
  static styles = [
    alxChatResetStyles,
    alxChatThemeStyles,
    alxChatDensityStyles,
    alxChatButtonStyles,
    alxChatLoadingStyles,
    alxChatCardStyles,
    css`
      :host { display: block; }

      .messages-container {
        display: flex;
        flex-direction: column;
        gap: 0.5rem;
        max-height: 500px;
        overflow-y: auto;
        padding: 0.75rem;
      }

      .message {
        display: flex;
        flex-direction: column;
        max-width: 75%;
        padding: 0.5rem 0.75rem;
        border-radius: 8px;
        font-size: 0.8125rem;
        line-height: 1.5;
        position: relative;
      }

      .message.visitor {
        align-self: flex-end;
        background: color-mix(in srgb, var(--alx-primary) 15%, var(--alx-surface));
        border: 1px solid color-mix(in srgb, var(--alx-primary) 30%, transparent);
      }

      .message.agent {
        align-self: flex-start;
        background: var(--alx-surface-alt);
        border: 1px solid var(--alx-border);
      }

      .message.ai {
        align-self: flex-start;
        background: color-mix(in srgb, var(--alx-info) 10%, var(--alx-surface));
        border: 1px solid color-mix(in srgb, var(--alx-info) 25%, transparent);
      }

      .message.system {
        align-self: center;
        max-width: 90%;
        background: transparent;
        border: none;
        color: var(--alx-text-muted);
        font-size: 0.75rem;
        font-style: italic;
        text-align: center;
        padding: 0.25rem 0.5rem;
      }

      .message-sender {
        font-size: 0.6875rem;
        font-weight: 600;
        color: var(--alx-text-muted);
        margin-bottom: 0.15rem;
        text-transform: capitalize;
      }

      .message-content {
        word-wrap: break-word;
        white-space: pre-wrap;
      }

      .message-time {
        font-size: 0.625rem;
        color: var(--alx-text-muted);
        margin-top: 0.25rem;
        text-align: right;
      }

      .load-more {
        text-align: center;
        padding: 0.5rem;
      }

      .no-messages {
        text-align: center;
        color: var(--alx-text-muted);
        padding: 2rem;
        font-size: 0.8125rem;
      }
    `,
  ];

  @property({ type: String }) density: 'default' | 'compact' = 'default';
  @property({ type: String }) sessionId = '';

  @state() private messages: ChatMessage[] = [];
  @state() private loading = false;
  @state() private loadingMore = false;
  @state() private error = '';
  @state() private hasMore = false;
  @state() private nextCursor = '';

  private http!: HttpClient;

  connectedCallback() {
    super.connectedCallback();
    this.http = new HttpClient(AlxChatConfig.getApiUrl('chatEngine'));
    if (this.sessionId) this.loadMessages();
  }

  updated(changed: Map<string, unknown>) {
    if (changed.has('sessionId') && this.sessionId) {
      this.messages = [];
      this.nextCursor = '';
      this.loadMessages();
    }
  }

  async loadMessages(loadMore = false) {
    if (loadMore) {
      this.loadingMore = true;
    } else {
      this.loading = true;
    }
    this.error = '';
    try {
      const params: Record<string, unknown> = { limit: 50 };
      if (loadMore && this.nextCursor) params.before = this.nextCursor;

      const result = await this.http.get<{
        data: ChatMessage[];
        nextCursor?: string;
        hasMore: boolean;
      }>(`/sessions/${this.sessionId}/messages`, params);

      const fetched = result.data ?? [];
      if (loadMore) {
        this.messages = [...fetched, ...this.messages];
      } else {
        this.messages = fetched;
      }
      this.hasMore = result.hasMore ?? false;
      this.nextCursor = result.nextCursor ?? '';
    } catch (e) {
      this.error = e instanceof Error ? e.message : 'Failed to load messages';
    } finally {
      this.loading = false;
      this.loadingMore = false;
    }
  }

  /** Append a message externally (e.g., from socket). */
  appendMessage(msg: ChatMessage) {
    this.messages = [...this.messages, msg];
    this.updateComplete.then(() => {
      const container = this.shadowRoot?.querySelector('.messages-container');
      if (container) container.scrollTop = container.scrollHeight;
    });
  }

  private getSenderClass(type: ChatSenderType): string {
    switch (type) {
      case ChatSenderType.Visitor: return 'visitor';
      case ChatSenderType.Agent: return 'agent';
      case ChatSenderType.AI: return 'ai';
      case ChatSenderType.System: return 'system';
      default: return 'agent';
    }
  }

  private getSenderLabel(msg: ChatMessage): string {
    if (msg.senderType === ChatSenderType.System) return '';
    return msg.senderName || msg.senderType;
  }

  private formatTime(date: Date): string {
    return new Date(date).toLocaleString(undefined, {
      hour: '2-digit',
      minute: '2-digit',
      month: 'short',
      day: 'numeric',
    });
  }

  render() {
    return html`
      <div class="alx-card">
        <div class="alx-card-header">
          <h3>Messages</h3>
          ${this.sessionId ? html`
            <span class="text-muted text-small">${this.sessionId.slice(0, 12)}...</span>
          ` : ''}
        </div>

        ${this.error ? html`<div class="alx-error">${this.error}</div>` : ''}
        ${this.loading ? html`<div class="alx-loading"><span class="alx-spinner"></span> Loading...</div>` : ''}

        ${!this.loading ? html`
          <div class="messages-container">
            ${this.hasMore ? html`
              <div class="load-more">
                <button class="alx-btn-sm" ?disabled=${this.loadingMore}
                  @click=${() => this.loadMessages(true)}>
                  ${this.loadingMore ? 'Loading...' : 'Load older messages'}
                </button>
              </div>
            ` : ''}

            ${this.messages.length === 0 && !this.sessionId
              ? html`<div class="no-messages">Select a session to view messages</div>`
              : ''}
            ${this.messages.length === 0 && this.sessionId
              ? html`<div class="no-messages">No messages in this session</div>`
              : ''}

            ${this.messages.map(msg => {
              const cls = this.getSenderClass(msg.senderType);
              return html`
                <div class="message ${cls}">
                  ${msg.senderType !== ChatSenderType.System ? html`
                    <span class="message-sender">${this.getSenderLabel(msg)}</span>
                  ` : ''}
                  <span class="message-content">${msg.content}</span>
                  <span class="message-time">${this.formatTime(msg.createdAt)}</span>
                </div>
              `;
            })}
          </div>
        ` : ''}
      </div>
    `;
  }
}

safeRegister('alx-chat-session-messages', AlxChatSessionMessages);
