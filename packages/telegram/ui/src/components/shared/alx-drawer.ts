import { LitElement, html, css } from 'lit';
import { property } from 'lit/decorators.js';
import { safeRegister } from '../../utils/safe-register.js';
import { alxBaseStyles } from '../../styles/theme.js';
import { alxDensityStyles, alxButtonStyles } from '../../styles/shared.js';
import { iconClose } from '../../utils/icons.js';

export class AlxTgDrawer extends LitElement {
  static override styles = [
    alxBaseStyles,
    alxDensityStyles,
    alxButtonStyles,
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
        width: var(--alx-drawer-width, min(520px, 90vw));
        background: var(--alx-bg);
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
        border-bottom: 1px solid var(--alx-border);
        background: var(--alx-surface);
        flex-shrink: 0;
      }

      .drawer-title {
        font-size: 1rem;
        font-weight: 600;
        color: var(--alx-text);
        margin: 0;
      }

      .close-btn {
        background: none;
        border: none;
        color: var(--alx-text-muted);
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
        color: var(--alx-text);
        background: color-mix(in srgb, var(--alx-text) 8%, transparent);
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

  override connectedCallback(): void {
    super.connectedCallback();
    document.addEventListener('keydown', this._onKeyDown);
  }

  override disconnectedCallback(): void {
    super.disconnectedCallback();
    document.removeEventListener('keydown', this._onKeyDown);
  }

  override render() {
    return html`
      <div
        class="backdrop ${this.open ? 'open' : ''}"
        @click=${this._onBackdropClick}
      ></div>
      <div class="drawer ${this.open ? 'open' : ''}">
        <div class="drawer-header">
          <h2 class="drawer-title">${this.heading}</h2>
          <button class="close-btn" @click=${this._close} title="Close">
            ${iconClose(18)}
          </button>
        </div>
        <div class="drawer-body">
          <slot></slot>
        </div>
      </div>
    `;
  }
}
safeRegister('alx-tg-drawer', AlxTgDrawer);

declare global {
  interface HTMLElementTagNameMap {
    'alx-tg-drawer': AlxTgDrawer;
  }
}
