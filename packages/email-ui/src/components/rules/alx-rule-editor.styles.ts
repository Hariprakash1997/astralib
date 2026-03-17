import { css } from 'lit';

export const ruleEditorStyles = css`
  .form-grid {
    display: grid;
    grid-template-columns: 1fr 1fr;
    gap: var(--alx-density-gap, 0.75rem);
  }

  .form-group {
    display: flex;
    flex-direction: column;
    margin-bottom: 0;
  }

  .form-group-full {
    grid-column: 1 / -1;
  }

  .section-title {
    font-size: 0.95rem;
    font-weight: 600;
    color: var(--alx-text);
    margin-top: 0.75rem;
    margin-bottom: 0.25rem;
    padding-bottom: 0.25rem;
    border-bottom: 1px solid var(--alx-border);
    grid-column: 1 / -1;
  }

  .condition-row {
    display: flex;
    gap: 0.5rem;
    align-items: center;
    margin-bottom: 0.375rem;
  }

  .condition-row input,
  .condition-row select {
    flex: 1;
  }

  .condition-row button {
    flex-shrink: 0;
  }

  .checkbox-group {
    display: flex;
    align-items: center;
    gap: 0.5rem;
    margin-top: 0.125rem;
  }

  .checkbox-group input[type='checkbox'] {
    width: auto;
  }

  .actions {
    display: flex;
    gap: 0.75rem;
    margin-top: 1rem;
  }

  .mode-toggle {
    display: flex;
    gap: 0;
    align-items: center;
    margin-bottom: 0.25rem;
    grid-column: 1 / -1;
  }

  .mode-option {
    display: inline-flex;
    align-items: center;
    padding: 0.3rem 0.75rem;
    font-size: 0.75rem;
    font-weight: 500;
    cursor: pointer;
    border: 1px solid var(--alx-border);
    background: var(--alx-surface);
    color: var(--alx-text-muted);
    transition: all 0.15s;
    text-transform: none;
    letter-spacing: normal;
    margin-bottom: 0;
  }

  .mode-option:first-child {
    border-radius: var(--alx-radius) 0 0 var(--alx-radius);
  }

  .mode-option:last-child {
    border-radius: 0 var(--alx-radius) var(--alx-radius) 0;
    border-left: none;
  }

  .mode-option.active {
    background: var(--alx-primary);
    color: #fff;
    border-color: var(--alx-primary);
  }

  .mode-option:hover:not(.active) {
    border-color: var(--alx-primary);
    color: var(--alx-primary);
  }

  textarea {
    min-height: 100px;
    font-family: monospace;
    font-size: 0.85rem;
    resize: vertical;
  }

  .helper-text {
    font-size: 0.75rem;
    color: var(--alx-text-muted);
    margin-top: 0.15rem;
  }

  .actions-right {
    margin-left: auto;
  }
`;
