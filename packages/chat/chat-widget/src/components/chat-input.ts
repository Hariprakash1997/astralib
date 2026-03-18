import { LitElement, html, css, nothing } from 'lit';
import { property, state, query } from 'lit/decorators.js';
import {
  chatResetStyles,
  chatBaseStyles,
  chatAnimations,
} from '../styles/shared.js';
import { safeRegister } from '../utils/safe-register.js';

const TYPING_DEBOUNCE_MS = 2000;

export class AlxChatInput extends LitElement {
  static styles = [
    chatResetStyles,
    chatBaseStyles,
    chatAnimations,
    css`
      :host {
        display: block;
      }

      .input-container {
        display: flex;
        align-items: flex-end;
        gap: 10px;
        padding: 12px 16px;
        border-top: 1px solid var(--alx-chat-border);
        background: var(--alx-chat-surface);
      }

      /* -- Attachment button -- */

      .attach-btn {
        width: 40px;
        height: 40px;
        border-radius: 12px;
        background: transparent;
        border: none;
        color: var(--alx-chat-text-muted);
        cursor: pointer;
        display: flex;
        align-items: center;
        justify-content: center;
        flex-shrink: 0;
        transition: background 0.15s, color 0.15s;
      }

      .attach-btn:hover {
        background: var(--alx-chat-surface-alt);
        color: var(--alx-chat-text);
      }

      .attach-btn:active {
        transform: scale(0.9);
      }

      /* -- Input wrapper (relative container for textarea + send btn) -- */

      .input-wrapper {
        position: relative;
        flex: 1;
      }

      /* -- Textarea -- */

      textarea {
        width: 100%;
        min-height: 44px;
        max-height: 120px;
        padding: 11px 48px 11px 16px;
        border: 1.5px solid var(--alx-chat-border);
        border-radius: 22px;
        background: var(--alx-chat-bg);
        color: var(--alx-chat-text);
        font-size: 14px;
        font-family: var(--alx-chat-font);
        line-height: 1.5;
        resize: none;
        outline: none;
        overflow-y: auto;
        transition: border-color 0.2s var(--alx-chat-spring-smooth), box-shadow 0.2s var(--alx-chat-spring-smooth);
      }

      textarea:focus {
        border-color: var(--alx-chat-primary);
        box-shadow: 0 0 0 3px var(--alx-chat-primary-light);
      }

      textarea::placeholder {
        color: var(--alx-chat-text-muted);
        opacity: 0.7;
      }

      textarea:disabled {
        opacity: 0.5;
        cursor: not-allowed;
      }

      /* Thin scrollbar */
      textarea::-webkit-scrollbar {
        width: 5px;
      }

      textarea::-webkit-scrollbar-track {
        background: transparent;
      }

      textarea::-webkit-scrollbar-thumb {
        background: var(--alx-chat-border);
        border-radius: 3px;
      }

      /* -- Send button (inside textarea wrapper) -- */

      .send-btn {
        position: absolute;
        right: 4px;
        bottom: 4px;
        width: 36px;
        height: 36px;
        border-radius: 50%;
        border: none;
        cursor: pointer;
        display: flex;
        align-items: center;
        justify-content: center;
        transition: background 0.2s, transform 0.15s
          var(--alx-chat-spring-snappy);
      }

      .send-btn.empty {
        background: transparent;
        color: var(--alx-chat-text-muted);
        cursor: default;
        pointer-events: none;
      }

      .send-btn.has-text {
        background: var(--alx-chat-primary);
        color: var(--alx-chat-primary-text);
        animation: alx-scaleIn 0.2s var(--alx-chat-spring-bounce);
      }

      .send-btn.has-text:hover {
        background: var(--alx-chat-primary-hover);
      }

      .send-btn.has-text:active {
        transform: scale(0.9);
      }
    `,
  ];

  @property() placeholder = 'Type a message...';
  @property({ type: Boolean }) disabled = false;
  @property({ type: Boolean, attribute: 'show-attach' }) showAttach = false;

  @state() private value = '';

  @query('textarea') private textarea!: HTMLTextAreaElement;

  private typingTimer: ReturnType<typeof setTimeout> | null = null;
  private isCurrentlyTyping = false;

  render() {
    const hasText = this.value.trim().length > 0;

    return html`
      <div class="input-container">
        ${this.showAttach
          ? html`
              <button
                class="attach-btn"
                @click=${this.handleAttachClick}
                aria-label="Attach file"
              >
                <svg
                  width="20"
                  height="20"
                  viewBox="0 0 20 20"
                  fill="none"
                >
                  <line
                    x1="10"
                    y1="4"
                    x2="10"
                    y2="16"
                    stroke="currentColor"
                    stroke-width="2"
                    stroke-linecap="round"
                  />
                  <line
                    x1="4"
                    y1="10"
                    x2="16"
                    y2="10"
                    stroke="currentColor"
                    stroke-width="2"
                    stroke-linecap="round"
                  />
                </svg>
              </button>
            `
          : nothing}
        <div class="input-wrapper">
          <textarea
            rows="1"
            .value=${this.value}
            placeholder=${this.placeholder}
            ?disabled=${this.disabled}
            aria-label="Type a message"
            role="textbox"
            @input=${this.handleInput}
            @keydown=${this.handleKeydown}
          ></textarea>
          <button
            class="send-btn ${hasText ? 'has-text' : 'empty'}"
            @click=${this.handleSend}
            aria-label="Send message"
          >
            <svg
              width="18"
              height="18"
              viewBox="0 0 18 18"
              fill="none"
            >
              <path
                d="M3 9L15 3L12 15L9.5 10.5L3 9Z"
                fill="currentColor"
              />
              <path
                d="M9.5 10.5L15 3"
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

  focus() {
    this.textarea?.focus();
  }

  clear() {
    this.value = '';
    this.autoResize();
  }

  private handleAttachClick() {
    this.dispatchEvent(
      new CustomEvent('attach-click', { bubbles: true, composed: true }),
    );
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
    ta.style.height = `${Math.min(ta.scrollHeight, 120)}px`;
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
