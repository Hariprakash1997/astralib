import { LitElement, html, css, nothing } from 'lit';
import { property } from 'lit/decorators.js';
import { classMap } from 'lit/directives/class-map.js';
import type { ChatMessage } from '@astralibx/chat-types';
import { chatResetStyles, chatBaseStyles, chatAnimations } from '../styles/shared.js';
import { safeRegister } from '../utils/safe-register.js';
import './chat-header.js';
import './chat-messages.js';
import './chat-input.js';

export class AlxChatWindow extends LitElement {
  static styles = [
    chatResetStyles,
    chatBaseStyles,
    chatAnimations,
    css`
      :host {
        display: block;
      }

      /* --- Window Open / Close Keyframes --- */

      @keyframes alx-windowOpen {
        0% {
          opacity: 0;
          transform: scale(0.85) translateY(20px);
        }
        100% {
          opacity: 1;
          transform: scale(1) translateY(0);
        }
      }

      @keyframes alx-windowClose {
        0% {
          opacity: 1;
          transform: scale(1) translateY(0);
        }
        100% {
          opacity: 0;
          transform: scale(0.9) translateY(10px);
        }
      }

      /* --- Window Container --- */

      .window-container {
        position: fixed;
        z-index: 9999;
        width: 400px;
        height: 600px;
        max-width: calc(100vw - 32px);
        max-height: calc(100vh - 100px);
        border-radius: 16px;
        background: var(--alx-chat-bg);
        border: 1px solid color-mix(in srgb, var(--alx-chat-border) 50%, transparent);
        box-shadow: var(--alx-chat-shadow);
        overflow: hidden;
        display: flex;
        flex-direction: column;

        /* Hidden by default */
        visibility: hidden;
        opacity: 0;
        pointer-events: none;
      }

      .window-container.open {
        visibility: visible;
        opacity: 1;
        pointer-events: auto;
        animation: alx-windowOpen 0.35s var(--alx-chat-spring-smooth) forwards;
      }

      .window-container.closing {
        visibility: visible;
        pointer-events: none;
        animation: alx-windowClose 0.2s ease-in forwards;
      }

      .messages-area {
        flex: 1;
        overflow: hidden;
        display: flex;
        flex-direction: column;
        min-height: 0;
      }

      /* --- Staggered Content Reveal --- */

      .window-container.open > :nth-child(1) {
        animation: alx-fadeInUp 0.25s var(--alx-chat-spring-smooth) both;
        animation-delay: 0.1s;
      }

      .window-container.open > :nth-child(2) {
        animation: alx-fadeInUp 0.25s var(--alx-chat-spring-smooth) both;
        animation-delay: 0.15s;
      }

      .window-container.open > :nth-child(3) {
        animation: alx-fadeInUp 0.25s var(--alx-chat-spring-smooth) both;
        animation-delay: 0.2s;
      }

      /* --- Position Variants --- */

      .window-container.bottom-right {
        bottom: 80px;
        right: 16px;
      }

      .window-container.bottom-left {
        bottom: 80px;
        left: 16px;
      }

      /* --- Content --- */

      .messages-area {
        flex: 1;
        overflow: hidden;
      }

      /* --- Queue Banner --- */

      .queue-banner {
        display: flex;
        align-items: center;
        justify-content: center;
        gap: 8px;
        padding: 10px 16px;
        background: var(--alx-chat-primary-light);
        color: var(--alx-chat-text);
        font-size: 13px;
        font-weight: 500;
        border-bottom: 1px solid var(--alx-chat-border);
        animation: alx-fadeInUp 0.25s var(--alx-chat-spring-smooth);
      }

      .queue-banner svg {
        color: var(--alx-chat-primary);
        flex-shrink: 0;
      }

      .queue-wait {
        color: var(--alx-chat-text-muted);
      }

      /* --- Connection Status Banner --- */

      .connection-banner {
        display: flex;
        align-items: center;
        justify-content: center;
        gap: 8px;
        padding: 8px 16px;
        font-size: 12px;
        font-weight: 500;
        border-bottom: 1px solid var(--alx-chat-border);
        animation: alx-fadeInUp 0.2s var(--alx-chat-spring-smooth);
      }

      .connection-banner.connecting {
        background: color-mix(in srgb, var(--alx-chat-warning) 12%, var(--alx-chat-surface));
        color: var(--alx-chat-warning);
      }

      .connection-banner.reconnecting {
        background: color-mix(in srgb, var(--alx-chat-warning) 12%, var(--alx-chat-surface));
        color: var(--alx-chat-warning);
      }

      .connection-banner.disconnected {
        background: color-mix(in srgb, var(--alx-chat-danger) 12%, var(--alx-chat-surface));
        color: var(--alx-chat-danger);
      }

      @keyframes alx-ellipsis {
        0% { content: ''; }
        33% { content: '.'; }
        66% { content: '..'; }
        100% { content: '...'; }
      }

      .connection-dots::after {
        content: '';
        animation: alx-ellipsis 1.5s steps(4) infinite;
      }

      /* --- History Link --- */

      .history-link {
        display: flex;
        align-items: center;
        justify-content: center;
        gap: 6px;
        padding: 8px 16px;
        border-top: 1px solid var(--alx-chat-border);
        background: var(--alx-chat-surface);
        color: var(--alx-chat-text-muted);
        font-size: 12px;
        cursor: pointer;
        transition: color 0.15s, background 0.15s;
      }

      .history-link:hover {
        color: var(--alx-chat-primary);
        background: var(--alx-chat-surface-alt);
      }

      /* --- Mobile Responsive --- */

      @media (max-width: 480px) {
        .window-container {
          width: 100vw;
          height: 100vh;
          max-width: none;
          max-height: none;
          bottom: 0 !important;
          left: 0 !important;
          right: 0 !important;
          border-radius: 0;
        }
      }
    `,
  ];

  @property({ type: Boolean }) open = false;
  @property() position: 'bottom-right' | 'bottom-left' = 'bottom-right';
  @property({ type: Array }) messages: ChatMessage[] = [];
  @property() agentName = 'Chat Support';
  @property() agentAvatar = '';
  @property() connectionStatus: 'disconnected' | 'connecting' | 'connected' | 'reconnecting' = 'disconnected';
  @property({ type: Boolean }) isTyping = false;
  @property() typingLabel = 'Agent is typing...';
  @property() inputPlaceholder = 'Type a message...';
  @property({ type: Boolean }) inputDisabled = false;
  @property({ type: Boolean }) showAttach = false;
  @property({ type: Array }) allowedFileTypes: string[] = [];
  @property({ type: Number }) maxFileSizeMb = 5;
  @property({ type: Boolean }) showHistoryLink = false;
  @property({ type: Number }) queuePosition: number | null = null;
  @property({ type: Number }) estimatedWaitMinutes: number | null = null;
  @property() connectionStatusLabel = '';

  private _closing = false;

  updated(changed: Map<PropertyKey, unknown>) {
    super.updated(changed);

    if (changed.has('open')) {
      const wasOpen = changed.get('open') as boolean | undefined;
      // Trigger close animation when going from open to closed
      if (wasOpen === true && !this.open) {
        this._closing = true;
        this.requestUpdate();

        // Remove closing state after animation completes
        setTimeout(() => {
          this._closing = false;
          this.requestUpdate();
        }, 200);
      }
    }
  }

  render() {
    const containerClasses = {
      'window-container': true,
      open: this.open,
      closing: this._closing,
      'bottom-right': this.position === 'bottom-right',
      'bottom-left': this.position === 'bottom-left',
    };

    return html`
      <div class=${classMap(containerClasses)} role="dialog" aria-label="Chat window">
        <alx-chat-header
          .agentName=${this.agentName}
          .agentAvatar=${this.agentAvatar}
          .connectionStatus=${this.connectionStatus}
          @minimize=${this.handleMinimize}
          @end-chat=${this.handleEndChat}
        ></alx-chat-header>
        ${this.queuePosition != null && this.queuePosition > 0 ? html`
          <div class="queue-banner">
            <svg width="16" height="16" viewBox="0 0 16 16" fill="none">
              <circle cx="8" cy="8" r="6.5" stroke="currentColor" stroke-width="1.5"/>
              <polyline points="8 4 8 8 11 10" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"/>
            </svg>
            <span>You're #${this.queuePosition} in the queue${this.estimatedWaitMinutes != null && this.estimatedWaitMinutes > 0
              ? html` <span class="queue-wait">&mdash; about ${this.estimatedWaitMinutes} min wait</span>`
              : nothing}</span>
          </div>
        ` : nothing}
        ${this.connectionStatus === 'connecting' ? html`
          <div class="connection-banner connecting">
            <span>Connecting you<span class="connection-dots"></span></span>
          </div>
        ` : this.connectionStatus === 'reconnecting' ? html`
          <div class="connection-banner reconnecting">
            <span>Connection lost. Reconnecting<span class="connection-dots"></span></span>
          </div>
        ` : this.connectionStatus === 'disconnected' && this.connectionStatusLabel ? html`
          <div class="connection-banner disconnected">
            <span>${this.connectionStatusLabel}</span>
          </div>
        ` : nothing}
        <div class="messages-area">
          <alx-chat-messages
            .messages=${this.messages}
            .isTyping=${this.isTyping}
            .typingLabel=${this.typingLabel}
          ></alx-chat-messages>
        </div>
        <alx-chat-input
          .placeholder=${this.inputPlaceholder}
          .disabled=${this.inputDisabled}
          .showAttach=${this.showAttach}
          .allowedFileTypes=${this.allowedFileTypes}
          .maxFileSizeMb=${this.maxFileSizeMb}
          @send=${this.handleSend}
          @typing=${this.handleTyping}
        ></alx-chat-input>
        ${this.showHistoryLink ? html`
          <div class="history-link" @click=${this.handleHistoryClick}>
            <svg width="14" height="14" viewBox="0 0 14 14" fill="none">
              <circle cx="7" cy="7" r="5.5" stroke="currentColor" stroke-width="1.2"/>
              <polyline points="7 4 7 7 9.5 8.5" stroke="currentColor" stroke-width="1.2" stroke-linecap="round" stroke-linejoin="round"/>
            </svg>
            Previous conversations
          </div>
        ` : nothing}
      </div>
    `;
  }

  private handleMinimize(e: Event) {
    e.stopPropagation();
    this.dispatchEvent(
      new CustomEvent('minimize', { bubbles: true, composed: true }),
    );
  }

  private handleEndChat(e: Event) {
    e.stopPropagation();
    this.dispatchEvent(
      new CustomEvent('end-chat', { bubbles: true, composed: true }),
    );
  }

  private handleSend(e: CustomEvent<{ content: string }>) {
    e.stopPropagation();
    this.dispatchEvent(
      new CustomEvent('send', {
        detail: e.detail,
        bubbles: true,
        composed: true,
      }),
    );
  }

  private handleTyping(e: CustomEvent<{ isTyping: boolean }>) {
    e.stopPropagation();
    this.dispatchEvent(
      new CustomEvent('typing', {
        detail: e.detail,
        bubbles: true,
        composed: true,
      }),
    );
  }

  private handleHistoryClick() {
    this.dispatchEvent(
      new CustomEvent('show-history', { bubbles: true, composed: true }),
    );
  }
}

safeRegister('alx-chat-window', AlxChatWindow);
