import { LitElement, html, css } from 'lit';
import { property, state, query } from 'lit/decorators.js';
import { chatResetStyles, chatBaseStyles } from '../styles/shared.js';
import { safeRegister } from '../utils/safe-register.js';

const TYPING_DEBOUNCE_MS = 2000;
const MAX_ROWS = 4;

export class AlxChatInput extends LitElement {
  static styles = [
    chatResetStyles,
    chatBaseStyles,
    css`
      :host {
        display: block;
      }

      .input-container {
        display: flex;
        align-items: flex-end;
        gap: 8px;
        padding: 12px 16px;
        border-top: 1px solid var(--alx-chat-border);
        background: var(--alx-chat-bg);
      }

      .textarea-wrapper {
        flex: 1;
        position: relative;
      }

      textarea {
        width: 100%;
        min-height: 40px;
        max-height: calc(var(--alx-chat-font-size, 14px) * 1.5 * ${MAX_ROWS} + 20px);
        padding: 10px 14px;
        border: 1px solid var(--alx-chat-border);
        border-radius: 20px;
        background: var(--alx-chat-surface);
        color: var(--alx-chat-text);
        font-family: var(--alx-chat-font);
        font-size: var(--alx-chat-font-size);
        line-height: 1.5;
        resize: none;
        outline: none;
        overflow-y: auto;
        transition: border-color 0.15s;
      }

      textarea:focus {
        border-color: var(--alx-chat-primary);
      }

      textarea::placeholder {
        color: var(--alx-chat-text-muted);
        opacity: 0.7;
      }

      textarea:disabled {
        opacity: 0.5;
        cursor: not-allowed;
      }

      .send-btn {
        display: flex;
        align-items: center;
        justify-content: center;
        width: 40px;
        height: 40px;
        border: none;
        border-radius: 50%;
        background: var(--alx-chat-primary);
        color: var(--alx-chat-primary-text);
        cursor: pointer;
        transition: background 0.15s, transform 0.1s;
        flex-shrink: 0;
      }

      .send-btn:hover:not(:disabled) {
        background: var(--alx-chat-primary-hover);
      }

      .send-btn:active:not(:disabled) {
        transform: scale(0.94);
      }

      .send-btn:disabled {
        opacity: 0.4;
        cursor: not-allowed;
      }

      .send-btn svg {
        width: 18px;
        height: 18px;
        fill: currentColor;
      }
    `,
  ];

  @property() placeholder = 'Type a message...';
  @property({ type: Boolean }) disabled = false;

  @state() private value = '';

  @query('textarea') private textarea!: HTMLTextAreaElement;

  private typingTimer: ReturnType<typeof setTimeout> | null = null;
  private isCurrentlyTyping = false;

  render() {
    return html`
      <div class="input-container">
        <div class="textarea-wrapper">
          <textarea
            rows="1"
            .value=${this.value}
            placeholder=${this.placeholder}
            ?disabled=${this.disabled}
            @input=${this.handleInput}
            @keydown=${this.handleKeydown}
          ></textarea>
        </div>
        <button
          class="send-btn"
          ?disabled=${this.disabled || !this.value.trim()}
          @click=${this.handleSend}
          aria-label="Send message"
        >
          <svg viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg">
            <path d="M2.01 21L23 12 2.01 3 2 10l15 2-15 2z"/>
          </svg>
        </button>
      </div>
    `;
  }

  focus() {
    this.textarea?.focus();
  }

  clear() {
    this.value = '';
    this.autoResize();
  }

  private handleInput(e: Event) {
    const target = e.target as HTMLTextAreaElement;
    this.value = target.value;
    this.autoResize();
    this.emitTyping(true);
  }

  private handleKeydown(e: KeyboardEvent) {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      this.handleSend();
    }
  }

  private handleSend() {
    const trimmed = this.value.trim();
    if (!trimmed || this.disabled) return;

    this.dispatchEvent(
      new CustomEvent('send', {
        detail: { content: trimmed },
        bubbles: true,
        composed: true,
      }),
    );

    this.value = '';
    this.emitTyping(false);

    // Reset textarea height
    requestAnimationFrame(() => this.autoResize());
  }

  private autoResize() {
    const ta = this.textarea;
    if (!ta) return;
    ta.style.height = 'auto';
    ta.style.height = `${Math.min(ta.scrollHeight, ta.clientHeight + 200)}px`;
  }

  private emitTyping(isTyping: boolean) {
    if (this.typingTimer) {
      clearTimeout(this.typingTimer);
      this.typingTimer = null;
    }

    if (isTyping && !this.isCurrentlyTyping) {
      this.isCurrentlyTyping = true;
      this.dispatchEvent(
        new CustomEvent('typing', {
          detail: { isTyping: true },
          bubbles: true,
          composed: true,
        }),
      );
    }

    if (isTyping) {
      this.typingTimer = setTimeout(() => {
        this.isCurrentlyTyping = false;
        this.dispatchEvent(
          new CustomEvent('typing', {
            detail: { isTyping: false },
            bubbles: true,
            composed: true,
          }),
        );
      }, TYPING_DEBOUNCE_MS);
    } else if (this.isCurrentlyTyping) {
      this.isCurrentlyTyping = false;
      this.dispatchEvent(
        new CustomEvent('typing', {
          detail: { isTyping: false },
          bubbles: true,
          composed: true,
        }),
      );
    }
  }

  disconnectedCallback() {
    super.disconnectedCallback();
    if (this.typingTimer) {
      clearTimeout(this.typingTimer);
    }
  }
}

safeRegister('alx-chat-input', AlxChatInput);
