import { LitElement, html, css, nothing } from 'lit';
import { property, state } from 'lit/decorators.js';
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

export class AlxStaffPasswordReset extends LitElement {
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
    `,
  ];

  @property({ type: String }) staffId = '';

  @state() private newPassword = '';
  @state() private confirmPassword = '';
  @state() private submitting = false;
  @state() private error = '';
  @state() private success = '';

  private async onSubmit(e: Event) {
    e.preventDefault();
    this.error = '';

    if (!this.newPassword.trim()) {
      this.error = 'Password is required.';
      return;
    }
    if (this.newPassword !== this.confirmPassword) {
      this.error = 'Passwords do not match.';
      return;
    }
    if (this.newPassword.length < 8) {
      this.error = 'Password must be at least 8 characters.';
      return;
    }

    this.submitting = true;
    this.success = '';
    try {
      await StaffApiClient.resetPassword(this.staffId, this.newPassword);
      this.success = 'Password reset successfully.';
      this.newPassword = '';
      this.confirmPassword = '';
      this.dispatchEvent(new CustomEvent('password-reset', {
        detail: { staffId: this.staffId },
        bubbles: true,
        composed: true,
      }));
    } catch (e) {
      this.error = e instanceof Error ? e.message : 'Failed to reset password';
    } finally {
      this.submitting = false;
    }
  }

  render() {
    return html`
      <div class="alx-card">
        <div class="alx-card-header">
          <h3>Reset Password</h3>
        </div>

        ${this.error ? html`<div class="alx-error">${this.error}</div>` : nothing}
        ${this.success ? html`<div class="alx-success-msg">${this.success}</div>` : nothing}

        <form @submit=${this.onSubmit}>
          <div class="form-group">
            <label>New Password</label>
            <input type="password" .value=${this.newPassword}
              @input=${(e: Event) => this.newPassword = (e.target as HTMLInputElement).value}
              placeholder="Enter new password" required minlength="8" />
          </div>
          <div class="form-group">
            <label>Confirm Password</label>
            <input type="password" .value=${this.confirmPassword}
              @input=${(e: Event) => this.confirmPassword = (e.target as HTMLInputElement).value}
              placeholder="Repeat new password" required />
          </div>

          <div class="form-actions">
            <button type="button"
              @click=${() => this.dispatchEvent(new CustomEvent('cancel', { bubbles: true, composed: true }))}>
              Cancel
            </button>
            <button type="submit" class="alx-btn-primary" ?disabled=${this.submitting}>
              ${this.submitting ? 'Resetting...' : 'Reset Password'}
            </button>
          </div>
        </form>
      </div>
    `;
  }
}

safeRegister('alx-staff-password-reset', AlxStaffPasswordReset);
