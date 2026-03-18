import { LitElement, html, css, nothing } from 'lit';
import { property } from 'lit/decorators.js';
import { classMap } from 'lit/directives/class-map.js';
import { chatResetStyles, chatBaseStyles, chatAnimations } from '../styles/shared.js';
import { safeRegister } from '../utils/safe-register.js';

export class AlxChatHeader extends LitElement {
  static styles = [
    chatResetStyles,
    chatBaseStyles,
    chatAnimations,
    css`
      :host {
        display: block;
      }

      .header {
        display: flex;
        align-items: center;
        gap: 12px;
        min-height: 64px;
        padding: 16px 20px;
        background: linear-gradient(
          135deg,
          var(--alx-chat-primary),
          color-mix(in srgb, var(--alx-chat-primary) 92%, #000)
        );
        color: var(--alx-chat-primary-text);
        border-radius: var(--alx-chat-radius) var(--alx-chat-radius) 0 0;
      }

      .avatar {
        width: 40px;
        height: 40px;
        border-radius: 50%;
        flex-shrink: 0;
        position: relative;
        border: 2.5px solid rgba(255, 255, 255, 0.3);
        overflow: hidden;
        background: rgba(255, 255, 255, 0.15);
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
        font-size: 16px;
        font-weight: 700;
        color: rgba(255, 255, 255, 0.9);
        text-transform: uppercase;
      }

      .status-dot {
        position: absolute;
        bottom: 0;
        right: 0;
        width: 12px;
        height: 12px;
        border-radius: 50%;
        border: 2.5px solid var(--alx-chat-primary);
      }

      .status-dot.connected {
        background: #22c55e;
        box-shadow: 0 0 0 3px rgba(34, 197, 94, 0.3);
        animation: alx-pulse 2s ease-in-out infinite;
      }

      .status-dot.reconnecting {
        background: #f59e0b;
      }

      .status-dot.connecting,
      .status-dot.disconnected {
        background: #6b7280;
      }

      .logo {
        height: 24px;
        width: auto;
        max-width: 80px;
        flex-shrink: 0;
      }

      .info {
        flex: 1;
        min-width: 0;
      }

      .agent-name {
        font-size: 15px;
        font-weight: 600;
        color: inherit;
        white-space: nowrap;
        overflow: hidden;
        text-overflow: ellipsis;
      }

      .status-text {
        font-size: 12px;
        color: inherit;
        opacity: 0.75;
        display: flex;
        align-items: center;
        gap: 4px;
      }

      .actions {
        display: flex;
        gap: 4px;
      }

      .action-btn {
        width: 34px;
        height: 34px;
        border-radius: 10px;
        border: none;
        background: rgba(255, 255, 255, 0.1);
        color: inherit;
        cursor: pointer;
        display: flex;
        align-items: center;
        justify-content: center;
        opacity: 0.85;
        transition: background 0.15s, opacity 0.15s, transform 0.1s;
      }

      .action-btn:hover {
        background: rgba(255, 255, 255, 0.2);
        opacity: 1;
      }

      .action-btn:active {
        transform: scale(0.92);
      }
    `,
  ];

  @property() agentName = 'Chat Support';
  @property() agentAvatar = '';
  @property({ type: String }) logoUrl = '';
  @property()
  connectionStatus:
    | 'disconnected'
    | 'connecting'
    | 'connected'
    | 'reconnecting' = 'disconnected';

  private renderAvatar() {
    // If logoUrl is provided and no agent name (AI-only / anonymous mode)
    if (this.logoUrl && !this.agentName) {
      return html`<img class="logo" src=${this.logoUrl} alt="Logo" />`;
    }

    const dotClasses = {
      'status-dot': true,
      [this.connectionStatus]: true,
    };

    return html`
      <div class="avatar">
        ${this.agentAvatar
          ? html`<img src=${this.agentAvatar} alt=${this.agentName} />`
          : this.agentName
            ? html`<span class="initial">${this.agentName[0]}</span>`
            : html`
                <svg
                  width="20"
                  height="20"
                  viewBox="0 0 20 20"
                  fill="none"
                  style="color: rgba(255,255,255,0.9)"
                >
                  <circle
                    cx="10"
                    cy="7"
                    r="3.5"
                    stroke="currentColor"
                    stroke-width="1.5"
                  />
                  <path
                    d="M3 17.5C3 14 6 12 10 12C14 12 17 14 17 17.5"
                    stroke="currentColor"
                    stroke-width="1.5"
                    stroke-linecap="round"
                  />
                </svg>
              `}
        <span class=${classMap(dotClasses)}></span>
      </div>
    `;
  }

  render() {
    const statusLabels: Record<string, string> = {
      connected: 'Online',
      connecting: 'Connecting...',
      reconnecting: 'Reconnecting...',
      disconnected: 'Offline',
    };

    return html`
      <div class="header">
        ${this.renderAvatar()}
        <div class="info">
          ${this.agentName
            ? html`<div class="agent-name">${this.agentName}</div>`
            : nothing}
          <div class="status-text">
            ${statusLabels[this.connectionStatus] ?? 'Offline'}
          </div>
        </div>
        <div class="actions">
          <button
            class="action-btn"
            @click=${this.handleMinimize}
            aria-label="Minimize chat"
            title="Minimize"
          >
            <svg width="16" height="16" viewBox="0 0 16 16" fill="none">
              <polyline
                points="4 6 8 10 12 6"
                stroke="currentColor"
                stroke-width="1.5"
                stroke-linecap="round"
                stroke-linejoin="round"
              />
            </svg>
          </button>
          <button
            class="action-btn"
            @click=${this.handleEndChat}
            aria-label="End chat"
            title="End chat"
          >
            <svg width="16" height="16" viewBox="0 0 16 16" fill="none">
              <line
                x1="4"
                y1="4"
                x2="12"
                y2="12"
                stroke="currentColor"
                stroke-width="1.5"
                stroke-linecap="round"
              />
              <line
                x1="12"
                y1="4"
                x2="4"
                y2="12"
                stroke="currentColor"
                stroke-width="1.5"
                stroke-linecap="round"
              />
            </svg>
          </button>
        </div>
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
}

safeRegister('alx-chat-header', AlxChatHeader);
