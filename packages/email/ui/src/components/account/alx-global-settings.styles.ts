import { css } from 'lit';

export const globalSettingsStyles = css`
  .info-banner {
    font-size: 0.75rem;
    color: var(--alx-text-muted);
    padding: 0.375rem 0.625rem;
    background: color-mix(in srgb, var(--alx-info) 6%, transparent);
    border-radius: var(--alx-radius);
    margin-bottom: 0.75rem;
    line-height: 1.5;
  }
  .section-desc {
    font-size: 0.7rem;
    color: var(--alx-text-muted);
    padding: 0 1rem 0.5rem;
    line-height: 1.4;
  }
  .section {
    border: 1px solid var(--alx-border);
    border-radius: var(--alx-radius);
    margin-bottom: 0.75rem;
    overflow: hidden;
  }
  .section-header {
    display: flex;
    align-items: center;
    justify-content: space-between;
    padding: 0.5rem 0.75rem;
    background: var(--alx-surface);
    cursor: pointer;
    user-select: none;
  }
  .section-header:hover {
    background: var(--alx-bg);
  }
  .section-title {
    font-weight: 600;
    font-size: 0.9rem;
  }
  .section-toggle {
    font-size: 0.75rem;
    color: var(--alx-text-muted);
  }
  .section-body {
    padding: 0.75rem;
    display: none;
  }
  .section-body.open {
    display: block;
  }
  .field-row {
    display: grid;
    grid-template-columns: 1fr 1fr;
    gap: 0.75rem;
    margin-bottom: 0.5rem;
  }
  .field-group {
    display: flex;
    flex-direction: column;
  }
  .toggle-row {
    display: flex;
    align-items: center;
    justify-content: space-between;
    padding: 0.5rem 0;
  }
  .toggle-label {
    font-size: 0.85rem;
  }
  .toggle-switch {
    position: relative;
    width: 44px;
    height: 24px;
    cursor: pointer;
  }
  .toggle-switch input {
    opacity: 0;
    width: 0;
    height: 0;
    position: absolute;
  }
  .toggle-slider {
    position: absolute;
    inset: 0;
    background: var(--alx-border);
    border-radius: 12px;
    transition: background 0.2s;
  }
  .toggle-slider::before {
    content: '';
    position: absolute;
    left: 3px;
    top: 3px;
    width: 18px;
    height: 18px;
    background: #fff;
    border-radius: 50%;
    transition: transform 0.2s;
  }
  .toggle-switch input:checked + .toggle-slider {
    background: var(--alx-primary);
  }
  .toggle-switch input:checked + .toggle-slider::before {
    transform: translateX(20px);
  }
  .section-actions {
    display: flex;
    justify-content: flex-end;
    margin-top: 0.75rem;
  }
  input[type='number'] {
    width: 100%;
  }
`;
