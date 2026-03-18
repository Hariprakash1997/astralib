import { LitElement, html, css, nothing } from 'lit';
import { property } from 'lit/decorators.js';
import { classMap } from 'lit/directives/class-map.js';
import { chatResetStyles, chatBaseStyles, chatAnimations } from '../styles/shared.js';
import { safeRegister } from '../utils/safe-register.js';

/**
 * <alx-chat-welcome> -- Welcome screen, first step of the pre-chat flow.
 *
 * Shows a decorative wave, avatar with online status, title, subtitle,
 * CTA button, optional conversation starters, and a skip link.
 */
export class AlxChatWelcome extends LitElement {
  static styles = [
    chatResetStyles,
    chatBaseStyles,
    chatAnimations,
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
        position: relative;
        overflow: hidden;
      }

      .wave {
        position: absolute;
        top: 0;
        left: 0;
        width: 100%;
        height: 80px;
        color: var(--alx-chat-primary);
        opacity: 0.08;
        z-index: 0;
      }

      .avatar-wrapper {
        width: 72px;
        height: 72px;
        border-radius: 50%;
        background: var(--alx-chat-surface);
        border: 3px solid var(--alx-chat-border);
        overflow: hidden;
        position: relative;
        z-index: 1;
        margin-bottom: 20px;
        animation: alx-scaleIn 0.4s var(--alx-chat-spring-bounce);
        animation-delay: 0.1s;
        animation-fill-mode: both;
        display: flex;
        align-items: center;
        justify-content: center;
      }

      .avatar-wrapper img {
        width: 100%;
        height: 100%;
        object-fit: cover;
        border-radius: 50%;
      }

      .avatar-wrapper svg {
        width: 36px;
        height: 36px;
        fill: var(--alx-chat-text-muted);
      }

      .avatar-initial {
        font-size: 24px;
        font-weight: 700;
        color: var(--alx-chat-text);
        line-height: 1;
        user-select: none;
      }

      .online-dot {
        position: absolute;
        bottom: 2px;
        right: 2px;
        width: 14px;
        height: 14px;
        border-radius: 50%;
        border: 3px solid var(--alx-chat-bg);
        z-index: 2;
      }

      .online-dot.online {
        background: #22c55e;
      }

      .online-dot.offline {
        background: var(--alx-chat-text-muted);
      }

      .avatar-status-wrapper {
        position: relative;
        z-index: 1;
      }

      .agent-name {
        font-size: 13px;
        font-weight: 500;
        color: var(--alx-chat-text-muted);
        margin-bottom: 8px;
        animation: alx-fadeInUp 0.3s var(--alx-chat-spring-smooth);
        animation-delay: 0.15s;
        animation-fill-mode: both;
      }

      .title {
        font-size: 22px;
        font-weight: 700;
        color: var(--alx-chat-text);
        margin-bottom: 8px;
        line-height: 1.3;
        animation: alx-fadeInUp 0.3s var(--alx-chat-spring-smooth);
        animation-delay: 0.2s;
        animation-fill-mode: both;
      }

      .subtitle {
        font-size: 14px;
        color: var(--alx-chat-text-muted);
        margin-bottom: 32px;
        max-width: 280px;
        line-height: 1.5;
        animation: alx-fadeInUp 0.3s var(--alx-chat-spring-smooth);
        animation-delay: 0.25s;
        animation-fill-mode: both;
      }

      .cta {
        display: inline-flex;
        align-items: center;
        gap: 8px;
        padding: 14px 32px;
        border: none;
        border-radius: 12px;
        background: var(--alx-chat-primary);
        color: var(--alx-chat-primary-text);
        font-family: var(--alx-chat-font);
        font-size: 15px;
        font-weight: 600;
        cursor: pointer;
        box-shadow: var(--alx-chat-shadow-sm);
        transition: background 0.2s, transform 0.2s var(--alx-chat-spring-bounce),
          box-shadow 0.2s;
        animation: alx-fadeInUp 0.3s var(--alx-chat-spring-smooth);
        animation-delay: 0.3s;
        animation-fill-mode: both;
      }

      .cta:hover {
        background: var(--alx-chat-primary-hover);
        transform: translateY(-1px);
        box-shadow: var(--alx-chat-shadow);
      }

      .cta:active {
        transform: translateY(0);
      }

      .starters {
        margin-top: 24px;
        display: flex;
        flex-direction: column;
        gap: 8px;
        width: 100%;
        max-width: 300px;
      }

      .starter-chip {
        background: var(--alx-chat-surface);
        border: 1px solid var(--alx-chat-border);
        border-radius: 12px;
        padding: 10px 16px;
        font-family: var(--alx-chat-font);
        font-size: 13px;
        color: var(--alx-chat-text);
        cursor: pointer;
        text-align: left;
        transition: border-color 0.2s,
          transform 0.15s var(--alx-chat-spring-snappy);
        animation: alx-fadeInUp 0.2s var(--alx-chat-spring-smooth);
        animation-fill-mode: both;
      }

      .starter-chip:hover {
        border-color: var(--alx-chat-primary);
        transform: translateX(4px);
      }

      .starter-chip:active {
        transform: translateX(2px) scale(0.98);
      }

      .skip {
        margin-top: 16px;
        background: none;
        border: none;
        color: var(--alx-chat-text-muted);
        font-family: var(--alx-chat-font);
        font-size: 13px;
        cursor: pointer;
        text-decoration: underline;
        text-underline-offset: 2px;
        transition: color 0.2s;
      }

      .skip:hover {
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
  @property({ type: Array }) starters: string[] = [];

  render() {
    const dotClasses = {
      'online-dot': true,
      online: this.isOnline,
      offline: !this.isOnline,
    };

    return html`
      <div class="welcome-container">
        <svg class="wave" viewBox="0 0 400 80" preserveAspectRatio="none">
          <path
            d="M0 40 C100 80 200 0 300 40 C350 60 380 30 400 40 L400 0 L0 0 Z"
            fill="currentColor"
          />
        </svg>

        <div class="avatar-status-wrapper">
          <div class="avatar-wrapper">
            ${this._renderAvatarContent()}
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

        <button class="cta" @click=${this._handleCta}>
          <svg width="18" height="18" viewBox="0 0 18 18" fill="none">
            <path
              d="M9 2C5.134 2 2 4.686 2 8c0 1.886 1.07 3.567 2.748 4.663-.102 1-.546 1.936-1.213 2.687a.35.35 0 00.263.6c1.537-.103 2.87-.718 3.79-1.47.41.055.82.089 1.247.089C12.866 14.57 16 11.883 16 8.57 16 4.686 12.866 2 9 2z"
              fill="currentColor"
            />
          </svg>
          ${this.ctaText}
        </button>

        ${this.starters.length > 0
          ? html`
              <div class="starters">
                ${this.starters.slice(0, 4).map(
                  (text, i) => html`
                    <button
                      class="starter-chip"
                      style="animation-delay: ${0.4 + i * 0.1}s"
                      @click=${() => this._onStarterClick(text)}
                    >
                      ${text}
                    </button>
                  `,
                )}
              </div>
            `
          : nothing}

        ${this.canSkipToChat
          ? html`
              <button class="skip" @click=${this._handleSkip}>
                Skip to chat
              </button>
            `
          : nothing}
      </div>
    `;
  }

  private _renderAvatarContent() {
    if (this.agentAvatar) {
      return html`<img
        src=${this.agentAvatar}
        alt=${this.agentName || 'Agent'}
      />`;
    }

    if (this.agentName) {
      return html`<span class="avatar-initial"
        >${this.agentName.charAt(0).toUpperCase()}</span
      >`;
    }

    return html`
      <svg viewBox="0 0 24 24">
        <path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2" />
        <circle cx="12" cy="7" r="4" />
      </svg>
    `;
  }

  private _handleCta() {
    this.dispatchEvent(
      new CustomEvent('step-complete', { bubbles: true, composed: true }),
    );
  }

  private _handleSkip() {
    this.dispatchEvent(
      new CustomEvent('skip-to-chat', { bubbles: true, composed: true }),
    );
  }

  private _onStarterClick(text: string) {
    this.dispatchEvent(
      new CustomEvent('starter-selected', {
        bubbles: true,
        composed: true,
        detail: { text },
      }),
    );
  }
}

safeRegister('alx-chat-welcome', AlxChatWelcome);
