import { LitElement, html, css } from 'lit';
import { property, state } from 'lit/decorators.js';
import type { ITimelineEntry } from '@astralibx/call-log-types';
import { TimelineEntryType } from '@astralibx/call-log-types';
import { safeRegister } from '../../utils/safe-register.js';
import { CallLogApiClient } from '../../api/call-log-api-client.js';

export class AlxCallTimeline extends LitElement {
  static styles = css`
    :host { display: block; font-family: inherit; }
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
    .entry-header { display: flex; align-items: baseline; gap: 0.5rem; }
    .entry-type { font-size: 0.75rem; font-weight: 600; }
    .entry-time { font-size: 0.7rem; color: var(--alx-text-muted, #64748b); }
    .entry-author { font-size: 0.75rem; color: var(--alx-text-muted, #64748b); }
    .entry-content { font-size: 0.8rem; margin-top: 0.25rem; white-space: pre-wrap; }
    .add-note { display: flex; gap: 0.5rem; margin-top: 1rem; align-items: flex-start; }
    textarea { flex: 1; padding: 0.4rem 0.5rem; border: 1px solid var(--alx-border, #e2e8f0); border-radius: 6px; font-size: 0.8rem; font-family: inherit; resize: vertical; min-height: 60px; }
    button { padding: 0.375rem 0.75rem; font-size: 0.8rem; border-radius: 6px; border: 1px solid #3b82f6; cursor: pointer; background: #3b82f6; color: #fff; font-family: inherit; white-space: nowrap; }
    button:disabled { opacity: 0.5; cursor: not-allowed; }
    .pagination { display: flex; gap: 0.5rem; align-items: center; padding-top: 0.75rem; }
    .page-btn { background: var(--alx-surface, #fff); color: var(--alx-text, #0f172a); border-color: var(--alx-border, #e2e8f0); }
    .error { color: #dc2626; font-size: 0.8rem; }
    .loading, .empty { color: var(--alx-text-muted, #64748b); font-size: 0.8rem; padding: 0.5rem 0; }
  `;

  @property({ type: String }) callLogId = '';
  @property({ type: String }) authorId = '';
  @property({ type: String }) authorName = '';

  @state() private entries: ITimelineEntry[] = [];
  @state() private loading = false;
  @state() private error = '';
  @state() private page = 1;
  @state() private totalPages = 1;
  @state() private noteText = '';
  @state() private saving = false;

  private api = new CallLogApiClient();

  connectedCallback() {
    super.connectedCallback();
    if (this.callLogId) this.loadTimeline();
  }

  updated(changed: Map<PropertyKey, unknown>) {
    if (changed.has('callLogId') && this.callLogId) {
      this.page = 1;
      this.loadTimeline();
    }
  }

  async loadTimeline() {
    this.loading = true;
    this.error = '';
    try {
      const result = await this.api.getTimeline(this.callLogId, this.page, 20);
      this.entries = result.data ?? [];
      this.totalPages = result.totalPages ?? 1;
    } catch (e) {
      this.error = e instanceof Error ? e.message : 'Failed to load timeline';
    } finally {
      this.loading = false;
    }
  }

  private async onAddNote() {
    if (!this.noteText.trim()) return;
    this.saving = true;
    try {
      await this.api.addNote(this.callLogId, this.noteText, this.authorId || 'unknown', this.authorName || 'Agent');
      this.noteText = '';
      this.page = 1;
      await this.loadTimeline();
    } catch (e) {
      this.error = e instanceof Error ? e.message : 'Failed to add note';
    } finally {
      this.saving = false;
    }
  }

  private getEntryIcon(type: TimelineEntryType): { cls: string; icon: string; label: string } {
    const map: Record<string, { cls: string; icon: string; label: string }> = {
      [TimelineEntryType.Note]: { cls: 'icon-note', icon: '📝', label: 'Note' },
      [TimelineEntryType.StageChange]: { cls: 'icon-stage', icon: '➡', label: 'Stage Change' },
      [TimelineEntryType.Assignment]: { cls: 'icon-assign', icon: '👤', label: 'Assignment' },
      [TimelineEntryType.FollowUpSet]: { cls: 'icon-followup', icon: '📅', label: 'Follow-Up Set' },
      [TimelineEntryType.FollowUpCompleted]: { cls: 'icon-followup', icon: '✅', label: 'Follow-Up Done' },
      [TimelineEntryType.System]: { cls: 'icon-system', icon: '⚙', label: 'System' },
    };
    return map[type] ?? { cls: 'icon-system', icon: '•', label: type };
  }

  private formatTime(d: Date | string): string {
    return new Date(d).toLocaleString(undefined, { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' });
  }

  render() {
    return html`
      ${this.error ? html`<div class="error">${this.error}</div>` : ''}
      ${this.loading ? html`<div class="loading">Loading timeline...</div>` : ''}

      ${!this.loading && this.entries.length === 0
        ? html`<div class="empty">No timeline entries yet.</div>`
        : ''}

      <div class="timeline">
        ${this.entries.map(entry => {
          const info = this.getEntryIcon(entry.type);
          return html`
            <div class="entry">
              <div class="icon ${info.cls}">${info.icon}</div>
              <div class="body">
                <div class="entry-header">
                  <span class="entry-type">${info.label}</span>
                  <span class="entry-time">${this.formatTime(entry.createdAt)}</span>
                  ${entry.authorName ? html`<span class="entry-author">by ${entry.authorName}</span>` : ''}
                </div>
                ${entry.content ? html`<div class="entry-content">${entry.content}</div>` : ''}
                ${entry.fromStageName && entry.toStageName
                  ? html`<div class="entry-content">${entry.fromStageName} → ${entry.toStageName}</div>`
                  : ''}
                ${entry.fromAgentName && entry.toAgentName
                  ? html`<div class="entry-content">${entry.fromAgentName} → ${entry.toAgentName}</div>`
                  : ''}
              </div>
            </div>
          `;
        })}
      </div>

      ${this.totalPages > 1 ? html`
        <div class="pagination">
          <button class="page-btn" ?disabled=${this.page <= 1} @click=${() => { this.page--; this.loadTimeline(); }}>Prev</button>
          <span style="font-size:0.75rem;color:#64748b;">Page ${this.page} of ${this.totalPages}</span>
          <button class="page-btn" ?disabled=${this.page >= this.totalPages} @click=${() => { this.page++; this.loadTimeline(); }}>Next</button>
        </div>
      ` : ''}

      <div class="add-note">
        <textarea placeholder="Add a note..." .value=${this.noteText}
          @input=${(e: Event) => this.noteText = (e.target as HTMLTextAreaElement).value}></textarea>
        <button ?disabled=${this.saving || !this.noteText.trim()} @click=${this.onAddNote}>
          ${this.saving ? '...' : 'Add Note'}
        </button>
      </div>
    `;
  }
}

safeRegister('alx-call-timeline', AlxCallTimeline);
