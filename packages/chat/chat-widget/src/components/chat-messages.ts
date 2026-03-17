import { LitElement, html, css, nothing } from 'lit';
import { property, state, query } from 'lit/decorators.js';
import type { ChatMessage } from '@astralibx/chat-types';
import { chatResetStyles, chatBaseStyles } from '../styles/shared.js';
import { safeRegister } from '../utils/safe-register.js';
import './chat-bubble.js';
import './chat-typing.js';

export class AlxChatMessages extends LitElement {
  static styles = [
    chatResetStyles,
    chatBaseStyles,
    css`
      :host {
        display: block;
        flex: 1;
        overflow: hidden;
      }

      .messages-container {
        height: 100%;
        overflow-y: auto;
        padding: 12px 0;
        scroll-behavior: smooth;
      }

      .messages-container::-webkit-scrollbar {
        width: 5px;
      }

      .messages-container::-webkit-scrollbar-track {
        background: transparent;
      }

      .messages-container::-webkit-scrollbar-thumb {
        background: var(--alx-chat-border);
        border-radius: 3px;
      }

      .messages-container::-webkit-scrollbar-thumb:hover {
        background: var(--alx-chat-text-muted);
      }

      .empty-state {
        display: flex;
        flex-direction: column;
        align-items: center;
        justify-content: center;
        height: 100%;
        color: var(--alx-chat-text-muted);
        text-align: center;
        padding: 24px;
      }

      .empty-icon {
        width: 48px;
        height: 48px;
        margin-bottom: 12px;
        opacity: 0.4;
      }

      .empty-title {
        font-size: 15px;
        font-weight: 600;
        margin-bottom: 4px;
        color: var(--alx-chat-text);
        opacity: 0.7;
      }

      .empty-subtitle {
        font-size: 13px;
        opacity: 0.6;
      }

      .date-separator {
        display: flex;
        align-items: center;
        justify-content: center;
        padding: 8px 16px;
        margin: 4px 0;
      }

      .date-separator span {
        font-size: 11px;
        color: var(--alx-chat-text-muted);
        background: var(--alx-chat-bg);
        padding: 2px 12px;
        border-radius: 10px;
        border: 1px solid var(--alx-chat-border);
      }
    `,
  ];

  @property({ type: Array }) messages: ChatMessage[] = [];
  @property({ type: Boolean }) isTyping = false;
  @property() typingLabel = 'Agent is typing...';

  @query('.messages-container') private container!: HTMLElement;

  @state() private shouldAutoScroll = true;

  updated(changedProps: Map<string, unknown>) {
    if (changedProps.has('messages') || changedProps.has('isTyping')) {
      if (this.shouldAutoScroll) {
        this.scrollToBottom();
      }
    }
  }

  render() {
    if (this.messages.length === 0 && !this.isTyping) {
      return html`
        <div class="empty-state">
          <svg class="empty-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5">
            <path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z"/>
          </svg>
          <div class="empty-title">No messages yet</div>
          <div class="empty-subtitle">Send a message to start the conversation</div>
        </div>
      `;
    }

    return html`
      <div class="messages-container" @scroll=${this.handleScroll}>
        ${this.renderMessages()}
        ${this.isTyping
          ? html`<alx-chat-typing .label=${this.typingLabel}></alx-chat-typing>`
          : nothing}
      </div>
    `;
  }

  scrollToBottom() {
    requestAnimationFrame(() => {
      if (this.container) {
        this.container.scrollTop = this.container.scrollHeight;
      }
    });
  }

  private renderMessages() {
    const result: unknown[] = [];
    let lastDate = '';

    for (const msg of this.messages) {
      const msgDate = this.formatDate(msg.createdAt);
      if (msgDate && msgDate !== lastDate) {
        lastDate = msgDate;
        result.push(html`
          <div class="date-separator">
            <span>${msgDate}</span>
          </div>
        `);
      }

      result.push(html`
        <alx-chat-bubble
          .senderType=${msg.senderType}
          .senderName=${msg.senderName ?? ''}
          .content=${msg.content}
          .timestamp=${msg.createdAt instanceof Date ? msg.createdAt.toISOString() : String(msg.createdAt)}
          .status=${msg.status}
        ></alx-chat-bubble>
      `);
    }

    return result;
  }

  private handleScroll() {
    if (!this.container) return;
    const { scrollTop, scrollHeight, clientHeight } = this.container;
    // Auto-scroll if user is near the bottom (within 60px)
    this.shouldAutoScroll = scrollHeight - scrollTop - clientHeight < 60;
  }

  private formatDate(date: Date | string): string {
    try {
      const d = date instanceof Date ? date : new Date(date);
      const now = new Date();
      const isToday =
        d.getDate() === now.getDate() &&
        d.getMonth() === now.getMonth() &&
        d.getFullYear() === now.getFullYear();

      if (isToday) return 'Today';

      const yesterday = new Date(now);
      yesterday.setDate(yesterday.getDate() - 1);
      const isYesterday =
        d.getDate() === yesterday.getDate() &&
        d.getMonth() === yesterday.getMonth() &&
        d.getFullYear() === yesterday.getFullYear();

      if (isYesterday) return 'Yesterday';

      return d.toLocaleDateString([], {
        month: 'short',
        day: 'numeric',
        year: d.getFullYear() !== now.getFullYear() ? 'numeric' : undefined,
      });
    } catch {
      return '';
    }
  }
}

safeRegister('alx-chat-messages', AlxChatMessages);
