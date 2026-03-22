import { LitElement, html, css, nothing } from 'lit';
import { state, property } from 'lit/decorators.js';
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

export class AlxPermissionEntryEditor extends LitElement {
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
    `,
  ];

  @property({ type: Object }) group!: IPermissionGroup;

  @state() private newEntry: NewEntry = { key: '', label: '', type: 'view' };
  @state() private error = '';

  private async addEntry() {
    if (!this.newEntry.key.trim() || !this.newEntry.label.trim()) return;

    const updated: IPermissionEntry[] = [
      ...this.group.permissions,
      { key: this.newEntry.key.trim(), label: this.newEntry.label.trim(), type: this.newEntry.type },
    ];

    try {
      const result = await StaffApiClient.updatePermissionGroup(this.group.groupId, {
        permissions: updated,
      });
      this.newEntry = { key: '', label: '', type: 'view' };
      this.dispatchEvent(new CustomEvent('group-updated', {
        detail: { groupId: this.group.groupId, group: result },
        bubbles: true,
        composed: true,
      }));
    } catch (e) {
      this.error = e instanceof Error ? e.message : 'Failed to add entry';
    }
  }

  private async removeEntry(entryKey: string) {
    const updated = this.group.permissions.filter(p => p.key !== entryKey);
    try {
      const result = await StaffApiClient.updatePermissionGroup(this.group.groupId, {
        permissions: updated,
      });
      this.dispatchEvent(new CustomEvent('group-updated', {
        detail: { groupId: this.group.groupId, group: result },
        bubbles: true,
        composed: true,
      }));
    } catch (e) {
      this.error = e instanceof Error ? e.message : 'Failed to remove entry';
    }
  }

  render() {
    if (!this.group) return nothing;

    return html`
      <div class="group-body">
        ${this.error ? html`<div class="alx-error">${this.error}</div>` : nothing}

        <div class="entry-list">
          ${this.group.permissions.length === 0 ? html`
            <div style="font-size:0.75rem;color:var(--alx-text-muted);padding:0.25rem 0;">No permissions yet.</div>
          ` : this.group.permissions.map(p => html`
            <div class="entry-row">
              <span class="entry-key">${p.key}</span>
              <span class="entry-label">${p.label}</span>
              <span class="entry-type">${p.type}</span>
              <button class="alx-btn-icon danger alx-btn-sm"
                @click=${() => this.removeEntry(p.key)}>x</button>
            </div>
          `)}
        </div>

        <div class="add-entry-form">
          <div class="form-group" style="margin:0;">
            <label>Key</label>
            <input type="text" .value=${this.newEntry.key}
              @input=${(e: Event) => this.newEntry = { ...this.newEntry, key: (e.target as HTMLInputElement).value }}
              placeholder="e.g. contacts.view" />
          </div>
          <div class="form-group" style="margin:0;">
            <label>Label</label>
            <input type="text" .value=${this.newEntry.label}
              @input=${(e: Event) => this.newEntry = { ...this.newEntry, label: (e.target as HTMLInputElement).value }}
              placeholder="e.g. View Contacts" />
          </div>
          <div class="form-group" style="margin:0;">
            <label>Type</label>
            <select .value=${this.newEntry.type}
              @change=${(e: Event) => this.newEntry = { ...this.newEntry, type: (e.target as HTMLSelectElement).value as 'view' | 'edit' | 'action' }}>
              <option value="view">view</option>
              <option value="edit">edit</option>
              <option value="action">action</option>
            </select>
          </div>
          <button class="alx-btn-sm alx-btn-primary" style="align-self:flex-end;"
            @click=${() => this.addEntry()}>Add</button>
        </div>
      </div>
    `;
  }
}

safeRegister('alx-permission-entry-editor', AlxPermissionEntryEditor);
