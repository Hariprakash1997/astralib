import { LitElement, html, css, nothing } from 'lit';
import { property, state } from 'lit/decorators.js';
import type { ChatMessage, ChatSessionSummary } from '@astralibx/chat-types';
import { chatResetStyles, chatBaseStyles, chatAnimations } from '../styles/shared.js';
import { safeRegister } from '../utils/safe-register.js';
import './chat-bubble.js';

interface HistorySession extends ChatSessionSummary {
  messages?: ChatMessage[];
}

/**
 * <alx-chat-history> -- Shows previous conversations for a visitor.
 *
 * Fetches up to 5 past sessions from the REST API and displays them
 * in a list. Clicking a session expands it to show the full read-only
 * conversation.
 */
export class AlxChatHistory extends LitElement {
  static styles = [
    chatResetStyles,
    chatBaseStyles,
    chatAnimations,
    css`
      :host {
        display: block;
        height: 100%;
      }

      .history-container {
        display: flex;
        flex-direction: column;
        height: 100%;
        animation: alx-fadeInUp 0.3s var(--alx-chat-spring-smooth);
      }

      .history-header {
        display: flex;
        align-items: center;
        gap: 12px;
        padding: 16px 20px;
        border-bottom: 1px solid var(--alx-chat-border);
      }

      .back-btn {
        width: 32px;
        height: 32px;
        border-radius: 8px;
        background: transparent;
        border: none;
        color: var(--alx-chat-text);
        cursor: pointer;
        display: flex;
        align-items: center;
        justify-content: center;
        flex-shrink: 0;
        transition: background 0.15s;
      }

      .back-btn:hover {
        background: var(--alx-chat-surface-alt);
      }

      .history-title {
        font-size: 15px;
        font-weight: 600;
        color: var(--alx-chat-text);
      }

      .history-list {
        flex: 1;
        overflow-y: auto;
        padding: 8px 0;
      }

      .history-list::-webkit-scrollbar {
        width: 5px;
      }

      .history-list::-webkit-scrollbar-track {
        background: transparent;
      }

      .history-list::-webkit-scrollbar-thumb {
        background: var(--alx-chat-border);
        border-radius: 3px;
      }

      /* -- Session item -- */
      .session-item {
        display: flex;
        align-items: center;
        gap: 12px;
        padding: 12px 20px;
        cursor: pointer;
        transition: background 0.15s;
      }

      .session-item:hover {
        background: var(--alx-chat-surface-alt);
      }

      .session-avatar {
        width: 40px;
        height: 40px;
        border-radius: 50%;
        background: var(--alx-chat-primary-muted);
        display: flex;
        align-items: center;
        justify-content: center;
        font-size: 16px;
        font-weight: 600;
        color: var(--alx-chat-primary-text);
        text-transform: uppercase;
        flex-shrink: 0;
      }

      .session-info {
        flex: 1;
        min-width: 0;
      }

      .session-agent {
        font-size: 14px;
        font-weight: 600;
        color: var(--alx-chat-text);
        white-space: nowrap;
        overflow: hidden;
        text-overflow: ellipsis;
      }

      .session-meta {
        display: flex;
        align-items: center;
        gap: 8px;
        font-size: 12px;
        color: var(--alx-chat-text-muted);
        margin-top: 2px;
      }

      .session-preview {
        font-size: 13px;
        color: var(--alx-chat-text-muted);
        white-space: nowrap;
        overflow: hidden;
        text-overflow: ellipsis;
        margin-top: 2px;
      }

      .session-chevron {
        color: var(--alx-chat-text-muted);
        flex-shrink: 0;
      }

      /* -- Expanded session view -- */
      .expanded-view {
        flex: 1;
        overflow-y: auto;
        padding: 12px 0;
      }

      .expanded-view::-webkit-scrollbar {
        width: 5px;
      }

      .expanded-view::-webkit-scrollbar-track {
        background: transparent;
      }

      .expanded-view::-webkit-scrollbar-thumb {
        background: var(--alx-chat-border);
        border-radius: 3px;
      }

      /* -- States -- */
      .loading-state,
      .empty-state,
      .error-state {
        display: flex;
        flex-direction: column;
        align-items: center;
        justify-content: center;
        height: 100%;
        color: var(--alx-chat-text-muted);
        text-align: center;
        padding: 24px;
        gap: 8px;
      }

      .loading-spinner {
        width: 32px;
        height: 32px;
        border: 3px solid var(--alx-chat-border);
        border-top-color: var(--alx-chat-primary);
        border-radius: 50%;
        animation: alx-spinnerRotate 0.8s linear infinite;
      }

      .empty-text {
        font-size: 14px;
      }

      .retry-btn {
        margin-top: 8px;
        padding: 8px 20px;
        border: 1px solid var(--alx-chat-border);
        border-radius: var(--alx-chat-radius-sm);
        background: transparent;
        color: var(--alx-chat-text);
        cursor: pointer;
        font-size: 13px;
        font-family: inherit;
      }

      .retry-btn:hover {
        background: var(--alx-chat-surface);
        border-color: var(--alx-chat-primary);
      }
    `,
  ];

  @property() socketUrl = '';
  @property() visitorId = '';
  @property({ type: Number }) limit = 5;

  @state() private sessions: HistorySession[] = [];
  @state() private expandedSessionId: string | null = null;
  @state() private expandedMessages: ChatMessage[] = [];
  @state() private loading = false;
  @state() private loadingMessages = false;
  @state() private error = '';

  connectedCallback() {
    super.connectedCallback();
    this.fetchSessions();
  }

  render() {
    return html`
      <div class="history-container">
        <div class="history-header">
          ${this.expandedSessionId ? html`
            <button class="back-btn" @click=${this.collapseSession} aria-label="Back to list">
              <svg width="18" height="18" viewBox="0 0 18 18" fill="none">
                <polyline points="11 4 6 9 11 14" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/>
              </svg>
            </button>
          ` : html`
            <button class="back-btn" @click=${this.handleClose} aria-label="Close history">
              <svg width="18" height="18" viewBox="0 0 18 18" fill="none">
                <polyline points="11 4 6 9 11 14" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/>
              </svg>
            </button>
          `}
          <span class="history-title">
            ${this.expandedSessionId ? 'Conversation' : 'Previous Conversations'}
          </span>
        </div>

        ${this.loading ? html`
          <div class="loading-state">
            <div class="loading-spinner"></div>
          </div>
        ` : this.error ? html`
          <div class="error-state">
            <span>${this.error}</span>
            <button class="retry-btn" @click=${this.fetchSessions}>Try Again</button>
          </div>
        ` : this.sessions.length === 0 ? html`
          <div class="empty-state">
            <svg width="40" height="40" viewBox="0 0 40 40" fill="none" opacity="0.4">
              <path d="M20 5C11.716 5 5 10.82 5 18c0 4.14 2.35 7.83 6.04 10.24-.225 2.19-1.2 4.24-2.66 5.89a.75.75 0 00.56 1.27c3.38-.225 5.78-1.58 7.65-3.23.9.12 1.8.18 2.75.18C28.284 32.35 35 26.53 35 19.35 35 10.82 28.284 5 20 5z" stroke="currentColor" stroke-width="1.5" fill="none"/>
            </svg>
            <span class="empty-text">No previous conversations</span>
          </div>
        ` : this.expandedSessionId ? this.renderExpandedSession() : this.renderSessionList()}
      </div>
    `;
  }

  private renderSessionList() {
    return html`
      <div class="history-list">
        ${this.sessions.map(session => {
          const agentName = session.agentName || 'Chat Support';
          const initial = agentName.charAt(0).toUpperCase();
          const date = this.formatDate(session.lastMessageAt || session.startedAt);

          return html`
            <div class="session-item" @click=${() => this.expandSession(session.sessionId)}>
              <div class="session-avatar">${initial}</div>
              <div class="session-info">
                <div class="session-agent">${agentName}</div>
                <div class="session-meta">
                  <span>${date}</span>
                  <span>\u00B7</span>
                  <span>${session.messageCount} messages</span>
                </div>
              </div>
              <svg class="session-chevron" width="16" height="16" viewBox="0 0 16 16" fill="none">
                <polyline points="6 3 11 8 6 13" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"/>
              </svg>
            </div>
          `;
        })}
      </div>
    `;
  }

  private renderExpandedSession() {
    if (this.loadingMessages) {
      return html`
        <div class="loading-state">
          <div class="loading-spinner"></div>
        </div>
      `;
    }

    return html`
      <div class="expanded-view">
        ${this.expandedMessages.map(msg => html`
          <alx-chat-bubble
            .message=${msg}
            .senderType=${msg.senderType}
            .senderName=${msg.senderName || ''}
            .content=${msg.content}
            .contentType=${msg.contentType}
            .status=${msg.status}
            .timestamp=${msg.createdAt}
            .metadata=${msg.metadata || {}}
            groupPosition="solo"
          ></alx-chat-bubble>
        `)}
      </div>
    `;
  }

  private async fetchSessions() {
    if (!this.socketUrl || !this.visitorId) return;

    this.loading = true;
    this.error = '';

    try {
      const baseUrl = this.socketUrl.replace(/\/$/, '');
      const res = await fetch(
        `${baseUrl}/sessions/user-history/${encodeURIComponent(this.visitorId)}?limit=${this.limit}`,
      );
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const json = await res.json();
      this.sessions = (json.data?.sessions || json.sessions || []) as HistorySession[];
    } catch (err) {
      this.error = 'Failed to load conversations';
      console.error('[ChatHistory] Failed to fetch sessions:', err);
    } finally {
      this.loading = false;
    }
  }

  private async expandSession(sessionId: string) {
    this.expandedSessionId = sessionId;
    this.loadingMessages = true;

    try {
      const baseUrl = this.socketUrl.replace(/\/$/, '');
      const res = await fetch(
        `${baseUrl}/sessions/${encodeURIComponent(sessionId)}/messages?limit=100`,
      );
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const json = await res.json();
      this.expandedMessages = (json.data?.messages || json.messages || []) as ChatMessage[];
    } catch (err) {
      this.expandedMessages = [];
      console.error('[ChatHistory] Failed to fetch messages:', err);
    } finally {
      this.loadingMessages = false;
    }
  }

  private collapseSession() {
    this.expandedSessionId = null;
    this.expandedMessages = [];
  }

  private handleClose() {
    this.dispatchEvent(
      new CustomEvent('history-close', { bubbles: true, composed: true }),
    );
  }

  private formatDate(date: Date | string | undefined): string {
    if (!date) return '';
    try {
      const d = new Date(date);
      const now = new Date();
      const isToday = d.toDateString() === now.toDateString();
      if (isToday) return d.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });

      const yesterday = new Date(now);
      yesterday.setDate(yesterday.getDate() - 1);
      if (d.toDateString() === yesterday.toDateString()) return 'Yesterday';

      return d.toLocaleDateString(undefined, { month: 'short', day: 'numeric' });
    } catch {
      return '';
    }
  }
}

safeRegister('alx-chat-history', AlxChatHistory);
