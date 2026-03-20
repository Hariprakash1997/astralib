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

      /* -- Attach tooltip -- */

      .attach-btn-wrapper {
        position: relative;
        flex-shrink: 0;
      }

      .attach-tooltip {
        position: absolute;
        bottom: calc(100% + 6px);
        left: 50%;
        transform: translateX(-50%);
        padding: 4px 10px;
        border-radius: 6px;
        background: var(--alx-chat-surface-alt);
        color: var(--alx-chat-text);
        font-size: 11px;
        font-weight: 500;
        white-space: nowrap;
        pointer-events: none;
        opacity: 0;
        transition: opacity 0.15s;
        border: 1px solid var(--alx-chat-border);
      }

      .attach-btn-wrapper:hover .attach-tooltip {
        opacity: 1;
      }

      /* -- File preview bar -- */

      .file-preview {
        display: flex;
        align-items: center;
        gap: 8px;
        padding: 8px 12px;
        margin-bottom: 0;
        background: var(--alx-chat-surface);
        border: 1px solid var(--alx-chat-border);
        border-bottom: none;
        border-radius: 12px 12px 0 0;
        font-size: 12px;
        color: var(--alx-chat-text);
        animation: alx-fadeInUp 0.2s var(--alx-chat-spring-smooth);
      }

      .file-preview-icon {
        flex-shrink: 0;
        color: var(--alx-chat-primary);
      }

      .file-preview-name {
        flex: 1;
        overflow: hidden;
        text-overflow: ellipsis;
        white-space: nowrap;
        font-weight: 500;
      }

      .file-preview-size {
        color: var(--alx-chat-text-muted);
        flex-shrink: 0;
      }

      .file-preview-remove {
        background: none;
        border: none;
        color: var(--alx-chat-text-muted);
        cursor: pointer;
        padding: 2px;
        display: flex;
        align-items: center;
        flex-shrink: 0;
        transition: color 0.15s;
      }

      .file-preview-remove:hover {
        color: var(--alx-chat-danger);
      }

      /* -- File error -- */

      .file-error {
        display: flex;
        align-items: center;
        gap: 6px;
        padding: 8px 12px;
        font-size: 12px;
        color: var(--alx-chat-danger);
        background: color-mix(in srgb, var(--alx-chat-danger) 8%, var(--alx-chat-surface));
        border-top: 1px solid color-mix(in srgb, var(--alx-chat-danger) 25%, transparent);
        animation: alx-fadeInUp 0.2s var(--alx-chat-spring-smooth);
      }
    `,
  ];

  @property() placeholder = 'Type a message...';
  @property({ type: Boolean }) disabled = false;
  @property({ type: Boolean, attribute: 'show-attach' }) showAttach = false;
  @property({ type: Array }) allowedFileTypes: string[] = [];
  @property({ type: Number }) maxFileSizeMb = 5;

  @state() private value = '';
  @state() private pendingFile: { name: string; size: string } | null = null;
  @state() private fileError: string | null = null;

  @query('textarea') private textarea!: HTMLTextAreaElement;

  private typingTimer: ReturnType<typeof setTimeout> | null = null;
  private isCurrentlyTyping = false;

  render() {
    const hasText = this.value.trim().length > 0;

    return html`
      ${this.pendingFile ? html`
        <div class="file-preview">
          <svg class="file-preview-icon" width="16" height="16" viewBox="0 0 16 16" fill="none">
            <path d="M9 1H4a1 1 0 00-1 1v12a1 1 0 001 1h8a1 1 0 001-1V5L9 1z" stroke="currentColor" stroke-width="1.2" stroke-linecap="round" stroke-linejoin="round"/>
            <polyline points="9 1 9 5 13 5" stroke="currentColor" stroke-width="1.2" stroke-linecap="round" stroke-linejoin="round"/>
          </svg>
          <span class="file-preview-name">${this.pendingFile.name}</span>
          <span class="file-preview-size">${this.pendingFile.size}</span>
          <button class="file-preview-remove" @click=${this.clearPendingFile} aria-label="Remove file">
            <svg width="14" height="14" viewBox="0 0 14 14" fill="none">
              <line x1="4" y1="4" x2="10" y2="10" stroke="currentColor" stroke-width="1.5" stroke-linecap="round"/>
              <line x1="10" y1="4" x2="4" y2="10" stroke="currentColor" stroke-width="1.5" stroke-linecap="round"/>
            </svg>
          </button>
        </div>
      ` : nothing}
      ${this.fileError ? html`
        <div class="file-error">
          <svg width="14" height="14" viewBox="0 0 14 14" fill="none">
            <circle cx="7" cy="7" r="6" stroke="currentColor" stroke-width="1.2"/>
            <line x1="7" y1="4" x2="7" y2="8" stroke="currentColor" stroke-width="1.2" stroke-linecap="round"/>
            <circle cx="7" cy="10" r="0.8" fill="currentColor"/>
          </svg>
          ${this.fileError}
        </div>
      ` : nothing}
      <div class="input-container">
        ${this.showAttach
          ? html`
              <div class="attach-btn-wrapper">
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
                <span class="attach-tooltip">Attach file</span>
              </div>
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

  private fileErrorTimer: ReturnType<typeof setTimeout> | null = null;

  private handleAttachClick() {
    // Build accept string from allowed types, falling back to broad defaults
    const accept = this.allowedFileTypes.length > 0
      ? this.allowedFileTypes.join(',')
      : 'image/*,application/pdf,.doc,.docx,.txt';

    const input = document.createElement('input');
    input.type = 'file';
    input.accept = accept;
    input.onchange = () => {
      const file = input.files?.[0];
      if (!file) return;

      // Validate file size
      const maxBytes = this.maxFileSizeMb * 1024 * 1024;
      if (file.size > maxBytes) {
        this.showFileError(`File too large (max ${this.maxFileSizeMb}MB)`);
        this.dispatchEvent(
          new CustomEvent('file-error', {
            detail: { error: `File too large (max ${this.maxFileSizeMb}MB)`, file },
            bubbles: true,
            composed: true,
          }),
        );
        return;
      }

      // Validate file type if allowed types are specified
      if (this.allowedFileTypes.length > 0) {
        const typeMatch = this.allowedFileTypes.some(t => {
          if (t.endsWith('/*')) return file.type.startsWith(t.replace('/*', '/'));
          if (t.startsWith('.')) return file.name.toLowerCase().endsWith(t.toLowerCase());
          return file.type === t;
        });
        if (!typeMatch) {
          this.showFileError('File type not allowed');
          this.dispatchEvent(
            new CustomEvent('file-error', {
              detail: { error: 'File type not allowed', file },
              bubbles: true,
              composed: true,
            }),
          );
          return;
        }
      }

      // Show file preview
      this.pendingFile = { name: file.name, size: this.formatFileSize(file.size) };

      this.dispatchEvent(
        new CustomEvent('attach-click', {
          detail: { file, name: file.name, type: file.type, size: file.size },
          bubbles: true,
          composed: true,
        }),
      );

      // Clear preview after dispatch (file is being uploaded)
      setTimeout(() => { this.pendingFile = null; }, 2000);
    };
    input.click();
  }

  private showFileError(msg: string) {
    this.fileError = msg;
    if (this.fileErrorTimer) clearTimeout(this.fileErrorTimer);
    this.fileErrorTimer = setTimeout(() => { this.fileError = null; }, 3000);
  }

  private clearPendingFile() {
    this.pendingFile = null;
  }

  private formatFileSize(bytes: number): string {
    if (bytes < 1024) return `${bytes} B`;
    if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(0)} KB`;
    return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
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
    if (this.fileErrorTimer) {
      clearTimeout(this.fileErrorTimer);
    }
  }
}

safeRegister('alx-chat-input', AlxChatInput);
