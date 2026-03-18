import { LitElement, html, css, nothing } from 'lit';
import { property, state } from 'lit/decorators.js';
import {
  chatResetStyles,
  chatBaseStyles,
  chatAnimations,
} from '../styles/shared.js';
import { safeRegister } from '../utils/safe-register.js';

export class AlxChatLauncher extends LitElement {
  static styles = [
    chatResetStyles,
    chatBaseStyles,
    chatAnimations,
    css`
      :host {
        display: block;
        animation: alx-fadeInUp 0.5s var(--alx-chat-spring-bounce);
        animation-delay: 1.5s;
        animation-fill-mode: both;
      }

      .launcher {
        width: 56px;
        height: 56px;
        border-radius: 50%;
        border: none;
        background: var(--alx-chat-primary);
        color: var(--alx-chat-primary-text);
        cursor: pointer;
        display: flex;
        align-items: center;
        justify-content: center;
        box-shadow: 0 4px 16px rgba(0, 0, 0, 0.25);
        transition: transform 0.2s var(--alx-chat-spring-bounce),
          box-shadow 0.2s ease;
        z-index: 10000;
        position: relative;
      }

      .launcher:hover {
        transform: scale(1.1);
        box-shadow: 0 6px 24px rgba(0, 0, 0, 0.3);
      }

      .launcher:active {
        transform: scale(0.96);
      }

      /* Icon transitions */
      .icon {
        position: absolute;
        transition: transform 0.25s var(--alx-chat-spring-bounce),
          opacity 0.15s ease;
      }

      .icon-chat {
        transform: rotate(0deg) scale(1);
        opacity: 1;
      }

      .icon-close {
        transform: rotate(-90deg) scale(0.5);
        opacity: 0;
      }

      :host([open]) .icon-chat {
        transform: rotate(90deg) scale(0.5);
        opacity: 0;
      }

      :host([open]) .icon-close {
        transform: rotate(90deg) scale(1);
        opacity: 1;
      }

      /* Badge */
      .badge {
        position: absolute;
        top: -4px;
        right: -4px;
        min-width: 20px;
        height: 20px;
        border-radius: 10px;
        background: var(--alx-chat-danger, #ef4444);
        color: #fff;
        font-size: 11px;
        font-weight: 700;
        display: flex;
        align-items: center;
        justify-content: center;
        padding: 0 5px;
        animation: alx-badgePulse 2s ease-in-out infinite;
        box-shadow: 0 2px 6px rgba(239, 68, 68, 0.4);
        pointer-events: none;
      }

      .badge-enter {
        animation: alx-scaleIn 0.3s var(--alx-chat-spring-bounce);
      }

      /* Tooltip */
      .tooltip {
        position: absolute;
        bottom: 8px;
        right: 68px;
        background: var(--alx-chat-surface);
        border: 1px solid var(--alx-chat-border);
        border-radius: 12px;
        padding: 12px;
        max-width: 260px;
        box-shadow: var(--alx-chat-shadow);
        animation: alx-slideInLeft 0.3s var(--alx-chat-spring-bounce);
        cursor: pointer;
        display: flex;
        align-items: center;
        gap: 10px;
      }

      :host([position='bottom-left']) .tooltip {
        right: auto;
        left: 68px;
      }

      .tooltip-arrow {
        position: absolute;
        right: -6px;
        bottom: 16px;
        width: 12px;
        height: 12px;
        background: var(--alx-chat-surface);
        border-right: 1px solid var(--alx-chat-border);
        border-bottom: 1px solid var(--alx-chat-border);
        transform: rotate(-45deg);
      }

      :host([position='bottom-left']) .tooltip-arrow {
        right: auto;
        left: -6px;
        border-right: none;
        border-bottom: none;
        border-left: 1px solid var(--alx-chat-border);
        border-top: 1px solid var(--alx-chat-border);
      }

      .tooltip-avatar {
        width: 32px;
        height: 32px;
        border-radius: 50%;
        background: var(--alx-chat-primary-muted);
        flex-shrink: 0;
        display: flex;
        align-items: center;
        justify-content: center;
        overflow: hidden;
      }

      .tooltip-avatar img {
        width: 100%;
        height: 100%;
        object-fit: cover;
      }

      .tooltip-avatar-initial {
        font-size: 13px;
        font-weight: 600;
        color: var(--alx-chat-primary-text);
      }

      .tooltip-text {
        min-width: 0;
        flex: 1;
      }

      .tooltip-name {
        font-size: 12px;
        font-weight: 600;
        color: var(--alx-chat-text);
      }

      .tooltip-message {
        font-size: 13px;
        color: var(--alx-chat-text-muted);
        white-space: nowrap;
        overflow: hidden;
        text-overflow: ellipsis;
        max-width: 180px;
      }

      .tooltip-close {
        width: 20px;
        height: 20px;
        border: none;
        background: transparent;
        color: var(--alx-chat-text-muted);
        cursor: pointer;
        padding: 0;
        flex-shrink: 0;
        display: flex;
        align-items: center;
        justify-content: center;
      }

      .tooltip-close:hover {
        color: var(--alx-chat-text);
      }

      /* Mobile responsive */
      @media (max-width: 480px) {
        .tooltip {
          max-width: 220px;
        }
      }
    `,
  ];

  @property({ type: Boolean, reflect: true }) open = false;
  @property({ reflect: true }) position: 'bottom-right' | 'bottom-left' =
    'bottom-right';
  @property({ type: Number }) unreadCount = 0;
  @property({ type: String }) lastMessageSender = '';
  @property({ type: String }) lastMessageText = '';
  @property({ type: String }) lastMessageAvatar = '';

  @state() private showTooltip = false;
  private tooltipTimer: ReturnType<typeof setTimeout> | null = null;
  private tooltipDismissTimer: ReturnType<typeof setTimeout> | null = null;

  override updated(changed: Map<string, unknown>) {
    if (changed.has('unreadCount') || changed.has('open')) {
      this.manageTooltip();
    }
  }

  override disconnectedCallback() {
    super.disconnectedCallback();
    this.clearTimers();
  }

  private clearTimers() {
    if (this.tooltipTimer !== null) {
      clearTimeout(this.tooltipTimer);
      this.tooltipTimer = null;
    }
    if (this.tooltipDismissTimer !== null) {
      clearTimeout(this.tooltipDismissTimer);
      this.tooltipDismissTimer = null;
    }
  }

  private manageTooltip() {
    this.clearTimers();

    if (this.unreadCount > 0 && !this.open && this.lastMessageText) {
      this.tooltipTimer = setTimeout(() => {
        this.showTooltip = true;

        this.tooltipDismissTimer = setTimeout(() => {
          this.showTooltip = false;
        }, 8000);
      }, 3000);
    } else {
      this.showTooltip = false;
    }
  }

  private dismissTooltip(e: Event) {
    e.stopPropagation();
    this.showTooltip = false;
    this.clearTimers();
  }

  private handleTooltipClick() {
    this.showTooltip = false;
    this.clearTimers();
    this.dispatchEvent(
      new CustomEvent('toggle', { bubbles: true, composed: true }),
    );
  }

  private handleClick() {
    this.showTooltip = false;
    this.clearTimers();
    this.dispatchEvent(
      new CustomEvent('toggle', { bubbles: true, composed: true }),
    );
  }

  private renderTooltipAvatar() {
    if (this.lastMessageAvatar) {
      return html`<img
        src=${this.lastMessageAvatar}
        alt=${this.lastMessageSender}
      />`;
    }
    const initial = this.lastMessageSender
      ? this.lastMessageSender.charAt(0).toUpperCase()
      : '?';
    return html`<span class="tooltip-avatar-initial">${initial}</span>`;
  }

  render() {
    return html`
      <button
        class="launcher"
        @click=${this.handleClick}
        aria-label=${this.open ? 'Close chat' : 'Open chat'}
        aria-expanded=${this.open}
      >
        <!-- Chat bubble icon -->
        <svg
          class="icon icon-chat"
          width="26"
          height="26"
          viewBox="0 0 26 26"
          fill="none"
        >
          <path
            d="M13 3C7.477 3 3 6.925 3 11.75c0 2.76 1.57 5.22 4.025 6.82-.15 1.46-.8 2.83-1.775 3.93a.5.5 0 00.375.85c2.25-.15 4.2-1.05 5.55-2.15.6.08 1.2.13 1.825.13 5.523 0 10-3.925 10-8.75S18.523 3 13 3z"
            fill="currentColor"
          />
          <circle
            cx="9"
            cy="11.5"
            r="1.25"
            fill="var(--alx-chat-primary-text)"
            opacity="0.9"
          />
          <circle
            cx="13"
            cy="11.5"
            r="1.25"
            fill="var(--alx-chat-primary-text)"
            opacity="0.9"
          />
          <circle
            cx="17"
            cy="11.5"
            r="1.25"
            fill="var(--alx-chat-primary-text)"
            opacity="0.9"
          />
        </svg>

        <!-- Close icon -->
        <svg
          class="icon icon-close"
          width="26"
          height="26"
          viewBox="0 0 26 26"
          fill="none"
        >
          <line
            x1="8"
            y1="8"
            x2="18"
            y2="18"
            stroke="currentColor"
            stroke-width="2"
            stroke-linecap="round"
          />
          <line
            x1="18"
            y1="8"
            x2="8"
            y2="18"
            stroke="currentColor"
            stroke-width="2"
            stroke-linecap="round"
          />
        </svg>

        ${!this.open && this.unreadCount > 0
          ? html`<span class="badge badge-enter"
              aria-label="${this.unreadCount} unread messages"
              >${this.unreadCount > 99 ? '99+' : this.unreadCount}</span
            >`
          : nothing}
      </button>

      ${this.showTooltip && !this.open
        ? html`
            <div class="tooltip" @click=${this.handleTooltipClick}>
              <div class="tooltip-avatar">${this.renderTooltipAvatar()}</div>
              <div class="tooltip-text">
                <div class="tooltip-name">${this.lastMessageSender}</div>
                <div class="tooltip-message">${this.lastMessageText}</div>
              </div>
              <button
                class="tooltip-close"
                @click=${this.dismissTooltip}
                aria-label="Dismiss notification"
              >
                <svg
                  width="12"
                  height="12"
                  viewBox="0 0 12 12"
                  fill="none"
                >
                  <line
                    x1="2"
                    y1="2"
                    x2="10"
                    y2="10"
                    stroke="currentColor"
                    stroke-width="1.5"
                    stroke-linecap="round"
                  />
                  <line
                    x1="10"
                    y1="2"
                    x2="2"
                    y2="10"
                    stroke="currentColor"
                    stroke-width="1.5"
                    stroke-linecap="round"
                  />
                </svg>
              </button>
              <div class="tooltip-arrow"></div>
            </div>
          `
        : nothing}
    `;
  }
}

safeRegister('alx-chat-launcher', AlxChatLauncher);
