import { LitElement, html, css } from 'lit';
import { property } from 'lit/decorators.js';
import { chatResetStyles, chatBaseStyles } from '../styles/shared.js';
import { safeRegister } from '../utils/safe-register.js';

export class AlxChatTyping extends LitElement {
  static styles = [
    chatResetStyles,
    chatBaseStyles,
    css`
      :host {
        display: block;
      }

      .typing-container {
        display: flex;
        align-items: center;
        gap: 8px;
        padding: 8px 16px;
        animation: fadeIn 0.2s ease;
      }

      @keyframes fadeIn {
        from { opacity: 0; transform: translateY(4px); }
        to { opacity: 1; transform: translateY(0); }
      }

      .typing-dots {
        display: flex;
        align-items: center;
        gap: 3px;
        background: var(--alx-chat-surface);
        border: 1px solid var(--alx-chat-border);
        border-radius: 16px;
        padding: 10px 14px;
      }

      .dot {
        width: 6px;
        height: 6px;
        border-radius: 50%;
        background: var(--alx-chat-text-muted);
        animation: bounce 1.4s infinite ease-in-out both;
      }

      .dot:nth-child(1) { animation-delay: -0.32s; }
      .dot:nth-child(2) { animation-delay: -0.16s; }
      .dot:nth-child(3) { animation-delay: 0s; }

      @keyframes bounce {
        0%, 80%, 100% {
          transform: scale(0.6);
          opacity: 0.4;
        }
        40% {
          transform: scale(1);
          opacity: 1;
        }
      }

      .typing-label {
        font-size: 12px;
        color: var(--alx-chat-text-muted);
        font-style: italic;
      }
    `,
  ];

  @property() label = 'Agent is typing...';

  render() {
    return html`
      <div class="typing-container">
        <div class="typing-dots">
          <span class="dot"></span>
          <span class="dot"></span>
          <span class="dot"></span>
        </div>
        <span class="typing-label">${this.label}</span>
      </div>
    `;
  }
}

safeRegister('alx-chat-typing', AlxChatTyping);
