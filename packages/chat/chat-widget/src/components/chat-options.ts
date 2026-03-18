import { LitElement, html, css, nothing } from 'lit';
import { property, state } from 'lit/decorators.js';
import { classMap } from 'lit/directives/class-map.js';
import { chatResetStyles, chatBaseStyles, chatAnimations } from '../styles/shared.js';
import { safeRegister } from '../utils/safe-register.js';

export interface ChatOptionItem {
  value: string;
  label: string;
  icon?: string;
  description?: string;
}

/**
 * <alx-chat-options> -- reusable clickable option buttons/cards.
 * Used by guided questions, welcome screen, and agent selector.
 */
export class AlxChatOptions extends LitElement {
  static styles = [
    chatResetStyles,
    chatBaseStyles,
    chatAnimations,
    css`
      :host {
        display: block;
      }

      .options-container {
        display: flex;
        flex-direction: column;
        gap: 8px;
      }

      .options-container.grid {
        display: grid;
        grid-template-columns: repeat(auto-fill, minmax(140px, 1fr));
        gap: 10px;
      }

      .option-card {
        display: flex;
        align-items: center;
        gap: 10px;
        padding: 12px 16px;
        border: 1px solid var(--alx-chat-border);
        border-radius: var(--alx-chat-radius-sm);
        background: var(--alx-chat-surface);
        color: var(--alx-chat-text);
        cursor: pointer;
        transition: all 0.2s var(--alx-chat-spring-smooth);
        font-family: var(--alx-chat-font);
        font-size: var(--alx-chat-font-size);
        text-align: left;
        width: 100%;
      }

      .option-card:hover {
        background: var(--alx-chat-surface-hover);
        border-color: var(--alx-chat-primary);
        transform: translateY(-1px);
        box-shadow: var(--alx-chat-shadow-sm);
      }

      .option-card:active {
        transform: translateY(0);
      }

      .option-card.selected {
        border-color: var(--alx-chat-primary);
        background: color-mix(in srgb, var(--alx-chat-primary) 10%, var(--alx-chat-surface));
      }

      .option-icon {
        font-size: 20px;
        flex-shrink: 0;
        width: 28px;
        text-align: center;
      }

      .option-content {
        flex: 1;
        min-width: 0;
      }

      .option-label {
        font-weight: 500;
        line-height: 1.3;
      }

      .option-description {
        font-size: 12px;
        color: var(--alx-chat-text-muted);
        margin-top: 2px;
        line-height: 1.4;
      }

      .checkbox-indicator {
        width: 18px;
        height: 18px;
        border: 2px solid var(--alx-chat-border);
        border-radius: 4px;
        flex-shrink: 0;
        display: flex;
        align-items: center;
        justify-content: center;
        transition: all 0.15s var(--alx-chat-spring-smooth);
      }

      .option-card.selected .checkbox-indicator {
        background: var(--alx-chat-primary);
        border-color: var(--alx-chat-primary);
      }

      .checkbox-indicator svg {
        width: 12px;
        height: 12px;
        fill: none;
        stroke: var(--alx-chat-primary-text);
        stroke-width: 3;
        stroke-linecap: round;
        stroke-linejoin: round;
        opacity: 0;
        transition: opacity 0.15s;
      }

      .option-card.selected .checkbox-indicator svg {
        opacity: 1;
      }

      .confirm-btn {
        display: block;
        width: 100%;
        padding: 12px;
        margin-top: 8px;
        border: none;
        border-radius: var(--alx-chat-radius-sm);
        background: var(--alx-chat-primary);
        color: var(--alx-chat-primary-text);
        font-family: var(--alx-chat-font);
        font-size: var(--alx-chat-font-size);
        font-weight: 600;
        cursor: pointer;
        transition: background 0.2s var(--alx-chat-spring-smooth);
      }

      .confirm-btn:hover {
        background: var(--alx-chat-primary-hover);
      }

      .confirm-btn:disabled {
        opacity: 0.5;
        cursor: not-allowed;
      }
    `,
  ];

  @property({ type: Array }) options: ChatOptionItem[] = [];
  @property({ type: Boolean }) multiSelect = false;
  @property() confirmText = 'Continue';
  @property({ type: Boolean }) grid = false;

  @state() private selectedValues: Set<string> = new Set();

  render() {
    const containerClasses = {
      'options-container': true,
      grid: this.grid,
    };

    return html`
      <div class=${classMap(containerClasses)}>
        ${this.options.map((option) => this.renderOption(option))}
      </div>
      ${this.multiSelect && this.selectedValues.size > 0
        ? html`
            <button
              class="confirm-btn"
              @click=${this.handleConfirm}
            >
              ${this.confirmText}
            </button>
          `
        : nothing}
    `;
  }

  private renderOption(option: ChatOptionItem) {
    const isSelected = this.selectedValues.has(option.value);
    const classes = {
      'option-card': true,
      selected: isSelected,
    };

    return html`
      <button
        class=${classMap(classes)}
        @click=${() => this.handleOptionClick(option)}
      >
        ${this.multiSelect
          ? html`
              <span class="checkbox-indicator">
                <svg viewBox="0 0 24 24"><polyline points="20 6 9 17 4 12"/></svg>
              </span>
            `
          : nothing}
        ${option.icon
          ? html`<span class="option-icon">${option.icon}</span>`
          : nothing}
        <span class="option-content">
          <span class="option-label">${option.label}</span>
          ${option.description
            ? html`<span class="option-description">${option.description}</span>`
            : nothing}
        </span>
      </button>
    `;
  }

  private handleOptionClick(option: ChatOptionItem) {
    if (this.multiSelect) {
      const next = new Set(this.selectedValues);
      if (next.has(option.value)) {
        next.delete(option.value);
      } else {
        next.add(option.value);
      }
      this.selectedValues = next;
    } else {
      // Single select fires immediately
      this.dispatchEvent(
        new CustomEvent('option-selected', {
          detail: { value: option.value, option },
          bubbles: true,
          composed: true,
        }),
      );
    }
  }

  private handleConfirm() {
    const values = Array.from(this.selectedValues);
    this.dispatchEvent(
      new CustomEvent('option-selected', {
        detail: { value: values, options: values },
        bubbles: true,
        composed: true,
      }),
    );
  }
}

safeRegister('alx-chat-options', AlxChatOptions);
