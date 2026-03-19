import { css } from 'lit';

export const templateEditorStyles = css`
  :host { display: block; }

  .editor-layout {
    display: flex;
    gap: 16px;
    min-height: 500px;
  }

  .editor-sidebar {
    width: 35%;
    min-width: 280px;
    max-width: 360px;
    border-right: 1px solid var(--alx-border, #e5e7eb);
    padding-right: 16px;
    overflow-y: auto;
  }

  .editor-main {
    flex: 1;
    min-width: 0;
    display: flex;
    flex-direction: column;
  }

  .sidebar-section {
    margin-bottom: 16px;
  }

  .sidebar-section label {
    display: block;
    font-size: 12px;
    font-weight: 600;
    color: var(--alx-text-muted, #6b7280);
    margin-bottom: 4px;
    text-transform: uppercase;
    letter-spacing: 0.5px;
  }

  .form-row {
    margin-bottom: 10px;
  }

  .form-row input,
  .form-row select,
  .form-row textarea {
    width: 100%;
    padding: 6px 10px;
    border: 1px solid var(--alx-border, #d1d5db);
    border-radius: var(--alx-radius, 6px);
    font-size: 13px;
    box-sizing: border-box;
  }

  .collection-section {
    background: var(--alx-primary-bg, #eef2ff);
    border: 1px solid var(--alx-primary, #818cf8);
    border-radius: var(--alx-radius, 6px);
    padding: 10px;
    margin-bottom: 12px;
  }

  .join-checkboxes {
    display: flex;
    flex-wrap: wrap;
    gap: 6px;
    margin-top: 6px;
  }

  .join-checkbox {
    display: flex;
    align-items: center;
    gap: 4px;
    padding: 4px 8px;
    border: 1px solid var(--alx-border, #ddd);
    border-radius: 4px;
    font-size: 12px;
    cursor: pointer;
  }

  .join-checkbox:has(input:checked) {
    border-color: var(--alx-primary, #4f46e5);
    background: white;
  }

  .variables-section {
    margin-top: 8px;
  }

  .variable-tags {
    display: flex;
    flex-wrap: wrap;
    gap: 4px;
    margin-top: 4px;
  }

  .variable-tag {
    background: var(--alx-bg-muted, #f3f4f6);
    padding: 2px 8px;
    border-radius: 12px;
    font-size: 11px;
    display: flex;
    align-items: center;
    gap: 4px;
  }

  .variable-tag .remove {
    cursor: pointer;
    color: var(--alx-text-muted, #9ca3af);
    font-weight: bold;
  }

  .insert-variable-btn {
    background: var(--alx-primary-bg, #eef2ff);
    color: var(--alx-primary, #4f46e5);
    border: 1px dashed var(--alx-primary, #4f46e5);
    padding: 2px 8px;
    border-radius: 12px;
    font-size: 11px;
    cursor: pointer;
  }

  .variable-picker-overlay {
    position: fixed;
    top: 0; left: 0; right: 0; bottom: 0;
    background: rgba(0,0,0,0.3);
    display: flex;
    align-items: center;
    justify-content: center;
    z-index: 1000;
  }

  .variable-picker {
    background: white;
    border-radius: 8px;
    padding: 16px;
    width: 400px;
    max-height: 500px;
    overflow-y: auto;
    box-shadow: 0 4px 24px rgba(0,0,0,0.15);
  }

  .variable-picker h3 {
    margin: 0 0 12px;
    font-size: 14px;
  }

  .picker-collection-tabs {
    display: flex;
    gap: 4px;
    margin-bottom: 8px;
  }

  .picker-collection-tab {
    padding: 4px 10px;
    border: 1px solid var(--alx-border, #ddd);
    border-radius: 4px;
    font-size: 12px;
    cursor: pointer;
    background: white;
  }

  .picker-collection-tab.active {
    background: var(--alx-primary, #4f46e5);
    color: white;
    border-color: var(--alx-primary, #4f46e5);
  }

  .picker-fields {
    display: flex;
    flex-direction: column;
    gap: 2px;
  }

  .picker-field {
    display: flex;
    justify-content: space-between;
    align-items: center;
    padding: 6px 8px;
    border-radius: 4px;
    cursor: pointer;
    font-size: 12px;
  }

  .picker-field:hover {
    background: var(--alx-primary-bg, #eef2ff);
  }

  .picker-field .type {
    color: var(--alx-text-muted, #9ca3af);
    font-size: 11px;
  }

  .picker-group-label {
    font-size: 11px;
    font-weight: 600;
    color: var(--alx-text-muted, #6b7280);
    padding: 8px 0 4px;
    text-transform: uppercase;
  }

  .fallback-editor textarea {
    width: 100%;
    min-height: 300px;
    padding: 12px;
    border: 1px solid var(--alx-border, #d1d5db);
    border-radius: var(--alx-radius, 6px);
    font-family: monospace;
    font-size: 13px;
    resize: vertical;
    box-sizing: border-box;
  }

  .actions {
    display: flex;
    gap: 8px;
    justify-content: flex-end;
    margin-top: 16px;
    padding-top: 12px;
    border-top: 1px solid var(--alx-border, #e5e7eb);
  }

  .error-msg {
    color: var(--alx-danger, #ef4444);
    font-size: 13px;
    margin-bottom: 8px;
  }
`;
