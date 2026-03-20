import { LitElement, html, css, nothing } from 'lit';
import { property, state } from 'lit/decorators.js';
import { classMap } from 'lit/directives/class-map.js';
import type { FormField } from '@astralibx/chat-types';
import { chatResetStyles, chatBaseStyles, chatAnimations } from '../styles/shared.js';
import { safeRegister } from '../utils/safe-register.js';

/**
 * <alx-chat-offline> -- Offline mode display.
 *
 * Shown when no agents or AI are available.
 * Two modes: static message or "leave a message" form.
 */
export class AlxChatOffline extends LitElement {
  static styles = [
    chatResetStyles,
    chatBaseStyles,
    chatAnimations,
    css`
      :host {
        display: block;
        height: 100%;
      }

      .offline-container {
        display: flex;
        flex-direction: column;
        height: 100%;
        overflow: hidden;
        animation: alx-fadeInUp 0.3s var(--alx-chat-spring-smooth);
      }

      /* -- Message mode -- */

      .message-container {
        display: flex;
        flex-direction: column;
        align-items: center;
        justify-content: center;
        text-align: center;
        padding: 48px 24px;
        height: 100%;
      }

      .offline-icon {
        width: 64px;
        height: 64px;
        border-radius: 50%;
        background: var(--alx-chat-surface);
        display: flex;
        align-items: center;
        justify-content: center;
        margin-bottom: 20px;
      }

      .offline-icon svg {
        width: 32px;
        height: 32px;
        fill: none;
        stroke: var(--alx-chat-text-muted);
        stroke-width: 2;
        stroke-linecap: round;
        stroke-linejoin: round;
      }

      .offline-title {
        font-size: 18px;
        font-weight: 700;
        color: var(--alx-chat-text);
        margin-bottom: 8px;
      }

      .offline-message {
        font-size: 14px;
        color: var(--alx-chat-text-muted);
        line-height: 1.5;
        max-width: 280px;
      }

      .reopen-message {
        font-size: 13px;
        color: var(--alx-chat-primary);
        font-weight: 500;
        margin-top: 12px;
        max-width: 280px;
        line-height: 1.4;
      }

      /* -- Form mode -- */

      .form-header {
        padding: 24px 20px 12px;
        flex-shrink: 0;
      }

      .form-icon-row {
        display: flex;
        align-items: center;
        gap: 12px;
        margin-bottom: 8px;
      }

      .form-icon {
        width: 40px;
        height: 40px;
        border-radius: 50%;
        background: var(--alx-chat-surface);
        display: flex;
        align-items: center;
        justify-content: center;
        flex-shrink: 0;
      }

      .form-icon svg {
        width: 20px;
        height: 20px;
        fill: none;
        stroke: var(--alx-chat-text-muted);
        stroke-width: 2;
        stroke-linecap: round;
        stroke-linejoin: round;
      }

      .form-title {
        font-size: 18px;
        font-weight: 700;
        color: var(--alx-chat-text);
      }

      .form-subtitle {
        font-size: 13px;
        color: var(--alx-chat-text-muted);
        margin-top: 4px;
      }

      .form-body {
        flex: 1;
        overflow-y: auto;
        padding: 12px 20px;
      }

      .form-field {
        margin-bottom: 14px;
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
      .field-textarea {
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
      .field-textarea:focus {
        border-color: var(--alx-chat-primary);
      }

      .field-input.error,
      .field-textarea.error {
        border-color: var(--alx-chat-danger);
      }

      .field-textarea {
        min-height: 100px;
        resize: vertical;
      }

      .field-error {
        font-size: 11px;
        color: var(--alx-chat-danger);
        margin-top: 4px;
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

      /* -- Success state -- */

      .success-container {
        display: flex;
        flex-direction: column;
        align-items: center;
        justify-content: center;
        text-align: center;
        padding: 48px 24px;
        height: 100%;
        animation: alx-scaleIn 0.4s var(--alx-chat-spring-bounce);
      }

      .success-icon {
        width: 64px;
        height: 64px;
        border-radius: 50%;
        background: color-mix(in srgb, var(--alx-chat-success) 15%, var(--alx-chat-surface));
        display: flex;
        align-items: center;
        justify-content: center;
        margin-bottom: 16px;
      }

      .success-icon svg {
        width: 32px;
        height: 32px;
        fill: none;
        stroke: var(--alx-chat-success);
        stroke-width: 2.5;
        stroke-linecap: round;
        stroke-linejoin: round;
      }

      .success-text {
        font-size: 16px;
        font-weight: 600;
        color: var(--alx-chat-text);
        margin-bottom: 4px;
      }

      .success-subtext {
        font-size: 13px;
        color: var(--alx-chat-text-muted);
        max-width: 260px;
      }
    `,
  ];

  @property() mode: 'form' | 'message' = 'message';
  @property() title = 'We are currently offline';
  @property() message = 'Our team is not available right now. Please leave a message and we will get back to you.';
  @property() reopenMessage = '';
  @property({ type: Array }) formFields: FormField[] = [];

  @state() private formData: Record<string, string> = {};
  @state() private errors: Record<string, string> = {};
  @state() private messageSent = false;

  private defaultFormFields: FormField[] = [
    { key: 'name', label: 'Name', type: 'text', placeholder: 'Your name', required: true },
    { key: 'email', label: 'Email', type: 'email', placeholder: 'your@email.com', required: true },
    { key: 'message', label: 'Message', type: 'textarea', placeholder: 'How can we help?', required: true },
  ];

  private get activeFields(): FormField[] {
    return this.formFields.length > 0 ? this.formFields : this.defaultFormFields;
  }

  render() {
    if (this.messageSent) {
      return this.renderSuccess();
    }

    if (this.mode === 'message') {
      return this.renderMessage();
    }

    return this.renderForm();
  }

  private renderMessage() {
    return html`
      <div class="offline-container">
        <div class="message-container">
          <div class="offline-icon">
            <svg viewBox="0 0 24 24">
              <circle cx="12" cy="12" r="10"/>
              <line x1="12" y1="8" x2="12" y2="12"/>
              <line x1="12" y1="16" x2="12.01" y2="16"/>
            </svg>
          </div>
          <h2 class="offline-title">${this.title}</h2>
          <p class="offline-message">${this.message}</p>
          ${this.reopenMessage ? html`<p class="reopen-message">${this.reopenMessage}</p>` : nothing}
        </div>
      </div>
    `;
  }

  private renderForm() {
    const fields = this.activeFields;

    return html`
      <div class="offline-container">
        <div class="form-header">
          <div class="form-icon-row">
            <div class="form-icon">
              <svg viewBox="0 0 24 24">
                <path d="M4 4h16c1.1 0 2 .9 2 2v12c0 1.1-.9 2-2 2H4c-1.1 0-2-.9-2-2V6c0-1.1.9-2 2-2z"/>
                <polyline points="22,6 12,13 2,6"/>
              </svg>
            </div>
            <div>
              <h2 class="form-title">${this.title}</h2>
              <p class="form-subtitle">Leave us a message and we will get back to you.</p>
            </div>
          </div>
        </div>

        <div class="form-body">
          ${fields.map((field) => this.renderFormField(field))}
        </div>

        <div class="form-footer">
          <button class="submit-btn" @click=${this.handleSubmit}>
            Send Message
          </button>
        </div>
      </div>
    `;
  }

  private renderFormField(field: FormField) {
    const error = this.errors[field.key];
    const hasError = !!error;

    return html`
      <div class="form-field">
        <label class="field-label">
          ${field.label}
          ${field.required ? html`<span class="required-mark">*</span>` : nothing}
        </label>
        ${field.type === 'textarea'
          ? html`
              <textarea
                class=${classMap({ 'field-textarea': true, error: hasError })}
                placeholder=${field.placeholder ?? ''}
                .value=${this.formData[field.key] ?? ''}
                @input=${(e: Event) => this.handleInput(field.key, (e.target as HTMLTextAreaElement).value)}
              ></textarea>
            `
          : html`
              <input
                class=${classMap({ 'field-input': true, error: hasError })}
                type=${field.type === 'phone' ? 'tel' : field.type}
                placeholder=${field.placeholder ?? ''}
                .value=${this.formData[field.key] ?? ''}
                @input=${(e: Event) => this.handleInput(field.key, (e.target as HTMLInputElement).value)}
              />
            `}
        ${error ? html`<div class="field-error">${error}</div>` : nothing}
      </div>
    `;
  }

  private renderSuccess() {
    return html`
      <div class="offline-container">
        <div class="success-container">
          <div class="success-icon">
            <svg viewBox="0 0 24 24">
              <polyline points="20 6 9 17 4 12"/>
            </svg>
          </div>
          <div class="success-text">Message sent!</div>
          <div class="success-subtext">We received your message and will get back to you as soon as possible.</div>
        </div>
      </div>
    `;
  }

  private handleInput(key: string, value: string) {
    this.formData = { ...this.formData, [key]: value };
    // Clear error on input
    if (this.errors[key]) {
      const errors = { ...this.errors };
      delete errors[key];
      this.errors = errors;
    }
  }

  private handleSubmit() {
    const fields = this.activeFields;
    const errors: Record<string, string> = {};

    for (const field of fields) {
      const value = (this.formData[field.key] ?? '').trim();

      if (field.required && !value) {
        errors[field.key] = `${field.label} is required`;
        continue;
      }

      if (value && field.type === 'email') {
        const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
        if (!emailRegex.test(value)) {
          errors[field.key] = 'Please enter a valid email address';
        }
      }

      if (value && field.validation?.pattern) {
        const regex = new RegExp(field.validation.pattern);
        if (!regex.test(value)) {
          errors[field.key] = field.validation.errorMessage ?? `Invalid ${field.label.toLowerCase()}`;
        }
      }
    }

    this.errors = errors;

    if (Object.keys(errors).length > 0) return;

    this.messageSent = true;

    this.dispatchEvent(
      new CustomEvent('offline-message-submitted', {
        detail: { data: { ...this.formData } },
        bubbles: true,
        composed: true,
      }),
    );
  }
}

safeRegister('alx-chat-offline', AlxChatOffline);
