import { LitElement, html, css, nothing } from 'lit';
import { state } from 'lit/decorators.js';
import { safeRegister } from '../utils/safe-register.js';
import { StaffApiClient } from '../api/staff-api-client.js';
import type { IPermissionGroup } from '@astralibx/staff-types';
import {
  alxStaffResetStyles,
  alxStaffThemeStyles,
  alxStaffDensityStyles,
  alxStaffButtonStyles,
  alxStaffInputStyles,
  alxStaffCardStyles,
  alxStaffLoadingStyles,
} from '../styles/shared.js';

export class AlxStaffCreateForm extends LitElement {
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

      .permission-group {
        margin-bottom: 0.75rem;
      }

      .permission-group-label {
        font-size: 0.75rem;
        font-weight: 600;
        color: var(--alx-text-muted);
        text-transform: uppercase;
        letter-spacing: 0.04em;
        margin-bottom: 0.375rem;
      }

      .permission-list {
        display: flex;
        flex-wrap: wrap;
        gap: 0.375rem;
      }

      .permission-item {
        display: flex;
        align-items: center;
        gap: 0.25rem;
        font-size: 0.75rem;
        color: var(--alx-text);
      }

      .permission-item input[type="checkbox"] {
        width: auto;
      }
    `,
  ];

  @state() private name = '';
  @state() private email = '';
  @state() private password = '';
  @state() private selectedPermissions: Set<string> = new Set();
  @state() private groups: IPermissionGroup[] = [];
  @state() private submitting = false;
  @state() private error = '';
  @state() private success = '';

  connectedCallback() {
    super.connectedCallback();
    this.loadGroups();
  }

  private async loadGroups() {
    try {
      this.groups = await StaffApiClient.listPermissionGroups();
    } catch {
      // Permission groups are optional for the form
    }
  }

  private togglePermission(key: string, checked: boolean) {
    const next = new Set(this.selectedPermissions);
    if (checked) {
      next.add(key);
      // Auto-check corresponding view permission for edit keys
      if (key.endsWith('.edit')) {
        const viewKey = key.replace('.edit', '.view');
        next.add(viewKey);
      }
    } else {
      next.delete(key);
    }
    this.selectedPermissions = next;
  }

  private async onSubmit(e: Event) {
    e.preventDefault();
    if (!this.name.trim() || !this.email.trim() || !this.password.trim()) {
      this.error = 'Name, email, and password are required.';
      return;
    }
    this.submitting = true;
    this.error = '';
    this.success = '';
    try {
      const staff = await StaffApiClient.createStaff({
        name: this.name.trim(),
        email: this.email.trim(),
        password: this.password,
        permissions: Array.from(this.selectedPermissions),
      });
      this.success = `Staff member "${staff.name}" created successfully.`;
      this.name = '';
      this.email = '';
      this.password = '';
      this.selectedPermissions = new Set();
      this.dispatchEvent(new CustomEvent('staff-created', {
        detail: { staff },
        bubbles: true,
        composed: true,
      }));
    } catch (e) {
      this.error = e instanceof Error ? e.message : 'Failed to create staff member';
    } finally {
      this.submitting = false;
    }
  }

  render() {
    return html`
      <div class="alx-card">
        <div class="alx-card-header">
          <h3>Create Staff Member</h3>
        </div>

        ${this.error ? html`<div class="alx-error">${this.error}</div>` : nothing}
        ${this.success ? html`<div class="alx-success-msg">${this.success}</div>` : nothing}

        <form @submit=${this.onSubmit}>
          <div class="form-group">
            <label>Name</label>
            <input type="text" .value=${this.name}
              @input=${(e: Event) => this.name = (e.target as HTMLInputElement).value}
              placeholder="Full name" required />
          </div>
          <div class="form-group">
            <label>Email</label>
            <input type="email" .value=${this.email}
              @input=${(e: Event) => this.email = (e.target as HTMLInputElement).value}
              placeholder="email@example.com" required />
          </div>
          <div class="form-group">
            <label>Password</label>
            <input type="password" .value=${this.password}
              @input=${(e: Event) => this.password = (e.target as HTMLInputElement).value}
              placeholder="Temporary password" required />
          </div>

          ${this.groups.length > 0 ? html`
            <div class="form-section">
              <div class="form-section-title">Permissions (optional)</div>
              ${this.groups.map(group => html`
                <div class="permission-group">
                  <div class="permission-group-label">${group.label}</div>
                  <div class="permission-list">
                    ${group.permissions.map(p => html`
                      <label class="permission-item">
                        <input type="checkbox"
                          .checked=${this.selectedPermissions.has(p.key)}
                          @change=${(e: Event) => this.togglePermission(p.key, (e.target as HTMLInputElement).checked)} />
                        ${p.label}
                      </label>
                    `)}
                  </div>
                </div>
              `)}
            </div>
          ` : nothing}

          <div class="form-actions">
            <button type="button" @click=${() => this.dispatchEvent(new CustomEvent('cancel', { bubbles: true, composed: true }))}>
              Cancel
            </button>
            <button type="submit" class="alx-btn-primary" ?disabled=${this.submitting}>
              ${this.submitting ? 'Creating...' : 'Create Staff'}
            </button>
          </div>
        </form>
      </div>
    `;
  }
}

safeRegister('alx-staff-create-form', AlxStaffCreateForm);
