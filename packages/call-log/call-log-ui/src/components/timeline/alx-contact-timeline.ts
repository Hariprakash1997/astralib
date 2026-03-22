import { LitElement, html, css } from 'lit';
import { property, state } from 'lit/decorators.js';
import type { ITimelineEntry } from '@astralibx/call-log-types';
import { TimelineEntryType } from '@astralibx/call-log-types';
import { safeRegister } from '../../utils/safe-register.js';
import { CallLogApiClient } from '../../api/call-log-api-client.js';

export class AlxContactTimeline extends LitElement {
  static styles = css`
    :host { display: block; font-family: inherit; }
    .card { background: var(--alx-surface, #fff); border: 1px solid var(--alx-border, #e2e8f0); border-radius: 8px; padding: 1rem; }
    .card-header { display: flex; align-items: center; justify-content: space-between; margin-bottom: 1rem; }
    h3 { margin: 0; font-size: 1rem; font-weight: 600; }
    .timeline { display: flex; flex-direction: column; gap: 0; }
    .entry { display: flex; gap: 0.75rem; position: relative; padding-bottom: 1rem; }
    .entry:last-child { padding-bottom: 0; }
    .entry::before { content: ''; position: absolute; left: 15px; top: 28px; bottom: 0; width: 2px; background: var(--alx-border, #e2e8f0); }
    .entry:last-child::before { display: none; }
    .icon { width: 32px; height: 32px; border-radius: 50%; display: flex; align-items: center; justify-content: center; font-size: 0.8rem; flex-shrink: 0; z-index: 1; }
    .icon-note { background: #dbeafe; color: #1e40af; }
    .icon-stage { background: #dcfce7; color: #166534; }
    .icon-assign { background: #fef9c3; color: #92400e; }
    .icon-followup { background: #fce7f3; color: #9d174d; }
    .icon-system { background: #f1f5f9; color: #64748b; }
    .body { flex: 1; }
    .entry-header { display: flex; align-items: baseline; gap: 0.5rem; flex-wrap: wrap; }
    .entry-type { font-size: 0.75rem; font-weight: 600; }
    .entry-time { font-size: 0.7rem; color: var(--alx-text-muted, #64748b); }
    .call-id { font-size: 0.7rem; color: #3b82f6; cursor: pointer; }
    .call-id:hover { text-decoration: underline; }
    .entry-content { font-size: 0.8rem; margin-top: 0.25rem; white-space: pre-wrap; }
    button { padding: 0.35rem 0.75rem; font-size: 0.8rem; border-radius: 6px; border: 1px solid var(--alx-border, #e2e8f0); cursor: pointer; background: var(--alx-surface, #fff); font-family: inherit; }
    .error { color: #dc2626; font-size: 0.8rem; }
    .loading, .empty { color: var(--alx-text-muted, #64748b); font-size: 0.8rem; padding: 0.5rem 0; }
    .stats { display: flex; gap: 1rem; margin-bottom: 0.75rem; flex-wrap: wrap; }
    .stat { font-size: 0.8rem; }
    .stat strong { font-weight: 600; }
  `;

  @property({ type: String }) contactExternalId = '';

  @state() private entries: ITimelineEntry[] = [];
  @state() private loading = false;
  @state() private error = '';

  private api = new CallLogApiClient();

  connectedCallback() {
    super.connectedCallback();
    if (this.contactExternalId) this.load();
  }

  updated(changed: Map<PropertyKey, unknown>) {
    if (changed.has('contactExternalId') && this.contactExternalId) this.load();
  }

  async load() {
    this.loading = true;
    this.error = '';
    try {
      this.entries = await this.api.getContactTimeline(this.contactExternalId);
    } catch (e) {
      this.error = e instanceof Error ? e.message : 'Failed to load contact timeline';
    } finally {
      this.loading = false;
    }
  }

  private getEntryInfo(type: TimelineEntryType): { cls: string; icon: string; label: string } {
    const map: Record<string, { cls: string; icon: string; label: string }> = {
      [TimelineEntryType.Note]: { cls: 'icon-note', icon: '📝', label: 'Note' },
      [TimelineEntryType.StageChange]: { cls: 'icon-stage', icon: '➡', label: 'Stage Change' },
      [TimelineEntryType.Assignment]: { cls: 'icon-assign', icon: '👤', label: 'Assigned' },
      [TimelineEntryType.FollowUpSet]: { cls: 'icon-followup', icon: '📅', label: 'Follow-Up' },
      [TimelineEntryType.FollowUpCompleted]: { cls: 'icon-followup', icon: '✅', label: 'Follow-Up Done' },
      [TimelineEntryType.System]: { cls: 'icon-system', icon: '⚙', label: 'System' },
    };
    return map[type] ?? { cls: 'icon-system', icon: '•', label: type };
  }

  private formatTime(d: Date | string): string {
    return new Date(d).toLocaleString(undefined, { month: 'short', day: 'numeric', year: 'numeric', hour: '2-digit', minute: '2-digit' });
  }

  render() {
    return html`
      <div class="card">
        <div class="card-header">
          <h3>Contact Timeline</h3>
          <button @click=${() => this.load()}>Refresh</button>
        </div>

        ${!this.contactExternalId ? html`<div class="empty">No contact selected.</div>` : ''}

        ${this.error ? html`<div class="error">${this.error}</div>` : ''}
        ${this.loading ? html`<div class="loading">Loading timeline...</div>` : ''}

        ${!this.loading && this.entries.length > 0 ? html`
          <div class="stats">
            <div class="stat"><strong>${this.entries.length}</strong> total events</div>
            <div class="stat"><strong>${this.entries.filter(e => e.type === TimelineEntryType.Note).length}</strong> notes</div>
            <div class="stat"><strong>${this.entries.filter(e => e.type === TimelineEntryType.StageChange).length}</strong> stage changes</div>
          </div>

          <div class="timeline">
            ${this.entries.map(entry => {
              const info = this.getEntryInfo(entry.type);
              return html`
                <div class="entry">
                  <div class="icon ${info.cls}">${info.icon}</div>
                  <div class="body">
                    <div class="entry-header">
                      <span class="entry-type">${info.label}</span>
                      <span class="entry-time">${this.formatTime(entry.createdAt)}</span>
                      ${entry.authorName ? html`<span style="font-size:0.7rem;color:#64748b;">by ${entry.authorName}</span>` : ''}
                    </div>
                    ${entry.content ? html`<div class="entry-content">${entry.content}</div>` : ''}
                    ${entry.fromStageName && entry.toStageName
                      ? html`<div class="entry-content">${entry.fromStageName} → ${entry.toStageName}</div>`
                      : ''}
                  </div>
                </div>
              `;
            })}
          </div>
        ` : ''}

        ${!this.loading && this.entries.length === 0 && this.contactExternalId && !this.error
          ? html`<div class="empty">No timeline entries for this contact.</div>`
          : ''}
      </div>
    `;
  }
}

safeRegister('alx-contact-timeline', AlxContactTimeline);
