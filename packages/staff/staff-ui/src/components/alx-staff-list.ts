import { LitElement, html, css, nothing } from 'lit';
import { property, state } from 'lit/decorators.js';
import { safeRegister } from '../utils/safe-register.js';
import { StaffApiClient } from '../api/staff-api-client.js';
import type { IStaffSummary, IStaffListFilters } from '@astralibx/staff-types';
import {
  alxStaffResetStyles,
  alxStaffThemeStyles,
  alxStaffDensityStyles,
  alxStaffButtonStyles,
  alxStaffInputStyles,
  alxStaffTableStyles,
  alxStaffCardStyles,
  alxStaffBadgeStyles,
  alxStaffLoadingStyles,
  alxStaffToolbarStyles,
} from '../styles/shared.js';

export class AlxStaffList extends LitElement {
  static styles = [
    alxStaffResetStyles,
    alxStaffThemeStyles,
    alxStaffDensityStyles,
    alxStaffButtonStyles,
    alxStaffInputStyles,
    alxStaffTableStyles,
    alxStaffCardStyles,
    alxStaffBadgeStyles,
    alxStaffLoadingStyles,
    alxStaffToolbarStyles,
    css`
      :host { display: block; }

      .actions { display: flex; gap: 0.25rem; }

      .page-info {
        font-size: 0.75rem;
        color: var(--alx-text-muted);
      }
    `,
  ];

  @property({ type: String }) density: 'default' | 'compact' = 'default';

  @state() private staff: IStaffSummary[] = [];
  @state() private loading = false;
  @state() private error = '';
  @state() private page = 1;
  @state() private limit = 20;
  @state() private total = 0;
  @state() private totalPages = 1;
  @state() private filterStatus = '';
  @state() private filterRole = '';

  connectedCallback() {
    super.connectedCallback();
    this.loadStaff();
  }

  private async loadStaff() {
    this.loading = true;
    this.error = '';
    try {
      const filters: IStaffListFilters = { page: this.page, limit: this.limit };
      if (this.filterStatus) filters.status = this.filterStatus as IStaffListFilters['status'];
      if (this.filterRole) filters.role = this.filterRole as IStaffListFilters['role'];
      const result = await StaffApiClient.listStaff(filters);
      this.staff = result.data;
      this.total = result.pagination.total;
      this.totalPages = result.pagination.totalPages;
    } catch (e) {
      this.error = e instanceof Error ? e.message : 'Failed to load staff';
    } finally {
      this.loading = false;
    }
  }

  private onEditPermissions(staffId: string) {
    this.dispatchEvent(new CustomEvent('edit-permissions', { detail: { staffId }, bubbles: true, composed: true }));
  }

  private onResetPassword(staffId: string) {
    this.dispatchEvent(new CustomEvent('reset-password', { detail: { staffId }, bubbles: true, composed: true }));
  }

  private onToggleStatus(staffId: string, currentStatus: string) {
    this.dispatchEvent(new CustomEvent('toggle-status', { detail: { staffId, currentStatus }, bubbles: true, composed: true }));
  }

  private prevPage() {
    if (this.page > 1) { this.page--; this.loadStaff(); }
  }

  private nextPage() {
    if (this.page < this.totalPages) { this.page++; this.loadStaff(); }
  }

  private statusBadgeClass(status: string) {
    if (status === 'active') return 'alx-badge alx-badge-success';
    if (status === 'inactive') return 'alx-badge alx-badge-danger';
    return 'alx-badge alx-badge-warning';
  }

  private formatDate(date?: Date | string) {
    if (!date) return '—';
    return new Date(date).toLocaleDateString();
  }

  render() {
    return html`
      <div class="alx-card">
        <div class="alx-card-header">
          <h3>Staff Members</h3>
          <button class="alx-btn-primary alx-btn-sm"
            @click=${() => this.dispatchEvent(new CustomEvent('create-staff', { bubbles: true, composed: true }))}>
            + Add Staff
          </button>
        </div>

        ${this.error ? html`<div class="alx-error">${this.error}</div>` : nothing}

        <div class="toolbar">
          <select @change=${(e: Event) => { this.filterStatus = (e.target as HTMLSelectElement).value; this.page = 1; this.loadStaff(); }}>
            <option value="">All Statuses</option>
            <option value="active">Active</option>
            <option value="inactive">Inactive</option>
            <option value="pending">Pending</option>
          </select>
          <select @change=${(e: Event) => { this.filterRole = (e.target as HTMLSelectElement).value; this.page = 1; this.loadStaff(); }}>
            <option value="">All Roles</option>
            <option value="owner">Owner</option>
            <option value="staff">Staff</option>
          </select>
          <div class="spacer"></div>
          <span class="page-info">${this.total} total</span>
        </div>

        ${this.loading ? html`<div class="alx-loading"><span class="alx-spinner"></span> Loading...</div>` : nothing}

        ${!this.loading ? html`
          ${this.staff.length === 0 ? html`<div class="alx-empty">No staff members found.</div>` : html`
            <table>
              <thead>
                <tr>
                  <th>Name</th>
                  <th>Email</th>
                  <th>Role</th>
                  <th>Status</th>
                  <th>Permissions</th>
                  <th>Last Login</th>
                  <th>Actions</th>
                </tr>
              </thead>
              <tbody>
                ${this.staff.map(s => html`
                  <tr>
                    <td>${s.name}</td>
                    <td>${s.email}</td>
                    <td>
                      <span class="alx-badge ${s.role === 'owner' ? 'alx-badge-info' : 'alx-badge-muted'}">${s.role}</span>
                    </td>
                    <td>
                      <span class="${this.statusBadgeClass(s.status)}">${s.status}</span>
                    </td>
                    <td>${s.permissions.length}</td>
                    <td>${this.formatDate(s.lastLoginAt)}</td>
                    <td>
                      <div class="actions">
                        <button class="alx-btn-sm" @click=${() => this.onEditPermissions(String(s._id))}>Permissions</button>
                        <button class="alx-btn-sm" @click=${() => this.onResetPassword(String(s._id))}>Reset PW</button>
                        <button class="alx-btn-sm ${s.status === 'active' ? 'alx-btn-danger' : 'alx-btn-success'}"
                          @click=${() => this.onToggleStatus(String(s._id), s.status)}>
                          ${s.status === 'active' ? 'Deactivate' : 'Activate'}
                        </button>
                      </div>
                    </td>
                  </tr>
                `)}
              </tbody>
            </table>

            ${this.totalPages > 1 ? html`
              <div class="pagination">
                <button class="alx-btn-sm" ?disabled=${this.page <= 1} @click=${this.prevPage}>Prev</button>
                <span class="page-info">Page ${this.page} of ${this.totalPages}</span>
                <button class="alx-btn-sm" ?disabled=${this.page >= this.totalPages} @click=${this.nextPage}>Next</button>
              </div>
            ` : nothing}
          `}
        ` : nothing}
      </div>
    `;
  }
}

safeRegister('alx-staff-list', AlxStaffList);
