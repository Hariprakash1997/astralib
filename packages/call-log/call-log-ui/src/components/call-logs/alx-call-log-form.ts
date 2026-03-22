import { LitElement, html, css, nothing } from 'lit';
import { property, state } from 'lit/decorators.js';
import type { IPipeline, ICallLog } from '@astralibx/call-log-types';
import { safeRegister } from '../../utils/safe-register.js';
import { CallLogApiClient } from '../../api/call-log-api-client.js';

export class AlxCallLogForm extends LitElement {
  static styles = css`
    :host { display: block; font-family: inherit; }
    .overlay { position: fixed; inset: 0; background: rgba(0,0,0,0.4); z-index: 100; display: flex; align-items: flex-start; justify-content: flex-end; }
    .drawer { width: 420px; max-width: 100%; height: 100vh; background: var(--alx-surface, #fff); box-shadow: -4px 0 20px rgba(0,0,0,0.15); display: flex; flex-direction: column; overflow-y: auto; }
    .drawer-header { display: flex; align-items: center; justify-content: space-between; padding: 1rem 1.25rem; border-bottom: 1px solid var(--alx-border, #e2e8f0); }
    .drawer-header h3 { margin: 0; font-size: 1rem; font-weight: 600; }
    .close-btn { background: none; border: none; font-size: 1.25rem; cursor: pointer; color: var(--alx-text-muted, #64748b); padding: 0; }
    .form-body { padding: 1.25rem; display: flex; flex-direction: column; gap: 1rem; flex: 1; }
    .form-footer { padding: 1rem 1.25rem; border-top: 1px solid var(--alx-border, #e2e8f0); display: flex; gap: 0.5rem; justify-content: flex-end; }
    label { display: flex; flex-direction: column; gap: 0.25rem; font-size: 0.8rem; font-weight: 500; }
    input, select, textarea { padding: 0.4rem 0.5rem; border: 1px solid var(--alx-border, #e2e8f0); border-radius: 6px; font-size: 0.875rem; font-family: inherit; width: 100%; box-sizing: border-box; }
    textarea { resize: vertical; min-height: 80px; }
    .form-row { display: grid; grid-template-columns: 1fr 1fr; gap: 0.75rem; }
    button { padding: 0.4rem 0.875rem; font-size: 0.8rem; border-radius: 6px; border: 1px solid var(--alx-border, #e2e8f0); cursor: pointer; background: var(--alx-surface, #fff); font-family: inherit; }
    button.primary { background: #3b82f6; color: #fff; border-color: #3b82f6; }
    button:disabled { opacity: 0.5; cursor: not-allowed; }
    .error { color: #dc2626; font-size: 0.8rem; background: #fee2e2; padding: 0.5rem; border-radius: 4px; }
    .hint { font-size: 0.7rem; color: var(--alx-text-muted, #64748b); }
    .contact-search-wrap { position: relative; }
    .contact-dropdown { position: absolute; top: 100%; left: 0; right: 0; background: var(--alx-surface, #fff); border: 1px solid var(--alx-border, #e2e8f0); border-radius: 6px; box-shadow: 0 4px 12px rgba(0,0,0,0.1); z-index: 200; max-height: 180px; overflow-y: auto; }
    .contact-option { padding: 0.4rem 0.6rem; font-size: 0.8rem; cursor: pointer; border-bottom: 1px solid var(--alx-border, #e2e8f0); }
    .contact-option:last-child { border-bottom: none; }
    .contact-option:hover { background: var(--alx-surface-alt, #f8fafc); }
    .contact-option-name { font-weight: 500; }
    .contact-option-meta { font-size: 0.7rem; color: var(--alx-text-muted, #64748b); }
    .new-contact-banner { background: #eff6ff; border: 1px solid #bfdbfe; border-radius: 6px; padding: 0.4rem 0.6rem; font-size: 0.75rem; color: #1e40af; }
    .toggle-btn { padding: 0.25rem 0.6rem; font-size: 0.75rem; border-radius: 4px; border: 1px solid var(--alx-border, #e2e8f0); cursor: pointer; background: var(--alx-surface, #fff); font-family: inherit; }
    .toggle-btn.active { background: #eff6ff; color: #1e40af; border-color: #93c5fd; }
  `;

  @property({ type: Boolean }) open = false;
  @property({ type: String }) callLogId = '';

  @state() private pipelines: IPipeline[] = [];
  @state() private loading = false;
  @state() private saving = false;
  @state() private error = '';

  // form fields
  @state() private fContactName = '';
  @state() private fContactId = '';
  @state() private fPhone = '';
  @state() private fEmail = '';
  @state() private fDirection = 'inbound';
  @state() private fPipelineId = '';
  @state() private fPriority = 'medium';
  @state() private fAgentId = '';
  @state() private fCallDate = new Date().toISOString().split('T')[0]!;
  @state() private fTags = '';
  @state() private fCategory = '';
  @state() private fFollowUpDate = '';
  @state() private fNote = '';

  // contact search
  @state() private contactSearchValue = '';
  @state() private contactSearchResults: ICallLog[] = [];
  @state() private showContactDropdown = false;
  @state() private isNewContact = false;

  private api = new CallLogApiClient();
  private searchDebounceTimer: ReturnType<typeof setTimeout> | null = null;

  connectedCallback() {
    super.connectedCallback();
    this.loadPipelines();
  }

  updated(changed: Map<PropertyKey, unknown>) {
    if (changed.has('open') && this.open) {
      this.error = '';
      if (this.callLogId) this.loadExisting();
    }
  }

  async loadPipelines() {
    try {
      this.pipelines = await this.api.listPipelines({ isActive: true });
    } catch {
      // non-fatal — pipelines list just won't populate
    }
  }

  async loadExisting() {
    this.loading = true;
    try {
      const c = await this.api.getCallLog(this.callLogId);
      this.fContactName = c.contactRef.displayName;
      this.fContactId = c.contactRef.externalId;
      this.fPhone = c.contactRef.phone ?? '';
      this.fEmail = c.contactRef.email ?? '';
      this.fDirection = c.direction;
      this.fPipelineId = c.pipelineId;
      this.fPriority = c.priority;
      this.fAgentId = c.agentId;
      this.fTags = c.tags.join(', ');
      this.fCategory = c.category ?? '';
      this.fFollowUpDate = c.nextFollowUpDate
        ? new Date(c.nextFollowUpDate).toISOString().split('T')[0]!
        : '';
    } catch (e) {
      this.error = e instanceof Error ? e.message : 'Failed to load';
    } finally {
      this.loading = false;
    }
  }

  private resetForm() {
    this.fContactName = ''; this.fContactId = ''; this.fPhone = ''; this.fEmail = '';
    this.fDirection = 'inbound'; this.fPipelineId = ''; this.fPriority = 'medium';
    this.fAgentId = ''; this.fCallDate = new Date().toISOString().split('T')[0]!;
    this.fTags = ''; this.fCategory = ''; this.fFollowUpDate = ''; this.fNote = '';
    this.contactSearchValue = ''; this.contactSearchResults = []; this.showContactDropdown = false; this.isNewContact = false;
    this.error = '';
  }

  private onContactSearchInput(value: string) {
    this.contactSearchValue = value;
    if (this.searchDebounceTimer) clearTimeout(this.searchDebounceTimer);
    if (!value.trim()) { this.contactSearchResults = []; this.showContactDropdown = false; return; }
    this.searchDebounceTimer = setTimeout(async () => {
      try {
        const byName = await this.api.listCallLogs({ limit: 10 });
        // filter client-side by name contains value (server may not support contactName filter)
        const results = (byName.data ?? []).filter(c =>
          c.contactRef.displayName.toLowerCase().includes(value.toLowerCase()) ||
          (c.contactRef.phone ?? '').includes(value) ||
          (c.contactRef.email ?? '').toLowerCase().includes(value.toLowerCase())
        );
        this.contactSearchResults = results.slice(0, 8);
        this.showContactDropdown = this.contactSearchResults.length > 0;
      } catch { this.contactSearchResults = []; }
    }, 300);
  }

  private onContactSelect(c: ICallLog) {
    this.fContactName = c.contactRef.displayName;
    this.fContactId = c.contactRef.externalId;
    this.fPhone = c.contactRef.phone ?? '';
    this.fEmail = c.contactRef.email ?? '';
    this.contactSearchValue = c.contactRef.displayName;
    this.showContactDropdown = false;
    this.isNewContact = false;
  }

  private async onSave() {
    if (!this.fContactName.trim() || !this.fContactId.trim() || !this.fPipelineId || !this.fAgentId.trim()) {
      this.error = 'Contact name, ID, pipeline, and agent ID are required.';
      return;
    }
    this.saving = true;
    this.error = '';
    try {
      const tags = this.fTags.split(',').map(t => t.trim()).filter(Boolean);
      if (this.callLogId) {
        await this.api.updateCallLog(this.callLogId, {
          priority: this.fPriority,
          tags,
          category: this.fCategory || undefined,
          nextFollowUpDate: this.fFollowUpDate || undefined,
        });
      } else {
        await this.api.createCallLog({
          pipelineId: this.fPipelineId,
          contactRef: {
            externalId: this.fContactId,
            displayName: this.fContactName,
            phone: this.fPhone || undefined,
            email: this.fEmail || undefined,
          },
          direction: this.fDirection,
          agentId: this.fAgentId,
          callDate: this.fCallDate || undefined,
          priority: this.fPriority,
          tags,
          category: this.fCategory || undefined,
          nextFollowUpDate: this.fFollowUpDate || undefined,
          initialNote: this.fNote || undefined,
        });
      }
      this.resetForm();
      this.dispatchEvent(new CustomEvent('call-log-saved', { bubbles: true, composed: true }));
    } catch (e) {
      this.error = e instanceof Error ? e.message : 'Save failed';
    } finally {
      this.saving = false;
    }
  }

  private onClose() {
    this.resetForm();
    this.dispatchEvent(new CustomEvent('drawer-close', { bubbles: true, composed: true }));
  }

  render() {
    if (!this.open) return nothing;

    return html`
      <div class="overlay" @click=${(e: Event) => { if (e.target === e.currentTarget) this.onClose(); }}>
        <div class="drawer">
          <div class="drawer-header">
            <h3>${this.callLogId ? 'Edit Call Log' : 'New Call Log'}</h3>
            <button class="close-btn" @click=${this.onClose}>&times;</button>
          </div>

          ${this.loading ? html`<div style="padding:1rem;color:#64748b;">Loading...</div>` : ''}

          ${!this.loading ? html`
            <div class="form-body">
              ${this.error ? html`<div class="error">${this.error}</div>` : ''}

              ${!this.callLogId ? html`
                <label>Search Existing Contact
                  <div class="contact-search-wrap">
                    <input type="text" placeholder="Type name, phone or email..."
                      .value=${this.contactSearchValue}
                      @input=${(e: Event) => this.onContactSearchInput((e.target as HTMLInputElement).value)}
                      @focus=${() => { if (this.contactSearchResults.length > 0) this.showContactDropdown = true; }}
                      @blur=${() => setTimeout(() => { this.showContactDropdown = false; }, 150)} />
                    ${this.showContactDropdown ? html`
                      <div class="contact-dropdown">
                        ${this.contactSearchResults.map(c => html`
                          <div class="contact-option" @mousedown=${() => this.onContactSelect(c)}>
                            <div class="contact-option-name">${c.contactRef.displayName}</div>
                            <div class="contact-option-meta">${c.contactRef.phone ?? c.contactRef.email ?? c.contactRef.externalId}</div>
                          </div>
                        `)}
                      </div>
                    ` : nothing}
                  </div>
                </label>
                <div style="display:flex;align-items:center;gap:0.5rem;">
                  <button type="button" class="toggle-btn ${this.isNewContact ? 'active' : ''}"
                    @click=${() => this.isNewContact = !this.isNewContact}>
                    ${this.isNewContact ? 'Cancel New Contact' : '+ New Contact'}
                  </button>
                  ${this.isNewContact ? html`
                    <div class="new-contact-banner">This contact will be registered through your platform's contact adapter.</div>
                  ` : nothing}
                </div>
              ` : nothing}

              <div class="form-row">
                <label>Contact Name *
                  <input type="text" .value=${this.fContactName}
                    @input=${(e: Event) => this.fContactName = (e.target as HTMLInputElement).value} />
                </label>
                <label>Contact ID *
                  <input type="text" .value=${this.fContactId}
                    @input=${(e: Event) => this.fContactId = (e.target as HTMLInputElement).value} />
                </label>
              </div>

              <div class="form-row">
                <label>Phone
                  <input type="tel" .value=${this.fPhone}
                    @input=${(e: Event) => this.fPhone = (e.target as HTMLInputElement).value} />
                </label>
                <label>Email
                  <input type="email" .value=${this.fEmail}
                    @input=${(e: Event) => this.fEmail = (e.target as HTMLInputElement).value} />
                </label>
              </div>

              <div class="form-row">
                <label>Direction *
                  <select .value=${this.fDirection} @change=${(e: Event) => this.fDirection = (e.target as HTMLSelectElement).value}>
                    <option value="inbound">Inbound</option>
                    <option value="outbound">Outbound</option>
                  </select>
                </label>
                <label>Priority *
                  <select .value=${this.fPriority} @change=${(e: Event) => this.fPriority = (e.target as HTMLSelectElement).value}>
                    <option value="low">Low</option>
                    <option value="medium">Medium</option>
                    <option value="high">High</option>
                    <option value="urgent">Urgent</option>
                  </select>
                </label>
              </div>

              ${!this.callLogId ? html`
                <label>Call Date
                  <input type="date" .value=${this.fCallDate}
                    @change=${(e: Event) => this.fCallDate = (e.target as HTMLInputElement).value} />
                </label>
              ` : ''}

              <label>Pipeline *
                <select .value=${this.fPipelineId} @change=${(e: Event) => this.fPipelineId = (e.target as HTMLSelectElement).value}>
                  <option value="">— Select Pipeline —</option>
                  ${this.pipelines.map(p => html`<option value=${p.pipelineId}>${p.name}</option>`)}
                </select>
              </label>

              <label>Agent ID *
                <input type="text" .value=${this.fAgentId}
                  @input=${(e: Event) => this.fAgentId = (e.target as HTMLInputElement).value} />
              </label>

              <label>Tags
                <input type="text" placeholder="comma-separated" .value=${this.fTags}
                  @input=${(e: Event) => this.fTags = (e.target as HTMLInputElement).value} />
                <span class="hint">e.g. sales, urgent, callback</span>
              </label>

              <label>Category
                <input type="text" .value=${this.fCategory}
                  @input=${(e: Event) => this.fCategory = (e.target as HTMLInputElement).value} />
              </label>

              <label>Follow-Up Date
                <input type="date" .value=${this.fFollowUpDate}
                  @change=${(e: Event) => this.fFollowUpDate = (e.target as HTMLInputElement).value} />
              </label>

              ${!this.callLogId ? html`
                <label>Initial Note
                  <textarea .value=${this.fNote}
                    @input=${(e: Event) => this.fNote = (e.target as HTMLTextAreaElement).value}
                    placeholder="Optional opening note..."></textarea>
                </label>
              ` : ''}
            </div>

            <div class="form-footer">
              <button @click=${this.onClose}>Cancel</button>
              <button class="primary" ?disabled=${this.saving} @click=${this.onSave}>
                ${this.saving ? 'Saving...' : 'Save'}
              </button>
            </div>
          ` : ''}
        </div>
      </div>
    `;
  }
}

safeRegister('alx-call-log-form', AlxCallLogForm);
