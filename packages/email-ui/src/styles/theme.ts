import { css } from 'lit';

export const alxDarkTheme = css`
  :host {
    --alx-primary: #d4af37;
    --alx-danger: #ef4444;
    --alx-success: #22c55e;
    --alx-warning: #f59e0b;
    --alx-info: #3b82f6;
    --alx-bg: #111;
    --alx-surface: #1a1a1a;
    --alx-border: #333;
    --alx-text: #ccc;
    --alx-text-muted: #888;
    --alx-radius: 6px;
    --alx-font-family: 'Inter', sans-serif;
  }
`;

export const alxLightTheme = css`
  :host {
    --alx-primary: #b8941e;
    --alx-danger: #dc2626;
    --alx-success: #16a34a;
    --alx-warning: #d97706;
    --alx-info: #2563eb;
    --alx-bg: #f8f9fa;
    --alx-surface: #ffffff;
    --alx-border: #e2e8f0;
    --alx-text: #1a1a1a;
    --alx-text-muted: #64748b;
    --alx-radius: 6px;
    --alx-font-family: 'Inter', sans-serif;
  }
`;

export const alxBaseStyles = css`
  :host {
    display: block;
    font-family: var(--alx-font-family, 'Inter', sans-serif);
    color: var(--alx-text, #ccc);
    background: var(--alx-bg, #111);
    box-sizing: border-box;
  }

  *,
  *::before,
  *::after {
    box-sizing: inherit;
  }
`;
