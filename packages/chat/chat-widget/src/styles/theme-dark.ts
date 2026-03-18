import { css } from 'lit';

export const chatDarkTheme = css`
  :host([theme='dark']),
  :host(:not([theme])) {
    --alx-chat-primary: #6366f1;
    --alx-chat-primary-hover: #5558e6;
    --alx-chat-primary-text: #ffffff;
    --alx-chat-bg: #0f0f1a;
    --alx-chat-surface: #1a1a2e;
    --alx-chat-surface-hover: #1f1f38;
    --alx-chat-surface-alt: #232340;
    --alx-chat-text: #f0f0f5;
    --alx-chat-text-muted: #8b8ba3;
    --alx-chat-border: #2a2a45;
    --alx-chat-shadow: 0 0 0 1px rgba(0, 0, 0, 0.06),
      0 4px 16px rgba(0, 0, 0, 0.15), 0 16px 48px rgba(0, 0, 0, 0.2);
    --alx-chat-shadow-sm: 0 1px 3px rgba(0, 0, 0, 0.12),
      0 2px 8px rgba(0, 0, 0, 0.08);
  }
`;
