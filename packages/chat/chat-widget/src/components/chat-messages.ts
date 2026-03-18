import { LitElement, html, css, nothing } from 'lit';
import { property, state, query } from 'lit/decorators.js';
import type { ChatMessage } from '@astralibx/chat-types';
import { ChatSenderType } from '@astralibx/chat-types';
import { chatResetStyles, chatBaseStyles, chatAnimations } from '../styles/shared.js';
import { safeRegister } from '../utils/safe-register.js';
import './chat-bubble.js';
import './chat-typing.js';

interface GroupedMessage {
  message: ChatMessage;
  groupPosition: 'solo' | 'first' | 'middle' | 'last';
  showAvatar: boolean;
  showName: boolean;
  showDateSeparator: boolean;
  dateLabel: string;
}

function isSameDay(a: Date, b: Date): boolean {
  return a.getFullYear() === b.getFullYear()
    && a.getMonth() === b.getMonth()
    && a.getDate() === b.getDate();
}

function formatDateLabel(date: Date): string {
  const now = new Date();
  if (isSameDay(date, now)) return 'Today';
  const yesterday = new Date(now);
  yesterday.setDate(yesterday.getDate() - 1);
  if (isSameDay(date, yesterday)) return 'Yesterday';
  return date.toLocaleDateString(undefined, { weekday: 'short', month: 'short', day: 'numeric' });
}

export class AlxChatMessages extends LitElement {
  static styles = [
    chatResetStyles,
    chatBaseStyles,
    chatAnimations,
    css`
      :host {
        display: block;
        flex: 1;
        overflow: hidden;
      }

      .messages-container {
        height: 100%;
        overflow-y: auto;
        scroll-behavior: smooth;
      }

      .messages-inner {
        padding: 12px 0;
        min-height: 100%;
        display: flex;
        flex-direction: column;
        justify-content: flex-end;
        align-items: stretch;
      }

      .messages-inner > * {
        flex-shrink: 0;
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
        color: var(--alx-chat-text-muted);
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
        justify-content: center;
        padding: 8px 16px;
        margin: 4px 0;
      }

      .date-pill {
        font-size: 11px;
        color: var(--alx-chat-text-muted);
        background: var(--alx-chat-surface-alt);
        border: 1px solid var(--alx-chat-border);
        border-radius: 10px;
        padding: 4px 12px;
        font-weight: 500;
      }
    `,
  ];

  @property({ type: Array }) messages: ChatMessage[] = [];
  @property({ type: Boolean }) isTyping = false;
  @property() typingLabel = 'Agent is typing...';
  @property({ type: String }) typingAgentName = '';
  @property({ type: String }) typingAgentAvatar = '';

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
          <svg class="empty-icon" width="48" height="48" viewBox="0 0 48 48" fill="none">
            <path d="M24 6C14.059 6 6 13.163 6 22c0 5.07 2.88 9.58 7.38 12.5-.275 2.68-1.47 5.19-3.255 7.2a.92.92 0 00.69 1.56c4.13-.275 7.7-1.925 10.185-3.94 1.1.15 2.2.23 3.35.23C33.941 39.55 42 32.387 42 23.55 42 13.163 33.941 6 24 6z" stroke="currentColor" stroke-width="2" fill="none" opacity="0.4"/>
            <circle cx="17" cy="22" r="2" fill="currentColor" opacity="0.3"/>
            <circle cx="24" cy="22" r="2" fill="currentColor" opacity="0.3"/>
            <circle cx="31" cy="22" r="2" fill="currentColor" opacity="0.3"/>
          </svg>
          <div class="empty-title">No messages yet</div>
          <div class="empty-subtitle">Send a message to start the conversation</div>
        </div>
      `;
    }

    const grouped = this._groupMessages(this.messages);

    return html`
      <div class="messages-container" role="log" aria-live="polite" aria-label="Chat messages" @scroll=${this.handleScroll}>
        <div class="messages-inner">
        ${grouped.map(g => html`
          ${g.showDateSeparator ? html`
            <div class="date-separator">
              <span class="date-pill">${g.dateLabel}</span>
            </div>
          ` : nothing}
          <alx-chat-bubble
            .message=${g.message}
            .senderType=${g.message.senderType}
            .senderName=${g.message.senderName || ''}
            .content=${g.message.content}
            .contentType=${g.message.contentType}
            .status=${g.message.status}
            .timestamp=${g.message.createdAt}
            .metadata=${g.message.metadata || {}}
            .groupPosition=${g.groupPosition}
            .showAvatar=${g.showAvatar}
            .showName=${g.showName}
          ></alx-chat-bubble>
        `)}
        ${this.isTyping ? html`
          <alx-chat-typing
            .agentName=${this.typingAgentName || ''}
            .agentAvatar=${this.typingAgentAvatar || ''}
          ></alx-chat-typing>
        ` : nothing}
        </div>
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

  private _groupMessages(messages: ChatMessage[]): GroupedMessage[] {
    const grouped: GroupedMessage[] = [];
    const GROUP_WINDOW_MS = 2 * 60 * 1000; // 2 minutes

    for (let i = 0; i < messages.length; i++) {
      const msg = messages[i];
      const prev = i > 0 ? messages[i - 1] : null;
      const next = i < messages.length - 1 ? messages[i + 1] : null;

      // Date separator logic
      const msgDate = new Date(msg.createdAt);
      const prevDate = prev ? new Date(prev.createdAt) : null;
      const showDateSeparator = !prevDate || !isSameDay(msgDate, prevDate);
      const dateLabel = showDateSeparator ? formatDateLabel(msgDate) : '';

      // System messages are always 'solo'
      if (msg.senderType === ChatSenderType.System) {
        grouped.push({ message: msg, groupPosition: 'solo', showAvatar: false, showName: false, showDateSeparator, dateLabel });
        continue;
      }

      // Check if this message groups with previous and next
      // System check on prev/next is implicit: if prev.senderType === msg.senderType
      // and msg is not System (handled above with continue), prev can't be System either.
      const sameAsPrev = prev
        && prev.senderType === msg.senderType
        && prev.senderName === msg.senderName
        && (msgDate.getTime() - new Date(prev.createdAt).getTime()) < GROUP_WINDOW_MS
        && !showDateSeparator;

      const sameAsNext = next
        && next.senderType === msg.senderType
        && next.senderName === msg.senderName
        && (new Date(next.createdAt).getTime() - msgDate.getTime()) < GROUP_WINDOW_MS
        && isSameDay(msgDate, new Date(next.createdAt));

      let groupPosition: 'solo' | 'first' | 'middle' | 'last';
      if (!sameAsPrev && !sameAsNext) groupPosition = 'solo';
      else if (!sameAsPrev && sameAsNext) groupPosition = 'first';
      else if (sameAsPrev && sameAsNext) groupPosition = 'middle';
      else groupPosition = 'last';

      // Show avatar and name only on first message in group (or solo)
      const isFirstInGroup = groupPosition === 'solo' || groupPosition === 'first';
      const isAgent = msg.senderType === ChatSenderType.Agent || msg.senderType === ChatSenderType.AI;
      const showAvatar = isFirstInGroup && isAgent;
      const showName = isFirstInGroup && isAgent;

      grouped.push({ message: msg, groupPosition, showAvatar, showName, showDateSeparator, dateLabel });
    }

    return grouped;
  }

  private handleScroll() {
    if (!this.container) return;
    const { scrollTop, scrollHeight, clientHeight } = this.container;
    // Auto-scroll if user is near the bottom (within 60px)
    this.shouldAutoScroll = scrollHeight - scrollTop - clientHeight < 60;
  }
}

safeRegister('alx-chat-messages', AlxChatMessages);
