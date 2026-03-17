import { LitElement, html, css, nothing } from 'lit';
import { property } from 'lit/decorators.js';
import { classMap } from 'lit/directives/class-map.js';
import { chatResetStyles, chatBaseStyles } from '../styles/shared.js';
import { safeRegister } from '../utils/safe-register.js';

export class AlxChatLauncher extends LitElement {
  static styles = [
    chatResetStyles,
    chatBaseStyles,
    css`
      :host {
        display: block;
      }

      .launcher {
        position: fixed;
        bottom: 16px;
        width: 56px;
        height: 56px;
        border: none;
        border-radius: 50%;
        background: var(--alx-chat-primary);
        color: var(--alx-chat-primary-text);
        cursor: pointer;
        box-shadow: 0 4px 16px rgba(0, 0, 0, 0.25);
        display: flex;
        align-items: center;
        justify-content: center;
        transition: transform 0.2s ease, box-shadow 0.2s ease;
        z-index: 10000;
      }

      .launcher:hover {
        transform: scale(1.08);
        box-shadow: 0 6px 24px rgba(0, 0, 0, 0.3);
      }

      .launcher:active {
        transform: scale(0.96);
      }

      .launcher.bottom-right {
        right: 16px;
      }

      .launcher.bottom-left {
        left: 16px;
      }

      .launcher svg {
        width: 26px;
        height: 26px;
        fill: currentColor;
        transition: transform 0.25s ease, opacity 0.2s ease;
      }

      .launcher .icon-chat {
        position: absolute;
      }

      .launcher .icon-close {
        position: absolute;
      }

      .launcher.open .icon-chat {
        transform: rotate(90deg) scale(0);
        opacity: 0;
      }

      .launcher:not(.open) .icon-close {
        transform: rotate(-90deg) scale(0);
        opacity: 0;
      }

      .launcher.open .icon-close {
        transform: rotate(0) scale(1);
        opacity: 1;
      }

      .launcher:not(.open) .icon-chat {
        transform: rotate(0) scale(1);
        opacity: 1;
      }

      .badge {
        position: absolute;
        top: -4px;
        right: -4px;
        min-width: 20px;
        height: 20px;
        padding: 0 6px;
        border-radius: 10px;
        background: #ef4444;
        color: #ffffff;
        font-size: 11px;
        font-weight: 700;
        display: flex;
        align-items: center;
        justify-content: center;
        pointer-events: none;
        animation: badgePop 0.3s ease;
      }

      @keyframes badgePop {
        0% { transform: scale(0); }
        60% { transform: scale(1.2); }
        100% { transform: scale(1); }
      }

      /* Mobile responsive */
      @media (max-width: 480px) {
        .launcher {
          bottom: 12px;
        }
        .launcher.bottom-right {
          right: 12px;
        }
        .launcher.bottom-left {
          left: 12px;
        }
      }
    `,
  ];

  @property({ type: Boolean }) open = false;
  @property() position: 'bottom-right' | 'bottom-left' = 'bottom-right';
  @property({ type: Number }) unreadCount = 0;

  render() {
    const launcherClasses = {
      launcher: true,
      open: this.open,
      'bottom-right': this.position === 'bottom-right',
      'bottom-left': this.position === 'bottom-left',
    };

    return html`
      <button
        class=${classMap(launcherClasses)}
        @click=${this.handleClick}
        aria-label=${this.open ? 'Close chat' : 'Open chat'}
      >
        <!-- Chat icon -->
        <svg class="icon-chat" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg">
          <path d="M21 11.5a8.38 8.38 0 0 1-.9 3.8 8.5 8.5 0 0 1-7.6 4.7 8.38 8.38 0 0 1-3.8-.9L3 21l1.9-5.7a8.38 8.38 0 0 1-.9-3.8 8.5 8.5 0 0 1 4.7-7.6 8.38 8.38 0 0 1 3.8-.9h.5a8.48 8.48 0 0 1 8 8v.5z"/>
        </svg>
        <!-- Close icon -->
        <svg class="icon-close" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg">
          <path d="M18 6L6 18M6 6l12 12" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" fill="none"/>
        </svg>
        ${!this.open && this.unreadCount > 0
          ? html`<span class="badge">${this.unreadCount > 99 ? '99+' : this.unreadCount}</span>`
          : nothing}
      </button>
    `;
  }

  private handleClick() {
    this.dispatchEvent(
      new CustomEvent('toggle', { bubbles: true, composed: true }),
    );
  }
}

safeRegister('alx-chat-launcher', AlxChatLauncher);
