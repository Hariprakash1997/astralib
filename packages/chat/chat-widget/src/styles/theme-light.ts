import { css } from 'lit';

export const chatLightTheme = css`
  :host([theme='light']) {
    --alx-chat-primary: #6366f1;
    --alx-chat-primary-hover: #4f46e5;
    --alx-chat-primary-text: #ffffff;
    --alx-chat-bg: #ffffff;
    --alx-chat-surface: #f7f7fa;
    --alx-chat-surface-hover: #ededf2;
    --alx-chat-surface-alt: #eeeef2;
    --alx-chat-text: #1a1a2e;
    --alx-chat-text-muted: #6b6b80;
    --alx-chat-border: #e0e0ea;
    --alx-chat-shadow: 0 0 0 1px rgba(0, 0, 0, 0.03),
      0 4px 16px rgba(0, 0, 0, 0.06), 0 16px 48px rgba(0, 0, 0, 0.08);
    --alx-chat-shadow-sm: 0 1px 3px rgba(0, 0, 0, 0.04),
      0 2px 8px rgba(0, 0, 0, 0.03);
    --alx-chat-visitor-bg: var(--alx-chat-primary);
    --alx-chat-visitor-text: var(--alx-chat-primary-text);
    --alx-chat-agent-bg: var(--alx-chat-surface);
    --alx-chat-agent-text: var(--alx-chat-text);
    --alx-chat-system-text: var(--alx-chat-text-muted);
  }
`;
