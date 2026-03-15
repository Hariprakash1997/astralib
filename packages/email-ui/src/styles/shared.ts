import { css } from 'lit';

export const alxDensityStyles = css`
  :host {
    --alx-density-padding: 0.75rem;
    --alx-density-gap: 1rem;
    --alx-density-font-size: 0.875rem;
    --alx-density-row-height: 2.5rem;
    --alx-density-header-size: 1.25rem;
  }

  :host([density="compact"]) {
    --alx-density-padding: 0.375rem;
    --alx-density-gap: 0.5rem;
    --alx-density-font-size: 0.75rem;
    --alx-density-row-height: 1.75rem;
    --alx-density-header-size: 1rem;
  }
`;

export const alxResetStyles = css`
  *,
  *::before,
  *::after {
    box-sizing: border-box;
    margin: 0;
    padding: 0;
  }
`;

export const alxTypographyStyles = css`
  h1, h2, h3, h4, h5, h6 {
    color: var(--alx-text);
    font-family: var(--alx-font-family);
    font-weight: 600;
    line-height: 1.3;
  }

  h1 { font-size: 1.75rem; }
  h2 { font-size: 1.5rem; }
  h3 { font-size: 1.25rem; }
  h4 { font-size: 1.1rem; }

  p {
    color: var(--alx-text);
    line-height: 1.6;
  }

  .text-muted {
    color: var(--alx-text-muted);
  }

  .text-small {
    font-size: 0.85rem;
  }
`;

export const alxButtonStyles = css`
  button, .alx-btn {
    display: inline-flex;
    align-items: center;
    gap: var(--alx-density-gap, 0.5rem);
    padding: var(--alx-density-padding, 0.5rem) var(--alx-density-gap, 1rem);
    border: 1px solid var(--alx-border);
    border-radius: var(--alx-radius);
    background: var(--alx-surface);
    color: var(--alx-text);
    font-family: var(--alx-font-family);
    font-size: var(--alx-density-font-size, 0.875rem);
    cursor: pointer;
    transition: background 0.15s, border-color 0.15s;
  }

  button:hover, .alx-btn:hover {
    border-color: var(--alx-primary);
  }

  button:disabled, .alx-btn:disabled {
    opacity: 0.5;
    cursor: not-allowed;
  }

  .alx-btn-primary {
    background: var(--alx-primary);
    color: #111;
    border-color: var(--alx-primary);
  }

  .alx-btn-danger {
    background: var(--alx-danger);
    color: #fff;
    border-color: var(--alx-danger);
  }

  .alx-btn-success {
    background: var(--alx-success);
    color: #fff;
    border-color: var(--alx-success);
  }

  .alx-btn-sm {
    padding: 0.25rem 0.625rem;
    font-size: 0.8rem;
  }
`;

export const alxInputStyles = css`
  input, select, textarea {
    width: 100%;
    padding: var(--alx-density-padding, 0.5rem) var(--alx-density-padding, 0.75rem);
    border: 1px solid var(--alx-border);
    border-radius: var(--alx-radius);
    background: var(--alx-bg);
    color: var(--alx-text);
    font-family: var(--alx-font-family);
    font-size: var(--alx-density-font-size, 0.875rem);
    transition: border-color 0.15s;
  }

  input:focus, select:focus, textarea:focus {
    outline: none;
    border-color: var(--alx-primary);
  }

  input::placeholder, textarea::placeholder {
    color: var(--alx-text-muted);
  }

  label {
    display: block;
    margin-bottom: 0.25rem;
    font-size: 0.85rem;
    color: var(--alx-text-muted);
  }
`;

export const alxTableStyles = css`
  table {
    width: 100%;
    border-collapse: collapse;
    font-size: var(--alx-density-font-size, 0.875rem);
  }

  th {
    text-align: left;
    padding: var(--alx-density-padding, 0.625rem) var(--alx-density-padding, 0.75rem);
    border-bottom: 2px solid var(--alx-border);
    color: var(--alx-text-muted);
    font-weight: 600;
    font-size: calc(var(--alx-density-font-size, 0.875rem) * 0.9);
    text-transform: uppercase;
    letter-spacing: 0.05em;
  }

  td {
    padding: var(--alx-density-padding, 0.625rem) var(--alx-density-padding, 0.75rem);
    border-bottom: 1px solid var(--alx-border);
    color: var(--alx-text);
  }

  tr:hover td {
    background: var(--alx-surface);
  }
`;

export const alxCardStyles = css`
  .alx-card {
    background: var(--alx-surface);
    border: 1px solid var(--alx-border);
    border-radius: var(--alx-radius);
    padding: var(--alx-density-gap, 1.25rem);
  }

  .alx-card-header {
    display: flex;
    align-items: center;
    justify-content: space-between;
    margin-bottom: var(--alx-density-gap, 1rem);
  }

  .alx-card-header h3 {
    font-size: var(--alx-density-header-size, 1.25rem);
  }
`;

export const alxBadgeStyles = css`
  .alx-badge {
    display: inline-flex;
    align-items: center;
    padding: 0.15rem 0.5rem;
    border-radius: 999px;
    font-size: 0.75rem;
    font-weight: 500;
    line-height: 1.4;
  }

  .alx-badge-success {
    background: color-mix(in srgb, var(--alx-success) 15%, transparent);
    color: var(--alx-success);
  }

  .alx-badge-danger {
    background: color-mix(in srgb, var(--alx-danger) 15%, transparent);
    color: var(--alx-danger);
  }

  .alx-badge-warning {
    background: color-mix(in srgb, var(--alx-warning) 15%, transparent);
    color: var(--alx-warning);
  }

  .alx-badge-info {
    background: color-mix(in srgb, var(--alx-info) 15%, transparent);
    color: var(--alx-info);
  }

  .alx-badge-muted {
    background: color-mix(in srgb, var(--alx-text-muted) 15%, transparent);
    color: var(--alx-text-muted);
  }
`;

export const alxLoadingStyles = css`
  .alx-loading {
    display: flex;
    align-items: center;
    justify-content: center;
    padding: 2rem;
    color: var(--alx-text-muted);
  }

  .alx-spinner {
    width: 1.25rem;
    height: 1.25rem;
    border: 2px solid var(--alx-border);
    border-top-color: var(--alx-primary);
    border-radius: 50%;
    animation: alx-spin 0.6s linear infinite;
  }

  @keyframes alx-spin {
    to { transform: rotate(360deg); }
  }

  .alx-empty {
    text-align: center;
    padding: 3rem 1rem;
    color: var(--alx-text-muted);
  }

  .alx-error {
    padding: 1rem;
    background: color-mix(in srgb, var(--alx-danger) 10%, transparent);
    border: 1px solid var(--alx-danger);
    border-radius: var(--alx-radius);
    color: var(--alx-danger);
    font-size: 0.875rem;
  }
`;
