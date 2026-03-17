import { LitElement, html, css, nothing } from 'lit';
import { property } from 'lit/decorators.js';
import { classMap } from 'lit/directives/class-map.js';
import { chatResetStyles, chatBaseStyles } from '../styles/shared.js';
import { safeRegister } from '../utils/safe-register.js';

/**
 * <alx-chat-welcome> -- Welcome screen, first step of the pre-chat flow.
 *
 * Shows a title, subtitle, optional agent avatar + name,
 * online status indicator, and a CTA button.
 */
export class AlxChatWelcome extends LitElement {
  static styles = [
    chatResetStyles,
    chatBaseStyles,
    css`
      :host {
        display: block;
        height: 100%;
      }

      .welcome-container {
        display: flex;
        flex-direction: column;
        align-items: center;
        justify-content: center;
        text-align: center;
        padding: 40px 24px;
        height: 100%;
        animation: fadeInUp 0.4s ease;
      }

      @keyframes fadeInUp {
        from {
          opacity: 0;
          transform: translateY(12px);
        }
        to {
          opacity: 1;
          transform: translateY(0);
        }
      }

      .avatar-wrapper {
        position: relative;
        margin-bottom: 20px;
      }

      .avatar {
        width: 72px;
        height: 72px;
        border-radius: 50%;
        background: var(--alx-chat-surface);
        border: 3px solid var(--alx-chat-border);
        display: flex;
        align-items: center;
        justify-content: center;
        overflow: hidden;
      }

      .avatar img {
        width: 100%;
        height: 100%;
        object-fit: cover;
        border-radius: 50%;
      }

      .avatar svg {
        width: 36px;
        height: 36px;
        fill: var(--alx-chat-text-muted);
      }

      .status-dot {
        position: absolute;
        bottom: 2px;
        right: 2px;
        width: 14px;
        height: 14px;
        border-radius: 50%;
        border: 3px solid var(--alx-chat-bg);
      }

      .status-dot.online {
        background: var(--alx-chat-success);
      }

      .status-dot.offline {
        background: var(--alx-chat-text-muted);
      }

      .agent-name {
        font-size: 13px;
        color: var(--alx-chat-text-muted);
        margin-bottom: 8px;
        font-weight: 500;
      }

      .title {
        font-size: 22px;
        font-weight: 700;
        color: var(--alx-chat-text);
        margin-bottom: 8px;
        line-height: 1.3;
      }

      .subtitle {
        font-size: 14px;
        color: var(--alx-chat-text-muted);
        margin-bottom: 32px;
        line-height: 1.5;
        max-width: 280px;
      }

      .cta-button {
        display: inline-flex;
        align-items: center;
        gap: 8px;
        padding: 14px 32px;
        border: none;
        border-radius: var(--alx-chat-radius);
        background: var(--alx-chat-primary);
        color: var(--alx-chat-primary-text);
        font-family: var(--alx-chat-font);
        font-size: 15px;
        font-weight: 600;
        cursor: pointer;
        transition: all 0.2s ease;
        box-shadow: var(--alx-chat-shadow-sm);
      }

      .cta-button:hover {
        background: var(--alx-chat-primary-hover);
        transform: translateY(-1px);
        box-shadow: var(--alx-chat-shadow);
      }

      .cta-button:active {
        transform: translateY(0);
      }

      .cta-button svg {
        width: 18px;
        height: 18px;
        fill: currentColor;
      }

      .skip-link {
        margin-top: 16px;
        background: none;
        border: none;
        color: var(--alx-chat-text-muted);
        font-family: var(--alx-chat-font);
        font-size: 13px;
        cursor: pointer;
        padding: 4px 8px;
        transition: color 0.2s ease;
        text-decoration: underline;
        text-underline-offset: 2px;
      }

      .skip-link:hover {
        color: var(--alx-chat-text);
      }
    `,
  ];

  @property() title = 'Welcome';
  @property() subtitle = '';
  @property() agentAvatar = '';
  @property() agentName = '';
  @property({ type: Boolean }) showOnlineStatus = false;
  @property({ type: Boolean }) isOnline = true;
  @property() ctaText = 'Start Chat';
  @property({ type: Boolean }) canSkipToChat = false;

  render() {
    const dotClasses = {
      'status-dot': true,
      online: this.isOnline,
      offline: !this.isOnline,
    };

    return html`
      <div class="welcome-container">
        <div class="avatar-wrapper">
          <div class="avatar">
            ${this.agentAvatar
              ? html`<img src=${this.agentAvatar} alt=${this.agentName || 'Agent'} />`
              : html`
                  <svg viewBox="0 0 24 24">
                    <path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2"/>
                    <circle cx="12" cy="7" r="4"/>
                  </svg>
                `}
          </div>
          ${this.showOnlineStatus
            ? html`<span class=${classMap(dotClasses)}></span>`
            : nothing}
        </div>

        ${this.agentName
          ? html`<div class="agent-name">${this.agentName}</div>`
          : nothing}

        <h2 class="title">${this.title}</h2>

        ${this.subtitle
          ? html`<p class="subtitle">${this.subtitle}</p>`
          : nothing}

        <button class="cta-button" @click=${this.handleCta}>
          <svg viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg">
            <path d="M21 11.5a8.38 8.38 0 0 1-.9 3.8 8.5 8.5 0 0 1-7.6 4.7 8.38 8.38 0 0 1-3.8-.9L3 21l1.9-5.7a8.38 8.38 0 0 1-.9-3.8 8.5 8.5 0 0 1 4.7-7.6 8.38 8.38 0 0 1 3.8-.9h.5a8.48 8.48 0 0 1 8 8v.5z"/>
          </svg>
          ${this.ctaText}
        </button>

        ${this.canSkipToChat
          ? html`
              <button class="skip-link" @click=${this.handleSkip}>
                Skip to chat
              </button>
            `
          : nothing}
      </div>
    `;
  }

  private handleCta() {
    this.dispatchEvent(
      new CustomEvent('step-complete', { bubbles: true, composed: true }),
    );
  }

  private handleSkip() {
    this.dispatchEvent(
      new CustomEvent('skip-to-chat', { bubbles: true, composed: true }),
    );
  }
}

safeRegister('alx-chat-welcome', AlxChatWelcome);
