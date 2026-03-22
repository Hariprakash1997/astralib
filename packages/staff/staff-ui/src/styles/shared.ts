import { css } from 'lit';

export const alxStaffDensityStyles = css`
  :host {
    --alx-density-padding: 0.5rem;
    --alx-density-gap: 0.75rem;
    --alx-density-font-size: 0.8125rem;
    --alx-density-row-height: 2.25rem;
    --alx-density-header-size: 1.1rem;
  }

  :host([density="compact"]) {
    --alx-density-padding: 0.3rem;
    --alx-density-gap: 0.4rem;
    --alx-density-font-size: 0.75rem;
    --alx-density-row-height: 1.625rem;
    --alx-density-header-size: 0.9rem;
  }
`;

export const alxStaffResetStyles = css`
  *,
  *::before,
  *::after {
    box-sizing: border-box;
    margin: 0;
    padding: 0;
  }
`;

export const alxStaffThemeStyles = css`
  :host {
    --alx-bg: #0f1117;
    --alx-surface: #181a20;
    --alx-surface-alt: #1e2028;
    --alx-border: #2a2d37;
    --alx-text: #e1e4ea;
    --alx-text-muted: #8b8fa3;
    --alx-primary: #6366f1;
    --alx-success: #22c55e;
    --alx-danger: #ef4444;
    --alx-warning: #f59e0b;
    --alx-info: #3b82f6;
    --alx-radius: 6px;
    --alx-font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
    --alx-shadow-sm: 0 1px 3px rgba(0, 0, 0, 0.3);
    --alx-shadow-md: 0 4px 12px rgba(0, 0, 0, 0.4);

    font-family: var(--alx-font-family);
    font-size: var(--alx-density-font-size, 0.8125rem);
    color: var(--alx-text);
  }
`;

export const alxStaffButtonStyles = css`
  button, .alx-btn {
    display: inline-flex;
    align-items: center;
    gap: 0.375rem;
    padding: 0.375rem 0.75rem;
    border: 1px solid var(--alx-border);
    border-radius: var(--alx-radius);
    background: var(--alx-surface);
    color: var(--alx-text);
    font-family: var(--alx-font-family);
    font-size: var(--alx-density-font-size, 0.8125rem);
    font-weight: 500;
    cursor: pointer;
    transition: all 0.15s ease;
    white-space: nowrap;
    line-height: 1.4;
  }

  button:hover, .alx-btn:hover {
    border-color: var(--alx-primary);
    background: color-mix(in srgb, var(--alx-primary) 6%, var(--alx-surface));
  }

  button:active, .alx-btn:active {
    transform: translateY(0.5px);
  }

  button:focus-visible, .alx-btn:focus-visible {
    outline: 2px solid var(--alx-primary);
    outline-offset: 1px;
  }

  button:disabled, .alx-btn:disabled {
    opacity: 0.45;
    cursor: not-allowed;
    pointer-events: none;
  }

  .alx-btn-primary {
    background: var(--alx-primary);
    color: #fff;
    border-color: var(--alx-primary);
    font-weight: 600;
  }

  .alx-btn-primary:hover {
    background: color-mix(in srgb, var(--alx-primary) 88%, #000);
    border-color: color-mix(in srgb, var(--alx-primary) 88%, #000);
  }

  .alx-btn-danger {
    background: transparent;
    color: var(--alx-danger);
    border-color: color-mix(in srgb, var(--alx-danger) 40%, transparent);
  }

  .alx-btn-danger:hover {
    background: color-mix(in srgb, var(--alx-danger) 10%, transparent);
    border-color: var(--alx-danger);
  }

  .alx-btn-success {
    background: var(--alx-success);
    color: #fff;
    border-color: var(--alx-success);
  }

  .alx-btn-sm {
    padding: 0.2rem 0.5rem;
    font-size: 0.75rem;
  }

  .alx-btn-icon {
    padding: 0.3rem;
    border: none;
    background: transparent;
    color: var(--alx-text-muted);
    border-radius: var(--alx-radius);
    line-height: 1;
  }

  .alx-btn-icon:hover {
    color: var(--alx-text);
    background: color-mix(in srgb, var(--alx-text) 8%, transparent);
  }

  .alx-btn-icon.danger:hover {
    color: var(--alx-danger);
    background: color-mix(in srgb, var(--alx-danger) 10%, transparent);
  }
`;

export const alxStaffInputStyles = css`
  input, select, textarea {
    width: 100%;
    padding: 0.375rem 0.625rem;
    border: 1px solid var(--alx-border);
    border-radius: var(--alx-radius);
    background: var(--alx-bg);
    color: var(--alx-text);
    font-family: var(--alx-font-family);
    font-size: var(--alx-density-font-size, 0.8125rem);
    line-height: 1.5;
    transition: border-color 0.15s, box-shadow 0.15s;
  }

  input:focus, select:focus, textarea:focus {
    outline: none;
    border-color: var(--alx-primary);
    box-shadow: 0 0 0 2px color-mix(in srgb, var(--alx-primary) 20%, transparent);
  }

  input::placeholder, textarea::placeholder {
    color: var(--alx-text-muted);
    opacity: 0.7;
  }

  label {
    display: block;
    margin-bottom: 0.2rem;
    font-size: 0.75rem;
    font-weight: 500;
    color: var(--alx-text-muted);
    text-transform: uppercase;
    letter-spacing: 0.03em;
  }

  .form-group {
    margin-bottom: 0.625rem;
  }

  .form-row {
    display: grid;
    grid-template-columns: 1fr 1fr;
    gap: 0.625rem;
  }

  .form-actions {
    display: flex;
    justify-content: flex-end;
    gap: 0.5rem;
    margin-top: 1rem;
    padding-top: 0.75rem;
    border-top: 1px solid var(--alx-border);
  }

  .form-section {
    padding-bottom: 0.75rem;
    margin-bottom: 0.75rem;
    border-bottom: 1px solid color-mix(in srgb, var(--alx-border) 60%, transparent);
  }

  .form-section-title {
    font-size: 0.7rem;
    font-weight: 600;
    text-transform: uppercase;
    letter-spacing: 0.05em;
    color: var(--alx-text-muted);
    margin-bottom: 0.5rem;
  }
`;

export const alxStaffTableStyles = css`
  table {
    width: 100%;
    border-collapse: collapse;
    font-size: var(--alx-density-font-size, 0.8125rem);
  }

  thead {
    position: sticky;
    top: 0;
    z-index: 1;
    background: var(--alx-surface);
  }

  th {
    text-align: left;
    padding: 0.5rem 0.625rem;
    border-bottom: 2px solid var(--alx-border);
    color: var(--alx-text-muted);
    font-weight: 600;
    font-size: 0.6875rem;
    text-transform: uppercase;
    letter-spacing: 0.05em;
    white-space: nowrap;
  }

  td {
    padding: 0.4rem 0.625rem;
    border-bottom: 1px solid color-mix(in srgb, var(--alx-border) 60%, transparent);
    color: var(--alx-text);
    vertical-align: middle;
  }

  tr:hover td {
    background: color-mix(in srgb, var(--alx-primary) 4%, transparent);
  }

  tbody tr:nth-child(even) td {
    background: color-mix(in srgb, var(--alx-text) 2%, transparent);
  }

  tbody tr:nth-child(even):hover td {
    background: color-mix(in srgb, var(--alx-primary) 4%, transparent);
  }
`;

export const alxStaffCardStyles = css`
  .alx-card {
    background: var(--alx-surface);
    border: 1px solid var(--alx-border);
    border-radius: var(--alx-radius);
    box-shadow: var(--alx-shadow-sm);
    padding: var(--alx-density-gap, 1rem);
  }

  .alx-card-header {
    display: flex;
    align-items: center;
    justify-content: space-between;
    margin-bottom: var(--alx-density-gap, 0.75rem);
    padding-bottom: var(--alx-density-gap, 0.5rem);
    border-bottom: 1px solid var(--alx-border);
  }

  .alx-card-header h3 {
    font-size: var(--alx-density-header-size, 1.1rem);
    font-weight: 600;
  }
`;

export const alxStaffBadgeStyles = css`
  .alx-badge {
    display: inline-flex;
    align-items: center;
    padding: 0.1rem 0.45rem;
    border-radius: 999px;
    font-size: 0.6875rem;
    font-weight: 600;
    line-height: 1.5;
    letter-spacing: 0.02em;
    text-transform: capitalize;
  }

  .alx-badge-success {
    background: color-mix(in srgb, var(--alx-success) 12%, transparent);
    color: var(--alx-success);
  }

  .alx-badge-danger {
    background: color-mix(in srgb, var(--alx-danger) 12%, transparent);
    color: var(--alx-danger);
  }

  .alx-badge-warning {
    background: color-mix(in srgb, var(--alx-warning) 12%, transparent);
    color: var(--alx-warning);
  }

  .alx-badge-info {
    background: color-mix(in srgb, var(--alx-info) 12%, transparent);
    color: var(--alx-info);
  }

  .alx-badge-muted {
    background: color-mix(in srgb, var(--alx-text-muted) 12%, transparent);
    color: var(--alx-text-muted);
  }
`;

export const alxStaffLoadingStyles = css`
  .alx-loading {
    display: flex;
    align-items: center;
    justify-content: center;
    padding: 2rem;
    color: var(--alx-text-muted);
    gap: 0.5rem;
    font-size: 0.8125rem;
  }

  .alx-spinner {
    width: 1rem;
    height: 1rem;
    border: 2px solid color-mix(in srgb, var(--alx-primary) 20%, transparent);
    border-top-color: var(--alx-primary);
    border-radius: 50%;
    animation: alx-spin 0.6s linear infinite;
  }

  @keyframes alx-spin {
    to { transform: rotate(360deg); }
  }

  .alx-empty {
    text-align: center;
    padding: 2.5rem 1rem;
    color: var(--alx-text-muted);
    font-size: 0.8125rem;
  }

  .alx-error {
    padding: 0.625rem 0.75rem;
    background: color-mix(in srgb, var(--alx-danger) 8%, transparent);
    border: 1px solid color-mix(in srgb, var(--alx-danger) 30%, transparent);
    border-radius: var(--alx-radius);
    color: var(--alx-danger);
    font-size: 0.8125rem;
    margin-bottom: 0.75rem;
  }

  .alx-success-msg {
    padding: 0.625rem 0.75rem;
    background: color-mix(in srgb, var(--alx-success) 8%, transparent);
    border: 1px solid color-mix(in srgb, var(--alx-success) 30%, transparent);
    border-radius: var(--alx-radius);
    color: var(--alx-success);
    font-size: 0.8125rem;
    margin-bottom: 0.75rem;
  }
`;

export const alxStaffToolbarStyles = css`
  .toolbar {
    display: flex;
    align-items: center;
    gap: var(--alx-density-gap, 0.5rem);
    margin-bottom: var(--alx-density-gap, 0.75rem);
    flex-wrap: wrap;
  }

  .toolbar select {
    width: auto;
    min-width: 120px;
  }

  .toolbar input[type="text"],
  .toolbar input[type="search"] {
    width: auto;
    min-width: 180px;
  }

  .spacer {
    flex: 1;
  }

  .pagination {
    display: flex;
    align-items: center;
    justify-content: center;
    gap: 0.5rem;
    margin-top: var(--alx-density-gap, 0.75rem);
    padding-top: var(--alx-density-gap, 0.5rem);
    border-top: 1px solid color-mix(in srgb, var(--alx-border) 60%, transparent);
  }
`;

export const alxStaffToggleStyles = css`
  .toggle {
    position: relative;
    display: inline-block;
    width: 32px;
    height: 18px;
  }

  .toggle input {
    opacity: 0;
    width: 0;
    height: 0;
    position: absolute;
  }

  .toggle-slider {
    position: absolute;
    inset: 0;
    background: var(--alx-border);
    border-radius: 18px;
    cursor: pointer;
    transition: background 0.2s;
  }

  .toggle-slider::before {
    content: '';
    position: absolute;
    width: 12px;
    height: 12px;
    left: 3px;
    bottom: 3px;
    background: #fff;
    border-radius: 50%;
    transition: transform 0.2s;
    box-shadow: 0 1px 2px rgba(0,0,0,0.15);
  }

  .toggle input:checked + .toggle-slider {
    background: var(--alx-success);
  }

  .toggle input:checked + .toggle-slider::before {
    transform: translateX(14px);
  }
`;
