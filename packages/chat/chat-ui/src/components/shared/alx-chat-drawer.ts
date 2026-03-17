import { LitElement, html, css } from 'lit';
import { property } from 'lit/decorators.js';
import { safeRegister } from '../../utils/safe-register.js';
import {
  alxChatResetStyles,
  alxChatThemeStyles,
  alxChatDensityStyles,
  alxChatButtonStyles,
} from '../../styles/shared.js';

export class AlxChatDrawer extends LitElement {
  static styles = [
    alxChatResetStyles,
    alxChatThemeStyles,
    alxChatDensityStyles,
    alxChatButtonStyles,
    css`
      :host {
        display: contents;
      }

      .backdrop {
        position: fixed;
        inset: 0;
        background: rgba(0, 0, 0, 0.3);
        z-index: 999;
        opacity: 0;
        transition: opacity 0.2s ease;
        pointer-events: none;
      }

      .backdrop.open {
        opacity: 1;
        pointer-events: auto;
      }

      .drawer {
        position: fixed;
        top: 0;
        right: 0;
        bottom: 0;
        width: var(--alx-chat-drawer-width, 480px);
        max-width: 90vw;
        background: var(--alx-bg, #0f1117);
        box-shadow: -4px 0 24px rgba(0, 0, 0, 0.12);
        z-index: 1000;
        transform: translateX(100%);
        transition: transform 0.25s cubic-bezier(0.4, 0, 0.2, 1);
        display: flex;
        flex-direction: column;
        overflow: hidden;
      }

      .drawer.open {
        transform: translateX(0);
      }

      .drawer-header {
        display: flex;
        align-items: center;
        justify-content: space-between;
        padding: 0.75rem 1rem;
        border-bottom: 1px solid var(--alx-border, #2a2d37);
        background: var(--alx-surface, #181a20);
        flex-shrink: 0;
      }

      .drawer-title {
        font-size: 1rem;
        font-weight: 600;
        color: var(--alx-text, #e1e4ea);
        margin: 0;
      }

      .close-btn {
        background: none;
        border: none;
        color: var(--alx-text-muted, #8b8fa3);
        cursor: pointer;
        padding: 0.25rem;
        font-size: 1.25rem;
        line-height: 1;
        border-radius: 4px;
        display: flex;
        align-items: center;
        justify-content: center;
      }

      .close-btn:hover {
        color: var(--alx-text, #e1e4ea);
        background: color-mix(in srgb, var(--alx-text, #e1e4ea) 8%, transparent);
      }

      .drawer-body {
        flex: 1;
        overflow-y: auto;
        overflow-x: hidden;
        padding: 1rem;
      }
    `,
  ];

  @property({ type: Boolean, reflect: true }) open = false;
  @property({ type: String }) heading = '';
  @property({ type: String }) width = '480px';

  private _onBackdropClick(): void {
    this._close();
  }

  private _close(): void {
    this.open = false;
    this.dispatchEvent(
      new CustomEvent('alx-drawer-closed', { bubbles: true, composed: true }),
    );
  }

  private _onKeyDown = (e: KeyboardEvent): void => {
    if (e.key === 'Escape' && this.open) this._close();
  };

  connectedCallback(): void {
    super.connectedCallback();
    document.addEventListener('keydown', this._onKeyDown);
  }

  disconnectedCallback(): void {
    super.disconnectedCallback();
    document.removeEventListener('keydown', this._onKeyDown);
  }

  updated(changed: Map<string, unknown>): void {
    if (changed.has('width')) {
      this.style.setProperty('--alx-chat-drawer-width', this.width);
    }
  }

  render() {
    return html`
      <div
        class="backdrop ${this.open ? 'open' : ''}"
        @click=${this._onBackdropClick}
      ></div>
      <div class="drawer ${this.open ? 'open' : ''}">
        <div class="drawer-header">
          <h2 class="drawer-title">${this.heading}</h2>
          <button class="close-btn" @click=${this._close} title="Close">
            &times;
          </button>
        </div>
        <div class="drawer-body">
          <slot></slot>
        </div>
      </div>
    `;
  }
}

safeRegister('alx-chat-drawer', AlxChatDrawer);

declare global {
  interface HTMLElementTagNameMap {
    'alx-chat-drawer': AlxChatDrawer;
  }
}
