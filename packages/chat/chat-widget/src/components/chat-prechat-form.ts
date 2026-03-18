import { LitElement, html, css, nothing } from 'lit';
import { property, state } from 'lit/decorators.js';
import { classMap } from 'lit/directives/class-map.js';
import type { FormField } from '@astralibx/chat-types';
import { chatResetStyles, chatBaseStyles, chatAnimations } from '../styles/shared.js';
import { safeRegister } from '../utils/safe-register.js';

/**
 * <alx-chat-prechat-form> -- Simple form for collecting visitor info
 * before starting a chat session.
 */
export class AlxChatPrechatForm extends LitElement {
  static styles = [
    chatResetStyles,
    chatBaseStyles,
    chatAnimations,
    css`
      :host {
        display: block;
        height: 100%;
      }

      .form-container {
        display: flex;
        flex-direction: column;
        height: 100%;
        overflow: hidden;
        animation: alx-fadeInUp 0.3s var(--alx-chat-spring-smooth);
      }

      .form-header {
        padding: 24px 20px 16px;
        flex-shrink: 0;
      }

      .form-title {
        font-size: 18px;
        font-weight: 700;
        color: var(--alx-chat-text);
      }

      .form-body {
        flex: 1;
        overflow-y: auto;
        padding: 0 20px;
      }

      .form-field {
        margin-bottom: 16px;
      }

      .field-label {
        display: block;
        font-size: 13px;
        font-weight: 600;
        color: var(--alx-chat-text);
        margin-bottom: 6px;
      }

      .required-mark {
        color: var(--alx-chat-danger);
        margin-left: 2px;
      }

      .field-input,
      .field-textarea,
      .field-select {
        width: 100%;
        padding: 10px 12px;
        border: 1px solid var(--alx-chat-border);
        border-radius: var(--alx-chat-radius-sm);
        background: var(--alx-chat-surface);
        color: var(--alx-chat-text);
        font-family: var(--alx-chat-font);
        font-size: 13px;
        outline: none;
        transition: border-color 0.2s var(--alx-chat-spring-smooth);
      }

      .field-input::placeholder,
      .field-textarea::placeholder {
        color: var(--alx-chat-text-muted);
      }

      .field-input:focus,
      .field-textarea:focus,
      .field-select:focus {
        border-color: var(--alx-chat-primary);
      }

      .field-input.error,
      .field-textarea.error,
      .field-select.error {
        border-color: var(--alx-chat-danger);
      }

      .field-textarea {
        min-height: 80px;
        resize: vertical;
      }

      .field-select {
        cursor: pointer;
        appearance: none;
        background-image: url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='16' height='16' viewBox='0 0 24 24' fill='none' stroke='%239ca3af' stroke-width='2' stroke-linecap='round' stroke-linejoin='round'%3E%3Cpolyline points='6 9 12 15 18 9'/%3E%3C/svg%3E");
        background-repeat: no-repeat;
        background-position: right 10px center;
        padding-right: 32px;
      }

      .field-select option {
        background: var(--alx-chat-surface);
        color: var(--alx-chat-text);
      }

      .radio-group,
      .checkbox-group {
        display: flex;
        flex-direction: column;
        gap: 8px;
      }

      .radio-option,
      .checkbox-option {
        display: flex;
        align-items: center;
        gap: 8px;
        cursor: pointer;
        font-size: 13px;
        color: var(--alx-chat-text);
      }

      .radio-option input,
      .checkbox-option input {
        accent-color: var(--alx-chat-primary);
        cursor: pointer;
        width: 16px;
        height: 16px;
      }

      .multiselect-container {
        display: flex;
        flex-direction: column;
        gap: 6px;
        border: 1px solid var(--alx-chat-border);
        border-radius: var(--alx-chat-radius-sm);
        padding: 8px;
        max-height: 160px;
        overflow-y: auto;
        background: var(--alx-chat-surface);
      }

      .multiselect-option {
        display: flex;
        align-items: center;
        gap: 8px;
        padding: 6px 8px;
        border-radius: 4px;
        cursor: pointer;
        font-size: 13px;
        color: var(--alx-chat-text);
        transition: background 0.15s var(--alx-chat-spring-smooth);
      }

      .multiselect-option:hover {
        background: var(--alx-chat-surface-hover);
      }

      .multiselect-option input {
        accent-color: var(--alx-chat-primary);
        cursor: pointer;
        width: 16px;
        height: 16px;
      }

      .field-error {
        font-size: 11px;
        color: var(--alx-chat-danger);
        margin-top: 4px;
        line-height: 1.3;
      }

      .form-footer {
        padding: 16px 20px;
        flex-shrink: 0;
        border-top: 1px solid var(--alx-chat-border);
      }

      .submit-btn {
        display: block;
        width: 100%;
        padding: 12px;
        border: none;
        border-radius: var(--alx-chat-radius-sm);
        background: var(--alx-chat-primary);
        color: var(--alx-chat-primary-text);
        font-family: var(--alx-chat-font);
        font-size: 14px;
        font-weight: 600;
        cursor: pointer;
        transition: background 0.2s var(--alx-chat-spring-smooth);
      }

      .submit-btn:hover {
        background: var(--alx-chat-primary-hover);
      }

      .submit-btn:disabled {
        opacity: 0.5;
        cursor: not-allowed;
      }

      .skip-link {
        display: block;
        text-align: center;
        margin-top: 12px;
        background: none;
        border: none;
        color: var(--alx-chat-text-muted);
        font-family: var(--alx-chat-font);
        font-size: 12px;
        cursor: pointer;
        text-decoration: underline;
        text-underline-offset: 2px;
        transition: color 0.2s var(--alx-chat-spring-smooth);
      }

      .skip-link:hover {
        color: var(--alx-chat-text);
      }
    `,
  ];

  @property() title = '';
  @property({ type: Array }) fields: FormField[] = [];
  @property() submitText = 'Start Chat';
  @property({ type: Boolean }) canSkipToChat = false;

  @state() private formData: Record<string, unknown> = {};
  @state() private errors: Record<string, string> = {};
  @state() private touched: Set<string> = new Set();

  render() {
    return html`
      <div class="form-container">
        ${this.title
          ? html`
              <div class="form-header">
                <h2 class="form-title">${this.title}</h2>
              </div>
            `
          : nothing}

        <div class="form-body">
          ${this.fields.map((field) => this.renderField(field))}
        </div>

        <div class="form-footer">
          <button class="submit-btn" @click=${this.handleSubmit}>
            ${this.submitText}
          </button>
          ${this.canSkipToChat
            ? html`<button class="skip-link" @click=${this.handleSkip}>Skip to chat</button>`
            : nothing}
        </div>
      </div>
    `;
  }

  private renderField(field: FormField) {
    const error = this.touched.has(field.key) ? this.errors[field.key] : undefined;
    const hasError = !!error;

    return html`
      <div class="form-field">
        <label class="field-label">
          ${field.label}
          ${field.required ? html`<span class="required-mark">*</span>` : nothing}
        </label>
        ${this.renderFieldInput(field, hasError)}
        ${error ? html`<div class="field-error">${error}</div>` : nothing}
      </div>
    `;
  }

  private renderFieldInput(field: FormField, hasError: boolean) {
    const value = this.formData[field.key];

    switch (field.type) {
      case 'text':
      case 'email':
      case 'phone':
        return html`
          <input
            class=${classMap({ 'field-input': true, error: hasError })}
            type=${field.type === 'phone' ? 'tel' : field.type}
            placeholder=${field.placeholder ?? ''}
            .value=${(value as string) ?? ''}
            @input=${(e: Event) => this.handleFieldInput(field, (e.target as HTMLInputElement).value)}
            @blur=${() => this.markTouched(field.key)}
          />
        `;

      case 'textarea':
        return html`
          <textarea
            class=${classMap({ 'field-textarea': true, error: hasError })}
            placeholder=${field.placeholder ?? ''}
            .value=${(value as string) ?? ''}
            @input=${(e: Event) => this.handleFieldInput(field, (e.target as HTMLTextAreaElement).value)}
            @blur=${() => this.markTouched(field.key)}
          ></textarea>
        `;

      case 'select':
        return html`
          <select
            class=${classMap({ 'field-select': true, error: hasError })}
            @change=${(e: Event) => this.handleFieldInput(field, (e.target as HTMLSelectElement).value)}
            @blur=${() => this.markTouched(field.key)}
          >
            <option value="">${field.placeholder ?? 'Select...'}</option>
            ${(field.options ?? []).map(
              (opt) => html`
                <option value=${opt.value} ?selected=${value === opt.value}>
                  ${opt.label}
                </option>
              `,
            )}
          </select>
        `;

      case 'multiselect':
        return html`
          <div class="multiselect-container">
            ${(field.options ?? []).map(
              (opt) => html`
                <label class="multiselect-option">
                  <input
                    type="checkbox"
                    .checked=${Array.isArray(value) && (value as string[]).includes(opt.value)}
                    @change=${(e: Event) => this.handleMultiselectChange(field, opt.value, (e.target as HTMLInputElement).checked)}
                  />
                  ${opt.label}
                </label>
              `,
            )}
          </div>
        `;

      case 'radio':
        return html`
          <div class="radio-group">
            ${(field.options ?? []).map(
              (opt) => html`
                <label class="radio-option">
                  <input
                    type="radio"
                    name=${field.key}
                    .checked=${value === opt.value}
                    @change=${() => this.handleFieldInput(field, opt.value)}
                  />
                  ${opt.label}
                </label>
              `,
            )}
          </div>
        `;

      case 'checkbox':
        return html`
          <div class="checkbox-group">
            <label class="checkbox-option">
              <input
                type="checkbox"
                .checked=${!!value}
                @change=${(e: Event) => this.handleFieldInput(field, (e.target as HTMLInputElement).checked)}
              />
              ${field.placeholder ?? field.label}
            </label>
          </div>
        `;

      default:
        return nothing;
    }
  }

  private handleFieldInput(field: FormField, value: unknown) {
    this.formData = { ...this.formData, [field.key]: value };
    this.validateField(field);
  }

  private handleMultiselectChange(field: FormField, optionValue: string, checked: boolean) {
    const current = (this.formData[field.key] as string[]) ?? [];
    const next = checked
      ? [...current, optionValue]
      : current.filter((v) => v !== optionValue);

    this.formData = { ...this.formData, [field.key]: next };
    this.markTouched(field.key);
    this.validateField(field);
  }

  private markTouched(key: string) {
    const next = new Set(this.touched);
    next.add(key);
    this.touched = next;

    const field = this.fields.find((f) => f.key === key);
    if (field) this.validateField(field);
  }

  private validateField(field: FormField): boolean {
    const value = this.formData[field.key];
    const errors = { ...this.errors };

    // Required check
    if (field.required) {
      const isEmpty =
        value === undefined ||
        value === null ||
        value === '' ||
        (Array.isArray(value) && value.length === 0);

      if (isEmpty) {
        errors[field.key] = field.validation?.errorMessage ?? `${field.label} is required`;
        this.errors = errors;
        return false;
      }
    }

    if (typeof value === 'string' && value) {
      // Pattern validation
      if (field.validation?.pattern) {
        const regex = new RegExp(field.validation.pattern);
        if (!regex.test(value)) {
          errors[field.key] = field.validation.errorMessage ?? `Invalid ${field.label.toLowerCase()}`;
          this.errors = errors;
          return false;
        }
      }

      // Min length
      if (field.validation?.minLength && value.length < field.validation.minLength) {
        errors[field.key] =
          field.validation.errorMessage ??
          `${field.label} must be at least ${field.validation.minLength} characters`;
        this.errors = errors;
        return false;
      }

      // Max length
      if (field.validation?.maxLength && value.length > field.validation.maxLength) {
        errors[field.key] =
          field.validation.errorMessage ??
          `${field.label} must be at most ${field.validation.maxLength} characters`;
        this.errors = errors;
        return false;
      }

      // Built-in email validation
      if (field.type === 'email' && !field.validation?.pattern) {
        const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
        if (!emailRegex.test(value)) {
          errors[field.key] = 'Please enter a valid email address';
          this.errors = errors;
          return false;
        }
      }
    }

    delete errors[field.key];
    this.errors = errors;
    return true;
  }

  private validateAll(): boolean {
    let isValid = true;
    const allTouched = new Set(this.touched);

    for (const field of this.fields) {
      allTouched.add(field.key);
      if (!this.validateField(field)) {
        isValid = false;
      }
    }

    this.touched = allTouched;
    return isValid;
  }

  private handleSubmit() {
    if (!this.validateAll()) return;

    this.dispatchEvent(
      new CustomEvent('form-submitted', {
        detail: { data: { ...this.formData } },
        bubbles: true,
        composed: true,
      }),
    );

    this.dispatchEvent(
      new CustomEvent('step-complete', {
        detail: { data: { ...this.formData } },
        bubbles: true,
        composed: true,
      }),
    );
  }

  private handleSkip() {
    this.dispatchEvent(
      new CustomEvent('skip-to-chat', { bubbles: true, composed: true }),
    );
  }
}

safeRegister('alx-chat-prechat-form', AlxChatPrechatForm);
