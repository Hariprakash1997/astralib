import { css } from 'lit';

export const chatDarkTheme = css`
  :host([theme='dark']),
  :host(:not([theme])) {
    --alx-chat-primary: #6366f1;
    --alx-chat-primary-hover: #5558e6;
    --alx-chat-primary-text: #ffffff;
    --alx-chat-bg: #1a1a2e;
    --alx-chat-surface: #16213e;
    --alx-chat-surface-hover: #1a2747;
    --alx-chat-text: #e4e4e7;
    --alx-chat-text-muted: #9ca3af;
    --alx-chat-border: #2d3748;
    --alx-chat-shadow: 0 8px 32px rgba(0, 0, 0, 0.3);
    --alx-chat-shadow-sm: 0 2px 8px rgba(0, 0, 0, 0.2);
  }
`;
