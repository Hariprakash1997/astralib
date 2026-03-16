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
    gap: 1rem;
    align-items: center;
    margin-bottom: 0.25rem;
    grid-column: 1 / -1;
  }

  .mode-toggle label {
    display: flex;
    align-items: center;
    gap: 0.35rem;
    margin-bottom: 0;
    cursor: pointer;
  }

  .mode-toggle input[type='radio'] {
    width: auto;
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
