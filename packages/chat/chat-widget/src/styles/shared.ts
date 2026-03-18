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
    --alx-chat-primary-light: color-mix(
      in srgb,
      var(--alx-chat-primary) 12%,
      transparent
    );
    --alx-chat-primary-muted: color-mix(
      in srgb,
      var(--alx-chat-primary) 40%,
      transparent
    );
    --alx-chat-bg: #1a1a2e;
    --alx-chat-surface: #16213e;
    --alx-chat-surface-hover: #1a2747;
    --alx-chat-surface-alt: #232340;
    --alx-chat-text: #e4e4e7;
    --alx-chat-text-muted: #9ca3af;
    --alx-chat-border: #2d3748;
    --alx-chat-radius: 16px;
    --alx-chat-radius-sm: 10px;
    --alx-chat-radius-bubble: 18px;
    --alx-chat-radius-bubble-tail: 6px;
    --alx-chat-font: system-ui, -apple-system, sans-serif;
    --alx-chat-font-size: 14px;
    --alx-chat-shadow: 0 0 0 1px rgba(0, 0, 0, 0.03),
      0 4px 16px rgba(0, 0, 0, 0.08), 0 16px 48px rgba(0, 0, 0, 0.12);
    --alx-chat-shadow-sm: 0 1px 3px rgba(0, 0, 0, 0.06),
      0 2px 8px rgba(0, 0, 0, 0.04);
    --alx-chat-success: #22c55e;
    --alx-chat-warning: #f59e0b;
    --alx-chat-danger: #ef4444;
    --alx-chat-visitor-bg: var(--alx-chat-primary);
    --alx-chat-visitor-text: var(--alx-chat-primary-text);
    --alx-chat-agent-bg: var(--alx-chat-surface);
    --alx-chat-agent-text: var(--alx-chat-text);
    --alx-chat-system-text: var(--alx-chat-text-muted);
    --alx-chat-spring-bounce: cubic-bezier(0.34, 1.56, 0.64, 1);
    --alx-chat-spring-smooth: cubic-bezier(0.22, 1, 0.36, 1);
    --alx-chat-spring-snappy: cubic-bezier(0.16, 1, 0.3, 1);

    font-family: var(--alx-chat-font);
    font-size: var(--alx-chat-font-size);
    color: var(--alx-chat-text);
    line-height: 1.5;
  }

  @media (prefers-reduced-motion: reduce) {
    *,
    *::before,
    *::after {
      animation-duration: 0.01ms !important;
      animation-iteration-count: 1 !important;
      transition-duration: 0.01ms !important;
    }
  }
`;

export const chatAnimations = css`
  @keyframes alx-slideInRight {
    from {
      transform: translateX(20px);
      opacity: 0;
    }
    to {
      transform: translateX(0);
      opacity: 1;
    }
  }

  @keyframes alx-slideInLeft {
    from {
      transform: translateX(-20px);
      opacity: 0;
    }
    to {
      transform: translateX(0);
      opacity: 1;
    }
  }

  @keyframes alx-fadeInUp {
    from {
      transform: translateY(12px);
      opacity: 0;
    }
    to {
      transform: translateY(0);
      opacity: 1;
    }
  }

  @keyframes alx-scaleIn {
    from {
      transform: scale(0.8);
      opacity: 0;
    }
    to {
      transform: scale(1);
      opacity: 1;
    }
  }

  @keyframes alx-springIn {
    0% {
      transform: scale(0.3);
      opacity: 0;
    }
    70% {
      transform: scale(1.05);
      opacity: 1;
    }
    100% {
      transform: scale(1);
    }
  }

  @keyframes alx-pulse {
    0%,
    100% {
      box-shadow: 0 0 0 0 var(--alx-chat-primary-light);
    }
    50% {
      box-shadow: 0 0 0 8px transparent;
    }
  }

  @keyframes alx-wave {
    0%,
    60%,
    100% {
      transform: translateY(0) scale(0.85);
      opacity: 0.4;
    }
    30% {
      transform: translateY(-6px) scale(1);
      opacity: 1;
    }
  }

  @keyframes alx-shake {
    0%,
    100% {
      transform: translateX(0);
    }
    25% {
      transform: translateX(-4px);
    }
    75% {
      transform: translateX(4px);
    }
  }

  @keyframes alx-badgePulse {
    0%,
    100% {
      transform: scale(1);
    }
    50% {
      transform: scale(1.15);
    }
  }

  @keyframes alx-spinnerRotate {
    from {
      transform: rotate(0deg);
    }
    to {
      transform: rotate(360deg);
    }
  }

  @keyframes alx-checkSlideIn {
    from {
      transform: translateX(-4px);
      opacity: 0;
    }
    to {
      transform: translateX(0);
      opacity: 1;
    }
  }
`;
