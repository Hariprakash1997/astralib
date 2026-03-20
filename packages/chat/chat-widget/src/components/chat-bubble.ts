import { LitElement, html, css, nothing } from 'lit';
import { property } from 'lit/decorators.js';
import { classMap } from 'lit/directives/class-map.js';
import type { ChatMessage } from '@astralibx/chat-types';
import { ChatSenderType, ChatContentType, ChatMessageStatus } from '@astralibx/chat-types';
import { chatResetStyles, chatBaseStyles, chatAnimations } from '../styles/shared.js';
import { safeRegister } from '../utils/safe-register.js';

export class AlxChatBubble extends LitElement {
  static styles = [
    chatResetStyles,
    chatBaseStyles,
    chatAnimations,
    css`
      :host {
        display: block;
        padding: 0 0;
      }

      /* -- Gap between messages based on group position -- */
      :host {
        margin-top: 12px;
      }

      :host([data-group-position='middle']),
      :host([data-group-position='last']) {
        margin-top: 3px;
      }

      /* -- Bubble row layout -- */
      .bubble-row {
        display: flex;
        align-items: flex-end;
        max-width: 100%;
        flex-shrink: 0;
      }

      .bubble-row.visitor {
        flex-direction: row-reverse;
      }

      .bubble-row.agent,
      .bubble-row.ai {
        flex-direction: row;
      }

      .bubble-row.system {
        justify-content: center;
      }

      /* -- Bubble column (name + bubble + meta) -- */
      .bubble-col {
        display: flex;
        flex-direction: column;
        max-width: 80%;
        min-width: 0;
      }

      .bubble-col.visitor {
        align-items: flex-end;
      }

      .bubble-col.agent,
      .bubble-col.ai {
        align-items: flex-start;
      }

      /* -- Sender name -- */
      .sender-name {
        font-size: 11px;
        font-weight: 600;
        color: var(--alx-chat-text-muted);
        margin-bottom: 4px;
        padding: 0 4px;
      }

      /* -- Avatar -- */
      .avatar {
        width: 28px;
        height: 28px;
        border-radius: 50%;
        flex-shrink: 0;
        align-self: flex-end;
        margin-inline-end: 8px;
        overflow: hidden;
      }

      .avatar img {
        width: 100%;
        height: 100%;
        object-fit: cover;
      }

      .avatar-initial {
        width: 28px;
        height: 28px;
        border-radius: 50%;
        background: var(--alx-chat-primary-muted);
        display: flex;
        align-items: center;
        justify-content: center;
        font-size: 12px;
        font-weight: 600;
        color: var(--alx-chat-primary-text);
        text-transform: uppercase;
        flex-shrink: 0;
        align-self: flex-end;
        margin-inline-end: 8px;
      }

      /* Invisible spacer when avatar is hidden but space is needed */
      .avatar-spacer {
        width: 28px;
        height: 28px;
        flex-shrink: 0;
        margin-inline-end: 8px;
      }

      /* -- Bubble -- */
      .bubble {
        padding: 10px 14px;
        line-height: 1.45;
        overflow-wrap: break-word;
        word-break: break-word;
        position: relative;
        width: fit-content;
        max-width: 100%;
        font-size: 14px;
      }

      /* Visitor bubble */
      .bubble.visitor {
        background: var(--alx-chat-primary);
        color: var(--alx-chat-primary-text);
        margin: 0;
        margin-inline-start: auto;
        margin-inline-end: 16px;
        box-shadow: 0 1px 3px color-mix(in srgb, var(--alx-chat-primary) 15%, transparent);
        animation: alx-slideInRight 0.25s var(--alx-chat-spring-bounce);
      }

      /* Visitor border-radius by group position */
      .bubble.visitor.gp-solo {
        border-radius: 18px 18px 6px 18px;
      }
      .bubble.visitor.gp-first {
        border-radius: 18px 18px 6px 18px;
      }
      .bubble.visitor.gp-middle {
        border-radius: 18px 6px 6px 18px;
      }
      .bubble.visitor.gp-last {
        border-radius: 18px 6px 18px 18px;
      }

      /* Agent/AI bubble */
      .bubble.agent,
      .bubble.ai {
        background: var(--alx-chat-surface);
        color: var(--alx-chat-text);
        border: 1px solid var(--alx-chat-border);
        margin: 0;
        margin-inline-end: auto;
        margin-inline-start: 16px;
        animation: alx-slideInLeft 0.25s var(--alx-chat-spring-bounce);
      }

      /* When avatar is shown, remove start margin (avatar provides spacing) */
      .has-avatar .bubble.agent,
      .has-avatar .bubble.ai {
        margin-inline-start: 0;
      }

      /* When avatar spacer is present, also remove start margin */
      .has-spacer .bubble.agent,
      .has-spacer .bubble.ai {
        margin-inline-start: 0;
      }

      /* Agent/AI border-radius by group position */
      .bubble.agent.gp-solo,
      .bubble.ai.gp-solo {
        border-radius: 18px 18px 18px 6px;
      }
      .bubble.agent.gp-first,
      .bubble.ai.gp-first {
        border-radius: 18px 18px 18px 6px;
      }
      .bubble.agent.gp-middle,
      .bubble.ai.gp-middle {
        border-radius: 6px 18px 18px 6px;
      }
      .bubble.agent.gp-last,
      .bubble.ai.gp-last {
        border-radius: 6px 18px 18px 18px;
      }

      /* System message */
      .bubble.system {
        text-align: center;
        font-size: 12px;
        color: var(--alx-chat-text-muted);
        font-style: italic;
        background: var(--alx-chat-surface-alt);
        opacity: 0.8;
        border-radius: 20px;
        padding: 6px 14px;
        margin: 4px auto;
        max-width: 85%;
        animation: alx-fadeInUp 0.2s var(--alx-chat-spring-smooth);
      }

      /* Event message (inline activity badge) */
      .bubble-row.event {
        justify-content: center;
      }

      .event-badge {
        display: inline-flex;
        align-items: center;
        gap: 6px;
        font-size: 11px;
        color: var(--alx-chat-text-muted);
        background: var(--alx-chat-surface-alt);
        border: 1px solid var(--alx-chat-border);
        border-radius: 12px;
        padding: 4px 12px;
        margin: 2px auto;
        opacity: 0.7;
        animation: alx-fadeInUp 0.2s var(--alx-chat-spring-smooth);
      }

      .event-badge svg {
        flex-shrink: 0;
        opacity: 0.6;
      }

      .event-badge a {
        color: var(--alx-chat-primary);
        text-decoration: none;
        font-weight: 500;
      }

      .event-badge a:hover {
        text-decoration: underline;
      }

      /* -- Meta row (timestamp + status) -- */
      .meta {
        display: flex;
        align-items: center;
        justify-content: flex-end;
        gap: 4px;
        margin-top: 4px;
        font-size: 11px;
        opacity: 0.7;
      }

      .meta.visitor {
        color: var(--alx-chat-primary-text);
      }

      .meta.agent,
      .meta.ai {
        color: var(--alx-chat-text-muted);
      }

      /* -- Status icons -- */
      .status-icon {
        display: inline-flex;
        vertical-align: middle;
      }

      .status-icon.spinning {
        animation: alx-spinnerRotate 1s linear infinite;
        opacity: 0.5;
      }

      .status-icon.sent-icon {
        opacity: 0.6;
      }

      .status-icon.delivered-icon {
        opacity: 0.7;
      }

      .status-icon.delivered-icon .check-second {
        animation: alx-checkSlideIn 0.2s var(--alx-chat-spring-snappy);
      }

      .status-icon.read-icon {
        color: #3b82f6;
        transition: color 0.3s var(--alx-chat-spring-smooth);
      }

      .status-icon.read-icon .check-second {
        animation: alx-checkSlideIn 0.2s var(--alx-chat-spring-snappy);
      }

      .status-icon.failed-icon {
        color: var(--alx-chat-danger);
      }

      /* -- Retry button -- */
      .retry-btn {
        background: none;
        border: none;
        font-size: 11px;
        color: var(--alx-chat-text-muted);
        text-decoration: underline;
        cursor: pointer;
        padding: 0;
        margin-inline-start: 4px;
        font-family: inherit;
      }

      .retry-btn:hover {
        color: var(--alx-chat-danger);
      }

      /* -- Image content -- */
      .image-content img {
        max-width: 100%;
        max-height: 200px;
        border-radius: 8px;
        cursor: pointer;
        object-fit: cover;
      }

      /* -- File content -- */
      .file-content {
        display: flex;
        align-items: center;
        gap: 8px;
        padding: 8px 12px;
        background: var(--alx-chat-surface-alt);
        border-radius: 8px;
        text-decoration: none;
        color: var(--alx-chat-text);
        font-size: 13px;
        transition: background 0.15s;
      }

      .file-content:hover {
        background: var(--alx-chat-surface-hover);
      }

      .file-name {
        overflow: hidden;
        text-overflow: ellipsis;
        white-space: nowrap;
        max-width: 180px;
      }
    `,
  ];

  @property({ attribute: false }) message: ChatMessage | null = null;
  @property() senderType: ChatSenderType = 'visitor' as ChatSenderType;
  @property() senderName = '';
  @property() content = '';
  @property() contentType = 'text';
  @property() status: ChatMessageStatus = 'sent' as ChatMessageStatus;
  @property() timestamp = '';
  @property({ attribute: false }) metadata: Record<string, unknown> = {};

  @property({ type: String }) groupPosition: 'solo' | 'first' | 'middle' | 'last' = 'solo';
  @property({ type: Boolean }) showAvatar = false;
  @property({ type: Boolean }) showName = false;

  connectedCallback() {
    super.connectedCallback();
    this.updateGroupAttribute();
  }

  updated(changed: Map<string, unknown>) {
    if (changed.has('groupPosition')) {
      this.updateGroupAttribute();
    }
  }

  private updateGroupAttribute() {
    this.setAttribute('data-group-position', this.groupPosition);
  }

  render() {
    const isVisitor = this.senderType === ChatSenderType.Visitor;
    const isSystem = this.senderType === ChatSenderType.System;
    const isAgent = this.senderType === ChatSenderType.Agent || this.senderType === ChatSenderType.AI;
    const isEvent = this.contentType === ChatContentType.Event;

    if (isEvent) {
      return this._renderEventBadge();
    }

    if (isSystem) {
      return html`
        <div class="bubble-row system">
          <div class="bubble system">${this.content}</div>
        </div>
      `;
    }

    const gpClass = `gp-${this.groupPosition}`;

    const bubbleClasses = {
      bubble: true,
      visitor: isVisitor,
      agent: this.senderType === ChatSenderType.Agent,
      ai: this.senderType === ChatSenderType.AI,
      [gpClass]: true,
    };

    const rowClasses = {
      'bubble-row': true,
      visitor: isVisitor,
      agent: this.senderType === ChatSenderType.Agent,
      ai: this.senderType === ChatSenderType.AI,
      'has-avatar': isAgent && this.showAvatar,
      'has-spacer': isAgent && !this.showAvatar && (this.groupPosition === 'middle' || this.groupPosition === 'last'),
    };

    const metaClasses = {
      meta: true,
      visitor: isVisitor,
      agent: this.senderType === ChatSenderType.Agent,
      ai: this.senderType === ChatSenderType.AI,
    };

    const avatarUrl = this.metadata?.avatarUrl as string | undefined;

    return html`
      <div class=${classMap(rowClasses)} role="article">
        ${isAgent ? this.renderAvatarSlot(avatarUrl) : nothing}
        <div class="bubble-col ${isVisitor ? 'visitor' : this.senderType}">
          ${isAgent && this.showName && this.senderName
            ? html`<span class="sender-name">${this.senderName}</span>`
            : nothing}
          <div class=${classMap(bubbleClasses)}>
            ${this._renderContent()}
            ${html`
              <div class=${classMap(metaClasses)}>
                <span class="timestamp">${this.formatTime(this.timestamp)}</span>
                ${isVisitor ? this.renderStatus() : nothing}
              </div>
            `}
          </div>
        </div>
      </div>
    `;
  }

  private _renderEventBadge() {
    const eventType = (this.metadata?.eventType as string) || '';
    const pageTitle = (this.metadata?.pageTitle as string) || '';
    const pageUrl = (this.metadata?.pageUrl as string) || '';

    if (eventType === 'page_view' && pageTitle) {
      return html`
        <div class="bubble-row event">
          <span class="event-badge">
            <svg width="12" height="12" viewBox="0 0 12 12" fill="none">
              <circle cx="6" cy="6" r="5" stroke="currentColor" stroke-width="1"/>
              <circle cx="6" cy="6" r="1.5" fill="currentColor"/>
            </svg>
            Viewed: ${pageUrl
              ? html`<a href=${pageUrl} target="_blank" rel="noopener">${pageTitle}</a>`
              : pageTitle}
          </span>
        </div>
      `;
    }

    // Generic event display
    const label = this.content || eventType.replace(/_/g, ' ');
    return html`
      <div class="bubble-row event">
        <span class="event-badge">
          <svg width="12" height="12" viewBox="0 0 12 12" fill="none">
            <circle cx="6" cy="6" r="5" stroke="currentColor" stroke-width="1"/>
            <circle cx="6" cy="6" r="1.5" fill="currentColor"/>
          </svg>
          ${label}
        </span>
      </div>
    `;
  }

  private _renderContent() {
    if (this.contentType === ChatContentType.Image) {
      return html`
        <div class="image-content">
          <img src=${this.content} alt="Shared image" loading="lazy"
            @click=${() => window.open(this.content, '_blank')}>
        </div>
      `;
    }

    if (this.contentType === ChatContentType.File) {
      const filename = (this.metadata?.filename as string) || 'File';
      return html`
        <a class="file-content" href=${this.content} target="_blank" rel="noopener">
          <svg width="16" height="16" viewBox="0 0 16 16" fill="none">
            <path d="M9 1H4C3.45 1 3 1.45 3 2V14C3 14.55 3.45 15 4 15H12C12.55 15 13 14.55 13 14V5L9 1Z" stroke="currentColor" stroke-width="1.5" stroke-linejoin="round"/>
            <polyline points="9,1 9,5 13,5" stroke="currentColor" stroke-width="1.5" stroke-linejoin="round"/>
          </svg>
          <span class="file-name">${filename}</span>
        </a>
      `;
    }

    // Default: text
    return html`<span class="text-content">${this.content?.trim()}</span>`;
  }

  private renderAvatarSlot(avatarUrl?: string) {
    if (this.showAvatar) {
      if (avatarUrl) {
        return html`
          <div class="avatar">
            <img src=${avatarUrl} alt=${this.senderName || 'Agent'} />
          </div>
        `;
      }
      const initial = this.senderName ? this.senderName.charAt(0).toUpperCase() : '?';
      return html`<div class="avatar-initial">${initial}</div>`;
    }

    // For middle/last messages in a group, add spacer to keep alignment
    if (this.groupPosition === 'middle' || this.groupPosition === 'last') {
      return html`<div class="avatar-spacer"></div>`;
    }

    return nothing;
  }

  private renderStatus() {
    switch (this.status) {
      case ChatMessageStatus.Sending:
        return html`
          <svg class="status-icon spinning" width="12" height="12" viewBox="0 0 12 12">
            <circle cx="6" cy="6" r="4.5" fill="none" stroke="currentColor" stroke-width="1.5" stroke-dasharray="14" stroke-linecap="round"/>
          </svg>
        `;
      case ChatMessageStatus.Sent:
        return html`
          <svg class="status-icon sent-icon" width="14" height="14" viewBox="0 0 14 14">
            <polyline points="2.5 7 5.5 10 11.5 4" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"/>
          </svg>
        `;
      case ChatMessageStatus.Delivered:
        return html`
          <svg class="status-icon delivered-icon" width="18" height="14" viewBox="0 0 18 14">
            <polyline points="1 7 4 10 10 4" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"/>
            <polyline class="check-second" points="5 7 8 10 14 4" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"/>
          </svg>
        `;
      case ChatMessageStatus.Read:
        return html`
          <svg class="status-icon read-icon" width="18" height="14" viewBox="0 0 18 14">
            <polyline points="1 7 4 10 10 4" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"/>
            <polyline class="check-second" points="5 7 8 10 14 4" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"/>
          </svg>
        `;
      case ChatMessageStatus.Failed:
        return html`
          <svg class="status-icon failed-icon" width="12" height="12" viewBox="0 0 12 12">
            <line x1="2" y1="2" x2="10" y2="10" stroke="currentColor" stroke-width="1.5" stroke-linecap="round"/>
            <line x1="10" y1="2" x2="2" y2="10" stroke="currentColor" stroke-width="1.5" stroke-linecap="round"/>
          </svg>
          <button class="retry-btn" @click=${this.handleRetry} aria-label="Retry sending message">Retry</button>
        `;
      default:
        return nothing;
    }
  }

  private handleRetry() {
    this.dispatchEvent(new CustomEvent('message-retry', {
      bubbles: true,
      composed: true,
      detail: { messageId: this.message?._id || this.message?.messageId },
    }));
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
