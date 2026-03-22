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
import './alx-permission-entry-editor.js';

export class AlxPermissionGroupList extends LitElement {
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
        font-size: 0.875rem;
        font-weight: 600;
        color: var(--alx-text);
      }

      .group-sort {
        font-size: 0.7rem;
        color: var(--alx-text-muted);
        margin-left: 0.5rem;
      }

      .group-actions {
        display: flex;
        gap: 0.25rem;
      }

      .new-group-form {
        padding: 1rem;
        background: var(--alx-surface-alt);
        border: 1px solid var(--alx-border);
        border-radius: var(--alx-radius);
        margin-bottom: 1rem;
      }

      .new-group-form h4 {
        font-size: 0.875rem;
        font-weight: 600;
        margin-bottom: 0.75rem;
        color: var(--alx-text);
      }

      .chevron {
        font-size: 0.7rem;
        color: var(--alx-text-muted);
        transition: transform 0.15s;
      }

      .chevron.open { transform: rotate(90deg); }

      .confirm-delete {
        display: flex;
        align-items: center;
        gap: 0.5rem;
        padding: 0.375rem 0.5rem;
        background: color-mix(in srgb, var(--alx-danger) 8%, transparent);
        border: 1px solid color-mix(in srgb, var(--alx-danger) 20%, transparent);
        border-radius: var(--alx-radius);
        font-size: 0.75rem;
        color: var(--alx-danger);
        margin-top: 0.5rem;
      }
    `,
  ];

  @state() private groups: IPermissionGroup[] = [];
  @state() private expanded: Set<string> = new Set();
  @state() private loading = false;
  @state() private error = '';
  @state() private success = '';

  // New group form state
  @state() private newGroupId = '';
  @state() private newGroupLabel = '';
  @state() private newGroupSortOrder = 0;
  @state() private creatingGroup = false;
  @state() private showNewGroupForm = false;

  // Per-group delete confirmation
  @state() private confirmDeleteGroupId = '';

  connectedCallback() {
    super.connectedCallback();
    this.loadGroups();
  }

  private async loadGroups() {
    this.loading = true;
    this.error = '';
    try {
      this.groups = (await StaffApiClient.listPermissionGroups()).sort(
        (a, b) => a.sortOrder - b.sortOrder,
      );
    } catch (e) {
      this.error = e instanceof Error ? e.message : 'Failed to load permission groups';
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

  private async createGroup() {
    if (!this.newGroupId.trim() || !this.newGroupLabel.trim()) return;
    this.creatingGroup = true;
    this.error = '';
    try {
      const result = await StaffApiClient.createPermissionGroup({
        groupId: this.newGroupId.trim(),
        label: this.newGroupLabel.trim(),
        permissions: [],
        sortOrder: this.newGroupSortOrder,
      });
      this.groups = [...this.groups, result].sort((a, b) => a.sortOrder - b.sortOrder);
      this.newGroupId = '';
      this.newGroupLabel = '';
      this.newGroupSortOrder = 0;
      this.showNewGroupForm = false;
      this.dispatchEvent(new CustomEvent('group-created', { detail: { group: result }, bubbles: true, composed: true }));
    } catch (e) {
      this.error = e instanceof Error ? e.message : 'Failed to create group';
    } finally {
      this.creatingGroup = false;
    }
  }

  private async deleteGroup(groupId: string) {
    try {
      await StaffApiClient.deletePermissionGroup(groupId);
      this.groups = this.groups.filter(g => g.groupId !== groupId);
      this.confirmDeleteGroupId = '';
      this.dispatchEvent(new CustomEvent('group-deleted', { detail: { groupId }, bubbles: true, composed: true }));
    } catch (e) {
      this.error = e instanceof Error ? e.message : 'Failed to delete group';
    }
  }

  private handleGroupUpdated(e: CustomEvent) {
    const { groupId, group } = e.detail as { groupId: string; group: IPermissionGroup };
    this.groups = this.groups.map(g => (g.groupId === groupId ? group : g));
  }

  render() {
    return html`
      <div class="alx-card">
        <div class="alx-card-header">
          <h3>Permission Groups</h3>
          <button class="alx-btn-primary alx-btn-sm"
            @click=${() => this.showNewGroupForm = !this.showNewGroupForm}>
            ${this.showNewGroupForm ? 'Cancel' : '+ New Group'}
          </button>
        </div>

        ${this.error ? html`<div class="alx-error">${this.error}</div>` : nothing}
        ${this.success ? html`<div class="alx-success-msg">${this.success}</div>` : nothing}
        ${this.loading ? html`<div class="alx-loading"><span class="alx-spinner"></span> Loading...</div>` : nothing}

        ${this.showNewGroupForm ? html`
          <div class="new-group-form">
            <h4>Create New Group</h4>
            <div class="form-row">
              <div class="form-group">
                <label>Group ID</label>
                <input type="text" .value=${this.newGroupId}
                  @input=${(e: Event) => this.newGroupId = (e.target as HTMLInputElement).value}
                  placeholder="e.g. crm" />
              </div>
              <div class="form-group">
                <label>Label</label>
                <input type="text" .value=${this.newGroupLabel}
                  @input=${(e: Event) => this.newGroupLabel = (e.target as HTMLInputElement).value}
                  placeholder="e.g. CRM" />
              </div>
            </div>
            <div class="form-group">
              <label>Sort Order</label>
              <input type="number" .value=${String(this.newGroupSortOrder)}
                @input=${(e: Event) => this.newGroupSortOrder = Number((e.target as HTMLInputElement).value)}
                placeholder="0" style="width:100px;" />
            </div>
            <div class="form-actions">
              <button class="alx-btn-primary alx-btn-sm" ?disabled=${this.creatingGroup}
                @click=${this.createGroup}>
                ${this.creatingGroup ? 'Creating...' : 'Create Group'}
              </button>
            </div>
          </div>
        ` : nothing}

        ${!this.loading ? this.groups.map(group => {
          const isOpen = this.expanded.has(group.groupId);
          return html`
            <div class="group-section">
              <div class="group-header" @click=${() => this.toggleExpand(group.groupId)}>
                <div>
                  <span class="group-title">${group.label}</span>
                  <span class="group-sort">order: ${group.sortOrder}</span>
                </div>
                <div class="group-actions" @click=${(e: Event) => e.stopPropagation()}>
                  <button class="alx-btn-icon danger"
                    @click=${() => this.confirmDeleteGroupId = group.groupId}>🗑</button>
                  <span class="chevron ${isOpen ? 'open' : ''}">▶</span>
                </div>
              </div>

              ${this.confirmDeleteGroupId === group.groupId ? html`
                <div class="confirm-delete" style="margin:0.5rem 0.75rem;">
                  Delete group "${group.label}"?
                  <button class="alx-btn-sm alx-btn-danger" @click=${() => this.deleteGroup(group.groupId)}>Delete</button>
                  <button class="alx-btn-sm" @click=${() => this.confirmDeleteGroupId = ''}>Cancel</button>
                </div>
              ` : nothing}

              ${isOpen ? html`
                <alx-permission-entry-editor
                  .group=${group}
                  @group-updated=${(e: CustomEvent) => this.handleGroupUpdated(e)}
                ></alx-permission-entry-editor>
              ` : nothing}
            </div>
          `;
        }) : nothing}
      </div>
    `;
  }
}

safeRegister('alx-permission-group-list', AlxPermissionGroupList);
