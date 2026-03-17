import { LitElement, html, css } from 'lit';
import { property } from 'lit/decorators.js';
import { classMap } from 'lit/directives/class-map.js';
import type { ChatMessage } from '@astralibx/chat-types';
import { chatResetStyles, chatBaseStyles } from '../styles/shared.js';
import { safeRegister } from '../utils/safe-register.js';
import './chat-header.js';
import './chat-messages.js';
import './chat-input.js';

export class AlxChatWindow extends LitElement {
  static styles = [
    chatResetStyles,
    chatBaseStyles,
    css`
      :host {
        display: block;
      }

      .window-container {
        position: fixed;
        bottom: 80px;
        width: 380px;
        height: 560px;
        max-height: calc(100vh - 100px);
        max-width: calc(100vw - 32px);
        border-radius: var(--alx-chat-radius);
        background: var(--alx-chat-bg);
        box-shadow: var(--alx-chat-shadow);
        border: 1px solid var(--alx-chat-border);
        display: flex;
        flex-direction: column;
        overflow: hidden;
        z-index: 9999;

        /* Animation */
        opacity: 0;
        transform: translateY(16px) scale(0.96);
        transition: opacity 0.25s ease, transform 0.25s ease;
        pointer-events: none;
      }

      .window-container.open {
        opacity: 1;
        transform: translateY(0) scale(1);
        pointer-events: auto;
      }

      .window-container.bottom-right {
        right: 16px;
      }

      .window-container.bottom-left {
        left: 16px;
      }

      .messages-area {
        flex: 1;
        overflow: hidden;
      }

      /* Mobile responsive */
      @media (max-width: 480px) {
        .window-container {
          bottom: 0;
          right: 0 !important;
          left: 0 !important;
          width: 100%;
          height: 100%;
          max-height: 100vh;
          max-width: 100vw;
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

  render() {
    const containerClasses = {
      'window-container': true,
      open: this.open,
      'bottom-right': this.position === 'bottom-right',
      'bottom-left': this.position === 'bottom-left',
    };

    return html`
      <div class=${classMap(containerClasses)}>
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

  private handleMinimize() {
    this.dispatchEvent(
      new CustomEvent('minimize', { bubbles: true, composed: true }),
    );
  }

  private handleEndChat() {
    this.dispatchEvent(
      new CustomEvent('end-chat', { bubbles: true, composed: true }),
    );
  }

  private handleSend(e: CustomEvent<{ content: string }>) {
    this.dispatchEvent(
      new CustomEvent('send', {
        detail: e.detail,
        bubbles: true,
        composed: true,
      }),
    );
  }

  private handleTyping(e: CustomEvent<{ isTyping: boolean }>) {
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
