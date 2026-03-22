import { LitElement, html, css, nothing } from 'lit';
import { state } from 'lit/decorators.js';
import { safeRegister } from '../utils/safe-register.js';
import { StaffApiClient } from '../api/staff-api-client.js';
import type { IPermissionGroup, IPermissionEntry } from '@astralibx/staff-types';
import {
  alxStaffResetStyles,
  alxStaffThemeStyles,
  alxStaffDensityStyles,
  alxStaffButtonStyles,
  alxStaffInputStyles,
  alxStaffCardStyles,
  alxStaffLoadingStyles,
} from '../styles/shared.js';

interface NewEntry {
  key: string;
  label: string;
  type: 'view' | 'edit' | 'action';
}

export class AlxPermissionGroupEditor extends LitElement {
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

      .group-body {
        padding: 0.75rem;
      }

      .entry-list {
        margin-bottom: 0.75rem;
      }

      .entry-row {
        display: flex;
        align-items: center;
        gap: 0.5rem;
        padding: 0.3rem 0;
        border-bottom: 1px solid color-mix(in srgb, var(--alx-border) 40%, transparent);
        font-size: 0.8125rem;
      }

      .entry-key {
        font-family: monospace;
        font-size: 0.75rem;
        color: var(--alx-primary);
        flex: 0 0 auto;
      }

      .entry-label {
        flex: 1;
        color: var(--alx-text);
      }

      .entry-type {
        font-size: 0.6875rem;
        color: var(--alx-text-muted);
        flex: 0 0 auto;
        text-transform: uppercase;
      }

      .add-entry-form {
        display: grid;
        grid-template-columns: 1fr 1fr auto auto;
        gap: 0.375rem;
        align-items: end;
        padding-top: 0.5rem;
        border-top: 1px solid color-mix(in srgb, var(--alx-border) 60%, transparent);
      }

      .add-entry-form select {
        width: auto;
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

  // Per-group new entry state (keyed by groupId)
  @state() private newEntries: Record<string, NewEntry> = {};

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

  private getNewEntry(groupId: string): NewEntry {
    return this.newEntries[groupId] ?? { key: '', label: '', type: 'view' };
  }

  private setNewEntry(groupId: string, partial: Partial<NewEntry>) {
    this.newEntries = {
      ...this.newEntries,
      [groupId]: { ...this.getNewEntry(groupId), ...partial },
    };
  }

  private async addEntry(group: IPermissionGroup) {
    const entry = this.getNewEntry(group.groupId);
    if (!entry.key.trim() || !entry.label.trim()) return;

    const updated: IPermissionEntry[] = [
      ...group.permissions,
      { key: entry.key.trim(), label: entry.label.trim(), type: entry.type },
    ];

    try {
      const result = await StaffApiClient.updatePermissionGroup(group.groupId, {
        permissions: updated,
      });
      this.groups = this.groups.map(g => (g.groupId === group.groupId ? result : g));
      this.newEntries = { ...this.newEntries, [group.groupId]: { key: '', label: '', type: 'view' } };
      this.dispatchEvent(new CustomEvent('group-updated', { detail: { group: result }, bubbles: true, composed: true }));
    } catch (e) {
      this.error = e instanceof Error ? e.message : 'Failed to add entry';
    }
  }

  private async removeEntry(group: IPermissionGroup, entryKey: string) {
    const updated = group.permissions.filter(p => p.key !== entryKey);
    try {
      const result = await StaffApiClient.updatePermissionGroup(group.groupId, {
        permissions: updated,
      });
      this.groups = this.groups.map(g => (g.groupId === group.groupId ? result : g));
      this.dispatchEvent(new CustomEvent('group-updated', { detail: { group: result }, bubbles: true, composed: true }));
    } catch (e) {
      this.error = e instanceof Error ? e.message : 'Failed to remove entry';
    }
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
          const entry = this.getNewEntry(group.groupId);
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
                <div class="group-body">
                  <div class="entry-list">
                    ${group.permissions.length === 0 ? html`
                      <div style="font-size:0.75rem;color:var(--alx-text-muted);padding:0.25rem 0;">No permissions yet.</div>
                    ` : group.permissions.map(p => html`
                      <div class="entry-row">
                        <span class="entry-key">${p.key}</span>
                        <span class="entry-label">${p.label}</span>
                        <span class="entry-type">${p.type}</span>
                        <button class="alx-btn-icon danger alx-btn-sm"
                          @click=${() => this.removeEntry(group, p.key)}>x</button>
                      </div>
                    `)}
                  </div>

                  <div class="add-entry-form">
                    <div class="form-group" style="margin:0;">
                      <label>Key</label>
                      <input type="text" .value=${entry.key}
                        @input=${(e: Event) => this.setNewEntry(group.groupId, { key: (e.target as HTMLInputElement).value })}
                        placeholder="e.g. contacts.view" />
                    </div>
                    <div class="form-group" style="margin:0;">
                      <label>Label</label>
                      <input type="text" .value=${entry.label}
                        @input=${(e: Event) => this.setNewEntry(group.groupId, { label: (e.target as HTMLInputElement).value })}
                        placeholder="e.g. View Contacts" />
                    </div>
                    <div class="form-group" style="margin:0;">
                      <label>Type</label>
                      <select .value=${entry.type}
                        @change=${(e: Event) => this.setNewEntry(group.groupId, { type: (e.target as HTMLSelectElement).value as 'view' | 'edit' | 'action' })}>
                        <option value="view">view</option>
                        <option value="edit">edit</option>
                        <option value="action">action</option>
                      </select>
                    </div>
                    <button class="alx-btn-sm alx-btn-primary" style="align-self:flex-end;"
                      @click=${() => this.addEntry(group)}>Add</button>
                  </div>
                </div>
              ` : nothing}
            </div>
          `;
        }) : nothing}
      </div>
    `;
  }
}

safeRegister('alx-permission-group-editor', AlxPermissionGroupEditor);
