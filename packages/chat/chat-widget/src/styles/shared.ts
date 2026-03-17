import { css } from 'lit';

export const chatResetStyles = css`
  *,
  *::before,
  *::after {
    box-sizing: border-box;
    margin: 0;
    padding: 0;
  }
`;

export const chatBaseStyles = css`
  :host {
    --alx-chat-primary: #6366f1;
    --alx-chat-primary-hover: #5558e6;
    --alx-chat-primary-text: #ffffff;
    --alx-chat-bg: #1a1a2e;
    --alx-chat-surface: #16213e;
    --alx-chat-surface-hover: #1a2747;
    --alx-chat-text: #e4e4e7;
    --alx-chat-text-muted: #9ca3af;
    --alx-chat-border: #2d3748;
    --alx-chat-radius: 12px;
    --alx-chat-radius-sm: 8px;
    --alx-chat-font: system-ui, -apple-system, sans-serif;
    --alx-chat-font-size: 14px;
    --alx-chat-shadow: 0 8px 32px rgba(0, 0, 0, 0.3);
    --alx-chat-shadow-sm: 0 2px 8px rgba(0, 0, 0, 0.2);
    --alx-chat-success: #22c55e;
    --alx-chat-warning: #f59e0b;
    --alx-chat-danger: #ef4444;
    --alx-chat-visitor-bg: var(--alx-chat-primary);
    --alx-chat-visitor-text: var(--alx-chat-primary-text);
    --alx-chat-agent-bg: var(--alx-chat-surface);
    --alx-chat-agent-text: var(--alx-chat-text);
    --alx-chat-system-text: var(--alx-chat-text-muted);

    font-family: var(--alx-chat-font);
    font-size: var(--alx-chat-font-size);
    color: var(--alx-chat-text);
    line-height: 1.5;
  }
`;
