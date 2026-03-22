import { LitElement, html, css, nothing } from 'lit';
import { property, state } from 'lit/decorators.js';
import { safeRegister } from '../utils/safe-register.js';
import { StaffApiClient } from '../api/staff-api-client.js';
import {
  alxStaffResetStyles,
  alxStaffThemeStyles,
  alxStaffDensityStyles,
  alxStaffButtonStyles,
  alxStaffCardStyles,
  alxStaffBadgeStyles,
  alxStaffLoadingStyles,
} from '../styles/shared.js';

export class AlxStaffStatusToggle extends LitElement {
  static styles = [
    alxStaffResetStyles,
    alxStaffThemeStyles,
    alxStaffDensityStyles,
    alxStaffButtonStyles,
    alxStaffCardStyles,
    alxStaffBadgeStyles,
    alxStaffLoadingStyles,
    css`
      :host { display: block; }

      .status-row {
        display: flex;
        align-items: center;
        gap: 0.75rem;
        padding: 0.75rem 0;
      }

      .status-label {
        font-size: 0.8125rem;
        color: var(--alx-text-muted);
      }

      .confirm-box {
        background: color-mix(in srgb, var(--alx-warning) 8%, transparent);
        border: 1px solid color-mix(in srgb, var(--alx-warning) 30%, transparent);
        border-radius: var(--alx-radius);
        padding: 0.625rem 0.75rem;
        margin-bottom: 0.75rem;
        font-size: 0.8125rem;
        color: var(--alx-text);
      }

      .confirm-actions {
        display: flex;
        gap: 0.5rem;
        margin-top: 0.5rem;
      }
    `,
  ];

  @property({ type: String }) staffId = '';
  @property({ type: String }) currentStatus = 'active';

  @state() private confirming = false;
  @state() private saving = false;
  @state() private error = '';

  private get nextStatus() {
    if (this.currentStatus === 'active') return 'inactive';
    return 'active';
  }

  private get statusBadgeClass() {
    if (this.currentStatus === 'active') return 'alx-badge alx-badge-success';
    if (this.currentStatus === 'inactive') return 'alx-badge alx-badge-danger';
    return 'alx-badge alx-badge-warning';
  }

  private async onConfirm() {
    this.saving = true;
    this.error = '';
    try {
      const updated = await StaffApiClient.updateStatus(this.staffId, this.nextStatus);
      this.currentStatus = updated.status;
      this.confirming = false;
      this.dispatchEvent(new CustomEvent('status-changed', {
        detail: { staffId: this.staffId, status: updated.status },
        bubbles: true,
        composed: true,
      }));
    } catch (e) {
      this.error = e instanceof Error ? e.message : 'Failed to update status';
    } finally {
      this.saving = false;
    }
  }

  render() {
    return html`
      <div class="alx-card">
        <div class="alx-card-header">
          <h3>Staff Status</h3>
        </div>

        ${this.error ? html`<div class="alx-error">${this.error}</div>` : nothing}

        <div class="status-row">
          <span class="status-label">Current status:</span>
          <span class="${this.statusBadgeClass}">${this.currentStatus}</span>
        </div>

        ${this.confirming ? html`
          <div class="confirm-box">
            Are you sure you want to change status to
            <strong>${this.nextStatus}</strong>?
            <div class="confirm-actions">
              <button class="alx-btn-primary alx-btn-sm" ?disabled=${this.saving}
                @click=${this.onConfirm}>
                ${this.saving ? 'Updating...' : 'Confirm'}
              </button>
              <button class="alx-btn-sm" @click=${() => this.confirming = false}>Cancel</button>
            </div>
          </div>
        ` : html`
          <button
            class="alx-btn-sm ${this.currentStatus === 'active' ? 'alx-btn-danger' : 'alx-btn-success'}"
            @click=${() => this.confirming = true}>
            ${this.currentStatus === 'active' ? 'Deactivate' : 'Activate'}
          </button>
        `}
      </div>
    `;
  }
}

safeRegister('alx-staff-status-toggle', AlxStaffStatusToggle);
