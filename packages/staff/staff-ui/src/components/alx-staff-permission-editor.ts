import { LitElement, html, css, nothing } from 'lit';
import { property, state } from 'lit/decorators.js';
import { safeRegister } from '../utils/safe-register.js';
import { StaffApiClient } from '../api/staff-api-client.js';
import type { IStaffSummary, IPermissionGroup } from '@astralibx/staff-types';
import {
  alxStaffResetStyles,
  alxStaffThemeStyles,
  alxStaffDensityStyles,
  alxStaffButtonStyles,
  alxStaffInputStyles,
  alxStaffCardStyles,
  alxStaffLoadingStyles,
} from '../styles/shared.js';

export class AlxStaffPermissionEditor extends LitElement {
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

      .group-section {
        border: 1px solid var(--alx-border);
        border-radius: var(--alx-radius);
        margin-bottom: 0.75rem;
        overflow: hidden;
      }

      .group-header {
        display: flex;
        align-items: center;
        justify-content: space-between;
        padding: 0.5rem 0.75rem;
        background: var(--alx-surface-alt);
        cursor: pointer;
        user-select: none;
      }

      .group-header:hover {
        background: color-mix(in srgb, var(--alx-primary) 6%, var(--alx-surface-alt));
      }

      .group-title {
        font-size: 0.8125rem;
        font-weight: 600;
        color: var(--alx-text);
      }

      .group-actions {
        display: flex;
        gap: 0.375rem;
        align-items: center;
      }

      .group-body {
        padding: 0.625rem 0.75rem;
        display: grid;
        grid-template-columns: repeat(auto-fill, minmax(180px, 1fr));
        gap: 0.375rem;
      }

      .perm-item {
        display: flex;
        align-items: center;
        gap: 0.3rem;
        font-size: 0.8125rem;
        color: var(--alx-text);
      }

      .perm-item input[type="checkbox"] {
        width: auto;
        cursor: pointer;
      }

      .perm-type {
        font-size: 0.6875rem;
        color: var(--alx-text-muted);
        margin-left: 0.15rem;
      }

      .chevron {
        font-size: 0.7rem;
        color: var(--alx-text-muted);
        transition: transform 0.15s;
      }

      .chevron.open { transform: rotate(90deg); }
    `,
  ];

  @property({ type: String }) staffId = '';

  @state() private staff: IStaffSummary | null = null;
  @state() private groups: IPermissionGroup[] = [];
  @state() private selected: Set<string> = new Set();
  @state() private expanded: Set<string> = new Set();
  @state() private loading = false;
  @state() private saving = false;
  @state() private error = '';
  @state() private success = '';

  connectedCallback() {
    super.connectedCallback();
    if (this.staffId) this.loadData();
  }

  updated(changed: Map<string, unknown>) {
    if (changed.has('staffId') && this.staffId) {
      this.loadData();
    }
  }

  private async loadData() {
    this.loading = true;
    this.error = '';
    try {
      const [staffResult, groupsResult] = await Promise.all([
        StaffApiClient.listStaff(),
        StaffApiClient.listPermissionGroups(),
      ]);
      const found = staffResult.staff.find(s => String(s._id) === this.staffId);
      if (!found) throw new Error('Staff not found');
      this.staff = found;
      this.selected = new Set(found.permissions);
      this.groups = [...groupsResult].sort((a, b) => a.sortOrder - b.sortOrder);
      // Expand all groups by default
      this.expanded = new Set(this.groups.map(g => g.groupId));
    } catch (e) {
      this.error = e instanceof Error ? e.message : 'Failed to load data';
    } finally {
      this.loading = false;
    }
  }

  private toggleExpand(groupId: string) {
    const next = new Set(this.expanded);
    if (next.has(groupId)) next.delete(groupId);
    else next.add(groupId);
    this.expanded = next;
  }

  private togglePerm(key: string, checked: boolean) {
    const next = new Set(this.selected);
    if (checked) {
      next.add(key);
      // Edit auto-checks matching view
      if (key.endsWith(':edit')) {
        const prefix = key.substring(0, key.lastIndexOf(':'));
        next.add(`${prefix}:view`);
      }
    } else {
      next.delete(key);
    }
    this.selected = next;
  }

  private selectAll(group: IPermissionGroup) {
    const next = new Set(this.selected);
    group.permissions.forEach(p => next.add(p.key));
    this.selected = next;
  }

  private clearAll(group: IPermissionGroup) {
    const next = new Set(this.selected);
    group.permissions.forEach(p => next.delete(p.key));
    this.selected = next;
  }

  private async onSave() {
    this.saving = true;
    this.error = '';
    this.success = '';
    try {
      await StaffApiClient.updatePermissions(this.staffId, Array.from(this.selected));
      this.success = 'Permissions updated successfully.';
      setTimeout(() => (this.success = ''), 3000);
      this.dispatchEvent(new CustomEvent('permissions-updated', {
        detail: { staffId: this.staffId, permissions: Array.from(this.selected) },
        bubbles: true,
        composed: true,
      }));
    } catch (e) {
      this.error = e instanceof Error ? e.message : 'Failed to save permissions';
    } finally {
      this.saving = false;
    }
  }

  render() {
    return html`
      <div class="alx-card">
        <div class="alx-card-header">
          <h3>Edit Permissions${this.staff ? html` — ${this.staff.name}` : nothing}</h3>
          <button class="alx-btn-primary alx-btn-sm" ?disabled=${this.saving || this.loading}
            @click=${this.onSave}>${this.saving ? 'Saving...' : 'Save'}</button>
        </div>

        ${this.error ? html`<div class="alx-error">${this.error}</div>` : nothing}
        ${this.success ? html`<div class="alx-success-msg">${this.success}</div>` : nothing}
        ${this.loading ? html`<div class="alx-loading"><span class="alx-spinner"></span> Loading...</div>` : nothing}

        ${!this.loading ? this.groups.map(group => {
          const isOpen = this.expanded.has(group.groupId);
          return html`
            <div class="group-section">
              <div class="group-header" @click=${() => this.toggleExpand(group.groupId)}>
                <span class="group-title">${group.label}</span>
                <div class="group-actions" @click=${(e: Event) => e.stopPropagation()}>
                  <button class="alx-btn-sm" @click=${() => this.selectAll(group)}>All</button>
                  <button class="alx-btn-sm" @click=${() => this.clearAll(group)}>Clear</button>
                  <span class="chevron ${isOpen ? 'open' : ''}">▶</span>
                </div>
              </div>
              ${isOpen ? html`
                <div class="group-body">
                  ${group.permissions.map(p => html`
                    <label class="perm-item">
                      <input type="checkbox"
                        .checked=${this.selected.has(p.key)}
                        @change=${(e: Event) => this.togglePerm(p.key, (e.target as HTMLInputElement).checked)} />
                      ${p.label}
                      <span class="perm-type">(${p.type})</span>
                    </label>
                  `)}
                </div>
              ` : nothing}
            </div>
          `;
        }) : nothing}
      </div>
    `;
  }
}

safeRegister('alx-staff-permission-editor', AlxStaffPermissionEditor);
