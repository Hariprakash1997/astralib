import { LitElement, html, css, nothing } from 'lit';
import { state } from 'lit/decorators.js';
import { safeRegister } from '../utils/safe-register.js';
import { StaffApiClient } from '../api/staff-api-client.js';
import {
  alxStaffResetStyles,
  alxStaffThemeStyles,
  alxStaffDensityStyles,
  alxStaffButtonStyles,
  alxStaffInputStyles,
  alxStaffCardStyles,
  alxStaffLoadingStyles,
} from '../styles/shared.js';

export class AlxStaffSetup extends LitElement {
  static styles = [
    alxStaffResetStyles,
    alxStaffThemeStyles,
    alxStaffDensityStyles,
    alxStaffButtonStyles,
    alxStaffInputStyles,
    alxStaffCardStyles,
    alxStaffLoadingStyles,
    css`
      :host { display: block; }

      .setup-wrapper {
        max-width: 420px;
        margin: 0 auto;
      }

      .setup-intro {
        font-size: 0.8125rem;
        color: var(--alx-text-muted);
        margin-bottom: 1.25rem;
        line-height: 1.5;
      }

      .setup-complete {
        text-align: center;
        padding: 2rem 1rem;
      }

      .setup-complete h3 {
        color: var(--alx-success);
        margin-bottom: 0.5rem;
      }

      .setup-complete p {
        color: var(--alx-text-muted);
        font-size: 0.8125rem;
      }
    `,
  ];

  @state() private name = '';
  @state() private email = '';
  @state() private password = '';
  @state() private confirmPassword = '';
  @state() private submitting = false;
  @state() private error = '';
  @state() private done = false;

  private async onSubmit(e: Event) {
    e.preventDefault();
    this.error = '';

    if (!this.name.trim() || !this.email.trim() || !this.password.trim()) {
      this.error = 'All fields are required.';
      return;
    }
    if (this.password !== this.confirmPassword) {
      this.error = 'Passwords do not match.';
      return;
    }
    if (this.password.length < 8) {
      this.error = 'Password must be at least 8 characters.';
      return;
    }

    this.submitting = true;
    try {
      const result = await StaffApiClient.setup({
        name: this.name.trim(),
        email: this.email.trim(),
        password: this.password,
      });
      this.done = true;
      this.dispatchEvent(new CustomEvent('setup-complete', {
        detail: { staff: result.staff, token: result.token },
        bubbles: true,
        composed: true,
      }));
    } catch (e) {
      const msg = e instanceof Error ? e.message : 'Setup failed';
      if (msg.toLowerCase().includes('already') || msg.toLowerCase().includes('exists')) {
        this.error = 'Setup has already been completed. Please log in instead.';
      } else {
        this.error = msg;
      }
    } finally {
      this.submitting = false;
    }
  }

  render() {
    if (this.done) {
      return html`
        <div class="alx-card">
          <div class="setup-complete">
            <h3>Setup Complete</h3>
            <p>Owner account created successfully. You can now log in.</p>
          </div>
        </div>
      `;
    }

    return html`
      <div class="alx-card">
        <div class="alx-card-header">
          <h3>Initial Setup</h3>
        </div>

        ${this.error ? html`<div class="alx-error">${this.error}</div>` : nothing}

        <div class="setup-wrapper">
          <p class="setup-intro">
            Create your owner account to get started. This can only be done once.
          </p>

          <form @submit=${this.onSubmit}>
            <div class="form-group">
              <label>Full Name</label>
              <input type="text" .value=${this.name}
                @input=${(e: Event) => this.name = (e.target as HTMLInputElement).value}
                placeholder="Your full name" required />
            </div>
            <div class="form-group">
              <label>Email</label>
              <input type="email" .value=${this.email}
                @input=${(e: Event) => this.email = (e.target as HTMLInputElement).value}
                placeholder="owner@example.com" required />
            </div>
            <div class="form-group">
              <label>Password</label>
              <input type="password" .value=${this.password}
                @input=${(e: Event) => this.password = (e.target as HTMLInputElement).value}
                placeholder="Min. 8 characters" required minlength="8" />
            </div>
            <div class="form-group">
              <label>Confirm Password</label>
              <input type="password" .value=${this.confirmPassword}
                @input=${(e: Event) => this.confirmPassword = (e.target as HTMLInputElement).value}
                placeholder="Repeat password" required />
            </div>

            <div class="form-actions">
              <button type="submit" class="alx-btn-primary" ?disabled=${this.submitting}>
                ${this.submitting ? 'Setting up...' : 'Create Owner Account'}
              </button>
            </div>
          </form>
        </div>
      </div>
    `;
  }
}

safeRegister('alx-staff-setup', AlxStaffSetup);
