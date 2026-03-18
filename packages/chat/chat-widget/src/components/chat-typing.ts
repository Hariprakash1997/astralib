import { LitElement, html, css, svg } from 'lit';
import { property } from 'lit/decorators.js';
import {
  chatResetStyles,
  chatBaseStyles,
  chatAnimations,
} from '../styles/shared.js';
import { safeRegister } from '../utils/safe-register.js';

export class AlxChatTyping extends LitElement {
  static styles = [
    chatResetStyles,
    chatBaseStyles,
    chatAnimations,
    css`
      :host {
        display: block;
        padding: 8px 16px;
        animation: alx-slideInLeft 0.2s var(--alx-chat-spring-smooth);
      }

      .typing-row {
        display: flex;
        align-items: flex-end;
        gap: 8px;
      }

      .avatar {
        width: 28px;
        height: 28px;
        border-radius: 50%;
        flex-shrink: 0;
        overflow: hidden;
        background: var(--alx-chat-primary-muted);
        display: flex;
        align-items: center;
        justify-content: center;
      }

      .avatar img {
        width: 100%;
        height: 100%;
        object-fit: cover;
      }

      .avatar .initial {
        font-size: 12px;
        font-weight: 700;
        color: var(--alx-chat-primary-text);
        text-transform: uppercase;
      }

      .avatar svg {
        color: var(--alx-chat-primary-text);
      }

      .bubble {
        display: flex;
        align-items: center;
        gap: 5px;
        padding: 14px 18px;
        background: var(--alx-chat-surface);
        border: 1px solid var(--alx-chat-border);
        border-radius: 18px 18px 18px 6px;
      }

      .dot {
        width: 7px;
        height: 7px;
        border-radius: 50%;
        background: var(--alx-chat-text-muted);
        animation: alx-wave 1.4s ease-in-out infinite;
      }

      .dot:nth-child(1) {
        animation-delay: 0s;
      }
      .dot:nth-child(2) {
        animation-delay: 0.15s;
      }
      .dot:nth-child(3) {
        animation-delay: 0.3s;
      }

      .label {
        font-size: 11px;
        color: var(--alx-chat-text-muted);
        font-style: italic;
        margin-top: 4px;
        margin-left: 36px;
      }
    `,
  ];

  @property({ type: String }) agentName = '';
  @property({ type: String }) agentAvatar = '';

  private _renderAvatar() {
    if (this.agentAvatar) {
      return html`<img src=${this.agentAvatar} alt="">`;
    }
    if (this.agentName) {
      return html`<span class="initial">${this.agentName.charAt(0)}</span>`;
    }
    return svg`<svg width="14" height="14" viewBox="0 0 20 20" fill="none">
      <circle cx="10" cy="7" r="3.5" stroke="currentColor" stroke-width="1.5"/>
      <path d="M3 17.5C3 14 6 12 10 12C14 12 17 14 17 17.5" stroke="currentColor" stroke-width="1.5" stroke-linecap="round"/>
    </svg>`;
  }

  render() {
    return html`
      <div class="typing-row">
        <div class="avatar">
          ${this._renderAvatar()}
        </div>
        <div class="bubble">
          <span class="dot"></span>
          <span class="dot"></span>
          <span class="dot"></span>
        </div>
      </div>
      <div class="label">${this.agentName || 'Someone'} is typing...</div>
    `;
  }
}

safeRegister('alx-chat-typing', AlxChatTyping);
