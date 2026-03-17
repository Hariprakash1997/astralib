import { css } from 'lit';

export const chatLightTheme = css`
  :host([theme='light']) {
    --alx-chat-primary: #6366f1;
    --alx-chat-primary-hover: #4f46e5;
    --alx-chat-primary-text: #ffffff;
    --alx-chat-bg: #ffffff;
    --alx-chat-surface: #f8fafc;
    --alx-chat-surface-hover: #f1f5f9;
    --alx-chat-text: #1e293b;
    --alx-chat-text-muted: #64748b;
    --alx-chat-border: #e2e8f0;
    --alx-chat-shadow: 0 8px 32px rgba(0, 0, 0, 0.12);
    --alx-chat-shadow-sm: 0 2px 8px rgba(0, 0, 0, 0.08);
    --alx-chat-visitor-bg: var(--alx-chat-primary);
    --alx-chat-visitor-text: var(--alx-chat-primary-text);
    --alx-chat-agent-bg: var(--alx-chat-surface);
    --alx-chat-agent-text: var(--alx-chat-text);
    --alx-chat-system-text: var(--alx-chat-text-muted);
  }
`;
