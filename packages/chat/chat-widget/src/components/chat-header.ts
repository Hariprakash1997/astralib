import { LitElement, html, css, nothing } from 'lit';
import { property } from 'lit/decorators.js';
import { classMap } from 'lit/directives/class-map.js';
import { chatResetStyles, chatBaseStyles } from '../styles/shared.js';
import { safeRegister } from '../utils/safe-register.js';

export class AlxChatHeader extends LitElement {
  static styles = [
    chatResetStyles,
    chatBaseStyles,
    css`
      :host {
        display: block;
      }

      .header {
        display: flex;
        align-items: center;
        gap: 10px;
        padding: 14px 16px;
        background: var(--alx-chat-primary);
        color: var(--alx-chat-primary-text);
        border-radius: var(--alx-chat-radius) var(--alx-chat-radius) 0 0;
        min-height: 56px;
      }

      .avatar {
        position: relative;
        width: 36px;
        height: 36px;
        border-radius: 50%;
        background: rgba(255, 255, 255, 0.2);
        display: flex;
        align-items: center;
        justify-content: center;
        flex-shrink: 0;
        overflow: hidden;
      }

      .avatar img {
        width: 100%;
        height: 100%;
        object-fit: cover;
        border-radius: 50%;
      }

      .avatar svg {
        width: 20px;
        height: 20px;
        fill: currentColor;
      }

      .status-dot {
        position: absolute;
        bottom: 0;
        right: 0;
        width: 10px;
        height: 10px;
        border-radius: 50%;
        border: 2px solid var(--alx-chat-primary);
      }

      .status-dot.connected {
        background: #22c55e;
      }

      .status-dot.reconnecting {
        background: #f59e0b;
      }

      .status-dot.disconnected,
      .status-dot.connecting {
        background: #9ca3af;
      }

      .info {
        flex: 1;
        min-width: 0;
      }

      .agent-name {
        font-size: 15px;
        font-weight: 600;
        white-space: nowrap;
        overflow: hidden;
        text-overflow: ellipsis;
      }

      .status-text {
        font-size: 12px;
        opacity: 0.85;
      }

      .actions {
        display: flex;
        align-items: center;
        gap: 4px;
      }

      .header-btn {
        display: flex;
        align-items: center;
        justify-content: center;
        width: 32px;
        height: 32px;
        border: none;
        border-radius: 8px;
        background: transparent;
        color: inherit;
        cursor: pointer;
        transition: background 0.15s;
        opacity: 0.85;
      }

      .header-btn:hover {
        background: rgba(255, 255, 255, 0.15);
        opacity: 1;
      }

      .header-btn svg {
        width: 18px;
        height: 18px;
        fill: none;
        stroke: currentColor;
        stroke-width: 2;
        stroke-linecap: round;
        stroke-linejoin: round;
      }
    `,
  ];

  @property() agentName = 'Chat Support';
  @property() agentAvatar = '';
  @property() connectionStatus: 'disconnected' | 'connecting' | 'connected' | 'reconnecting' = 'disconnected';

  render() {
    const statusLabels: Record<string, string> = {
      connected: 'Online',
      connecting: 'Connecting...',
      reconnecting: 'Reconnecting...',
      disconnected: 'Offline',
    };

    const dotClasses = {
      'status-dot': true,
      [this.connectionStatus]: true,
    };

    return html`
      <div class="header">
        <div class="avatar">
          ${this.agentAvatar
            ? html`<img src=${this.agentAvatar} alt=${this.agentName} />`
            : html`
              <svg viewBox="0 0 24 24">
                <path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2"/>
                <circle cx="12" cy="7" r="4"/>
              </svg>
            `}
          <span class=${classMap(dotClasses)}></span>
        </div>
        <div class="info">
          <div class="agent-name">${this.agentName}</div>
          <div class="status-text">${statusLabels[this.connectionStatus] ?? 'Offline'}</div>
        </div>
        <div class="actions">
          <button
            class="header-btn"
            @click=${this.handleMinimize}
            aria-label="Minimize chat"
            title="Minimize"
          >
            <svg viewBox="0 0 24 24">
              <polyline points="6 9 12 15 18 9"/>
            </svg>
          </button>
          <button
            class="header-btn"
            @click=${this.handleEndChat}
            aria-label="End chat"
            title="End chat"
          >
            <svg viewBox="0 0 24 24">
              <line x1="18" y1="6" x2="6" y2="18"/>
              <line x1="6" y1="6" x2="18" y2="18"/>
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
