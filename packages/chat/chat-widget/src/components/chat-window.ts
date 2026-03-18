import { LitElement, html, css } from 'lit';
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
          @send=${this.handleSend}
          @typing=${this.handleTyping}
        ></alx-chat-input>
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
}

safeRegister('alx-chat-window', AlxChatWindow);
