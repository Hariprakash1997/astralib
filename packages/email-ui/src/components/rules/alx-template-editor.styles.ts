import { css } from 'lit';

export const templateEditorStyles = css`
  .form-grid {
    display: grid;
    grid-template-columns: 1fr 1fr;
    gap: var(--alx-density-gap, 0.75rem);
  }

  .form-group {
    display: flex;
    flex-direction: column;
  }

  .form-group-full {
    grid-column: 1 / -1;
  }

  textarea {
    min-height: 200px;
    font-family: 'Fira Code', 'Cascadia Code', monospace;
    font-size: 0.8rem;
    resize: vertical;
  }

  .variables-input {
    display: flex;
    flex-wrap: wrap;
    gap: 0.5rem;
    align-items: center;
  }

  .variable-tag {
    display: inline-flex;
    align-items: center;
    gap: 0.25rem;
    padding: 0.2rem 0.5rem;
    background: color-mix(in srgb, var(--alx-primary) 15%, transparent);
    color: var(--alx-primary);
    border-radius: var(--alx-radius);
    font-size: 0.8rem;
  }

  .variable-tag button {
    background: none;
    border: none;
    color: var(--alx-text-muted);
    cursor: pointer;
    padding: 0;
    font-size: 1rem;
    line-height: 1;
  }

  .add-variable {
    display: flex;
    gap: 0.5rem;
    margin-top: 0.5rem;
  }

  .add-variable input {
    width: 180px;
  }

  .actions {
    display: flex;
    gap: 0.75rem;
    margin-top: 1rem;
  }

  .preview-frame {
    width: 100%;
    height: 400px;
    border: 1px solid var(--alx-border);
    border-radius: var(--alx-radius);
    background: #fff;
    margin-top: 0.5rem;
  }

  .multi-list {
    display: flex;
    flex-direction: column;
    gap: 0.5rem;
  }

  .multi-row {
    display: flex;
    gap: 0.5rem;
    align-items: start;
  }

  .multi-row input,
  .multi-row textarea {
    flex: 1;
  }

  .multi-row textarea {
    min-height: 150px;
  }

  .multi-row .remove-btn {
    background: none;
    border: none;
    color: var(--alx-text-muted);
    cursor: pointer;
    font-size: 1.1rem;
    padding: 0.25rem;
    line-height: 1;
    flex-shrink: 0;
  }

  .multi-row .remove-btn:hover {
    color: var(--alx-danger, #e53e3e);
  }

  .kv-row {
    display: flex;
    gap: 0.5rem;
    align-items: center;
  }

  .kv-row input {
    flex: 1;
  }

  .kv-row .remove-btn {
    background: none;
    border: none;
    color: var(--alx-text-muted);
    cursor: pointer;
    font-size: 1.1rem;
    padding: 0.25rem;
    line-height: 1;
    flex-shrink: 0;
  }

  .kv-row .remove-btn:hover {
    color: var(--alx-danger, #e53e3e);
  }

  .helper-text {
    font-size: 0.75rem;
    color: var(--alx-text-muted);
    margin-top: 0.25rem;
  }

  .section-label {
    font-weight: 600;
    font-size: 0.85rem;
    margin-bottom: 0.25rem;
    color: var(--alx-text-secondary, var(--alx-text-muted));
  }

  .info-banner {
    font-size: 0.75rem;
    color: var(--alx-text-muted);
    padding: 0.375rem 0.625rem;
    background: color-mix(in srgb, var(--alx-info) 6%, transparent);
    border-radius: var(--alx-radius);
    margin-bottom: 0.75rem;
    line-height: 1.5;
  }
`;
