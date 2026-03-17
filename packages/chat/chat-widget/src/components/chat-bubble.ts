import { LitElement, html, css, nothing } from 'lit';
import { property } from 'lit/decorators.js';
import { classMap } from 'lit/directives/class-map.js';
import type { ChatSenderType, ChatMessageStatus } from '@astralibx/chat-types';
import { chatResetStyles, chatBaseStyles } from '../styles/shared.js';
import { safeRegister } from '../utils/safe-register.js';

export class AlxChatBubble extends LitElement {
  static styles = [
    chatResetStyles,
    chatBaseStyles,
    css`
      :host {
        display: block;
        padding: 2px 16px;
      }

      .bubble-row {
        display: flex;
        flex-direction: column;
        max-width: 80%;
      }

      .bubble-row.visitor {
        align-items: flex-end;
        margin-left: auto;
      }

      .bubble-row.agent,
      .bubble-row.ai {
        align-items: flex-start;
        margin-right: auto;
      }

      .bubble-row.system {
        align-items: center;
        margin: 0 auto;
        max-width: 90%;
      }

      .sender-name {
        font-size: 11px;
        font-weight: 600;
        color: var(--alx-chat-text-muted);
        margin-bottom: 2px;
        padding: 0 4px;
      }

      .bubble {
        padding: 10px 14px;
        border-radius: 16px;
        line-height: 1.45;
        word-wrap: break-word;
        white-space: pre-wrap;
        position: relative;
      }

      .bubble.visitor {
        background: var(--alx-chat-visitor-bg);
        color: var(--alx-chat-visitor-text);
        border-bottom-right-radius: 4px;
      }

      .bubble.agent,
      .bubble.ai {
        background: var(--alx-chat-agent-bg);
        color: var(--alx-chat-agent-text);
        border: 1px solid var(--alx-chat-border);
        border-bottom-left-radius: 4px;
      }

      .bubble.system {
        background: transparent;
        color: var(--alx-chat-system-text);
        font-size: 12px;
        font-style: italic;
        text-align: center;
        padding: 6px 12px;
      }

      .meta {
        display: flex;
        align-items: center;
        gap: 6px;
        margin-top: 3px;
        padding: 0 4px;
      }

      .timestamp {
        font-size: 11px;
        color: var(--alx-chat-text-muted);
        opacity: 0.7;
      }

      .status-icon {
        font-size: 11px;
        color: var(--alx-chat-text-muted);
        opacity: 0.7;
      }

      .status-icon.delivered,
      .status-icon.read {
        color: var(--alx-chat-primary);
        opacity: 1;
      }

      .status-icon.failed {
        color: var(--alx-chat-danger, #ef4444);
      }

      .meta.visitor {
        justify-content: flex-end;
      }

      .meta.agent,
      .meta.ai {
        justify-content: flex-start;
      }
    `,
  ];

  @property() senderType: ChatSenderType = 'visitor' as ChatSenderType;
  @property() senderName = '';
  @property() content = '';
  @property() timestamp = '';
  @property() status: ChatMessageStatus = 'sent' as ChatMessageStatus;

  render() {
    const isVisitor = this.senderType === 'visitor';
    const isSystem = this.senderType === 'system';

    const rowClasses = {
      'bubble-row': true,
      visitor: this.senderType === 'visitor',
      agent: this.senderType === 'agent',
      ai: this.senderType === 'ai',
      system: this.senderType === 'system',
    };

    const bubbleClasses = {
      bubble: true,
      visitor: this.senderType === 'visitor',
      agent: this.senderType === 'agent',
      ai: this.senderType === 'ai',
      system: this.senderType === 'system',
    };

    return html`
      <div class=${classMap(rowClasses)}>
        ${!isVisitor && !isSystem && this.senderName
          ? html`<span class="sender-name">${this.senderName}</span>`
          : nothing}
        <div class=${classMap(bubbleClasses)}>
          ${this.content}
        </div>
        ${!isSystem
          ? html`
            <div class="meta ${this.senderType}">
              <span class="timestamp">${this.formatTime(this.timestamp)}</span>
              ${isVisitor ? this.renderStatus() : nothing}
            </div>
          `
          : nothing}
      </div>
    `;
  }

  private renderStatus() {
    const statusMap: Record<string, string> = {
      sending: '\u2022',    // bullet
      sent: '\u2713',       // single check
      delivered: '\u2713\u2713', // double check
      read: '\u2713\u2713',     // double check (colored)
      failed: '\u2717',         // X mark
    };

    const statusClasses = {
      'status-icon': true,
      [this.status]: true,
    };

    return html`<span class=${classMap(statusClasses)}>${statusMap[this.status] ?? ''}</span>`;
  }

  private formatTime(timestamp: string): string {
    if (!timestamp) return '';
    try {
      const date = new Date(timestamp);
      return date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
    } catch {
      return '';
    }
  }
}

safeRegister('alx-chat-bubble', AlxChatBubble);
